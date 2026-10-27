import test from "node:test";
import assert from "node:assert/strict";
import { donosDasPropostas, pagosPorProposta, extratoColaborador, itensPagamentoPropostas, geradaNoMes } from "./comissoesProposta.js";

const RUTH = { id: "r", nome: "RUTH", crmId: "u1", desde: "2026-10-01", taxas: [{ desde: "2026-10-01", pct: 1 }] };
const VERA = { id: "v", nome: "VERA", crmId: "u2", desde: "2026-10-01", taxas: [{ desde: "2026-01-01", pct: 1 }], ativo: false };
const OS = (id, proposta, dataOs, valor, fat = "FATURADO", pag = "PAGO", emissao = dataOs) => ({ id, os: id, proposta, dataOs, emissao: fat === "FATURADO" ? emissao : "", valor, fat, pag });

function contexto(registros, propostas, os) {
  const colabs = [RUTH, VERA];
  const osPorProposta = new Map();
  for (const o of os) osPorProposta.set(o.proposta, [...(osPorProposta.get(o.proposta) || []), o]);
  const pagamentos = registros.filter((r) => r.tipo === "pagamento");
  return (c) => extratoColaborador(c, {
    dono: donosDasPropostas(colabs, registros, propostas),
    propsPorNumero: new Map(propostas.map((p) => [p.numero, p])),
    osPorProposta, pagos: pagosPorProposta(pagamentos),
    planilha: registros.filter((r) => r.tipo === "planilha" && r.colaboradorId === c.id).flatMap((r) => r.linhas),
  });
}

const REG = [
  { tipo: "planilha", colaboradorId: "r", linhas: [
    { proposta: "434", data: "2026-05-04", base: 450, valor: 4.5, pago: true },
    { proposta: "648", data: "2026-07-23", base: 11760, valor: 117.6, pago: true },
    { proposta: "16", data: "2026-09-17", base: 210, valor: 2.1, pago: true },
  ] },
  { tipo: "planilha", colaboradorId: "v", linhas: [{ proposta: "16", data: "2026-01-05", base: 200, valor: 2, pago: true }] },
  { tipo: "pagamento", colaboradorId: "r", pagoEm: "2026-06-01", planilha: true, itens: [{ proposta: "434", valor: 4.5, planilha: true }, { proposta: "648", valor: 117.6, planilha: true }, { proposta: "16", valor: 2.1, planilha: true }] },
  { tipo: "pagamento", colaboradorId: "v", pagoEm: "2026-02-01", planilha: true, itens: [{ proposta: "16", valor: 2, planilha: true }] },
];
const PROPS = [
  { numero: "434", responsavel: "u1", aceite: "2026-05-04", valor: 450, status: "APROVADA" },
  { numero: "900", responsavel: "u1", aceite: "2026-10-05", valor: 500, status: "APROVADA" },
  { numero: "800", responsavel: "u1", aceite: "2026-09-20", valor: 300, status: "APROVADA" }, // antes da contagem, fora da planilha
];
const OSS = [
  OS("a", "434", "2026-05-05", 450), OS("b", "434", "2026-06-10", 450), OS("c", "434", "2026-07-16", 450),
  OS("d", "648", "2026-07-25", 3060),
  OS("e", "900", "2026-10-06", 250, "FATURADO", "A RECEBER"), OS("f", "900", "2026-10-20", 250, "PRONTO PARA FATURAR", "AGUARDANDO"),
  OS("g", "800", "2026-10-02", 300),
  OS("h", "16", "2026-10-19", 210, "FATURADO", "A RECEBER"),
];

test("proposta antiga da planilha: regra nova menos o já pago; adiantado não vira dívida", () => {
  const ex = contexto(REG, PROPS, OSS)(RUTH);
  const l434 = ex.linhas.find((l) => l.numero === "434");
  assert.deepEqual([l434.osGeradas, l434.geradas, l434.faltaGerar, l434.gerada, l434.pago, l434.aPagar], [3, 1350, 0, 13.5, 4.5, 9]);
  const l648 = ex.linhas.find((l) => l.numero === "648");
  assert.deepEqual([l648.gerada, l648.pago, l648.aPagar, l648.adiantado, l648.faltaGerar], [30.6, 117.6, 0, 87, 8700]);
});

test("proposta nova: só aceite e OS a partir da contagem; previsão das OS a faturar", () => {
  const ex = contexto(REG, PROPS, OSS)(RUTH);
  const l900 = ex.linhas.find((l) => l.numero === "900");
  assert.deepEqual([l900.origem, l900.osGeradas, l900.faturado, l900.pagoCliente, l900.gerada, l900.previsao, l900.faltaGerar], ["crm", 2, 250, 0, 2.5, 2.5, 0]);
  assert.ok(!ex.linhas.some((l) => l.numero === "800"));
  assert.equal(geradaNoMes(ex, "2026-10"), 4.6); // 900 (2,50) + 16 (2,10)
});

test("proposta paga a duas pessoas fica com a linha mais recente e soma o pago de todos", () => {
  const run = contexto(REG, PROPS, OSS);
  const l16 = run(RUTH).linhas.find((l) => l.numero === "16");
  assert.equal(l16.pago, 4.1);
  assert.equal(l16.aPagar, 0); // gerou 2,10, já pagaram 4,10
  assert.ok(!run(VERA).linhas.some((l) => l.numero === "16"));
});

test("pagar o que falta zera a proposta", () => {
  const run = contexto(REG, PROPS, OSS);
  const ex = run(RUTH);
  const sel = ex.linhas.filter((l) => l.aPagar > 0);
  const pg = { tipo: "pagamento", colaboradorId: "r", pagoEm: "2026-10-30", itens: itensPagamentoPropostas(sel) };
  const ex2 = contexto([...REG, pg], PROPS, OSS)(RUTH);
  assert.equal(ex2.totais.aPagar, 0);
});
