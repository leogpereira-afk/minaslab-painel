import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import forge from "npm:node-forge@1.3.1";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET="ml-arquivos";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const strip=(s:string)=>String(s||"").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").trim();
const tag=(xml:string,n:string)=>{const m=xml.match(new RegExp(`<(?:\\w+:)?${n}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${n}>`,`i`));return m?strip(m[1]):""};
const section=(xml:string,n:string)=>{const m=xml.match(new RegExp(`<(?:\\w+:)?${n}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${n}>`,`i`));return m?m[1]:""};
const money=(v:any)=>{const n=Number(String(v||"0").replace(",","."));return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})};
const dateBR=(v:string)=>{const x=String(v||"").slice(0,10);const p=x.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:x};
const docFmt=(v:string)=>{const d=String(v||"").replace(/\D/g,"");if(d.length===14)return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;if(d.length===11)return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;return v||"—"};
function wrap(text:string,max=88){const w=String(text||"").split(/\s+/).filter(Boolean),out:string[]=[];let cur="";for(const x of w){const n=cur?`${cur} ${x}`:x;if(n.length>max&&cur){out.push(cur);cur=x}else cur=n}if(cur)out.push(cur);return out.length?out:["—"]}

async function tentarGateway(chave:string){
  const base=String(Deno.env.get("NFSE_GATEWAY_URL")||"").replace(/\/$/,"");
  const token=String(Deno.env.get("NFSE_GATEWAY_TOKEN")||"");
  if(!base||!token)return null;
  let last="";
  for(let i=0;i<3;i++){
    try{
      const r=await fetch(`${base}/v1/danfse/${encodeURIComponent(chave)}`,{method:"GET",headers:{Authorization:`Bearer ${token}`}});
      const body=await r.json().catch(()=>null);
      if(r.status===404||/rota não encontrada/i.test(String(body?.erro||body?.message||"")))return null;
      if(!r.ok)throw new Error(body?.erro||body?.message||`Falha ao recuperar DANFSe (${r.status}).`);
      const b64=String(body?.pdfBase64||body?.resposta?.pdfBase64||"").replace(/^data:application\/pdf;base64,/i,"");
      if(!b64)return null;
      const bin=atob(b64);const bytes=new Uint8Array(bin.length);for(let j=0;j<bin.length;j++)bytes[j]=bin.charCodeAt(j);return bytes;
    }catch(e){last=e instanceof Error?e.message:String(e);if(i<2)await sleep(350*(i+1));}
  }
  if(/ssl|tls|bad record mac|decryption failed/i.test(last))return null;
  throw new Error(last||"Falha ao recuperar DANFSe.");
}

function abrirCertificadoA1(){
  const b64=String(Deno.env.get("MLAB_NFSE_CERT_PFX_B64")||"").replace(/\s/g,"");
  const senha=String(Deno.env.get("MLAB_NFSE_CERT_PASSWORD")||"");
  if(!b64||!senha)return null;
  const asn1=forge.asn1.fromDer(forge.util.createBuffer(atob(b64),"raw"));
  const p12=forge.pkcs12.pkcs12FromAsn1(asn1,false,senha);
  const cert=(p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[]).find((x:any)=>x.cert)?.cert;
  const protegidas=p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[];
  const abertas=p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[];
  const key=[...protegidas,...abertas].find((x:any)=>x.key)?.key;
  if(!cert||!key)return null;
  return {certChain:forge.pki.certificateToPem(cert),privateKey:forge.pki.privateKeyToPem(key)};
}

async function tentarAdnOficial(chave:string){
  const a1=abrirCertificadoA1(); if(!a1)return null;
  const client=Deno.createHttpClient({certChain:a1.certChain,privateKey:a1.privateKey});
  try{
    for(let i=0;i<4;i++){
      const r=await fetch(`https://adn.nfse.gov.br/danfse/${encodeURIComponent(chave)}`,{method:"GET",client,headers:{Accept:"application/pdf"}} as RequestInit & {client:Deno.HttpClient});
      if(r.ok){const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>4&&String.fromCharCode(...bytes.slice(0,4))==="%PDF")return bytes;}
      if(![404,409,425,429,500,502,503,504].includes(r.status))return null;
      if(i<3)await sleep(750*(i+1));
    }
    return null;
  }catch{return null;}finally{client.close();}
}

async function gerarPdfLocal(xml:string,n:any){
  const b64=(await Deno.readTextFile(new URL("./template-danfse-montes-claros-v1.b64",import.meta.url))).trim();
  const raw=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const pdf=await PDFDocument.load(raw),page=pdf.getPages()[0],font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),H=page.getHeight(),white=rgb(1,1,1),black=rgb(0,0,0);
  const erase=(x,top,w,h)=>page.drawRectangle({x,y:H-top-h,width:w,height:h,color:white});
  const put=(s,x,top,size=8,b=false,max=560)=>page.drawText(String(s||"-"),{x,y:H-top-size,size,font:b?bold:font,color:black,maxWidth:max});
  const lineValue=(s,x,top,w,size=8)=>{const ls=wrap(String(s||"-"),Math.max(8,Math.floor(w/(size*.51))));ls.slice(0,2).forEach((z,i)=>put(z,x,top+i*(size+1),size,false,w));};
  const emit=section(xml,"emit")||section(xml,"prest"),toma=section(xml,"toma"),inf=section(xml,"infNFSe")||xml,dps=section(xml,"infDPS")||xml;
  const chave=String(n.chave_acesso||tag(inf,"chNFSe")||""),numero=String(n.numero_nf||tag(inf,"nNFSe")||"-"),compet=dateBR(tag(dps,"dCompet")||n.data_emissao||"");
  const dataHora=v=>{const d=String(v||"");return d?dateBR(d)+(d.includes("T")?" "+d.slice(11,19):""):"-"};
  const dhN=tag(inf,"dhProc")||tag(inf,"dhEmi")||tag(dps,"dhEmi")||n.data_emissao||"",prestDoc=tag(emit,"CNPJ")||tag(emit,"CPF")||n.cnpj_emitente||"",tomaDoc=tag(toma,"CNPJ")||tag(toma,"CPF")||n.cnpj_destinatario||"";
  const endereco=s=>[tag(s,"xLgr"),tag(s,"nro"),tag(s,"xCpl"),tag(s,"xBairro")].filter(Boolean).join(", ");
  const desc=tag(dps,"xDescServ")||"Serviço conforme NFS-e autorizada.",valor=tag(inf,"vTotNF")||tag(inf,"vLiq")||tag(dps,"vServ")||String(n.valor_total||0),nbs=tag(dps,"cNBS")||"";
  const munToma=(tag(toma,"xMun")||"Montes Claros")+" - "+(tag(toma,"UF")||"MG");
  [[14,59,430,11],[14,80,125,11],[156,80,125,11],[298,80,150,11],[14,101,125,11],[156,101,125,11],[298,101,150,11],[476,51,70,58],
   [14,138,120,11],[156,138,125,11],[298,138,125,11],[439,138,125,11],[14,159,260,11],[298,159,255,11],[14,180,270,11],[298,180,125,11],[439,180,125,11],
   [14,223,125,11],[156,223,125,11],[298,223,125,11],[439,223,125,11],[14,244,260,12],[298,244,255,12],[14,266,270,12],[298,266,125,12],[439,266,125,12],
   [14,310,270,22],[298,310,125,12],[439,310,125,12],[14,343,540,13],[14,420,125,12],[14,533,125,12],[439,554,125,12],[14,607,300,13]].forEach(v=>erase(...v));
  put(chave,14,59,8);put(numero,14,80,8);put(compet,156,80,8);put(dataHora(dhN),298,80,8);put(tag(dps,"nDPS")||"-",14,101,8);put(tag(dps,"serie")||"-",156,101,8);put(dataHora(tag(dps,"dhEmi")),298,101,8);
  try{const qr=(await import("npm:qrcode-generator@1.4.4")).default(0,"M");qr.addData("https://www.nfse.gov.br/consultapublica?chave="+chave);qr.make();const m=qr.getModuleCount(),s=48/m;for(let r=0;r<m;r++)for(let c=0;c<m;c++)if(qr.isDark(r,c))page.drawRectangle({x:480+c*s,y:H-54-(r+1)*s,width:s+.06,height:s+.06,color:black});}catch{}
  put("Prestador do Serviço",14,138,8);put(docFmt(prestDoc),156,138,8);put(tag(emit,"IM")||"130602",298,138,8);put(tag(emit,"fone")||"(38) 9812-9311",439,138,8);
  lineValue(tag(emit,"xNome")||n.nome_emitente||"M LAB SERVICOS LTDA",14,159,260,8);put(tag(emit,"email")||"financeiro@minaslab.net",298,159,8);lineValue(endereco(emit)||"R RAIMUNDO FERNANDES DIAS, 96, RENASCENCA",14,180,270,8);put("Montes Claros - MG",298,180,8);put(tag(emit,"CEP")||"39400-241",439,180,8);
  put(docFmt(tomaDoc),156,223,8);put(tag(toma,"IM")||"-",298,223,8);put(tag(toma,"fone")||"-",439,223,8);lineValue(tag(toma,"xNome")||n.nome_destinatario||"-",14,244,260,8);put(tag(toma,"email")||"-",298,244,8);lineValue(endereco(toma)||"-",14,266,270,7.5);put(munToma,298,266,8);put(tag(toma,"CEP")||"-",439,266,8);
  const cod=tag(dps,"cTribNac")||"170202";lineValue(cod.replace(/(\d{2})(\d{2})(\d{2})/,"$1.$2.$3")+" - Expediente, secretaria em geral, apoio e infraestrutura administrativa e congêneres.",14,310,270,7.5);put("-",298,310,8);put("Montes Claros - MG",439,310,8);
  lineValue(desc,14,343,540,8);put(money(valor),14,420,8);put(money(valor),14,533,8);put(money(valor),439,554,8,true);put("NBS: "+(nbs||"-"),14,607,8);
  return new Uint8Array(await pdf.save());
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({erro:"Método não permitido"},405);
  try{
    const {id,forcarOficial=false,regenerarPadrao=false}=await req.json(); if(!id)return json({erro:"Nota não informada"},400);
    const sb=createClient(U,K,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:n,error}=await sb.from("notas_fiscais").select("id,empresa_id,status_fiscal,pdf_url,xml_url,origem,chave_acesso,numero_nf,data_emissao,valor_total,nome_emitente,nome_destinatario,cnpj_emitente,cnpj_destinatario").eq("id",id).maybeSingle();
    if(error)throw error; if(!n)throw new Error("Nota fiscal não encontrada.");
    if(String(n.origem||"")!=="NFSE_NACIONAL")throw new Error("Esta nota não é uma NFS-e Nacional.");
    if(!["AUTORIZADA","CANCELADA"].includes(String(n.status_fiscal||"").toUpperCase()))throw new Error(`Status ${n.status_fiscal||"sem status"} não permite gerar o DANFSe.`);
    if(!n.chave_acesso)throw new Error("A nota não possui chave de acesso da NFS-e Nacional.");
    let pdfPath=String(n.pdf_url||""); let origemPdf="existente";
    if(!pdfPath||forcarOficial||regenerarPadrao){
      let bytes=await tentarGateway(String(n.chave_acesso));
      if(bytes){origemPdf="gateway_oficial"}else{
        bytes=await tentarAdnOficial(String(n.chave_acesso));
        if(bytes){origemPdf="adn_oficial_direto"}else if(regenerarPadrao||!pdfPath){
          if(!n.xml_url)throw new Error("A nota não possui XML fiscal para gerar o DANFSe no padrão nacional.");
          const {data:xmlBlob,error:xe}=await sb.storage.from(BUCKET).download(n.xml_url); if(xe)throw xe;
          const xml=await xmlBlob.text(); if(!xml.trim())throw new Error("O XML salvo da NFS-e está vazio.");
          bytes=await gerarPdfLocal(xml,n); origemPdf="padrao_danfse_v2_xml";
        }else throw new Error("O DANFSe oficial ainda não está disponível no Portal Nacional; o PDF existente foi preservado.");
      }
      const ano=String(n.data_emissao||new Date().toISOString()).slice(0,4)||String(new Date().getFullYear());
      pdfPath=`financeiro/${n.empresa_id}/nfse/${ano}/${n.chave_acesso}.pdf`;
      const {error:upErr}=await sb.storage.from(BUCKET).upload(pdfPath,bytes,{contentType:"application/pdf",upsert:true}); if(upErr)throw upErr;
      const {error:dbErr}=await sb.from("notas_fiscais").update({pdf_url:pdfPath,updated_at:new Date().toISOString()}).eq("id",n.id); if(dbErr)throw dbErr;
    }
    return json({ok:true,pdfPath,origemPdf,numeroNf:n.numero_nf||null});
  }catch(e){return json({ok:false,erro:e instanceof Error?e.message:String(e)},500)}
});