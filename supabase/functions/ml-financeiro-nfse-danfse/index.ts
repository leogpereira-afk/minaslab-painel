import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import forge from "npm:node-forge@1.3.1";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET="ml-arquivos";
const LOGO_NFSE_PATH=Deno.env.get("DANFSE_LOGO_NFSE_PATH")||"financeiro/assets/nfse/Logo NFS-e.jpeg";
const LOGO_PREFEITURA_PATH=Deno.env.get("DANFSE_LOGO_PREFEITURA_PATH")||"financeiro/assets/nfse/Logo prefeitura.jpeg";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const strip=(s:string)=>String(s||"").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").trim();
const tag=(xml:string,n:string)=>{const m=xml.match(new RegExp(`<(?:\\w+:)?${n}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${n}>`,`i`));return m?strip(m[1]):""};
const section=(xml:string,n:string)=>{const m=xml.match(new RegExp(`<(?:\\w+:)?${n}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${n}>`,`i`));return m?m[1]:""};
const money=(v:any)=>Number(String(v||"0").replace(",",".")).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateBR=(v:string)=>{const x=String(v||"").slice(0,10),p=x.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:x||"-"};
const docFmt=(v:string)=>{const d=String(v||"").replace(/\D/g,"");if(d.length===14)return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;if(d.length===11)return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;return v||"-"};
const wrap=(text:string,max=90)=>{const ws=String(text||"-").split(/\s+/),out:string[]=[];let cur="";for(const w of ws){const n=cur?`${cur} ${w}`:w;if(n.length>max&&cur){out.push(cur);cur=w}else cur=n}if(cur)out.push(cur);return out};

async function tentarGateway(chave:string){
  const base=String(Deno.env.get("NFSE_GATEWAY_URL")||"").replace(/\/$/,""),token=String(Deno.env.get("NFSE_GATEWAY_TOKEN")||"");
  if(!base||!token)return null;let last="";
  for(let i=0;i<3;i++)try{const r=await fetch(`${base}/v1/danfse/${encodeURIComponent(chave)}`,{headers:{Authorization:`Bearer ${token}`}});const body=await r.json().catch(()=>null);if(r.status===404||/rota não encontrada/i.test(String(body?.erro||body?.message||"")))return null;if(!r.ok)throw new Error(body?.erro||body?.message||`Falha DANFSe (${r.status}).`);const b64=String(body?.pdfBase64||body?.resposta?.pdfBase64||"").replace(/^data:application\/pdf;base64,/i,"");if(!b64)return null;const bin=atob(b64),bytes=new Uint8Array(bin.length);for(let j=0;j<bin.length;j++)bytes[j]=bin.charCodeAt(j);return bytes}catch(e){last=e instanceof Error?e.message:String(e);if(i<2)await sleep(350*(i+1))}
  if(/ssl|tls|bad record mac|decryption failed/i.test(last))return null;throw new Error(last||"Falha ao recuperar DANFSe.");
}
function abrirCertificadoA1(){const b64=String(Deno.env.get("MLAB_NFSE_CERT_PFX_B64")||"").replace(/\s/g,""),senha=String(Deno.env.get("MLAB_NFSE_CERT_PASSWORD")||"");if(!b64||!senha)return null;const asn1=forge.asn1.fromDer(forge.util.createBuffer(atob(b64),"raw")),p12=forge.pkcs12.pkcs12FromAsn1(asn1,false,senha);const cert=(p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[]).find((x:any)=>x.cert)?.cert;const protegidas=p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[],abertas=p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[],key=[...protegidas,...abertas].find((x:any)=>x.key)?.key;if(!cert||!key)return null;return {certChain:forge.pki.certificateToPem(cert),privateKey:forge.pki.privateKeyToPem(key)}}
async function tentarAdnOficial(chave:string){const a1=abrirCertificadoA1();if(!a1)return null;const client=Deno.createHttpClient({certChain:a1.certChain,privateKey:a1.privateKey});try{for(let i=0;i<4;i++){const r=await fetch(`https://adn.nfse.gov.br/danfse/${encodeURIComponent(chave)}`,{method:"GET",client,headers:{Accept:"application/pdf"}} as RequestInit & {client:Deno.HttpClient});if(r.ok){const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>4&&String.fromCharCode(...bytes.slice(0,4))==="%PDF")return bytes}if(![404,409,425,429,500,502,503,504].includes(r.status))return null;if(i<3)await sleep(750*(i+1))}return null}catch{return null}finally{client.close()}}

async function baixarLogo(sb:any,path:string){const {data,error}=await sb.storage.from(BUCKET).download(path);if(error||!data)return null;return new Uint8Array(await data.arrayBuffer())}

async function gerarPdfLocal(xml:string,n:any,sb:any){
  const pdf=await PDFDocument.create(),page=pdf.addPage([595.28,841.89]),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink=rgb(.08,.08,.08),gray=rgb(.35,.35,.35),line=rgb(.58,.58,.58),head=rgb(.93,.93,.93),W=575,x0=10,H=page.getHeight();
  const draw=(s:any,x:number,top:number,size=6.2,b=false,color=ink,max=565)=>page.drawText(String(s??"-"),{x,y:H-top-size,size,font:b?bold:font,color,maxWidth:max});
  const rect=(top:number,h:number,x=x0,w=W,fill=false)=>page.drawRectangle({x,y:H-top-h,width:w,height:h,borderColor:line,borderWidth:.5,...(fill?{color:head}:{})});
  const label=(s:string,x:number,top:number)=>draw(s,x,top,5.2,true,gray),value=(s:any,x:number,top:number,size=6.7,b=false,max=565)=>draw(s||"-",x,top,size,b,ink,max);
  const field=(l:string,v:any,x:number,top:number,w:number,size=6.7)=>{label(l,x,top);wrap(String(v||"-"),Math.max(12,Math.floor(w/(size*.50)))).slice(0,2).forEach((z,i)=>value(z,x,top+8+i*7.4,size,false,w))};
  const emit=section(xml,"emit")||section(xml,"prest"),toma=section(xml,"toma"),inf=section(xml,"infNFSe")||xml,dps=section(xml,"infDPS")||xml;
  const chave=String(n.chave_acesso||tag(inf,"chNFSe")||""),numero=String(n.numero_nf||tag(inf,"nNFSe")||"-"),compet=dateBR(tag(dps,"dCompet")||n.data_emissao||"");
  const dataHora=(v:any)=>{const d=String(v||"");return d?dateBR(d)+(d.includes("T")?" "+d.slice(11,19):""):"-"},dhN=tag(inf,"dhProc")||tag(inf,"dhEmi")||tag(dps,"dhEmi")||n.data_emissao||"";
  const prestNome=tag(emit,"xNome")||n.nome_emitente||"M LAB SERVICOS LTDA",prestDoc=tag(emit,"CNPJ")||tag(emit,"CPF")||n.cnpj_emitente||"",tomaNome=tag(toma,"xNome")||n.nome_destinatario||"-",tomaDoc=tag(toma,"CNPJ")||tag(toma,"CPF")||n.cnpj_destinatario||"";
  const endereco=(s:string)=>[tag(s,"xLgr"),tag(s,"nro"),tag(s,"xBairro")].filter(Boolean).join(", "),codigo=tag(dps,"cTribNac")||"",desc=tag(dps,"xDescServ")||"Serviço conforme NFS-e autorizada.",valor=tag(inf,"vTotNF")||tag(inf,"vLiq")||tag(dps,"vServ")||String(n.valor_total||0);

  // Cabeçalho reproduz o DANFSe v1.0 de referência: logo NFS-e à esquerda, órgão emissor ao centro e brasão/QR à direita.
  rect(8,88);
  const [logoNfse,logoPref]=await Promise.all([baixarLogo(sb,LOGO_NFSE_PATH),baixarLogo(sb,LOGO_PREFEITURA_PATH)]);
  if(logoNfse){try{const img=await pdf.embedJpg(logoNfse);page.drawImage(img,{x:18,y:H-58,width:116,height:37})}catch{}}
  else {draw("NFS-e",20,22,20,true);draw("Nota Fiscal de Serviço eletrônica",20,46,7)}
  draw("DANFSe v1.0",178,17,7,true);draw("Documento Auxiliar da NFS-e",164,29,9,true);
  draw("PREFEITURA MUNICIPAL DE",176,46,6,true);draw("MONTES CLAROS/MG",186,56,7,true);draw("Secretaria de Finanças - Diretoria de Receitas",150,68,5.4);draw("(38)2211-3217  |  suportenfse@montesclaros.mg.gov.br",150,77,5.2);
  if(logoPref){try{const img=await pdf.embedJpg(logoPref);page.drawImage(img,{x:452,y:H-65,width:52,height:52})}catch{}}
  try{const qr=(await import("npm:qrcode-generator@1.4.4")).default(0,"M");qr.addData("https://www.nfse.gov.br/consultapublica?chave="+chave);qr.make();const m=qr.getModuleCount(),s=56/m;for(let r=0;r<m;r++)for(let c=0;c<m;c++)if(qr.isDark(r,c))page.drawRectangle({x:517+c*s,y:H-27-(r+1)*s,width:s+.06,height:s+.06,color:ink})}catch{}

  rect(99,78);field("Chave de Acesso da NFS-e",chave,18,105,375,8);draw("A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e",18,126,5.3,false,gray,365);
  field("Número da NFS-e",numero,405,103,82,7.2);field("Competência da NFS-e",compet,493,103,82,6.5);field("Data e Hora da emissão da NFS-e",dataHora(dhN),405,130,170,6.2);field("Número da DPS",tag(dps,"nDPS")||numero,405,153,52);field("Série da DPS",tag(dps,"serie")||"70000",463,153,52);field("Data e Hora da emissão da DPS",dataHora(tag(dps,"dhEmi")||dhN),521,153,54,5.2);

  rect(180,98);draw("EMITENTE DA NFS-e",18,185,6.7,true);draw("Prestador do Serviço",18,195,5.7,true,gray);
  field("CNPJ / CPF / NIF",docFmt(prestDoc),18,209,125);field("Inscrição Municipal",tag(emit,"IM")||"130602",150,209,110);field("Telefone",tag(emit,"fone")||"(38) 9812-9311",268,209,115);
  field("Nome / Nome Empresarial",prestNome,18,234,365,7);field("E-mail",tag(emit,"email")||"financeiro@minaslab.net",390,234,185,6.3);field("Endereço",endereco(emit)||"R RAIMUNDO FERNANDES DIAS, 96, RENASCENCA",18,258,365,6.3);field("Município",tag(emit,"xMun")||"Montes Claros - MG",390,258,110);field("CEP",tag(emit,"CEP")||"39400-241",508,258,67);
  field("Simples Nacional na Data de Competência","Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)",18,281,270,5.8);field("Regime de Apuração Tributária pelo SN","Regime de apuração dos tributos federais e municipal pelo Simples Nacional",295,281,280,5.5);

  rect(281,74);draw("TOMADOR DO SERVIÇO",18,286,6.7,true);field("CNPJ / CPF / NIF",docFmt(tomaDoc),150,286,120);field("Inscrição Municipal",tag(toma,"IM")||"-",278,286,100);field("Telefone",tag(toma,"fone")||"-",386,286,90);
  field("Nome / Nome Empresarial",tomaNome,18,311,365,6.8);field("E-mail",tag(toma,"email")||"-",390,311,185,6.1);field("Endereço",endereco(toma)||"-",18,335,365,6.1);field("Município",tag(toma,"xMun")?`${tag(toma,"xMun")} - ${tag(toma,"UF")||"MG"}`:"Montes Claros - MG",390,335,110);field("CEP",tag(toma,"CEP")||"-",508,335,67);

  rect(358,20,true);draw("INTERMEDIÁRIO DO SERVIÇO NÃO IDENTIFICADO NA NFS-e",18,364,6.2,true);
  rect(381,80);draw("SERVIÇO PRESTADO",18,386,6.7,true);field("Código de Tributação Nacional",codigo?codigo.replace(/(\d{2})(\d{2})(\d{2})/,"$1.$2.$3")+" - Expediente, secretaria em geral, apoio e infra-estrutura ...":"-",18,400,280,6);field("Código de Tributação Municipal","-",305,400,120);field("Local da Prestação","Montes Claros - MG",432,400,100);field("País da Prestação","-",538,400,37);
  label("Descrição do Serviço",18,430);wrap(desc,115).slice(0,3).forEach((z,i)=>value(z,18,439+i*7.5,6.3));

  rect(464,95);draw("TRIBUTAÇÃO MUNICIPAL",18,469,6.7,true);field("Tributação do ISSQN","Operação Tributável",18,483,150);field("País Resultado da Prestação do Serviço","-",175,483,145);field("Município de Incidência do ISSQN","Montes Claros - MG",327,483,150);field("Regime Especial de Tributação","Nenhum",484,483,91);
  field("Tipo de Imunidade","-",18,510,90);field("Suspensão da Exigibilidade do ISSQN","Não",115,510,150);field("Número Processo Suspensão","-",272,510,120);field("Benefício Municipal","-",399,510,100);field("Valor do Serviço",money(valor),506,510,69);
  field("Desconto Incondicionado","-",18,536,105);field("Total Deduções/Reduções","-",130,536,105);field("Cálculo do BM","-",242,536,80);field("BC ISSQN","-",329,536,70);field("Alíquota Aplicada","-",406,536,75);field("Retenção do ISSQN",tag(dps,"tpRetISSQN")==="2"?"Retido":"Não Retido",488,536,87);

  rect(562,55);draw("TRIBUTAÇÃO FEDERAL",18,567,6.7,true);field("IRRF","-",18,581,70);field("Contribuição Previdenciária - Retida","-",95,581,150);field("Contribuições Sociais - Retidas","-",252,581,135);field("Descrição Contrib. Sociais - Retidas","-",394,581,181);field("PIS - Débito Apuração Própria","-",18,604,150);field("COFINS - Débito Apuração Própria","-",175,604,165);

  rect(620,66);draw("VALOR TOTAL DA NFS-E",18,625,6.7,true);field("Valor do Serviço",money(valor),18,639,100,7.3);field("Desconto Condicionado","-",125,639,105);field("Desconto Incondicionado","-",237,639,105);field("ISSQN Retido","-",349,639,80);field("Total das Retenções Federais","-",436,639,139);field("PIS/COFINS - Débito Apur. Própria","-",18,664,180);field("Valor Líquido da NFS-e",money(valor),205,664,150,7.5);

  rect(689,43);draw("TOTAIS APROXIMADOS DOS TRIBUTOS",18,694,6.7,true);field("Federais","-",18,708,120);field("Estaduais","-",145,708,120);field("Municipais","-",272,708,120);
  rect(735,50);draw("INFORMAÇÕES COMPLEMENTARES",18,740,6.7,true);value(tag(dps,"cNBS")?`NBS: ${tag(dps,"cNBS")}`:"NBS: -",18,756,6.2);if(String(n.status_fiscal||"").toUpperCase()==="CANCELADA")draw("NFS-e CANCELADA",450,756,8,true);
  return new Uint8Array(await pdf.save());
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return json({erro:"Método não permitido"},405);
  try{const {id,forcarOficial=false,regenerarPadrao=false}=await req.json();if(!id)return json({erro:"Nota não informada"},400);const sb=createClient(U,K,{auth:{persistSession:false,autoRefreshToken:false}});const {data:n,error}=await sb.from("notas_fiscais").select("id,empresa_id,status_fiscal,pdf_url,xml_url,origem,chave_acesso,numero_nf,data_emissao,valor_total,nome_emitente,nome_destinatario,cnpj_emitente,cnpj_destinatario").eq("id",id).maybeSingle();if(error)throw error;if(!n)throw new Error("Nota fiscal não encontrada.");if(String(n.origem||"")!=="NFSE_NACIONAL")throw new Error("Esta nota não é uma NFS-e Nacional.");if(!["AUTORIZADA","CANCELADA"].includes(String(n.status_fiscal||"").toUpperCase()))throw new Error(`Status ${n.status_fiscal||"sem status"} não permite gerar o DANFSe.`);if(!n.chave_acesso)throw new Error("A nota não possui chave de acesso da NFS-e Nacional.");let pdfPath=String(n.pdf_url||""),origemPdf="existente";
    if(!pdfPath||forcarOficial||regenerarPadrao){let bytes=await tentarGateway(String(n.chave_acesso));if(bytes)origemPdf="gateway_oficial";else{bytes=await tentarAdnOficial(String(n.chave_acesso));if(bytes)origemPdf="adn_oficial_direto";else if(regenerarPadrao||!pdfPath){if(!n.xml_url)throw new Error("A nota não possui XML fiscal para gerar o DANFSe no padrão nacional.");const {data:xmlBlob,error:xe}=await sb.storage.from(BUCKET).download(n.xml_url);if(xe)throw xe;const xml=await xmlBlob.text();if(!xml.trim())throw new Error("O XML salvo da NFS-e está vazio.");bytes=await gerarPdfLocal(xml,n,sb);origemPdf="padrao_danfse_v1_xml"}else throw new Error("O DANFSe oficial ainda não está disponível no Portal Nacional; o PDF existente foi preservado.")}
      const ano=String(n.data_emissao||new Date().toISOString()).slice(0,4)||String(new Date().getFullYear());pdfPath=`financeiro/${n.empresa_id}/nfse/${ano}/${n.chave_acesso}.pdf`;const {error:upErr}=await sb.storage.from(BUCKET).upload(pdfPath,bytes,{contentType:"application/pdf",upsert:true});if(upErr)throw upErr;const {error:dbErr}=await sb.from("notas_fiscais").update({pdf_url:pdfPath,updated_at:new Date().toISOString()}).eq("id",n.id);if(dbErr)throw dbErr}
    return json({ok:true,pdfPath,origemPdf,numeroNf:n.numero_nf||null,layout:"DANFSe v1.0"})
  }catch(e){return json({ok:false,erro:e instanceof Error?e.message:String(e)},500)}
});