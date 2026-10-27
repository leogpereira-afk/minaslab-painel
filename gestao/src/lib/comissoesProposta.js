// Comissões por PROPOSTA (o extrato que a gestora usa para responder ao
// colaborador). Regra definida pela gestora:
//
// - A comissão de uma proposta é a taxa (1%) sobre cada OS FATURADA dela
//   (nota emitida), com a taxa vigente na data da emissão.
// - Quais propostas são de quem:
//     * as da planilha antiga (jan–set) são de quem aparece nela; se aparece
//       mais de uma pessoa, fica com a linha mais recente;
//     * as novas: aprovadas no CRM, responsável comercial = colaborador, aceite
//       a partir da data de contagem (e só OS geradas a partir dela).
// - Propostas da planilha seguem a regra nova: contam todas as OS faturadas,
//   e o que a planilha já pagou é descontado.
// - Pago é por proposta (planilha + pagamentos registrados aqui, de qualquer
//   pessoa: a mesma proposta nunca é paga duas vezes). A pagar = gerada −
//   paga; se a planilha pagou mais do que a proposta gerou até agora, a
//   diferença fica como "adiantado" e é consumida pelas próximas OS.

import { centavos, taxaEm, faturada, aFaturar } from "./comissoes.js";

const CANCELADA = (o) => ["CANCELADO", "NAO FATURAR"].includes(String(o.fat || "").toUpperCase()) || String(o.pag || "").toUpperCase() === "CANCELADO";
const clientePagou = (o) => String(o.pag || "").toUpperCase() === "PAGO";

/** Linhas da planilha de um colaborador (registro tipo "planilha"). */
export const linhasPlanilha = (registros, colabId) =>
  registros.filter((r) => r.tipo === "planilha" && r.colaboradorId === colabId).flatMap((r) => r.linhas || []);

/**
 * Dono de cada proposta: Map numero → { colabId, origem: "planilha"|"crm" }.
 * colabs: cadastros; registros: tudo da coleção; propostas: do CRM.
 */
export function donosDasPropostas(colabs, registros, propostas) {
  const dono = new Map();
  const quando = new Map();
  for (const c of colabs) {
    for (const l of linhasPlanilha(registros, c.id)) {
      const d = l.data || "";
      if (!dono.has(l.proposta) || d >= quando.get(l.proposta)) { dono.set(l.proposta, { colabId: c.id, origem: "planilha" }); quando.set(l.proposta, d); }
    }
  }
  for (const c of colabs) {
    if (c.ativo === false || !c.crmId || !c.desde) continue;
    for (const p of propostas) {
      if (dono.has(p.numero)) continue;
      if (p.responsavel === c.crmId && String(p.status || "APROVADA").toUpperCase() === "APROVADA" && p.aceite && p.aceite >= c.desde) dono.set(p.numero, { colabId: c.id, origem: "crm" });
    }
  }
  return dono;
}

/** Pagamentos por proposta (de qualquer pessoa): Map numero → [{ valor, pagoEm, colaboradorId, planilha, pagamentoId }]. */
export function pagosPorProposta(pagamentos) {
  const m = new Map();
  for (const pg of pagamentos || []) {
    for (const it of pg.itens || []) {
      if (!it.proposta) continue;
      if (!m.has(it.proposta)) m.set(it.proposta, []);
      m.get(it.proposta).push({ valor: Number(it.valor) || 0, pagoEm: pg.pagoEm, colaboradorId: pg.colaboradorId, planilha: !!(it.planilha || pg.planilha), pagamentoId: pg.id, obs: pg.obs || "" });
    }
  }
  return m;
}

/**
 * Extrato de um colaborador, uma linha por proposta.
 * ctx: { dono, propsPorNumero: Map, osPorProposta: Map, pagos: Map, planilha: linhas do colaborador }
 */
export function extratoColaborador(colab, ctx) {
  const linhasPl = new Map();
  for (const l of ctx.planilha || []) { if (!linhasPl.has(l.proposta)) linhasPl.set(l.proposta, []); linhasPl.get(l.proposta).push(l); }
  const linhas = [];
  for (const [numero, d] of ctx.dono) {
    if (d.colabId !== colab.id) continue;
    const prop = ctx.propsPorNumero.get(numero);
    const pl = linhasPl.get(numero) || [];
    const desdeOS = d.origem === "planilha" ? "" : colab.desde;
    const todas = (ctx.osPorProposta.get(numero) || []).filter((o) => !desdeOS || (o.dataOs && o.dataOs >= desdeOS));
    const os = todas.map((o) => {
      const fat = faturada(o);
      const pct = fat ? taxaEm(colab, o.emissao) : aFaturar(o) ? taxaEm(colab, o.dataOs) : 0;
      return { ...o, cancelada: CANCELADA(o), faturada: fat, aFaturar: aFaturar(o), clientePagou: clientePagou(o), pct, comissao: fat ? centavos((o.valor * pct) / 100) : 0 };
    }).sort((a, b) => String(a.dataOs).localeCompare(String(b.dataOs)));
    const vivas = os.filter((o) => !o.cancelada);
    const valorProposta = prop?.valor != null ? Number(prop.valor) : pl.length ? Math.max(...pl.map((l) => l.base || 0)) : 0;
    const geradas = centavos(vivas.reduce((s, o) => s + o.valor, 0));
    const faturado = centavos(vivas.filter((o) => o.faturada).reduce((s, o) => s + o.valor, 0));
    const pagoCliente = centavos(vivas.filter((o) => o.clientePagou).reduce((s, o) => s + o.valor, 0));
    const gerada = centavos(os.reduce((s, o) => s + o.comissao, 0));
    const previsao = centavos(os.filter((o) => o.aFaturar).reduce((s, o) => s + (o.valor * o.pct) / 100, 0));
    const pagamentos = (ctx.pagos.get(numero) || []).slice().sort((a, b) => String(a.pagoEm).localeCompare(String(b.pagoEm)));
    const pago = centavos(pagamentos.reduce((s, p) => s + p.valor, 0));
    const dif = centavos(gerada - pago);
    linhas.push({
      numero, origem: d.origem, cliente: prop?.cliente || pl[0]?.cliente || vivas[0]?.cliente || "", aceite: prop?.aceite || "", status: prop?.status || (pl.length ? "" : "APROVADA"),
      valorProposta: centavos(valorProposta), osGeradas: vivas.length, geradas, faltaGerar: centavos(Math.max(0, valorProposta - geradas)),
      faturado, pagoCliente, gerada, pago, aPagar: dif > 0 ? dif : 0, adiantado: dif < 0 ? -dif : 0, previsao,
      os, pagamentos, planilha: pl,
    });
  }
  linhas.sort((a, b) => b.aPagar - a.aPagar || String(b.numero).localeCompare(String(a.numero)));
  const soma = (k) => centavos(linhas.reduce((s, l) => s + l[k], 0));
  return {
    linhas,
    totais: { propostas: linhas.length, valorProposta: soma("valorProposta"), geradas: soma("geradas"), faltaGerar: soma("faltaGerar"), faturado: soma("faturado"), pagoCliente: soma("pagoCliente"), gerada: soma("gerada"), pago: soma("pago"), aPagar: soma("aPagar"), adiantado: soma("adiantado"), previsao: soma("previsao") },
  };
}

/** Comissão gerada num mês (pela emissão da nota). */
export const geradaNoMes = (extrato, mes) => centavos(extrato.linhas.reduce((s, l) => s + l.os.filter((o) => o.faturada && String(o.emissao).startsWith(mes)).reduce((t, o) => t + o.comissao, 0), 0));

/** Itens do pagamento: o que falta de cada proposta escolhida. */
export const itensPagamentoPropostas = (linhas) => linhas.map((l) => ({
  osId: `prop-${l.numero}`, proposta: l.numero, cliente: l.cliente, base: l.faturado, gerada: l.gerada, jaPago: l.pago, valor: l.aPagar,
}));

/** CSV (Excel) do extrato. */
export function csvExtrato(linhas, titulo = "") {
  const n = (v) => Number(v || 0).toFixed(2).replace(".", ",");
  const t = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const out = [];
  if (titulo) out.push(t(titulo));
  out.push(["Proposta", "Cliente", "Valor da proposta", "OS geradas", "Valor das OS", "Falta gerar", "Faturado", "Cliente pagou", "Comissão gerada", "Pago", "A pagar", "Adiantado"].join(";"));
  for (const l of linhas) out.push([t(l.numero), t(l.cliente), n(l.valorProposta), l.osGeradas, n(l.geradas), n(l.faltaGerar), n(l.faturado), n(l.pagoCliente), n(l.gerada), n(l.pago), n(l.aPagar), n(l.adiantado)].join(";"));
  return "﻿" + out.join("\r\n");
}
