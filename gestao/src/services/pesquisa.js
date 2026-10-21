// Votação anônima do Destaque do Mês (Edge Function ml-comercial).
// Ações da direção vão com crachá; as de voto são públicas e só funcionam com
// um código de uso único de uma votação aberta.
import { COMERCIAL } from "../lib/api.js";
import { comCracha, SEM_REDE, mensagemDoStatus } from "../lib/sessao.js";

const direcao = (action, corpo = {}) => comCracha(COMERCIAL, { action, ...corpo });

export const listarPesquisas = () => direcao("pesquisaListar").then((r) => r.itens || []);
export const criarPesquisa = (dados) => direcao("pesquisaCriar", dados).then((r) => r.pesquisa);
export const maisCodigos = (id, n) => direcao("pesquisaCodigos", { id, n }).then((r) => r.pesquisa);
export const mudarStatus = (id, status) => direcao("pesquisaStatus", { id, status }).then((r) => r.pesquisa);
export const apagarPesquisa = (id) => direcao("pesquisaApagar", { id });

async function publico(action, corpo) {
  let resp;
  try {
    resp = await fetch(COMERCIAL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...corpo }) });
  } catch {
    throw new Error(SEM_REDE);
  }
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) {
    const e = new Error(dados?.erro || mensagemDoStatus(resp.status));
    e.status = resp.status;
    e.precisaCodigo = !!dados?.precisaCodigo;
    throw e;
  }
  return dados;
}

export const abrirVoto = (pesquisa, codigo) => publico("votoAbrir", { pesquisa, codigo });
export const enviarVoto = (pesquisa, codigo, voto, eu = "") => publico("votoEnviar", { pesquisa, codigo, voto, eu });

/** Endereço do link de votação (funciona em qualquer hospedagem: rota no hash). */
export function linkVotacao(id, codigo = "") {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/votar/${id}${codigo ? `/${codigo}` : ""}`;
}

// ---- Avaliação da liderança por link (convite) ----
export const contasDirecao = () => direcao("conviteContas").then((r) => r.contas || []);
export const listarConvites = () => direcao("conviteListar").then((r) => r.itens || []);
export const criarConvite = (dados) => direcao("conviteCriar", dados).then((r) => r.convite);
export const revogarConvite = (id) => direcao("conviteRevogar", { id }).then((r) => r.convite);
export const abrirLideranca = (convite) => publico("liderAbrir", { convite });
export const salvarLideranca = (convite, ficha) => publico("liderSalvar", { convite, ...ficha });

/** Endereço do link de avaliação da liderança. */
export function linkLideranca(link) {
  return `${window.location.origin}${window.location.pathname}#/liderar/${link}`;
}
