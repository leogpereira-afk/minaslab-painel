import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

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

async function gerarPdfLocal(xml:string,n:any){
  const pdf=await PDFDocument.create(); const page=pdf.addPage([595.28,841.89]);
  const font=await pdf.embedFont(StandardFonts.Helvetica), bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const black=rgb(.12,.12,.12), gray=rgb(.42,.42,.42), light=rgb(.96,.97,.98), line=rgb(.82,.84,.86);
  let y=806; const x=34, W=527;
  const text=(s:string,xx:number,yy:number,size=9,b=false,c=black)=>page.drawText(String(s||"—"),{x:xx,y:yy,size,font:b?bold:font,color:c});
  const box=(yy:number,h:number)=>{page.drawRectangle({x,y:yy-h,width:W,height:h,borderColor:line,borderWidth:1,color:light})};
  text("DANFSe - Documento Auxiliar da NFS-e",x,y,15,true); y-=20;
  text(`NFS-e nº ${n.numero_nf||tag(xml,"nNFSe")||"—"}`,x,y,11,true); text(`Status: ${n.status_fiscal||"—"}`,390,y,9,true); y-=18;
  text(`Chave de acesso: ${n.chave_acesso||"—"}`,x,y,8,false,gray); y-=20;
  box(y,62); text("PRESTADOR DE SERVIÇOS",x+10,y-16,8,true,gray);
  const emit=section(xml,"emit"); const prest=section(xml,"prest"); const srcPrest=emit||prest;
  const prestNome=tag(srcPrest,"xNome")||n.nome_emitente||"M LAB SERVICOS LTDA"; const prestDoc=tag(srcPrest,"CNPJ")||tag(srcPrest,"CPF")||n.cnpj_emitente||"";
  text(prestNome,x+10,y-32,10,true); text(`CPF/CNPJ: ${docFmt(prestDoc)}`,x+10,y-47,8); y-=72;
  box(y,72); text("TOMADOR DO SERVIÇO",x+10,y-16,8,true,gray);
  const toma=section(xml,"toma"); const tomaNome=tag(toma,"xNome")||n.nome_destinatario||"—"; const tomaDoc=tag(toma,"CNPJ")||tag(toma,"CPF")||n.cnpj_destinatario||"";
  text(tomaNome,x+10,y-32,10,true); text(`CPF/CNPJ: ${docFmt(tomaDoc)}`,x+10,y-47,8); const email=tag(toma,"email"); if(email)text(`E-mail: ${email}`,x+10,y-61,8); y-=82;
  const inf=section(xml,"infNFSe")||xml; const dps=section(xml,"infDPS")||xml;
  box(y,58); text("DADOS DA NFS-e",x+10,y-16,8,true,gray); text(`Emissão: ${dateBR(tag(dps,"dhEmi")||tag(inf,"dhProc")||n.data_emissao||"")}`,x+10,y-33,8); text(`Competência: ${dateBR(tag(dps,"dCompet")||n.data_emissao||"")}`,230,y-33,8); text(`Código verificação: ${tag(inf,"cVerif")||"—"}`,390,y-33,8); y-=68;
  const desc=tag(dps,"xDescServ")||tag(inf,"xDescServ")||"Serviço conforme NFS-e autorizada."; const linhas=wrap(desc,96);
  const h=Math.max(82,38+linhas.length*11); box(y,h); text("DESCRIÇÃO DOS SERVIÇOS",x+10,y-16,8,true,gray); linhas.slice(0,14).forEach((l,i)=>text(l,x+10,y-33-i*11,8)); y-=h+10;
  const valor=tag(inf,"vTotNF")||tag(inf,"vLiq")||tag(dps,"vServ")||n.valor_total||0;
  box(y,62); text("VALORES",x+10,y-16,8,true,gray); text("Valor total da NFS-e",x+10,y-34,8); text(money(valor),x+10,y-51,13,true); const iss=tag(dps,"vISSQN")||tag(inf,"vISSQN"); if(iss)text(`ISSQN: ${money(iss)}`,220,y-48,8); y-=72;
  text("Documento gerado localmente a partir do XML autorizado da NFS-e Nacional.",x,y,7,false,gray); y-=11;
  text("Consulte a autenticidade pela chave de acesso no Portal Nacional da NFS-e.",x,y,7,false,gray);
  return new Uint8Array(await pdf.save());
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({erro:"Método não permitido"},405);
  try{
    const {id,forcarOficial=false}=await req.json(); if(!id)return json({erro:"Nota não informada"},400);
    const sb=createClient(U,K,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:n,error}=await sb.from("notas_fiscais").select("id,empresa_id,status_fiscal,pdf_url,xml_url,origem,chave_acesso,numero_nf,data_emissao,valor_total,nome_emitente,nome_destinatario,cnpj_emitente,cnpj_destinatario").eq("id",id).maybeSingle();
    if(error)throw error; if(!n)throw new Error("Nota fiscal não encontrada.");
    if(String(n.origem||"")!=="NFSE_NACIONAL")throw new Error("Esta nota não é uma NFS-e Nacional.");
    if(!["AUTORIZADA","CANCELADA"].includes(String(n.status_fiscal||"").toUpperCase()))throw new Error(`Status ${n.status_fiscal||"sem status"} não permite gerar o DANFSe.`);
    if(!n.chave_acesso)throw new Error("A nota não possui chave de acesso da NFS-e Nacional.");
    let pdfPath=String(n.pdf_url||""); let origemPdf="existente";
    if(!pdfPath||forcarOficial){
      let bytes=await tentarGateway(String(n.chave_acesso));
      if(bytes){origemPdf="gateway_oficial"}else{if(forcarOficial)throw new Error("Não foi possível recuperar o DANFSe oficial do Portal Nacional; o PDF existente foi preservado.");
        if(!n.xml_url)throw new Error("O DANFSe remoto não está disponível e esta nota não possui XML salvo para geração local.");
        const {data:xmlBlob,error:xe}=await sb.storage.from(BUCKET).download(n.xml_url); if(xe)throw xe;
        const xml=await xmlBlob.text(); if(!xml.trim())throw new Error("O XML salvo da NFS-e está vazio.");
        bytes=await gerarPdfLocal(xml,n); origemPdf="local_xml";
      }
      const ano=String(n.data_emissao||new Date().toISOString()).slice(0,4)||String(new Date().getFullYear());
      pdfPath=`financeiro/${n.empresa_id}/nfse/${ano}/${n.chave_acesso}.pdf`;
      const {error:upErr}=await sb.storage.from(BUCKET).upload(pdfPath,bytes,{contentType:"application/pdf",upsert:true}); if(upErr)throw upErr;
      const {error:dbErr}=await sb.from("notas_fiscais").update({pdf_url:pdfPath,updated_at:new Date().toISOString()}).eq("id",n.id); if(dbErr)throw dbErr;
    }
    return json({ok:true,pdfPath,origemPdf,numeroNf:n.numero_nf||null});
  }catch(e){return json({ok:false,erro:e instanceof Error?e.message:String(e)},500)}
});