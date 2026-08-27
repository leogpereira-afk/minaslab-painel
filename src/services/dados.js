// A UNICA porta de dados do painel: tudo passa por aqui e chega na Edge
// Function ml-sync. Nenhuma tela fala com o servidor por conta propria — um
// ponto de saida so e o que deixa conferir, num lugar so, que toda chamada
// leva o crachá e trata erro do mesmo jeito.

import { SYNC } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";
import { novoId } from "../lib/format.js";

async function chamar(action, corpo = {}) {
  const resp = await comCracha(SYNC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...corpo }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro || mensagemDoStatus(resp.status));
  return body;
}

// Le a colecao INTEIRA, pagina a pagina (o servidor pagina no banco; "traz
// tudo de uma vez" tem teto de 1000 no PostgREST e mente sem avisar).
// Cursor composto (atualizado_em + id): registro que divide o instante com a
// fronteira da pagina nao pode sumir calado. Dedup por id: um registro editado
// no meio da varredura reapareceria no fim — vale a versao mais nova.
// Registros apagados (lapide) ficam de fora.
export async function listar(colecao) {
  const porId = new Map();
  let desde = "";
  let desdeId = "";
  for (;;) {
    const r = await chamar("list", { colecao, desde, desdeId, limite: 500 });
    for (const linha of r.itens || []) {
      porId.set(linha.id, linha);
    }
    if (!r.proximo) break;
    desde = r.proximo;
    desdeId = r.proximoId || "";
  }
  return [...porId.values()].filter((l) => !l.apagado).map((l) => l.registro);
}

// Grava e CONFERE O EFEITO: o servidor devolve o registro como ficou; "nao deu
// erro" nao e "gravou" (licao paga na Impresilk). Devolve o registro gravado.
export async function salvar(colecao, registro) {
  const reg = { ...registro };
  if (!reg.id) reg.id = novoId(colecao.slice(0, 3));
  if (!reg.criadoEm) reg.criadoEm = new Date().toISOString();
  const r = await chamar("upsert", { colecao, registro: reg });
  if (!r?.registro?.id) throw new Error("O servidor nao confirmou a gravacao. Recarregue e confira.");
  return r.registro;
}

export async function apagar(colecao, id) {
  const r = await chamar("delete", { colecao, id });
  if (!r?.ok) throw new Error("O servidor nao confirmou a exclusao.");
  return true;
}

export const lerCfg = () => chamar("getCfg").then((r) => r.config || {});
export const salvarCfg = (config) => chamar("setCfg", { config });

// Quem trabalha aqui (id + nome), para os seletores de equipe (coletas,
// responsavel do compromisso). E uma porta ESTREITA de proposito: devolve so
// id, nome e apelido — a ficha completa do RH e assunto da direcao.
export const elenco = () => chamar("elenco").then((r) => r.pessoas || []);

// ---- Contas (so a direcao; o servidor confere) ----
export const contasListar = () => chamar("contasListar").then((r) => r.contas || []);
export const contaCriar = (dados) => chamar("contaCriar", dados);
export const contaSenha = (usuario, senha) => chamar("contaSenha", { usuario, senha });
export const contaAtiva = (usuario, ativo) => chamar("contaAtiva", { usuario, ativo });
// A propria pessoa troca a propria senha (qualquer papel).
export const trocarMinhaSenha = (senhaAtual, senhaNova) =>
  chamar("trocarSenha", { senhaAtual, senhaNova });
