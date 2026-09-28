import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const J=Deno.env.get("ML_JWT_SECRET")||"";
const sb=createClient(U,K,{auth:{persistSession:false,autoRefreshToken:false}});
const enc=new TextEncoder(),dec=new TextDecoder();
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const txt=(v:any)=>String(v??"").trim();
const num=(v:any)=>Number(v||0);
function b64u(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
async function auth(req:Request){const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!t||!J)return null;const p=t.split(".");if(p.length!==3)return null;try{const k=await crypto.subtle.importKey("raw",enc.encode(J),{name:"HMAC",hash:"SHA-256"},false,["verify"]);if(!await crypto.subtle.verify("HMAC",k,b64u(p[2]),enc.encode(`${p[0]}.${p[1]}`)))return null;const x=JSON.parse(dec.decode(b64u(p[1])));if(x.sis!=="minaslab"||(x.exp&&x.exp<Math.floor(Date.now()/1000))||txt(x.papel)!=="direcao")return null;return x}catch{return null}}

Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});const cracha=await auth(req);if(!cracha)return json({erro:"Sessão inválida ou sem permissão."},401);try{const b=await req.json();const id=txt(b.movimentoId);if(!id)return json({erro:"Movimento não informado."},400);const r=await sb.from("movimentos_bancarios").select("*,empresa:empresas(id,nome),conta:contas_bancarias(id,nome,banco,agencia,conta),conciliacoes(id,valor_conciliado,valor_movimento)").eq("id",id).maybeSingle();if(r.error)throw new Error(r.error.message);if(!r.data)return json({erro:"Movimento não encontrado."},404);const m=r.data as any;const usados=(m.conciliacoes||[]).filter((c:any)=>c?.id).reduce((s:number,c:any)=>s+num(c?.valor_movimento??c?.valor_conciliado),0);const total=Math.abs(num(m.valor));return json({movimento:{...m,valor_total:total,valor_conciliado_movimento:usados,valor_disponivel:Math.max(0,total-usados)}})}catch(e){return json({erro:e instanceof Error?e.message:String(e)},500)}});
