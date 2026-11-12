// Reclamações de clientes (ISO/IEC 17025 · 7.9; PG 013; formulário FM-LAB-113, antigo RRC).
// Regras usadas pelo servidor (ml-qualidade) e pela tela — testadas em src/lib/reclamacoes.test.mjs.
//
// Fluxo: RECEBIDA → VALIDACAO → INVESTIGACAO → RESPOSTA → ENCERRADA.
// Improcedente (validação "não procede") pula a investigação e vai direto à resposta ao cliente.

export const ETAPAS_RECLAMACAO = [
  ["RECEBIDA", "Recebida"],
  ["VALIDACAO", "Validação"],
  ["INVESTIGACAO", "Investigação e ação"],
  ["RESPOSTA", "Resposta ao cliente"],
  ["ENCERRADA", "Encerrada"],
];
export const CLASSIFICACOES = [
  ["CRITICA", "Crítica", "Impacto regulatório, legal ou técnico significativo"],
  ["ALTA", "Alta", "Impacto relevante no resultado do cliente"],
  ["MEDIA", "Média", "Impacto limitado"],
  ["BAIXA", "Baixa", "Impacto administrativo ou menor"],
];
export const CANAIS = [["EMAIL", "E-mail"], ["WHATSAPP", "WhatsApp"], ["TELEFONE", "Telefone"], ["SITE", "Site"], ["PRESENCIAL", "Presencial"], ["OUTRO", "Outro"]];
// Prazo de resposta ao cliente, em dias corridos a partir do recebimento (Ana, 12/11/2026).
export const PRAZO_RESPOSTA_DIAS = { CRITICA: 5, ALTA: 10, MEDIA: 15, BAIXA: 30 };
// Confirmação do recebimento ao reclamante (7.9.4): até 2 dias úteis.
export const DIAS_UTEIS_CONFIRMACAO = 2;

const ymd = (d) => d.toISOString().slice(0, 10);
const deYmd = (s) => new Date(`${s}T12:00:00Z`);

export function somaDias(dataYmd, dias) {
  const d = deYmd(dataYmd); d.setUTCDate(d.getUTCDate() + dias); return ymd(d);
}
/** Soma dias úteis (seg–sex). Feriados não entram na conta. */
export function somaDiasUteis(dataYmd, dias) {
  const d = deYmd(dataYmd);
  let falta = dias;
  while (falta > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const s = d.getUTCDay();
    if (s !== 0 && s !== 6) falta--;
  }
  return ymd(d);
}
export const prazoResposta = (recebidaYmd, classificacao) => somaDias(recebidaYmd, PRAZO_RESPOSTA_DIAS[classificacao] ?? PRAZO_RESPOSTA_DIAS.MEDIA);
export const prazoConfirmacao = (recebidaYmd) => somaDiasUteis(recebidaYmd, DIAS_UTEIS_CONFIRMACAO);

/** Próximo protocolo do ano: "RRC 001/2026". Sequência por ano, sem reaproveitar número. */
export function proximoCodigo(codigosExistentes, ano) {
  const re = new RegExp(`^RRC (\\d+)/${ano}$`);
  const max = Math.max(0, ...codigosExistentes.map((c) => Number(String(c).match(re)?.[1]) || 0));
  return `RRC ${String(max + 1).padStart(3, "0")}/${ano}`;
}

const tem = (v) => String(v ?? "").trim() !== "";

/** Próxima etapa no fluxo (improcedente pula a investigação). */
export function proximaEtapa(r) {
  if (r.etapa === "RECEBIDA") return "VALIDACAO";
  if (r.etapa === "VALIDACAO") return r.procedente === false ? "RESPOSTA" : "INVESTIGACAO";
  if (r.etapa === "INVESTIGACAO") return "RESPOSTA";
  if (r.etapa === "RESPOSTA") return "ENCERRADA";
  return null;
}

/**
 * O que falta para seguir de etapa. Devolve a mensagem do primeiro problema, ou null.
 * Regras do PG 013 e do 7.9: registrar com descrição e classificação; validar (procede ou não, e por quê)
 * e confirmar o recebimento ao reclamante; investigar; responder; e quem analisa/aprova não pode estar envolvido.
 */
export function faltaParaSeguir(r, para) {
  if (para === "VALIDACAO") {
    if (!tem(r.descricao)) return "Descreva a reclamação.";
    if (!tem(r.cliente_nome) && !tem(r.reclamante)) return "Informe o cliente ou o reclamante.";
    if (r.classificacao === "CRITICA" && !tem(r.acao_imediata)) return "Reclamação crítica: registre a ação imediata.";
  }
  if (para === "INVESTIGACAO" || (para === "RESPOSTA" && r.etapa === "VALIDACAO")) {
    if (r.procedente !== true && r.procedente !== false) return "Diga se a reclamação procede (se é sobre atividade do laboratório).";
    if (!tem(r.validacao)) return "Explique a validação: por que procede ou não procede.";
    if (!tem(r.confirmada_em)) return "Registre quando o recebimento foi confirmado ao reclamante.";
  }
  if (para === "RESPOSTA" && r.etapa === "INVESTIGACAO") {
    if (!tem(r.analise)) return "Registre a análise / investigação (causa).";
    if (!tem(r.acao)) return "Registre a ação tomada (ou por que não foi preciso ação).";
  }
  if (para === "ENCERRADA") {
    if (!tem(r.resposta)) return "Registre a resposta dada ao cliente.";
    if (!tem(r.respondida_em)) return "Informe quando o cliente recebeu a resposta.";
    if (!tem(r.analisado_por) || !tem(r.aprovado_por)) return "Informe quem analisou e quem aprovou.";
    const envolvidos = Array.isArray(r.envolvidos) ? r.envolvidos : [];
    if (envolvidos.includes(r.analisado_por) || envolvidos.includes(r.aprovado_por)) return "Quem analisa e quem aprova não pode estar envolvido no serviço reclamado (7.9.6).";
    if (!tem(r.encerramento)) return "Registre o encerramento / análise de tendência.";
  }
  return null;
}

/** Situação de prazo para a lista e os alertas. */
export function alertasPrazo(r, hojeYmd) {
  if (r.etapa === "ENCERRADA") return [];
  const out = [];
  if (!tem(r.confirmada_em) && r.prazo_confirmacao && r.prazo_confirmacao < hojeYmd) out.push("confirmação atrasada");
  if (!tem(r.respondida_em) && r.prazo_resposta && r.prazo_resposta < hojeYmd) out.push("resposta atrasada");
  return out;
}
