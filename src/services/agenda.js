// Agenda da equipe: conversa com a função ml-agenda. Quem vê e quem muda cada evento é decidido no servidor.
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamar(action, corpo = {}) {
  const resp = await comCracha(`${API}/ml-agenda`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...corpo }) });
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(dados?.erro || mensagemDoStatus(resp.status));
  return dados || {};
}

export const agendaUsuarios = () => chamar("usuarios");
export const agendaListar = (de, ate) => chamar("listar", { de, ate });
export const agendaCriar = (dados) => chamar("criar", dados);
export const agendaAtualizar = (id, dados) => chamar("atualizar", { id, ...dados });
export const agendaCancelar = (id) => chamar("cancelar", { id });
