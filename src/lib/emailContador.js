// Bolinha de e-mails não lidos no menu (Caixa de entrada de todas as caixas da pessoa).
// Uma consulta para o painel inteiro: confere a cada 2 minutos com a aba visível e na
// hora em que a tela de E-mail avisa que algo mudou (abriu, marcou, moveu, conectou caixa).
import { useSyncExternalStore } from "react";
import { contarNaoLidasEmail } from "../services/email.js";

const INTERVALO = 2 * 60 * 1000;
let estado = { total: 0, semCaixas: false };
const ouvintes = new Set();
let timer = null;
let atrasado = null;
let consultando = false;

function avisar(novo) {
  if (novo.total === estado.total && novo.semCaixas === estado.semCaixas) return;
  estado = novo;
  for (const f of ouvintes) f();
}

async function consultar() {
  if (consultando || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
  consultando = true;
  try {
    const r = await contarNaoLidasEmail();
    avisar({ total: Number(r?.total) || 0, semCaixas: !!r?.semCaixas });
  } catch { /* sem rede ou sessão: mantém o último número */ } finally { consultando = false; }
}

// A tela de E-mail chama depois de abrir/marcar/mover: reconta logo (com folga para o servidor).
export function emailMudou(espera = 1500) {
  clearTimeout(atrasado);
  atrasado = setTimeout(consultar, espera);
}

function assinar(f) {
  ouvintes.add(f);
  if (ouvintes.size === 1) {
    consultar();
    timer = setInterval(() => { if (!estado.semCaixas) consultar(); }, INTERVALO);
    document.addEventListener("visibilitychange", aoVoltar);
  }
  return () => {
    ouvintes.delete(f);
    if (!ouvintes.size) { clearInterval(timer); timer = null; document.removeEventListener("visibilitychange", aoVoltar); }
  };
}
function aoVoltar() { if (document.visibilityState === "visible" && !estado.semCaixas) consultar(); }

export function useNaoLidasEmail() {
  return useSyncExternalStore(assinar, () => estado.total, () => 0);
}
