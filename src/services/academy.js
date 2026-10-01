// Porta de dados da Academy (gestão). Fala só com a Edge Function
// ml-academy-gestao, que confere crachá e permissão em toda chamada.
import { ACADEMY, ACADEMY_GESTAO } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamar(action, corpo = {}, url = ACADEMY_GESTAO) {
  const resp = await comCracha(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...corpo }) });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro || mensagemDoStatus(resp.status));
  return body;
}
export const academyContexto = () => chamar("contexto");
export const treinamentosListar = () => chamar("treinamentosListar").then((r) => r.treinamentos || []);
export const treinamentoCriar = (titulo, categoriaId) => chamar("treinamentoCriar", { titulo, categoriaId }).then((r) => r.id);
export const treinamentoObter = (id, versaoId = "") => chamar("treinamentoObter", { id, versaoId });
export const treinamentoMeta = (id, categoriaId, responsavelPessoaId) => chamar("treinamentoMeta", { id, categoriaId, responsavelPessoaId });
export const versaoSalvar = (versaoId, dados) => chamar("versaoSalvar", { versaoId, dados });
export const versaoValidarQualidade = (versaoId, cargaValidada) => chamar("versaoValidarQualidade", { versaoId, cargaValidada });
export const versaoPublicar = (versaoId) => chamar("versaoPublicar", { versaoId });
export const novaVersao = (treinamentoId) => chamar("novaVersao", { treinamentoId }).then((r) => r.versaoId);
export const treinamentoArquivar = (id) => chamar("treinamentoArquivar", { id });
export const publicoSalvar = (treinamentoId, itens) => chamar("publicoSalvar", { treinamentoId, itens });
export const grupoSalvar = (g) => chamar("grupoSalvar", g);
export const vinculosListar = () => chamar("vinculosListar");
export const vinculoSalvar = (usuario, pessoaId) => chamar("vinculoSalvar", { usuario, pessoaId });
export const publicoAplicar = (treinamentoId) => chamar("publicoAplicar", { treinamentoId });

// Área do colaborador (função ml-academy).
const col = (action, corpo) => chamar(action, corpo, ACADEMY);
export const minhaAcademy = () => col("minha");
export const catalogo = () => col("catalogo").then((r) => r.treinamentos || []);
export const catalogoMatricular = (treinamentoId) => col("catalogoMatricular", { treinamentoId }).then((r) => r.atribuicaoId);
export const treinamentoAbrirColab = (atribuicaoId) => col("treinamentoAbrir", { atribuicaoId });
export const aulaRegistrar = (atribuicaoId, aulaId, concluir, resposta) => col("aulaRegistrar", { atribuicaoId, aulaId, concluir, resposta });
export const tentativaIniciar = (atribuicaoId) => col("tentativaIniciar", { atribuicaoId });
export const tentativaEnviar = (tentativaId, respostas) => col("tentativaEnviar", { tentativaId, respostas });
export const certificadosListar = () => col("certificados").then((r) => r.certificados || []);
export const certificadoObter = (id) => col("certificadoObter", { id }).then((r) => r.certificado);
export const notificacoesListar = () => col("notificacoes").then((r) => r.notificacoes || []);
export const notificacaoLer = (id) => col("notificacaoLer", { id });
