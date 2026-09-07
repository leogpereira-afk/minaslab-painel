import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";
import tls from "node:tls";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const erroTexto=(e:any)=>e instanceof Error?e.message:(typeof e==="string"?e:(e?.message||e?.details||e?.hint||JSON.stringify(e)));

async function auth(req:Request){
  const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!t)return null;const p=t.split(".");if(p.length!==3)return null;
  try{const s=p[1].replace(/-/g,"+").replace(/_/g,"/");const x=JSON.parse(atob(s+"=".repeat((4-s.length%4)%4)));if(x.exp&&x.exp*1000<Date.now())return null;return x}catch{return null}
}

function abrirA1(){
  const b64=String(Deno.env.get("MLAB_NFSE_CERT_PFX_B64")||"").replace(/\s/g,"");
  const senha=String(Deno.env.get("MLAB_NFSE_CERT_PASSWORD")||"");
  if(!b64||!senha)throw new Error("Certificado A1 e/ou senha não configurados.");
  const bin=atob(b64);const asn1=forge.asn1.fromDer(forge.util.createBuffer(bin,"raw"));
  const p12=forge.pkcs12.pkcs12FromAsn1(asn1,false,senha);
  const certBags=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[];
  const certs=certBags.map((x:any)=>x.cert).filter(Boolean);
  const shrouded=p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[];
  const plain=p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[];
  const key=[...shrouded,...plain].find((x:any)=>x.key)?.key;
  if(!certs.length||!key)throw new Error("O A1 foi aberto, mas certificado/chave privada não puderam ser extraídos.");
  return {certPem:certs.map((c:any)=>forge.pki.certificateToPem(c)).join("\n"),keyPem:forge.pki.privateKeyToPem(key)};
}

function headSefinHttp11(idDps:string,a1:{certPem:string,keyPem:string}){
  return new Promise<{status:number,alpn:string}>((resolve,reject)=>{
    let resolvido=false;let buffer="";
    const enc=encodeURIComponent(idDps);
    const caminhos=[`/SefinNacional/dps/${enc}`,`/API/SefinNacional/dps/${enc}`];
    const tentar=(idx:number)=>{
      const socket=tls.connect({host:"sefin.producaorestrita.nfse.gov.br",port:443,servername:"sefin.producaorestrita.nfse.gov.br",cert:a1.certPem,key:a1.keyPem,rejectUnauthorized:true,ALPNProtocols:["http/1.1"]},()=>{
        const alpn=socket.alpnProtocol||"http/1.1";
        const req=`HEAD ${caminhos[idx]} HTTP/1.1\r\nHost: sefin.producaorestrita.nfse.gov.br\r\nUser-Agent: MinasLab-Financeiro/1.0\r\nAccept: application/json\r\nConnection: close\r\n\r\n`;
        socket.write(req);
        (socket as any)._ml_alpn=alpn;
      });
      const timer=setTimeout(()=>socket.destroy(new Error("Timeout ao conectar à SEFIN Nacional.")),20000);
      socket.setEncoding("utf8");
      socket.on("data",d=>{buffer+=d;const m=buffer.match(/^HTTP\/1\.[01]\s+(\d{3})/);if(m&&!resolvido){const status=Number(m[1]);clearTimeout(timer);socket.end();if((status===404||status===405)&&idx===0){buffer="";tentar(1);return}resolvido=true;resolve({status,alpn:(socket as any)._ml_alpn||"http/1.1"});}});
      socket.on("error",e=>{clearTimeout(timer);if(!resolvido)reject(e)});
      socket.on("close",()=>{clearTimeout(timer);if(!resolvido&&buffer){const m=buffer.match(/^HTTP\/1\.[01]\s+(\d{3})/);if(m){resolvido=true;resolve({status:Number(m[1]),alpn:(socket as any)._ml_alpn||"http/1.1"});}}});
    };
    tentar(0);
  });
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(!await auth(req))return json({erro:"Sessão inválida."},401);
  if((Deno.env.get("MLAB_NFSE_AMBIENTE")||"HOMOLOGACAO").toUpperCase()!=="HOMOLOGACAO")return json({erro:"Teste SEFIN bloqueado fora de HOMOLOGAÇÃO."},409);
  let b:any={};try{b=await req.json()}catch{return json({erro:"JSON inválido."},400)}
  if(b.action!=="testarConexao")return json({erro:"Ação inválida."},400);
  const id=String(b.id||"");if(!id)return json({erro:"Rascunho não informado."},400);
  try{
    const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:nota,error}=await sb.from("notas_fiscais").select("id,status_fiscal,nfse_dps_id,nfse_dados").eq("id",id).eq("origem","NFSE_NACIONAL").eq("apagado",false).maybeSingle();
    if(error)throw error;if(!nota)throw new Error("Rascunho NFS-e não encontrado.");
    if(!nota.nfse_dps_id)throw new Error("A DPS ainda não foi preparada/assinada.");
    const a1=abrirA1();const r=await headSefinHttp11(nota.nfse_dps_id,a1);
    const chegou=r.status>0;const existe=r.status===200;
    const teste={ok:chegou,statusHttp:r.status,existeDpsNoSefin:existe,ambiente:"HOMOLOGACAO",endpoint:"SEFIN_NACIONAL_PRODUCAO_RESTRITA",testadoEm:new Date().toISOString(),metodo:"HEAD",http:"1.1",alpn:r.alpn,transmitiu:false};
    const dados={...(nota.nfse_dados||{}),sefinTeste:teste};
    const {error:upErr}=await sb.from("notas_fiscais").update({nfse_dados:dados,updated_at:new Date().toISOString()}).eq("id",id);if(upErr)throw upErr;
    if(existe)return json({ok:false,statusHttp:r.status,existeDpsNoSefin:true,mtls:true,http:"1.1",alpn:r.alpn,ambiente:"HOMOLOGACAO",transmitiu:false,erro:"A SEFIN informou que esta DPS já existe no ambiente restrito. Emissão permanece bloqueada para evitar duplicidade."},409);
    return json({ok:true,statusHttp:r.status,existeDpsNoSefin:false,mtls:true,http:"1.1",alpn:r.alpn,ambiente:"HOMOLOGACAO",transmitiu:false,mensagem:`Conexão mTLS HTTP/1.1 com a SEFIN Nacional alcançada (HTTP ${r.status}). Nenhuma NFS-e foi transmitida.`});
  }catch(e){return json({erro:erroTexto(e)},409)}
});
