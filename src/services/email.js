// Porta do E-mail do painel: Edge Function ml-email (crachá do painel). Cada pessoa só vê as
// próprias caixas; a senha da caixa fica cifrada no servidor e nunca volta para cá.
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamar(acao, corpo = {}) {
  const resp = await comCracha(`${API}/ml-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao, ...corpo }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro || mensagemDoStatus(resp.status));
  return body;
}

export const iniciarEmail = () => chamar("inicio");
export const contarNaoLidasEmail = () => chamar("naoLidas");
export const salvarCaixa = (conta) => chamar("contaSalvar", { conta }).then((r) => r.conta);
export const removerCaixa = (id) => chamar("contaApagar", { id });
export const lerPastas = (conta) => chamar("pastas", { conta }).then((r) => r.pastas);
export const listarEmails = (conta, pasta, pagina = 1, filtro = {}) => chamar("listar", { conta, pasta, pagina, filtro });
export const abrirEmail = (conta, pasta, uid) => chamar("ler", { conta, pasta, uid }).then((r) => r.mensagem);
export const baixarAnexoEmail = (conta, pasta, uid, indice) => chamar("anexo", { conta, pasta, uid, indice }).then((r) => r.anexo);
export const agirEmail = (conta, pasta, uids, tipo, destino) => chamar("agir", { conta, pasta, uids, tipo, destino });
export const enviarEmail = (dados) => chamar("enviar", dados);
