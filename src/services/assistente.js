// Assistente de IA: conversa com a função ml-assistente. A chave da IA, os limites e quem vê cada conversa ficam no servidor.
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamar(action, corpo = {}) {
  const resp = await comCracha(`${API}/ml-assistente`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...corpo }) });
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(dados?.erro || mensagemDoStatus(resp.status));
  return dados || {};
}

export const assistenteEstado = () => chamar("estado");
export const assistenteConversas = () => chamar("conversas");
export const assistenteAbrir = (id) => chamar("abrir", { id });
export const assistenteEnviar = ({ conversaId, texto, modo, pesquisar }) => chamar("enviar", { conversaId, texto, modo, pesquisar });
export const assistenteRenomear = (id, titulo) => chamar("renomear", { id, titulo });
export const assistenteApagar = (id) => chamar("apagar", { id });
export const assistenteConfirmar = (id) => chamar("confirmar", { id });
export const assistenteDescartar = (id) => chamar("descartar", { id });
