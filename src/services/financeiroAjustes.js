import { FINANCEIRO_AJUSTES } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamar(action, corpo={}) {
  const resp=await comCracha(FINANCEIRO_AJUSTES,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...corpo})});
  const body=await resp.json().catch(()=>null);
  if(!resp.ok) throw new Error(body?.erro||body?.message||mensagemDoStatus(resp.status));
  return body||{};
}
export const finTituloCandidatos=(tipo,id)=>chamar("candidatos",{tipo,id}).then(r=>r.itens||[]);
export const finTituloConciliar=(tipo,id,movimentoId,valor)=>chamar("conciliarTitulo",{tipo,id,movimentoId,valor});
export const finOmieAjustar=(tipo,id,dados,motivo="")=>chamar("ajustarOmie",{tipo,id,dados,motivo}).then(r=>r.item);
export const finOmieRestaurar=(tipo,id)=>chamar("restaurarOmie",{tipo,id}).then(r=>r.item);
