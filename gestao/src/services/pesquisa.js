// Votação anônima do Destaque do Mês (Edge Function ml-comercial).
// Ações da direção vão com crachá; as de voto são públicas e só funcionam com
// um código de uso único de uma votação aberta.
import { COMERCIAL, SYNC } from "../lib/api.js";
import { comCracha, SEM_REDE, mensagemDoStatus } from "../lib/sessao.js";

const direcao = (action, corpo = {}) => comCracha(COMERCIAL, { action, ...corpo });

export const listarPesquisas = () => direcao("pesquisaListar").then((r) => r.itens || []);
export const criarPesquisa = (dados) => direcao("pesquisaCriar", dados).then((r) => r.pesquisa);
export const maisCodigos = (id, n) => direcao("pesquisaCodigos", { id, n }).then((r) => r.pesquisa);
export const mudarStatus = (id, status) => direcao("pesquisaStatus", { id, status }).then((r) => r.pesquisa);
export const apagarPesquisa = (id) => direcao("pesquisaApagar", { id });
/** Link aberto: tira a marca de "já votou" de uma pessoa (alguém votou no nome dela). */
export const liberarVoto = (id, pessoa) => direcao("pesquisaLiberar", { id, pessoa }).then((r) => r.pesquisa);

async function publico(action, corpo, token = "") {
  let resp;
  try {
    resp = await fetch(COMERCIAL, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, ...corpo }) });
  } catch {
    throw new Error(SEM_REDE);
  }
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) {
    const e = new Error(dados?.erro || mensagemDoStatus(resp.status));
    e.status = resp.status;
    e.precisaCodigo = !!dados?.precisaCodigo;
    e.precisaLogin = !!dados?.precisaLogin;
    throw e;
  }
  return dados;
}

export const abrirVoto = (pesquisa, codigo, token = "") => publico("votoAbrir", { pesquisa, codigo }, token);
export const enviarVoto = (pesquisa, codigo, voto, eu = "", token = "") => publico("votoEnviar", { pesquisa, codigo, voto, eu }, token);

/**
 * Login só para votar (votação com login): usuário e senha do painel. O crachá
 * fica só na memória desta página; não aproveita nem grava a sessão do
 * aparelho, para ninguém votar pela conta de quem deixou o painel aberto.
 */
export async function entrarParaVotar(usuario, senha) {
  let resp;
  try {
    resp = await fetch(SYNC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "entrar", usuario, senha }) });
  } catch {
    throw new Error(SEM_REDE);
  }
  const dados = await resp.json().catch(() => null);
  if (!resp.ok || !dados?.token) throw new Error(dados?.erro || mensagemDoStatus(resp.status));
  return dados.token;
}

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
