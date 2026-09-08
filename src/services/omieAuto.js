import { FINANCEIRO_OMIE_AUTO } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamar(action) {
  const resp = await comCracha(FINANCEIRO_OMIE_AUTO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro || mensagemDoStatus(resp.status));
  return body || {};
}

export const omieAutoEstado = () => chamar("estado").then((r) => r.estado || null);
export const omieAutoSincronizarAgora = () => chamar("executar");
