// Porta de dados da Academy (gestão). Fala só com a Edge Function
// ml-academy-gestao, que confere crachá e permissão em toda chamada.
import { ACADEMY_GESTAO } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamar(action, corpo = {}) {
  const resp = await comCracha(ACADEMY_GESTAO, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...corpo }) });
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
