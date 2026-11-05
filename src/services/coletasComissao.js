// As coletas do CRM que dão comissão ao coletor, para a Folha de Pagamento.
// Só a direção (a Edge Function ml-rh-coletas confere o crachá).
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

export async function coletasComissionadas(competencia) {
  const resp = await comCracha(`${API}/ml-rh-coletas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "comissaoColetas", competencia }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro || mensagemDoStatus(resp.status));
  return body?.coletas || [];
}
