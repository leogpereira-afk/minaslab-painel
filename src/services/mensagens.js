// Messenger: conversa com a função ml-messenger. Quem pode ler cada conversa é decidido no servidor.
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";
import { encurtarNomes } from "../lib/nomes.js";

async function chamar(corpo) {
  const resp = await comCracha(`${API}/ml-messenger`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(dados?.erro || mensagemDoStatus(resp.status));
  return encurtarNomes(dados || {});
}
const msg = (action, corpo = {}) => chamar({ action, ...corpo });

export const mensagensUsuarios = () => msg("usuarios");
export const conversasListar = () => msg("conversas");
export const conversasContar = () => msg("contar");
export const conversaAbrirDireta = (com) => msg("abrir_direta", { com });
export const conversaCriarGrupo = (nome, membros) => msg("criar_grupo", { nome, membros });
export const conversaObter = (id, extra = {}) => msg("obter", { id, ...extra });
export const conversaEnviar = (id, texto) => msg("enviar", { id, texto });
export const conversaMembros = (id, adicionar = [], remover = []) => msg("membros", { id, adicionar, remover });
export const conversaSair = (id) => msg("sair", { id });
export const conversaRenomear = (id, nome) => msg("renomear", { id, nome });
export const conversaSilenciar = (id, silenciado) => msg("silenciar", { id, silenciado });
export const conversaApagarMensagem = (id, mensagemId) => msg("apagar_mensagem", { id, mensagem_id: mensagemId });

/** Avisa o contador do menu que algo mudou (aberta uma conversa, enviada uma mensagem). */
export const avisarContador = () => { try { window.dispatchEvent(new Event("mensagens:atualizar")); } catch { /* sem window */ } };
export const conversaFotoGrupo = (id, base64) => msg("foto_grupo", { id, base64 });
export const conversaFotoGrupoRemover = (id) => msg("foto_grupo", { id, remover: true });
export const conversaDescricao = (id, descricao) => msg("descricao", { id, descricao });
export const conversaEnviarArquivo = (id, nome, base64, texto = "") => msg("enviar_arquivo", { id, nome, base64, texto });
export const conversaArquivoUrl = (id, mensagemId, baixar = false) => msg("arquivo_url", { id, mensagem_id: mensagemId, baixar });
export const conversaEnviarAudio = (id, nome, base64, duracao) => msg("enviar_arquivo", { id, nome, base64, duracao });
export const conversaEditarMensagem = (id, mensagemId, texto) => msg("editar_mensagem", { id, mensagem_id: mensagemId, texto });
export const conversaReagir = (id, mensagemId, emoji) => msg("reagir", { id, mensagem_id: mensagemId, emoji });
