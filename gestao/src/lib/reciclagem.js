// Plano de treinamentos: para cada trilha, quais cargos precisam fazer, de
// quanto em quanto tempo reciclar, o prazo para quem acabou de entrar e o
// calendário de aplicação. Calcula a situação de cada pessoa. Regras puras.
import { treinamentosDaPessoa, notaDe, NOTA_MINIMA } from "./treinamentosPessoa.js";

export const OPCOES_PERIODO = [
  [0, "Sem reciclagem"],
  [3, "A cada 3 meses"],
  [6, "A cada 6 meses"],
  [12, "Anual (a cada 12 meses)"],
  [24, "A cada 2 anos"],
];
export const OPCOES_PRAZO_NOVO = [[0, "Sem prazo"], [15, "Até 15 dias"], [30, "Até 30 dias"], [60, "Até 60 dias"], [90, "Até 90 dias"]];

/** Sugestão inicial; a gestão muda na tela e a escolha fica gravada. */
export const PERIODO_SUGERIDO = {
  "analise-critica": 12, "crm-sem-furos": 12, "proposta-sem-erro": 12, "os-correta": 12,
  atendimento: 12, tecnico: 24, licitacoes: 0, "follow-up": 0, spin: 0, gestora: 0,
  "pg012-satisfacao": 12, "pg013-reclamacoes": 12, "pg010-recebimento": 12, "pg011-armazenamento": 12,
  "am-amostragem": 12, "am-coletas-especiais": 12, "am-purga": 12, integracao: 0, "gestao-tempo": 12, "aspecto-visual": 12,
};

/** Prazo sugerido para quem acabou de entrar (dias). */
export const PRAZO_NOVO_SUGERIDO = { integracao: 30 };

export const AVISO_DIAS = 30;
export const ID_CONFIG = "periodicidade";

/** Plano em vigor: o gravado (registro "periodicidade") ou as sugestões. */
export function planoEmVigor(registros) {
  const cfg = (registros || []).find((r) => r.id === ID_CONFIG) || {};
  return { periodos: { ...PERIODO_SUGERIDO, ...(cfg.periodos || {}) }, cargos: { ...(cfg.cargos || {}) }, prazoNovo: { ...PRAZO_NOVO_SUGERIDO, ...(cfg.prazoNovo || {}) } };
}
export const periodosEmVigor = (registros) => planoEmVigor(registros).periodos;

/** A trilha entra no plano (tem reciclagem, cargos definidos ou prazo para novos). */
export function noPlano(plano, id) {
  return (plano.periodos[id] || 0) > 0 || (plano.cargos[id] || []).length > 0 || (plano.prazoNovo[id] || 0) > 0;
}

/** A pessoa precisa fazer a trilha? Sem cargos marcados = toda a equipe do setor. */
export function obrigatoria(plano, id, pessoa) {
  const cs = plano.cargos[id] || [];
  return !cs.length || cs.includes(pessoa?.funcaoId);
}

/** "AAAA-MM-DD" + n meses (dia 31 vira o último dia do mês, se preciso). */
export function somarMesesData(iso, n) {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  const ano = Math.floor(t / 12), mes = (t % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}
export const somarDiasData = (iso, n) => new Date(Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const dias = (de, ate) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5);

/**
 * Situação de uma pessoa numa trilha.
 * - feito e com reciclagem: em dia / vence em breve / vencido (pela data da reciclagem);
 * - feito sem reciclagem: em dia;
 * - nunca feito: pendente até o prazo de novo colaborador (se houver), depois vencido;
 *   sem prazo: "nunca fez".
 */
export function situacao(ultima, meses, hoje, { entrouEm = "", prazoNovo = 0 } = {}) {
  if (ultima) {
    if (!meses) return { status: "em-dia", ultima, vence: null };
    const vence = somarMesesData(ultima, meses);
    const faltam = dias(hoje, vence);
    return { status: faltam < 0 ? "vencido" : faltam <= AVISO_DIAS ? "vence" : "em-dia", ultima, vence, faltam };
  }
  if (prazoNovo && entrouEm) {
    const vence = somarDiasData(entrouEm, prazoNovo);
    const faltam = dias(hoje, vence);
    return { status: faltam < 0 ? "vencido" : "pendente", ultima: null, vence, faltam, novo: true };
  }
  return { status: "nunca", ultima: null, vence: null };
}

/** Aplicações agendadas (registros tipo "agenda"), da mais próxima para a mais distante. */
export function agenda(registros, { desde = "", soAbertas = false } = {}) {
  return (registros || []).filter((r) => r.tipo === "agenda" && (!desde || String(r.data) >= desde) && (!soAbertas || !r.status || r.status === "agendado")).sort((a, b) => `${a.data}${a.hora || ""}`.localeCompare(`${b.data}${b.hora || ""}`));
}

/**
 * Matriz pessoa × trilha do plano, com a lista do que fazer (vencidos,
 * vencendo, pendentes de novos e quem nunca fez) e a próxima data agendada.
 */
export function matrizReciclagem({ trilhas, registros, pessoas, hoje }) {
  const plano = planoEmVigor(registros);
  const periodicas = (trilhas || []).filter((t) => noPlano(plano, t.id));
  const futuras = agenda(registros, { desde: hoje, soAbertas: true });
  const proxima = Object.fromEntries(periodicas.map((t) => [t.id, futuras.find((a) => a.trilhaId === t.id) || null]));
  const linhas = (pessoas || []).map((p) => {
    const feitos = treinamentosDaPessoa(registros, p);
    const celulas = Object.fromEntries(periodicas.map((t) => {
      if (!obrigatoria(plano, t.id, p)) return [t.id, { status: "nao-se-aplica" }];
      const feito = feitos.find((f) => f.trilhaId === t.id);
      const ultima = feito?.data || null;
      const sit = situacao(ultima, plano.periodos[t.id] || 0, hoje, { entrouEm: p.entrouEm || "", prazoNovo: plano.prazoNovo[t.id] || 0 });
      const n = notaDe(feito?.nota);
      return [t.id, n != null && n < NOTA_MINIMA ? { ...sit, status: "refazer", nota: n } : sit];
    }));
    return { pessoa: p, celulas };
  });
  const ordem = { vencido: 0, refazer: 1, vence: 2, pendente: 3, nunca: 4 };
  const pendencias = linhas.flatMap((l) => periodicas.map((t) => ({ pessoa: l.pessoa, trilha: t, agendada: proxima[t.id], ...l.celulas[t.id] })))
    .filter((x) => x.status in ordem)
    .sort((a, b) => ordem[a.status] - ordem[b.status] || String(a.vence || "9").localeCompare(String(b.vence || "9")));
  const conta = (s) => pendencias.filter((x) => x.status === s).length;
  return { plano, periodicas, periodos: plano.periodos, linhas, pendencias, proxima, totais: { vencido: conta("vencido") + conta("refazer"), vence: conta("vence"), nunca: conta("nunca") + conta("pendente") } };
}
