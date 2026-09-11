import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

const URL = "https://reoghclxripktzpdwhiy.supabase.co/functions/v1/ml-financeiro-conciliacao";

async function chamar(body){
  const resp=await comCracha(URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await resp.json().catch(()=>null);
  if(!resp.ok)throw new Error(data?.erro||data?.message||mensagemDoStatus(resp.status));
  return data||{};
}

export function finDesfazerConciliacaoMovimento(movimentoId){
  return chamar({action:"desfazer",movimentoId});
}

export function finDesfazerConciliacaoTitulo({tipo,tituloId}){
  return chamar({action:"desfazer_titulo",tipo,tituloId});
}
