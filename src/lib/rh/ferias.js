// Portado de rh/src/lib/ferias.ts (Impresilk) em 27/08/2026 — regras idênticas, campos adaptados à MinasLab.
// ============================================================================
// Quem está de férias HOJE.
//
// O registro de férias tem um campo de texto `status` (na base de origem:
// "Em aberto", "Agendada", "Em andamento", "Concluída"; na MinasLab:
// "marcada" | "concluida" | "cancelada") preenchido à mão. Ninguém volta na
// tela para avançar esse texto quando o calendário vira: período que começou
// continua escrito como agendado ("marcada") e período que terminou continua
// como se estivesse em andamento. Contar por esse texto errava nos DOIS
// sentidos — contava quem já voltou e não contava quem está fora agora.
//
// A verdade está nas DATAS. Este helper é a fonte única de "está de férias
// agora"; as telas devem usá-lo em vez de comparar o texto do status.
// ============================================================================

/**
 * Converte "AAAA-MM-DD" (ou ISO com T) em Date LOCAL de meia-noite.
 * Devolve null para vazio/inválido. (Substitui o parseData de @/lib/format
 * da origem — mesma semântica para os formatos usados aqui.)
 * @param {Date|string|null|undefined} data
 * @returns {Date|null}
 */
export function parseData(data) {
  if (!data) return null;
  if (data instanceof Date) return isNaN(data.getTime()) ? null : data;
  if (typeof data !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(data.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(data);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * O período está em curso na data informada?
 * Regra: inicio <= hoje < retorno (no dia do retorno a pessoa já voltou
 * ao trabalho).
 *
 * "concluida"/"cancelada" continuam mandando: são decisão explícita de quem
 * lançou (voltou antes, ou o período não aconteceu) e as datas não devem
 * atropelar isso. Registro sem uma das duas datas não conta — sem elas não dá
 * para afirmar que a pessoa está fora hoje.
 * @param {{inicio?: string|null, retorno?: string|null, status?: string}} f
 * @param {Date} [hoje]
 * @returns {boolean}
 */
export function feriasEmCurso(f, hoje = new Date()) {
  if (f.status === "concluida" || f.status === "cancelada") return false;
  const inicio = parseData(f.inicio);
  const retorno = parseData(f.retorno);
  if (!inicio || !retorno) return false;
  /* Compara DIA com DIA, não instante com instante.
     "Está de férias hoje?" é pergunta de calendário: ou o dia está dentro do
     período, ou não está — a hora em que alguém abriu a tela não muda isso.
     Comparando instantes, o banco (que guarda "2026-08-04T12:00:00.000Z", ou
     seja 09:00 em Brasília) respondia SIM às 10h; e o mesmo registro, depois de
     salvo pela tela (que gravava meio-dia local = 15:00Z, ou seja 12:00 aqui),
     respondia NÃO no mesmo horário. O cartão "De férias agora" caía de 1 para 0
     sem ninguém editar nada de visível. */
  const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return dia(inicio) <= dia(hoje) && dia(hoje) < dia(retorno);
}
