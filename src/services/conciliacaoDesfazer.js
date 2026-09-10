import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

const URL = "https://reoghclxripktzpdwhiy.supabase.co/functions/v1/ml-financeiro-conciliacao";

export async function finDesfazerConciliacaoMovimento(movimentoId){
  const resp=await comCracha(URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"desfazer",movimentoId})});
  const body=await resp.json().catch(()=>null);
  if(!resp.ok)throw new Error(body?.erro||body?.message||mensagemDoStatus(resp.status));
  return body||{};
}
