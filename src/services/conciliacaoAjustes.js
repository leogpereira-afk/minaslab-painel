import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

const URL = "https://reoghclxripktzpdwhiy.supabase.co/functions/v1/ml-financeiro-conciliacao";

function erroTexto(v){
  if(v==null)return "";
  if(typeof v==="string")return v.trim();
  if(typeof v==="object"){
    for(const k of ["erro","message","mensagem","details","hint"]){
      const s=erroTexto(v[k]);
      if(s)return s;
    }
  }
  return String(v||"");
}

export async function finConciliarAjustado(payload){
  const resp=await comCracha(URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"conciliar",...payload})});
  const body=await resp.json().catch(()=>null);
  if(!resp.ok)throw new Error(erroTexto(body)||mensagemDoStatus(resp.status));
  return body||{};
}
