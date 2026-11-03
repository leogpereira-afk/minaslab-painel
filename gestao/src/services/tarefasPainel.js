// Tarefas no painel MinasLab (função ml-tarefas), com o mesmo crachá do login.
// A tarefa aparece em Tarefas do painel, avisa no sino e lembra antes do prazo.
import { API } from "../lib/api.js";
import { comCracha } from "../lib/sessao.js";

const chamar = (action, corpo = {}) => comCracha(`${API}/ml-tarefas`, { action, ...corpo });

let cache = null;
/** Contas ativas que podem receber tarefa ({ usuarios: [{usuario, nome}], eu }). */
export function usuariosTarefas() {
  if (!cache) cache = chamar("usuarios").catch((e) => { cache = null; throw e; });
  return cache;
}
export const criarTarefa = (dados) => chamar("criar", dados);
export const concluirTarefa = (id) => chamar("status", { id, acao: "concluir" });
