import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SB_SECRET_KEY")??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const J=Deno.env.get("ML_JWT_SECRET")||"";
const sb=createClient(U,K,{auth:{persistSession:false,autoRefreshToken:false}});
const enc=new TextEncoder(),dec=new TextDecoder();
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const txt=(v:any)=>String(v??"").trim();
function b64u(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
async function auth(req:Request){const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!t||!J)return null;const p=t.split(".");if(p.length!==3)return null;try{const k=await crypto.subtle.importKey("raw",enc.encode(J),{name:"HMAC",hash:"SHA-256"},false,["verify"]);if(!await crypto.subtle.verify("HMAC",k,b64u(p[2]),enc.encode(`${p[0]}.${p[1]}`)))return null;const x=JSON.parse(dec.decode(b64u(p[1])));if(x.sis!=="minaslab"||(x.exp&&x.exp<Math.floor(Date.now()/1000))||txt(x.papel)!=="direcao")return null;return x}catch{return null}}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  const user=await auth(req);if(!user)return json({erro:"Sessão inválida ou sem permissão."},401);
  try{
    const b=await req.json(),action=txt(b.action),movimentoId=txt(b.movimentoId),relacionadoId=txt(b.relacionadoId),classificacao=txt(b.classificacao).toUpperCase();
    if(action==="desfazer"){
      if(!movimentoId)return json({erro:"Informe o movimento."},400);
      const {data:m,error:e}=await sb.from("movimentos_bancarios").select("id,movimento_relacionado_id,classificacao_bancaria").eq("id",movimentoId).maybeSingle();if(e)throw e;if(!m)return json({erro:"Movimento não encontrado."},404);
      const ids=[m.id,m.movimento_relacionado_id].filter(Boolean);
      const {data:cs,error:ec}=await sb.from("conciliacoes").select("id").in("movimento_id",ids).limit(1);if(ec)throw ec;if((cs||[]).length)return json({erro:"Este movimento possui conciliação com título e não pode ser desclassificado aqui."},409);
      const {error:eu}=await sb.from("movimentos_bancarios").update({classificacao_bancaria:null,movimento_relacionado_id:null,classificado_em:null,classificado_por:null,conciliado:false,updated_at:new Date().toISOString()}).in("id",ids);if(eu)throw eu;
      return json({ok:true});
    }
    if(action!=="classificar")return json({erro:"Ação inválida."},400);
    if(!movimentoId||!["MOVIMENTO_INTERNO","ESTORNO","TRANSFERENCIA"].includes(classificacao))return json({erro:"Classificação incompleta."},400);
    const ids=[movimentoId,...(relacionadoId?[relacionadoId]:[])];
    const {data:movs,error:em}=await sb.from("movimentos_bancarios").select("id,empresa_id,conta_bancaria_id,tipo,valor,conciliado,classificacao_bancaria").in("id",ids);if(em)throw em;
    const a=(movs||[]).find((x:any)=>x.id===movimentoId);if(!a)return json({erro:"Movimento não encontrado."},404);
    const {data:cs,error:ec}=await sb.from("conciliacoes").select("id").in("movimento_id",ids).limit(1);if(ec)throw ec;if((cs||[]).length)return json({erro:"Um dos movimentos já possui conciliação com título."},409);
    if(classificacao==="MOVIMENTO_INTERNO"){
      const {error}=await sb.from("movimentos_bancarios").update({classificacao_bancaria:classificacao,movimento_relacionado_id:null,classificado_em:new Date().toISOString(),classificado_por:txt(user.sub)||"direcao",conciliado:true,updated_at:new Date().toISOString()}).eq("id",movimentoId);if(error)throw error;return json({ok:true});
    }
    if(!relacionadoId)return json({erro:"Selecione o movimento de contrapartida."},400);
    const b2=(movs||[]).find((x:any)=>x.id===relacionadoId);if(!b2)return json({erro:"Movimento relacionado não encontrado."},404);
    if(a.empresa_id!==b2.empresa_id)return json({erro:"Os movimentos precisam pertencer à mesma empresa."},400);
    if(a.tipo===b2.tipo)return json({erro:"A contrapartida precisa ter tipo oposto: uma entrada e uma saída."},400);
    if(Math.abs(Number(a.valor)-Number(b2.valor))>0.01)return json({erro:"Os valores da saída e da entrada precisam ser iguais."},400);
    if(classificacao==="ESTORNO"&&a.conta_bancaria_id!==b2.conta_bancaria_id)return json({erro:"Para estorno, a saída e o retorno precisam estar na mesma conta."},400);
    if(classificacao==="TRANSFERENCIA"&&a.conta_bancaria_id===b2.conta_bancaria_id)return json({erro:"Para transferência, selecione movimentos de contas diferentes."},400);
    const agora=new Date().toISOString(),por=txt(user.sub)||"direcao";
    const {error:e1}=await sb.from("movimentos_bancarios").update({classificacao_bancaria:classificacao,movimento_relacionado_id:b2.id,classificado_em:agora,classificado_por:por,conciliado:true,updated_at:agora}).eq("id",a.id);if(e1)throw e1;
    const {error:e2}=await sb.from("movimentos_bancarios").update({classificacao_bancaria:classificacao,movimento_relacionado_id:a.id,classificado_em:agora,classificado_por:por,conciliado:true,updated_at:agora}).eq("id",b2.id);if(e2)throw e2;
    return json({ok:true});
  }catch(e){return json({erro:e instanceof Error?e.message:String(e)},500)}
});