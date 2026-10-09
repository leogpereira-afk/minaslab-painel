import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SB_SECRET_KEY")!;
const J=Deno.env.get("ML_JWT_SECRET")||"";
const sb=createClient(U,K,{auth:{persistSession:false,autoRefreshToken:false}});
const enc=new TextEncoder(),dec=new TextDecoder();
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const txt=(v:any)=>String(v??"").trim();
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
function b64u(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
async function auth(req:Request){const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!t||!J)return null;const p=t.split(".");if(p.length!==3)return null;try{const k=await crypto.subtle.importKey("raw",enc.encode(J),{name:"HMAC",hash:"SHA-256"},false,["verify"]);if(!await crypto.subtle.verify("HMAC",k,b64u(p[2]),enc.encode(`${p[0]}.${p[1]}`)))return null;const x=JSON.parse(dec.decode(b64u(p[1])));if(x.sis!=="minaslab"||(x.exp&&x.exp<Math.floor(Date.now()/1000))||txt(x.papel)!=="direcao")return null;return x}catch{return null}}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  const user=await auth(req);if(!user)return json({erro:"Sessão inválida ou sem permissão."},401);
  try{
    const b=await req.json();
    const action=txt(b.action);
    if(action==="desfazer"){
      const movimentoId=txt(b.movimentoId);
      if(!movimentoId)return json({erro:"Movimento bancário não informado."},400);
      const {data:existentes,error:erroBusca}=await sb.from("conciliacoes").select("id,recebimento_id,despesa_id,valor_conciliado,valor_movimento").eq("movimento_id",movimentoId);
      if(erroBusca)throw erroBusca;
      if(!existentes?.length)return json({erro:"Este movimento não possui conciliação para desfazer."},400);
      // Apaga pela função do banco: ela registra QUEM desfez na trilha de auditoria (audit_log).
      const {error}=await sb.rpc("financeiro_desfazer_conciliacao",{p_coluna:"movimento_id",p_id:movimentoId,p_usuario:txt(user.sub)||"direcao"});
      if(error)throw error;
      return json({ok:true,removidas:existentes.length,itens:existentes});
    }
    if(action==="desfazer_titulo"){
      const tituloId=txt(b.tituloId),tipo=txt(b.tipo).toUpperCase();
      if(!tituloId||!["RECEBIMENTO","DESPESA"].includes(tipo))return json({erro:"Título não informado para desconciliação."},400);
      const coluna=tipo==="RECEBIMENTO"?"recebimento_id":"despesa_id";
      const {data:existentes,error:erroBusca}=await sb.from("conciliacoes").select("id,movimento_id,recebimento_id,despesa_id,valor_conciliado,valor_movimento").eq(coluna,tituloId);
      if(erroBusca)throw erroBusca;
      if(!existentes?.length)return json({erro:"Este título não possui conciliação para desfazer."},400);
      const {error}=await sb.rpc("financeiro_desfazer_conciliacao",{p_coluna:coluna,p_id:tituloId,p_usuario:txt(user.sub)||"direcao"});
      if(error)throw error;
      return json({ok:true,removidas:existentes.length,itens:existentes});
    }
    if(action==="complementar_diferenca"){
      // Registra como juros ou multa a diferença que sobrou em um movimento já conciliado em parte (banco acima do título),
      // dentro da própria conciliação existente. O banco valida que tudo fecha e recalcula o movimento.
      const movimentoId=txt(b.movimentoId),tipoAjuste=txt(b.tipoAjuste).toLowerCase();
      if(!movimentoId||!["juros","multa"].includes(tipoAjuste))return json({erro:"Informe o movimento e se a diferença é juros ou multa."},400);
      const {data:mov,error:erroMov}=await sb.from("movimentos_bancarios").select("id,valor,tipo,conciliado").eq("id",movimentoId).maybeSingle();
      if(erroMov)throw erroMov;
      if(!mov)return json({erro:"Movimento bancário não encontrado."},404);
      const {data:vinculos,error:erroV}=await sb.from("conciliacoes").select("id,valor_conciliado,valor_movimento,juros,multa,observacao,created_at").eq("movimento_id",movimentoId).order("created_at",{ascending:false});
      if(erroV)throw erroV;
      if(!vinculos?.length)return json({erro:"Este movimento ainda não tem conciliação para complementar. Concilie com um título primeiro."},400);
      const soma=vinculos.reduce((s:number,v:any)=>s+num(v.valor_movimento??v.valor_conciliado),0);
      const dif=Math.round((Math.abs(num(mov.valor))-soma)*100)/100;
      if(dif<=0.005)return json({erro:"Não há diferença a registrar neste movimento."},400);
      const alvo=vinculos[0];
      const campo=tipoAjuste==="juros"?"juros":"multa";
      const quem=txt(user.sub)||"direcao";
      const hoje=new Date().toISOString().slice(0,10);
      const nota=`Diferença de R$ ${dif.toFixed(2).replace(".",",")} registrada como ${campo} em ${hoje} por ${quem}`;
      const {data,error}=await sb.from("conciliacoes").update({valor_movimento:Math.round((num(alvo.valor_movimento??alvo.valor_conciliado)+dif)*100)/100,[campo]:Math.round((num(alvo[campo])+dif)*100)/100,observacao:[txt(alvo.observacao),nota].filter(Boolean).join(" | ")}).eq("id",alvo.id).select("*").maybeSingle();
      if(error)throw error;
      return json({ok:true,item:data,diferenca:dif});
    }
    if(action!=="conciliar")return json({erro:"Ação inválida."},400);
    const movimentoId=txt(b.movimentoId),recebimentoId=b.recebimentoId||null,despesaId=b.despesaId||null;
    const valorTitulo=num(b.valorTitulo),valorMovimento=num(b.valorMovimento),desconto=num(b.desconto),juros=num(b.juros),multa=num(b.multa),ajuste=num(b.ajuste);
    const dataLiquidacao=txt(b.dataLiquidacao)||null,observacao=txt(b.observacao)||null;
    if(!movimentoId||(!recebimentoId&&!despesaId)||valorTitulo<=0||valorMovimento<=0)return json({erro:"Conciliação incompleta."},400);
    const payload={movimento_id:movimentoId,recebimento_id:recebimentoId,despesa_id:despesaId,valor_conciliado:valorTitulo,valor_movimento:valorMovimento,desconto,juros,multa,ajuste,data_liquidacao:dataLiquidacao,observacao,conciliado_por:txt(user.sub)||"direcao"};
    const {data,error}=await sb.from("conciliacoes").insert(payload).select("*").maybeSingle();
    if(error)throw error;
    return json({ok:true,item:data});
  }catch(e){return json({erro:e instanceof Error?e.message:String(e)},500)}
});