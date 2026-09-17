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
  const pdf=await PDFDocument.create(),page=pdf.addPage([595.28,841.89]),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink=rgb(.08,.08,.08),muted=rgb(.28,.32,.38),line=rgb(.55,.58,.62),pale=rgb(.94,.95,.96),blue=rgb(.04,.29,.55),W=575,x0=10,H=page.getHeight();
  const draw=(s,x,top,size=6.5,b=false,color=ink)=>page.drawText(String(s||"-"),{x,y:H-top-size,size,font:b?bold:font,color,maxWidth:570});
  const rule=(top,x=x0,w=W)=>page.drawLine({start:{x,y:H-top},end:{x:x+w,y:H-top},thickness:.55,color:line});
  const rect=(top,h,x=x0,w=W,fill)=>page.drawRectangle({x,y:H-top-h,width:w,height:h,borderColor:line,borderWidth:.55,...(fill?{color:fill}:{})});
  const label=(s,x,top)=>draw(s.toUpperCase(),x,top,5.5,true,muted),value=(s,x,top,size=7,b=false)=>draw(s||"-",x,top,size,b,ink);
  const field=(l,v,x,top,w,size=7)=>{label(l,x,top);const ls=wrap(v||"-",Math.max(12,Math.floor(w/(size*.52))));ls.slice(0,2).forEach((z,i)=>value(z,x,top+9+i*8,size));};
  const emit=section(xml,"emit")||section(xml,"prest"),toma=section(xml,"toma"),inf=section(xml,"infNFSe")||xml,dps=section(xml,"infDPS")||xml;
  const chave=String(n.chave_acesso||tag(inf,"chNFSe")||""),numero=String(n.numero_nf||tag(inf,"nNFSe")||"-"),compet=dateBR(tag(dps,"dCompet")||n.data_emissao||"");
  const dhN=tag(inf,"dhProc")||tag(inf,"dhEmi")||tag(dps,"dhEmi")||n.data_emissao||"",dataHora=v=>{const d=String(v||"");return d?dateBR(d)+(d.includes("T")?" "+d.slice(11,19):""):"-"};
  const prestNome=tag(emit,"xNome")||n.nome_emitente||"M LAB SERVICOS LTDA",prestDoc=tag(emit,"CNPJ")||tag(emit,"CPF")||n.cnpj_emitente||"";
  const tomaNome=tag(toma,"xNome")||n.nome_destinatario||"-",tomaDoc=tag(toma,"CNPJ")||tag(toma,"CPF")||n.cnpj_destinatario||"";
  const endereco=s=>[tag(s,"xLgr"),tag(s,"nro"),tag(s,"xCpl"),tag(s,"xBairro")].filter(Boolean).join(", ");
  const cMun=tag(dps,"cLocPrestacao")||tag(dps,"cLocEmi")||"3143302",codigo=tag(dps,"cTribNac")||"",nbs=tag(dps,"cNBS")||"",desc=tag(dps,"xDescServ")||"Serviço conforme NFS-e autorizada.";
  const valor=tag(inf,"vTotNF")||tag(inf,"vLiq")||tag(dps,"vServ")||String(n.valor_total||0);
  rect(8,55,10,575,pale);page.drawRectangle({x:22,y:H-45,width:12,height:12,color:blue});page.drawRectangle({x:37,y:H-36,width:8,height:8,color:blue});draw("NFS-e",51,18,18,true,blue);
  draw("DANFSe v2.0",210,14,7,true);draw("Documento Auxiliar da NFS-e",188,29,10,true);draw("Município: Montes Claros - MG",430,14,6,true);draw("Ambiente Gerador: Nacional",430,25,6);draw("Tipo de Ambiente: Produção",430,36,6);
  rect(66,86);field("Chave de acesso da NFS-e",chave,18,72,380,9);field("Número da NFS-e",numero,18,100,130,8);field("Competência da NFS-e",compet,155,100,150,8);field("Data e hora da emissão da NFS-e",dataHora(dhN),315,100,190,8);
  field("Número da DPS",tag(dps,"nDPS")||"-",18,126,130,7);field("Série da DPS",tag(dps,"serie")||"-",155,126,150,7);field("Data e hora da emissão da DPS",dataHora(tag(dps,"dhEmi")),315,126,190,7);
  try{const qr=(await import("npm:qrcode-generator@1.4.4")).default(0,"M");qr.addData("https://www.nfse.gov.br/consultapublica?chave="+chave);qr.make();const m=qr.getModuleCount(),s=62/m;for(let r=0;r<m;r++)for(let c=0;c<m;c++)if(qr.isDark(r,c))page.drawRectangle({x:514+c*s,y:H-76-(r+1)*s,width:s+.08,height:s+.08,color:ink});}catch{}
  field("Emitente da NFS-e","Prestador",18,154,130,7);field("Situação da NFS-e",String(n.status_fiscal||"AUTORIZADA")==="CANCELADA"?"NFS-e Cancelada":"NFS-e Gerada",155,154,150,7);field("Finalidade","NFS-e regular",315,154,180,7);
  rect(181,74);draw("PRESTADOR / FORNECEDOR",18,186,7,true);field("CNPJ / CPF / NIF",docFmt(prestDoc),190,186,125);field("Indicador Municipal (Inscrição)",tag(emit,"IM")||"-",325,186,130);field("Telefone",tag(emit,"fone")||"-",470,186,105);
  field("Nome / Nome Empresarial",prestNome,18,211,290,7.2);field("Município / Sigla UF","Montes Claros / MG",325,211,130);field("Código IBGE / CEP","31.43302 / "+(tag(emit,"CEP")||"-"),470,211,105);field("Endereço",endereco(emit)||"R RAIMUNDO FERNANDES DIAS, 96, RENASCENCA",18,235,290,6.5);field("E-mail",tag(emit,"email")||"financeiro@minaslab.net",325,235,250,6.5);
  rect(258,69);draw("TOMADOR / ADQUIRENTE",18,263,7,true);field("CNPJ / CPF / NIF",docFmt(tomaDoc),190,263,125);field("Indicador Municipal (Inscrição)",tag(toma,"IM")||"-",325,263,130);field("Telefone",tag(toma,"fone")||"-",470,263,105);
  field("Nome / Nome Empresarial",tomaNome,18,288,290,7.2);field("Município / Sigla UF",(tag(toma,"xMun")||"Montes Claros")+" / "+(tag(toma,"UF")||"MG"),325,288,130);field("Código IBGE / CEP",(tag(toma,"cMun")||"31.43302")+" / "+(tag(toma,"CEP")||"-"),470,288,105);field("Endereço",endereco(toma)||"-",18,309,290,5.4);field("E-mail",tag(toma,"email")||"-",325,309,250,5.8);
  rect(330,26,10,575,pale);draw("DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e",165,335,6,true);draw("INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e",158,346,6,true);
  rect(359,89);draw("SERVIÇO PRESTADO",18,364,7,true);field("Código de Tributação Nacional/Municipal",codigo?codigo.replace(/(\d{2})(\d{2})(\d{2})/,"$1.$2.$3")+" / -":"-",190,364,135);field("Código da NBS",nbs?nbs.replace(/(\d)(\d{4})(\d{2})(\d{2})/,"$1.$2.$3.$4"):"-",335,364,105);field("Local da Prestação / Sigla UF / País","Montes Claros / MG / -",450,364,125);
  value("Expediente, secretaria em geral, apoio e infraestrutura administrativa e congêneres.",18,389,6.5);label("Descrição do Serviço",18,402);wrap(desc,112).slice(0,3).forEach((z,i)=>value(z,18,412+i*9,6.8));
  rect(451,62);draw("TRIBUTAÇÃO MUNICIPAL (ISSQN)",18,456,7,true);field("Tipo de Tributação do ISSQN","Operação Tributável",190,456,180);field("Município / UF / País de Incidência","Montes Claros / MG / -",385,456,190);field("BC ISSQN","-",18,482,130);field("Alíquota Aplicada","-",155,482,130);field("Retenção do ISSQN",tag(dps,"tpRetISSQN")==="2"?"Retido":"Não Retido",295,482,130);field("ISSQN Apurado","-",440,482,135);
  rect(516,53);draw("TRIBUTAÇÃO FEDERAL (EXCETO CBS)",18,521,7,true);field("IRRF","-",190,521,100);field("Contribuição Previdenciária - Retida","-",300,521,160);field("Contribuições Sociais - Retidas","-",470,521,105);field("PIS / COFINS","Não Retidos",190,546,180);field("Descrição","0 - PIS/COFINS/CSLL Não Retidos",385,546,190);
  rect(572,89);draw("TRIBUTAÇÃO IBS/CBS",18,577,7,true);field("CST / cClassTrib",(tag(dps,"CST")||"000")+" / "+(tag(dps,"cClassTrib")||"000001"),190,577,150);field("Indicador de Operação / Código IBGE / Município / UF",(tag(dps,"cIndOp")||"100301")+" / "+cMun+" / Montes Claros / MG",350,577,225);
  field("Exclusões e Reduções da Base","R$ 0,00",18,606,130);field("Base de Cálculo",money(valor),155,606,130);field("Reduções de Alíquota","- / - / -",295,606,130);field("Alíquota IBS UF / IBS Mun","0,10% / 0,00%",440,606,135);field("Valor Total Apurado - IBS","-",18,634,130);field("Alíquota CBS","0,90%",155,634,130);field("Valor Total Apurado - CBS","-",295,634,130);field("Total IBS/CBS","-",440,634,135);
  rect(664,61);draw("VALOR TOTAL DA NFS-e",18,669,7,true);field("Valor da Operação / Serviço",money(valor),190,669,140,8);field("Desconto Incondicionado","-",340,669,115);field("Desconto Condicionado","-",470,669,105);field("Total das Retenções","-",18,696,130);field("VALOR LÍQUIDO DA NFS-e",money(valor),190,696,140,8);field("Total do IBS/CBS","-",340,696,115);field("VALOR LÍQUIDO + IBS/CBS",money(valor),470,696,105,7);
  rect(728,58);draw("INFORMAÇÕES COMPLEMENTARES",18,733,7,true);value("Totais aproximados dos Tributos conforme Lei nº 12.741/2012: conforme documento fiscal autorizado.",18,751,6.3);rule(792);field("Data cientificação","",18,797,150);field("Identificação e assinatura","",190,797,180);field("Nº NFS-e / Chave NFS-e",numero+" / "+chave,385,797,190,5.8);
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