import { FINANCEIRO_BOLETO } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

function textoErro(body, status) {
  const e = body?.erro;
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object") return e.message || e.mensagem || JSON.stringify(e);
  if (typeof body?.message === "string" && body.message.trim()) return body.message;
  return mensagemDoStatus(status);
}

async function chamar(action, corpo = {}) {
  const resp = await comCracha(FINANCEIRO_BOLETO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...corpo }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(textoErro(body, resp.status));
  return body || {};
}

export const finBoletoUpload = (empresaId, arquivo) => chamar("upload", { empresaId, ...arquivo });
