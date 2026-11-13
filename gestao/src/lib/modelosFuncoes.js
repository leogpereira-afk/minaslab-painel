// Modelos de descrição de função (DF) que "Funções e cargos" oferece para
// carregar em cada setor: as descrições da MinasLab (cargosMinasLab.js) e as
// do plano de carreira (cargosPlano.js). Um modelo só aparece se o setor ainda
// não tem a função — reconhecida pelo nome ou pelo nível do plano (nome atual
// ou antigo, ver planoCarreira.js), para nunca criar cópia.
import { CARGOS_MINASLAB } from "./cargosMinasLab.js";
import { CARGOS_PLANO } from "./cargosPlano.js";
import { nivelDaFuncao } from "./planoCarreira.js";

const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const TODOS_MODELOS = [...CARGOS_MINASLAB, ...CARGOS_PLANO];

export function modelosDoSetor(setor, funcoes) {
  const temNivel = new Set(funcoes.map((f) => nivelDaFuncao(f.nome)?.id).filter(Boolean));
  const temNome = new Set(funcoes.map((f) => norm(f.nome)));
  return TODOS_MODELOS.filter((m) => m.setor === setor && !temNome.has(norm(m.nome)) && !(m.nivelId && temNivel.has(m.nivelId)));
}

/** Já existe outra função com este nome (ignora acento e caixa)? */
export const nomeRepetido = (funcoes, nome, idProprio = "") => funcoes.some((f) => f.id !== idProprio && norm(f.nome) === norm(nome));
