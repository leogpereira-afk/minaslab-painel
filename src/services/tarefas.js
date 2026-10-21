// Tarefas e notificações: conversa com as funções ml-tarefas e ml-notificacoes.
// Quem decide o que cada pessoa pode fazer é o servidor; a tela só mostra os botões.
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamar(funcao, corpo) {
  const resp = await comCracha(`${API}/${funcao}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(dados?.erro || mensagemDoStatus(resp.status));
  return dados || {};
}
const tarefas = (action, corpo = {}) => chamar("ml-tarefas", { action, ...corpo });
const avisos = (action, corpo = {}) => chamar("ml-notificacoes", { action, ...corpo });

export const tarefasUsuarios = () => tarefas("usuarios");
export const tarefasListar = (filtros = {}) => tarefas("listar", filtros);
export const tarefaObter = (id) => tarefas("obter", { id });
export const tarefaCriar = (dados) => tarefas("criar", dados);
export const tarefaAtualizar = (id, campos) => tarefas("atualizar", { id, ...campos });
export const tarefaDelegar = (id, responsavel) => tarefas("delegar", { id, responsavel });
export const tarefaStatus = (id, acao) => tarefas("status", { id, acao });
export const tarefaPessoas = (id, participantes, observadores) => tarefas("pessoas", { id, participantes, observadores });
export const tarefaChecklist = (id, acao, extra = {}) => tarefas("checklist", { id, acao, ...extra });
export const tarefaMensagem = (id, texto) => tarefas("mensagem", { id, texto });
export const tarefaExcluir = (id) => tarefas("excluir", { id });

export const avisosContar = () => avisos("contar");
export const avisosListar = (limite = 40) => avisos("listar", { limite });
export const avisoLido = (id) => avisos("lida", { id });
export const avisosTodosLidos = () => avisos("todas");

export const tarefaAnexoEnviar = (id, nome, base64) => tarefas("anexo_enviar", { id, nome, base64 });
export const tarefaAnexoUrl = (id, anexoId) => tarefas("anexo_url", { id, anexo_id: anexoId });
export const tarefaAnexoApagar = (id, anexoId) => tarefas("anexo_apagar", { id, anexo_id: anexoId });

export const tarefaRecorrencias = () => tarefas("recorrencias");
export const tarefaRecorrenciaAtivar = (id, ativa) => tarefas("recorrencia_ativar", { id, ativa });
export const tarefaRecorrenciaExcluir = (id) => tarefas("recorrencia_excluir", { id });
