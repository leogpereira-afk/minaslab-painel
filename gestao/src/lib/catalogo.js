// Catálogo de treinamentos de um setor: as trilhas prontas do setor, com o
// que a gestão mudou na tela (editar, arquivar, excluir, obrigatório ou não)
// e os treinamentos criados por ela. Fica num registro "catalogo" da coleção
// de treinamentos do setor. Regras puras.
import { TRILHAS, TEMAS } from "./trilhas.js";

export const ID_CATALOGO = "catalogo";
export const CAMPOS_EDITAVEIS = ["nome", "tema", "publico", "objetivo", "minutos", "documento", "indicador", "exercicio", "apresentacaoId"];

export function configCatalogo(registros) {
  const c = (registros || []).find((r) => r.id === ID_CATALOGO) || {};
  return { arquivadas: c.arquivadas || [], excluidas: c.excluidas || [], obrigatorio: c.obrigatorio || {}, edicoes: c.edicoes || {}, proprias: c.proprias || [] };
}

const propria = (p, setor) => ({
  perguntas: [], slides: [], roteiro: [], gatilho: "manual", indicador: "", exercicio: "", publico: "", objetivo: "", minutos: 30,
  ...p, setores: [setor], tema: p.tema || "proprios", propria: true,
});

/**
 * Treinamentos do setor com as mudanças aplicadas.
 * ativos: aparecem nas trilhas e no plano; arquivados e excluídos ficam à parte
 * (o histórico de aplicações nunca é apagado).
 */
export function catalogo(registros, setor) {
  const cfg = configCatalogo(registros);
  const base = TRILHAS.filter((t) => t.setores.includes(setor)).map((t) => ({ ...t, ...(cfg.edicoes[t.id] || {}) }));
  const todos = [...base, ...cfg.proprias.map((p) => propria(p, setor))].map((t) => ({
    ...t,
    obrigatorio: cfg.obrigatorio[t.id] !== false,
    arquivado: cfg.arquivadas.includes(t.id),
    excluido: cfg.excluidas.includes(t.id),
  }));
  return {
    cfg,
    todos,
    ativos: todos.filter((t) => !t.arquivado && !t.excluido),
    arquivados: todos.filter((t) => t.arquivado && !t.excluido),
    excluidos: todos.filter((t) => t.excluido),
  };
}

/** Treinamentos ativos agrupados por tema (só temas com algum treinamento). */
export function porTema(ativos) {
  return TEMAS.map((tm) => ({ ...tm, trilhas: ativos.filter((t) => (t.tema || "proprios") === tm.id) })).filter((g) => g.trilhas.length);
}

/** Procura em qualquer setor (para nomes no histórico). */
export const trilhaEmQualquerLugar = (cat, id) => cat.todos.find((t) => t.id === id) || TRILHAS.find((t) => t.id === id) || null;
