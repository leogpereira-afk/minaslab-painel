// Sessao do painel MinasLab: guarda o crachá (JWT) e diz o que a pessoa pode
// abrir. O crachá vale 12h (o servidor decide). Guardamos tambem o instante do
// ultimo uso: um computador do laboratorio nao pode continuar logado no dia
// seguinte porque alguem esqueceu a tela aberta.
//
// IMPORTANTE: nada aqui autoriza coisa alguma de verdade. Esconder um item do
// menu e conforto, nao seguranca — quem manda e o servidor, que confere o
// crachá e o papel em toda chamada (supabase/functions/ml-sync).

import { SYNC } from "./api.js";

const K_TOKEN = "ml_auth_token";
const K_SESSAO = "ml_auth_sessao";
// Por que a pessoa foi parar na tela de login. Sem isso, o crachá vencia no
// meio do trabalho, a tela virava Login sem uma palavra e a impressao era de
// que o sistema tinha derrubado ela por conta propria.
const K_MOTIVO = "ml_auth_motivo";
const INATIVIDADE_MS = 12 * 60 * 60 * 1000;

// Frase unica para queda de rede — usada aqui e nos services.
export const SEM_REDE =
  "Nao consegui falar com o servidor. Confira a internet e tente de novo.";

// Ultimo recurso: o servidor respondeu erro mas nao mandou frase nenhuma.
export function mensagemDoStatus(status) {
  if (status === 401) return "Sua sessao expirou. Entre de novo.";
  if (status === 403) return "Voce nao tem acesso a esta parte do painel.";
  if (status === 404) return "Nao encontrei esse registro (talvez alguem tenha apagado).";
  if (status === 429) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  if (status >= 500) return "O servidor falhou agora. Tente de novo em instantes.";
  return "Nao consegui concluir. Tente de novo.";
}

const ouvintes = new Set();
const avisar = () => ouvintes.forEach((fn) => fn());

export function aoMudarSessao(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function getToken() {
  try {
    return localStorage.getItem(K_TOKEN) || null;
  } catch {
    return null;
  }
}

export function getSessao() {
  try {
    const raw = localStorage.getItem(K_SESSAO);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.usuario) return null;
    const visto = typeof s.visto === "number" ? s.visto : Date.now();
    if (Date.now() - visto > INATIVIDADE_MS) {
      sair("Voce ficou muito tempo sem usar o painel. Entre de novo.");
      return null;
    }
    // Cada leitura renova: quem esta usando nao e deslogado no meio do trabalho.
    localStorage.setItem(K_SESSAO, JSON.stringify({ ...s, visto: Date.now() }));
    return s;
  } catch {
    return null;
  }
}

export function gravarSessao({ token, usuario, nome, papel }) {
  try {
    localStorage.setItem(K_TOKEN, token);
    localStorage.setItem(
      K_SESSAO,
      JSON.stringify({ usuario, nome, papel: papel || "leitura", visto: Date.now() })
    );
  } catch {
    /* sem localStorage segue sem persistir */
  }
  avisar();
}

export function sair(motivo = "") {
  try {
    localStorage.removeItem(K_TOKEN);
    localStorage.removeItem(K_SESSAO);
    if (motivo) localStorage.setItem(K_MOTIVO, motivo);
    else localStorage.removeItem(K_MOTIVO);
  } catch {
    /* sem localStorage segue sem persistir */
  }
  avisar();
}

// Le e JA APAGA o motivo: a frase aparece uma vez, na volta para o login, e nao
// fica assombrando quem entrar depois no mesmo computador.
export function motivoSaida() {
  try {
    const m = localStorage.getItem(K_MOTIVO);
    if (m) localStorage.removeItem(K_MOTIVO);
    return m || "";
  } catch {
    return "";
  }
}

/* OS TRES PAPEIS DA CASA (decididos com o Leo em 27/08/2026):
     direcao — tudo, inclusive RH, Financas e a tela de Acessos
     equipe  — le e edita os modulos operacionais; nao ve RH nem Acessos
     leitura — so olha
   A regra de verdade mora no servidor; esta copia so decide o que o menu
   mostra. */
export const ehDirecao = (sessao = getSessao()) => sessao?.papel === "direcao";
export const podeEditar = (sessao = getSessao()) =>
  sessao?.papel === "direcao" || sessao?.papel === "equipe";

// Modulos que so a direcao abre. Mesma lista que o servidor usa para as
// colecoes rh_* — mudar aqui exige mudar la (ml-sync).
// "ponto" entra pela MESMA regua do RH: ele le e grava "rh_pessoas",
// "rh_ponto" e "rh_ponto_dia", que sao dado de pessoa e o servidor ja protege.
// Deixa-lo aberto a equipe abriria a folha de todo mundo por outra porta.
// "curva-abc" entra pela MESMA regua do financeiro: a tela le "fin_vendas",
// "fin_clientes" e "fin_receber" — quem comprou, quanto e de quem. E o
// faturamento da casa inteiro, so que arrumado por ranking; deixa-lo aberto a
// equipe abriria pela porta da analise o que a porta de Financas ja fecha.
const SO_DIRECAO = ["rh", "ponto", "financas", "acessos", "curva-abc"];
export function podeAbrir(modulo, sessao = getSessao()) {
  if (!sessao) return false;
  if (SO_DIRECAO.includes(modulo)) return ehDirecao(sessao);
  return true;
}

// fetch com o crachá. Sessao expirada (401) derruba para a tela de login em vez
// de deixar a pessoa olhando um erro sem saber o que fazer.
export async function comCracha(url, opcoes = {}) {
  const token = getToken();
  const headers = { ...(opcoes.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let resp;
  try {
    resp = await fetch(url, { ...opcoes, headers });
  } catch {
    throw new Error(SEM_REDE);
  }
  if (resp.status === 401) {
    const corpo = await resp.clone().json().catch(() => null);
    if (corpo?.semSessao) {
      sair("Sua sessao expirou (o cracha vale 12 horas). Entre de novo para continuar.");
      throw new Error("Sua sessao expirou. Entre de novo.");
    }
  }
  return resp;
}

// Entrar no painel: o servidor confere usuario+senha (com freio de tentativas)
// e devolve o crachá.
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
  gravarSessao(corpo);
  return corpo;
}
