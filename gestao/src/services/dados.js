// Dados próprios do sistema de gestão (Comercial e Laboratório). Tudo passa
// pelo servidor do Comercial (ml-comercial), que confere em CADA leitura e
// gravação se a página está liberada para o usuário em Acessos. Os dados ficam
// nas coleções rh_comercial_* e rh_lab_* (ver acessos.mjs).
//
// Regras herdadas do painel: exclusão é lápide (nunca DELETE), e toda
// gravação devolve o registro como ficou (conferimos o efeito, não a falta
// de erro).

import { COMERCIAL } from "../lib/api.js";
import { comCracha } from "../lib/sessao.js";
import { novoId } from "../lib/format.js";
import { CHAVES } from "../../supabase/functions/ml-comercial/acessos.mjs";

const chamar = (action, corpo = {}) => comCracha(COMERCIAL, { action, ...corpo });

/** Quem sou eu e o que posso ver: { usuario, admin, setores: {setor: [páginas]} }. */
export const quemSou = () => chamar("eu");

/** Lê todas as coleções do setor numa viagem só (as não liberadas vêm vazias). */
export async function carregarTudo(setor) {
  const r = await chamar("dadosCarregar", { setor });
  const out = {};
  for (const chave of CHAVES) out[chave] = r.colecoes?.[chave] ?? [];
  return out;
}

// Nome de colaborador sempre em MAIÚSCULAS (o padrão do cadastro do RH).
const NOME_MAIUSCULO = new Set(["equipe", "destaque", "fotos"]);
export const nomeMaiusculo = (n) => String(n ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR");

export async function salvar(setor, chave, registro) {
  const reg = { ...registro };
  if (NOME_MAIUSCULO.has(chave) && typeof reg.nome === "string") reg.nome = nomeMaiusculo(reg.nome);
  if (!reg.id) reg.id = novoId(chave.slice(0, 3));
  if (!reg.criadoEm) reg.criadoEm = new Date().toISOString();
  const r = await chamar("dadosGravar", { setor, chave, registro: reg });
  if (!r?.registro?.id) throw new Error("O servidor não confirmou a gravação. Recarregue e confira.");
  return r.registro;
}

export async function apagar(setor, chave, id) {
  const r = await chamar("dadosApagar", { setor, chave, id });
  if (!r?.ok) throw new Error("O servidor não confirmou a exclusão.");
  return true;
}

/** Colaboradores ativos do RH: só id, nome e apelido (porta estreita). */
export async function elencoRH() {
  const r = await chamar("elenco");
  return r?.pessoas ?? [];
}

/** Grava uma votação histórica importada da planilha (Destaque do mês). */
export async function importarVotacao(registro) {
  const r = await chamar("dadosImportarVotacao", { registro });
  if (!r?.registro?.id) throw new Error("O servidor não confirmou a gravação. Recarregue e confira.");
  return r.registro;
}

// ---- Acessos (só administração) ----
export const listarAcessos = () => chamar("acessosListar");
export const gravarAcesso = (usuario, setores) => chamar("acessosGravar", { usuario, setores });
