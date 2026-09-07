import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const erroTexto=(e:any)=>e instanceof Error?e.message:(typeof e==="string"?e:(e?.message||e?.details||e?.hint||JSON.stringify(e)));

async function auth(req:Request){
  const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!t)return null;const p=t.split(".");if(p.length!==3)return null;
  try{const s=p[1].replace(/-/g,"+").replace(/_/g,"/");const x=JSON.parse(atob(s+"=".repeat((4-s.length%4)%4)));if(x.exp&&x.exp*1000<Date.now())return null;return x}catch{return null}
}

async function testarGateway(idDps:string){
  const base=String(Deno.env.get("NFSE_GATEWAY_URL")||"").replace(/\/+$/,'');
  const token=String(Deno.env.get("NFSE_GATEWAY_TOKEN")||"");
  if(!base)throw new Error("NFSE_GATEWAY_URL não configurada no Supabase.");
  if(!token)throw new Error("NFSE_GATEWAY_TOKEN não configurado no Supabase.");
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);
  try{
    const resp=await fetch(`${base}/v1/testar-conexao`,{method:"POST",signal:controller.signal,headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({idDps})});
    const raw=await resp.text();let body:any={};try{body=raw?JSON.parse(raw):{}}catch{body={erro:raw||`HTTP ${resp.status}`}}
    if(!resp.ok)throw new Error(body?.erro||`Gateway NFS-e respondeu HTTP ${resp.status}.`);
    return body;
  }catch(e){if((e as any)?.name==="AbortError")throw new Error("Timeout ao chamar o gateway NFS-e.");throw e}
  finally{clearTimeout(timer)}
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
    const r=await testarGateway(nota.nfse_dps_id);
    const teste={ok:Boolean(r.ok),statusHttp:Number(r.statusHttp||0),existeDpsNoSefin:Boolean(r.existeDpsNoSefin),ambiente:"HOMOLOGACAO",endpoint:"GATEWAY_RENDER_SEFIN_PROD_RESTRITA",testadoEm:new Date().toISOString(),metodo:"HEAD",http:r.http||"1.1",mtls:Boolean(r.mtls),transmitiu:false};
    const dados={...(nota.nfse_dados||{}),sefinTeste:teste};
    const {error:upErr}=await sb.from("notas_fiscais").update({nfse_dados:dados,updated_at:new Date().toISOString()}).eq("id",id);if(upErr)throw upErr;
    if(teste.existeDpsNoSefin)return json({...r,ok:false,erro:"A SEFIN informou que esta DPS já existe no ambiente restrito. Emissão permanece bloqueada para evitar duplicidade."},409);
    return json({...r,ok:true,ambiente:"HOMOLOGACAO",transmitiu:false,mensagem:r.mensagem||`Gateway alcançou a SEFIN (HTTP ${teste.statusHttp}). Nenhuma NFS-e foi transmitida.`});
  }catch(e){return json({erro:erroTexto(e),transmitiu:false},409)}
});
