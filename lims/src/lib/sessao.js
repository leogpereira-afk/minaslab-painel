// Sessão do MinasLab LIMS. O login é o mesmo do painel (ml-sync, ação
// "entrar"): mesmas contas, mesmo crachá de 12 h. Mesmo desenho da Gestão
// (gestao/src/lib/sessao.js): o LIMS é publicado dentro do painel, no mesmo
// endereço, então adota o crachá de quem já entrou no painel.
//
// Esconder telas aqui é conforto; quem tranca de verdade é o servidor. Nesta
// primeira etapa as telas usam dados de demonstração guardados no navegador;
// a porta própria do LIMS no Supabase entra na etapa seguinte.

import { SYNC } from "./api.js";

const K_TOKEN = "lims_token";
const K_SESSAO = "lims_sessao";
const K_MOTIVO = "lims_motivo";
const INATIVIDADE_MS = 12 * 60 * 60 * 1000;

export const SEM_REDE = "Não consegui falar com o servidor. Confira a internet e tente de novo.";

export function mensagemDoStatus(status) {
  if (status === 401) return "Usuário ou senha não conferem.";
  if (status === 403) return "Você não tem acesso a esta parte.";
  if (status === 429) return "Muitas tentativas seguidas. Espere alguns minutos.";
  if (status >= 500) return "O servidor falhou agora. Tente de novo em instantes.";
  return "Não consegui concluir. Tente de novo.";
}

const ouvintes = new Set();
const avisar = () => ouvintes.forEach((fn) => fn());
export function aoMudarSessao(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function ler(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function gravar(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ }
}

// Login único com o painel: quem já entrou no painel não entra de novo.
const P_TOKEN = "ml_auth_token";
const P_SESSAO = "ml_auth_sessao";
function adotarPainel() {
  if (ler(K_TOKEN)) return;
  const token = ler(P_TOKEN);
  if (!token) return;
  try {
    const p = JSON.parse(ler(P_SESSAO) || "null");
    if (!p?.usuario || Date.now() - (p.visto || 0) > INATIVIDADE_MS) return;
    gravar(K_TOKEN, token);
    gravar(K_SESSAO, JSON.stringify({ usuario: p.usuario, nome: p.nome, papel: p.papel, visto: Date.now() }));
  } catch { /* sessão do painel ilegível: segue para o login */ }
}

export const getToken = () => { adotarPainel(); return ler(K_TOKEN); };

export function getSessao() {
  adotarPainel();
  try {
    const s = JSON.parse(ler(K_SESSAO) || "null");
    if (!s?.usuario) return null;
    if (Date.now() - (s.visto || 0) > INATIVIDADE_MS) {
      sair("Você ficou muito tempo sem usar. Entre de novo.");
      return null;
    }
    gravar(K_SESSAO, JSON.stringify({ ...s, visto: Date.now() }));
    return s;
  } catch {
    return null;
  }
}

// Piloto: enquanto o LIMS não tem porta própria no servidor, só a direção usa.
export const podeUsarLims = (s) => s?.papel === "direcao";

export function sair(motivo = "") {
  gravar(K_TOKEN, null);
  gravar(K_SESSAO, null);
  // Sair do LIMS sai também do painel (é o mesmo crachá); senão o login único
  // traria a pessoa de volta na hora.
  gravar(P_TOKEN, null);
  gravar(P_SESSAO, null);
  gravar(K_MOTIVO, motivo || null);
  avisar();
}

export function motivoSaida() {
  const m = ler(K_MOTIVO);
  if (m) gravar(K_MOTIVO, null);
  return m || "";
}

export async function login(usuario, senha) {
  let resp;
  try {
    resp = await fetch(SYNC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "entrar", usuario, senha }),
    });
  } catch {
    throw new Error(SEM_REDE);
  }
  const corpo = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(corpo?.erro || mensagemDoStatus(resp.status));
  gravar(K_TOKEN, corpo.token);
  gravar(K_SESSAO, JSON.stringify({ usuario: corpo.usuario, nome: corpo.nome, papel: corpo.papel, visto: Date.now() }));
  avisar();
  return corpo;
}
