// A conversa com o relógio de ponto (Jibble), sempre pela Edge Function
// ml-ponto — o navegador nunca fala com o Jibble direto: a credencial mora no
// servidor, e este repositório é público.
//
// Toda importação é COMANDADA PELA TELA, uma janela por chamada: a Edge
// Function tem teto de 150s, e uma varredura de mês inteiro estoura. Em troca,
// a tela mostra onde está e pode parar — e o que já veio fica gravado.

import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

const BASE = `${API}/ml-ponto`;

async function chamar(action, corpo = {}) {
  const resp = await comCracha(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...corpo }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro || mensagemDoStatus(resp.status));
  return body;
}

// O relógio está ligado? (responde sem falar com o Jibble)
export const estadoDoRelogio = () => chamar("estado");

// Confere a credencial e pergunta a cada fonte quem responde — é o caso de
// controle antes de confiar em qualquer número importado.
export const diagnosticar = (de, ate) => chamar("diagnostico", { de, ate });

// As pessoas cadastradas no relógio, para vincular a cada ficha do RH.
export const pessoasDoRelogio = () => chamar("pessoas").then((r) => r.pessoas || []);

/* Importa o período inteiro, janela a janela. `aoAndar` recebe o progresso
   para a tela mostrar; devolve o total. Erro no meio NÃO descarta o que já
   veio (cada janela grava antes de devolver) — a frase do erro sobe para
   quem chamou decidir. */
export async function importarPeriodo(de, ate, aoAndar) {
  let skip = 0;
  let lidos = 0;
  let gravados = 0;
  let preservados = 0;
  for (;;) {
    const r = await chamar("importar", { de, ate, skip });
    lidos += r.lidos || 0;
    gravados += r.gravados || 0;
    preservados += r.preservados || 0;
    aoAndar?.({ lidos, gravados, preservados, total: r.total ?? null });
    if (!r.proximaSkip) break;
    skip = r.proximaSkip;
  }
  await chamar("carimbarImportacao", { resumo: { de, ate, lidos, gravados, preservados } });
  return { lidos, gravados, preservados };
}
