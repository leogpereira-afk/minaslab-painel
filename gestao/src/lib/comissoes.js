// Comissões do Comercial: % sobre o FATURADO das propostas aprovadas.
//
// Regra (definida pela gestora):
// - Entra a proposta APROVADA no CRM cujo responsável comercial é o
//   colaborador e cujo aceite é a partir da data de contagem dele.
// - Cada OS dessa proposta (Serviços gerados, pelo nº da proposta) gera
//   comissão quando é FATURADA, no mês da emissão da nota (competência).
// - Só contam OS geradas a partir da data de contagem.
// - Base: valor a faturar da OS. Taxa: a vigente na data da emissão (o
//   histórico de taxas permite aumentar sem mexer no que já passou).
// - Pago x a pagar: cada pagamento guarda a lista das OS pagas e o valor de
//   cada uma. A pagar = comissão atual − o que já foi pago por OS; se uma OS
//   paga for cancelada ou mudar de valor, a diferença aparece como ajuste.
// - Uma OS paga a um colaborador não é paga de novo a outro (proposta que
//   trocou de responsável).

export const centavos = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const mesDe = (data) => String(data || "").slice(0, 7);

/** Taxa (%) vigente numa data: a de maior "desde" que já começou. */
export function taxaEm(colab, data) {
  const t = (colab?.taxas || []).filter((x) => x?.desde && String(x.desde) <= String(data))
    .sort((a, b) => String(b.desde).localeCompare(String(a.desde)))[0];
  return t ? Number(t.pct) || 0 : 0;
}

export const taxaAtual = (colab, hoje) => taxaEm(colab, hoje);

/** OS faturada de verdade (nota emitida e não cancelada). */
export const faturada = (os) => String(os?.fat || "").toUpperCase() === "FATURADO" && String(os?.pag || "").toUpperCase() !== "CANCELADO" && !!os?.emissao;
/** OS que ainda vai faturar (previsão). */
export const aFaturar = (os) => String(os?.fat || "").toUpperCase() === "PRONTO PARA FATURAR";

/**
 * Comissões calculadas de um colaborador.
 * propostas: [{ numero, responsavel, aceite: "AAAA-MM-DD", cliente }]
 * os: [{ id, os, proposta, cliente, servico, dataOs, emissao, valor, fat, pag, nf }]
 * Devolve { itens (faturadas), previsao (a faturar) }.
 */
export function calcularColaborador(colab, propostas, os) {
  const desde = String(colab?.desde || "");
  // Fora do cálculo: não gera comissão nova (o histórico e o saldo continuam).
  if (!colab?.crmId || !desde || colab.ativo === false) return { itens: [], previsao: [] };
  const minhas = new Map();
  for (const p of propostas) {
    if (p.responsavel === colab.crmId && p.aceite && p.aceite >= desde) minhas.set(p.numero, p);
  }
  const itens = [];
  const previsao = [];
  for (const o of os) {
    const p = minhas.get(o.proposta);
    if (!p || !o.dataOs || o.dataOs < desde) continue;
    const base = centavos(o.valor);
    if (faturada(o)) {
      const pct = taxaEm(colab, o.emissao);
      itens.push({ ...o, cliente: o.cliente || p.cliente || "", aceite: p.aceite, competencia: mesDe(o.emissao), base, pct, comissao: centavos((base * pct) / 100) });
    } else if (aFaturar(o)) {
      const pct = taxaEm(colab, o.dataOs > desde ? o.dataOs : desde);
      previsao.push({ ...o, cliente: o.cliente || p.cliente || "", aceite: p.aceite, base, pct, comissao: centavos((base * pct) / 100) });
    }
  }
  const ord = (a, b) => String(a.emissao || a.dataOs).localeCompare(String(b.emissao || b.dataOs)) || String(a.os).localeCompare(String(b.os));
  return { itens: itens.sort(ord), previsao: previsao.sort(ord) };
}

/** Quanto já foi pago por OS, por colaborador: { colabId: { osId: { valor, ultimo } } }. */
export function pagoPorOS(pagamentos) {
  const out = {};
  for (const pg of pagamentos || []) {
    const m = (out[pg.colaboradorId] ||= {});
    for (const it of pg.itens || []) {
      const x = (m[it.osId] ||= { valor: 0, ultimo: null });
      x.valor = centavos(x.valor + (Number(it.valor) || 0));
      x.ultimo = it;
    }
  }
  return out;
}

/** OS cancelada (ou desfaturada) depois de paga: só assim vira estorno. */
const OS_CANCELADA = (o) => !o || ["CANCELADO", "NAO FATURAR"].includes(String(o.fat || "").toUpperCase()) || String(o.pag || "").toUpperCase() === "CANCELADO";

/**
 * Situação de um colaborador: o que está pago, o que falta pagar e ajustes.
 * outrosPagos: Set de osId já pagos a OUTROS colaboradores.
 * extra.saldos: comissões antigas ainda não pagas (importadas da planilha).
 * extra.osPorId: Map id → OS (para saber se uma OS paga foi cancelada).
 */
export function situacao(colab, calc, pagamentos, outrosPagos = new Set(), extra = {}) {
  const osPorId = extra.osPorId;
  const pagos = pagoPorOS(pagamentos)[colab.id] || {};
  const aPagar = [];
  const vistos = new Set();
  const deOutro = [];
  for (const it of calc.itens) {
    vistos.add(it.id);
    const ja = pagos[it.id]?.valor || 0;
    if (!ja && outrosPagos.has(it.id)) { deOutro.push(it); continue; }
    const dif = centavos(it.comissao - ja);
    if (Math.abs(dif) >= 0.01) aPagar.push({ ...it, pago: ja, valor: dif, ajuste: ja !== 0 });
  }
  // Saldo antigo (planilha): o que ainda não foi pago.
  for (const it of extra.saldos || []) {
    vistos.add(it.id);
    const ja = pagos[it.id]?.valor || 0;
    const dif = centavos((Number(it.valor) || 0) - ja);
    if (dif >= 0.01) aPagar.push({ ...it, comissao: it.valor, pago: ja, valor: dif, planilha: true });
  }
  // OS que foram pagas e depois canceladas: estorno. Pagamentos antigos da
  // planilha e OS ainda a faturar (pagas adiantado) não viram estorno.
  for (const [osId, x] of Object.entries(pagos)) {
    if (vistos.has(osId) || Math.abs(x.valor) < 0.01) continue;
    if (x.ultimo?.planilha || osId.startsWith("plan-")) continue;
    if (osPorId && !OS_CANCELADA(osPorId.get(osId))) continue;
    const u = x.ultimo || {};
    aPagar.push({ id: osId, os: u.os, proposta: u.proposta, cliente: u.cliente, emissao: u.emissao, competencia: u.competencia, base: 0, pct: u.pct, comissao: 0, pago: x.valor, valor: centavos(-x.valor), ajuste: true, estorno: true });
  }
  aPagar.sort((a, b) => String(a.competencia || "").localeCompare(String(b.competencia || "")) || String(a.os).localeCompare(String(b.os)));
  const historico = Object.values(pagos).filter((x) => x.ultimo?.planilha).reduce((s, x) => s + x.valor, 0);
  const saldo = (extra.saldos || []).filter((i) => !pagos[i.id]).reduce((s, i) => s + (Number(i.valor) || 0), 0);
  const totalComissao = centavos(calc.itens.filter((i) => !deOutro.includes(i)).reduce((s, i) => s + i.comissao, 0) + historico + saldo);
  const totalPago = centavos(Object.values(pagos).reduce((s, x) => s + x.valor, 0));
  const totalAPagar = centavos(aPagar.reduce((s, i) => s + i.valor, 0));
  return { aPagar, deOutro, totalComissao, totalPago, totalAPagar };
}

/** Comissão, pago e a pagar por competência (mês da emissão). */
export function porMes(calc, pagamentosDoColab, saldos = []) {
  const m = {};
  const linha = (k) => (m[k] ||= { mes: k, faturado: 0, comissao: 0, pago: 0, os: 0, planilha: false });
  const pagos = new Set();
  for (const pg of pagamentosDoColab || []) for (const it of pg.itens || []) pagos.add(it.osId);
  for (const it of saldos) {
    if (pagos.has(it.id)) continue; // já entra pelo pagamento
    const l = linha(it.competencia);
    l.comissao = centavos(l.comissao + (Number(it.valor) || 0));
    l.planilha = true;
  }
  for (const it of calc.itens) {
    const l = linha(it.competencia);
    l.faturado = centavos(l.faturado + it.base);
    l.comissao = centavos(l.comissao + it.comissao);
    l.os += 1;
  }
  for (const pg of pagamentosDoColab || []) {
    for (const it of pg.itens || []) {
      const l = linha(it.competencia || mesDe(pg.pagoEm));
      l.pago = centavos(l.pago + (Number(it.valor) || 0));
      // Comissão antiga (planilha): o que foi pago também é a comissão do mês.
      if (it.planilha || String(it.osId).startsWith("plan-")) { l.comissao = centavos(l.comissao + (Number(it.valor) || 0)); l.planilha = true; }
    }
  }
  return Object.values(m).map((l) => ({ ...l, aPagar: centavos(l.comissao - l.pago) })).sort((a, b) => b.mes.localeCompare(a.mes));
}

/** Itens que vão para o registro do pagamento (foto do momento). */
export function itensDoPagamento(selecionados) {
  return selecionados.map((i) => ({
    osId: i.id, os: i.os ?? "", proposta: i.proposta ?? "", cliente: i.cliente ?? "", emissao: i.emissao ?? "",
    competencia: i.competencia ?? "", base: i.base ?? 0, pct: i.pct ?? 0, valor: centavos(i.valor), ...(i.ajuste ? { ajuste: true } : {}), ...(i.planilha ? { planilha: true } : {}),
  }));
}

/** Confere o cadastro de um colaborador antes de gravar. */
export function validarColaborador(c) {
  if (!String(c?.nome || "").trim()) return "Informe o nome.";
  if (!c?.crmId) return "Escolha o usuário do CRM (responsável comercial das propostas).";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c?.desde || ""))) return "Informe a data de contagem.";
  const taxas = c?.taxas || [];
  if (!taxas.length) return "Informe a taxa de comissão.";
  for (const t of taxas) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.desde || ""))) return "Cada taxa precisa da data em que começa a valer.";
    const p = Number(t.pct);
    if (!isFinite(p) || p < 0 || p > 30) return "Taxa entre 0% e 30%.";
  }
  if (new Set(taxas.map((t) => t.desde)).size !== taxas.length) return "Duas taxas começando no mesmo dia.";
  return "";
}

/** Planilha (CSV para o Excel, com ; e BOM) de uma lista de itens de comissão. */
export function csvItens(itens, { titulo = "" } = {}) {
  const n = (v) => String(Number(v || 0).toFixed(2)).replace(".", ",");
  const t = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const d = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
  const linhas = [];
  if (titulo) linhas.push(t(titulo));
  linhas.push(["Competência", "Proposta", "OS", "Cliente", "Emissão NF", "Faturado", "%", "Comissão"].join(";"));
  for (const i of itens) linhas.push([t(i.competencia), t(i.proposta), t(i.os), t(i.cliente), t(d(i.emissao)), n(i.base), n(i.pct), n(i.valor ?? i.comissao)].join(";"));
  linhas.push(["", "", "", "", "", "", t("Total"), n(itens.reduce((s, i) => s + Number(i.valor ?? i.comissao ?? 0), 0))].join(";"));
  return "﻿" + linhas.join("\r\n");
}
