// Regras de Contratos, no formato do GerenciaLab: o contrato nasce da
// proposta aceita ("Gerar notificação de serviço"), leva os serviços dela,
// gera as parcelas (contas a receber) e o plano de coleta (agendamentos que
// viram Ordens de Serviço). Puro e testado.

import { numeroProposta, subtotal } from "./propostas.js";

// Nº do contrato = nº da proposta sem a versão (00000959/2026), como no GerenciaLab.
export const numeroContrato = (c) => `${String(c.num).padStart(8, "0")}/${c.ano}`;

// Propostas aceitas que ainda não têm contrato.
export function contratosPendentes(propostas, contratos) {
  const comContrato = new Set(contratos.map((c) => c.propostaId));
  return propostas.filter((p) => (p.status === "Aceito" || p.status === "Gerar contrato") && !comContrato.has(p.id));
}

// Contrato a partir da proposta e dos dados da janela "Gerar notificação de serviço".
export function contratoDaProposta(p, g, por) {
  if (!g.inicio) throw new Error("Informe a data de início.");
  if (!g.fim || g.fim < g.inicio) throw new Error("A data final deve ser igual ou posterior à data de início.");
  if (g.ciclo === "Parcelado" && !(Number(g.parcelas) >= 1)) throw new Error("Informe o número de parcelas.");
  if (g.ciclo === "Parcelado" && !g.primeiroPag) throw new Error("Informe a data da primeira parcela.");
  return {
    propostaId: p.id, proposta: numeroProposta(p), num: p.num, ano: p.ano, ident: p.ident || "",
    clienteId: p.clienteId, solicitanteId: p.solicitanteId || null, centro: p.centro || "", status: "Ativo",
    inicio: g.inicio, fim: g.fim, indicacao: p.indicacao || "Sem indicação", grupoRegional: "",
    emailNF: p.emailCliNF || "", emailResultado: p.emailCliRes || "", prazoMicro: "", prazoFQ: "", responsavel: "", coleta: "MinasLab",
    obsFin: p.obsFin || "", limiteAmostras: "", tipoContrato: p.tipoContrato || "", condicoes: p.condicoes || "",
    ciclo: g.ciclo, cobrancaNa: p.cobrancaNa || "", parcelas: g.ciclo === "Parcelado" ? Number(g.parcelas) : 1,
    tipoPeriodo: g.tipoPeriodo || "Por dia Fixo", cobrarDia: g.cobrarDia || "10", primeiroPag: g.primeiroPag || "",
    cobranca: p.cobranca || "Cliente", resultado: p.resultado || "Cliente", emailCobSol: p.emailSolCob || "", emailResSol: p.emailSolRes || "",
    servicos: (p.itens || []).map((it, i) => ({ ...structuredClone(it), sid: `s${i + 1}`, status: "Ativo" })),
    outros: Number(p.outros) || 0, agendamentos: [], resp: por,
  };
}

export const totalContrato = (c) => subtotal({ itens: c.servicos.filter((s) => s.status !== "Inativo") }) + (Number(c.outros) || 0);

export function diasParaVencer(c, hojeIso) {
  if (!c.fim) return null;
  return Math.round((Date.parse(`${c.fim}T00:00:00Z`) - Date.parse(`${hojeIso}T00:00:00Z`)) / 864e5);
}

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (s) => new Date(`${s}T00:00:00Z`);
const diaUtil = (d, feriados) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !feriados.has(iso(d));
// N-ésimo dia útil do mês (1 = primeiro dia útil).
function enesimoDiaUtil(ano, mes, n, feriados) {
  const d = new Date(Date.UTC(ano, mes, 1));
  let c = 0;
  while (d.getUTCMonth() === mes) { if (diaUtil(d, feriados) && ++c === n) return iso(d); d.setUTCDate(d.getUTCDate() + 1); }
  return iso(new Date(Date.UTC(ano, mes + 1, 0)));
}

// Parcelas: valor dividido igual (centavos de sobra na última); a 1ª na data
// informada e as seguintes todo mês no dia fixo ou no N-ésimo dia útil.
export function gerarParcelas(total, n, primeira, tipoPeriodo = "Por dia Fixo", dia = "10", feriados = []) {
  n = Math.max(1, Math.floor(Number(n) || 1));
  const cent = Math.round((Number(total) || 0) * 100);
  const base = Math.floor(cent / n);
  const fer = new Set(feriados);
  const d0 = utc(primeira);
  const out = [];
  for (let i = 0; i < n; i++) {
    let venc;
    if (i === 0) venc = primeira;
    else {
      const ano = d0.getUTCFullYear(), mes = d0.getUTCMonth() + i;
      const a = ano + Math.floor(mes / 12), m = ((mes % 12) + 12) % 12;
      if (/útil|util/i.test(tipoPeriodo)) venc = enesimoDiaUtil(a, m, Number(dia) || 1, fer);
      else { const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate(); venc = iso(new Date(Date.UTC(a, m, Math.min(Number(dia) || 1, ultimo)))); }
    }
    const valor = (i === n - 1 ? cent - base * (n - 1) : base) / 100;
    out.push({ parcela: i + 1, de: n, venc, valor });
  }
  return out;
}

// Quanto de cada serviço já foi agendado (o contrato limita a quantidade).
export function saldoServicos(c) {
  const usado = {};
  for (const a of c.agendamentos || []) if (a.status !== "Cancelado") for (const s of a.servicos) usado[s.sid] = (usado[s.sid] || 0) + Number(s.qtd || 0);
  return c.servicos.map((s) => ({ ...s, agendado: usado[s.sid] || 0, saldo: Number(s.qtd || 0) - (usado[s.sid] || 0) }));
}

let seqAg = 0;
const idAg = () => `ag${Date.now().toString(36)}${(seqAg++).toString(36)}`;

export function novoAgendamento(c, { data, servicos, identificacao = "", periodo = "" }) {
  if (!data) throw new Error("Informe a data e hora do agendamento.");
  const sel = servicos.filter((s) => Number(s.qtd) > 0);
  if (!sel.length) throw new Error("Selecione ao menos um serviço com quantidade.");
  const saldo = Object.fromEntries(saldoServicos(c).map((s) => [s.sid, s.saldo]));
  for (const s of sel) if (Number(s.qtd) > (saldo[s.sid] ?? 0)) throw new Error("A quantidade passa do saldo contratado do serviço.");
  return { id: idAg(), data, identificacao, periodo, servicos: sel.map((s) => ({ sid: s.sid, qtd: Number(s.qtd) })), status: "Agendado" };
}

// Plano automático: datas a cada N dias entre início e fim (pula fim de
// semana e feriado, se pedido), cada uma com 1 de cada serviço marcado,
// até acabar o saldo.
export function planoAutomatico(c, { inicio, fim, intervaloDias, hora = "08:00", sids, pularNaoUteis = true, feriados = [] }) {
  const passo = Math.floor(Number(intervaloDias));
  if (!inicio || !fim || fim < inicio) throw new Error("Informe o período (início e fim) do plano.");
  if (!(passo >= 1)) throw new Error("Informe a frequência em dias.");
  if (!sids?.length) throw new Error("Selecione ao menos um serviço.");
  const fer = new Set(feriados);
  const saldo = Object.fromEntries(saldoServicos(c).map((s) => [s.sid, s.saldo]));
  const novos = [];
  for (let d = utc(inicio); iso(d) <= fim; d.setUTCDate(d.getUTCDate() + passo)) {
    const dia = new Date(d);
    if (pularNaoUteis) while (!diaUtil(dia, fer)) dia.setUTCDate(dia.getUTCDate() + 1);
    if (iso(dia) > fim) break;
    const servs = sids.filter((s) => saldo[s] > 0).map((sid) => { saldo[sid] -= 1; return { sid, qtd: 1 }; });
    if (!servs.length) break;
    novos.push({ id: idAg(), data: `${iso(dia)}T${hora}`, identificacao: `Coleta ${novos.length + 1}`, periodo: `a cada ${passo} dia(s)`, servicos: servs, status: "Agendado" });
  }
  if (!novos.length) throw new Error("Nenhuma data gerada: confira o período e o saldo dos serviços.");
  return novos;
}

