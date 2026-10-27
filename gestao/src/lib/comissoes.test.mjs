import test from "node:test";
import assert from "node:assert/strict";
import { taxaEm, calcularColaborador, situacao, porMes, itensDoPagamento, validarColaborador, pagoPorOS } from "./comissoes.js";

const COLAB = { id: "c1", nome: "PESSOA A", crmId: "u1", desde: "2026-10-01", taxas: [{ desde: "2026-10-01", pct: 1 }, { desde: "2026-12-01", pct: 1.5 }] };
const PROP = [
  { numero: "001/2026", responsavel: "u1", aceite: "2026-10-05" },
  { numero: "002/2026", responsavel: "u1", aceite: "2026-09-20" }, // antes da contagem
  { numero: "003/2026", responsavel: "u2", aceite: "2026-10-05" }, // de outra pessoa
];
const OS = (id, extra) => ({ id, os: id, proposta: "001/2026", dataOs: "2026-10-10", emissao: "2026-10-20", valor: 250, fat: "FATURADO", pag: "A RECEBER", ...extra });

test("taxa vigente muda na data e não mexe no passado", () => {
  assert.equal(taxaEm(COLAB, "2026-11-30"), 1);
  assert.equal(taxaEm(COLAB, "2026-12-01"), 1.5);
  assert.equal(taxaEm(COLAB, "2026-09-01"), 1); // antes da primeira taxa vale a primeira
});

test("proposta de 500 faturada em dois meses paga 250 em cada mês", () => {
  const os = [OS("a"), OS("b", { dataOs: "2026-11-05", emissao: "2026-11-10" })];
  const c = calcularColaborador(COLAB, PROP, os);
  assert.deepEqual(c.itens.map((i) => [i.competencia, i.comissao]), [["2026-10", 2.5], ["2026-11", 2.5]]);
  const m = porMes(c, []);
  assert.equal(m.length, 2);
  assert.equal(m[0].mes, "2026-11");
});

test("só entra o que é do colaborador, aprovado depois da contagem, OS depois da contagem e faturado", () => {
  const os = [
    OS("ok"),
    OS("antiga", { dataOs: "2026-09-15" }),                 // OS antes da contagem
    OS("outra", { proposta: "002/2026" }),                  // proposta aceita antes
    OS("deOutro", { proposta: "003/2026" }),                // outra pessoa
    OS("cancel", { fat: "CANCELADO", pag: "CANCELADO" }),
    OS("nfCancel", { pag: "CANCELADO" }),
    OS("prev", { fat: "PRONTO PARA FATURAR", pag: "AGUARDANDO", emissao: null }),
  ];
  const c = calcularColaborador(COLAB, PROP, os);
  assert.deepEqual(c.itens.map((i) => i.id), ["ok"]);
  assert.deepEqual(c.previsao.map((i) => i.id), ["prev"]);
});

test("taxa nova vale para o faturado a partir dela", () => {
  const c = calcularColaborador(COLAB, PROP, [OS("x", { emissao: "2026-12-03", valor: 1000 })]);
  assert.equal(c.itens[0].pct, 1.5);
  assert.equal(c.itens[0].comissao, 15);
});

test("pago sai do a pagar; OS cancelada depois de paga vira estorno", () => {
  const c1 = calcularColaborador(COLAB, PROP, [OS("a"), OS("b")]);
  const s1 = situacao(COLAB, c1, []);
  assert.equal(s1.totalAPagar, 5);
  const pg = { id: "p1", colaboradorId: "c1", pagoEm: "2026-11-05", itens: itensDoPagamento(s1.aPagar) };
  const s2 = situacao(COLAB, c1, [pg]);
  assert.equal(s2.aPagar.length, 0);
  assert.equal(s2.totalPago, 5);
  // A OS "b" foi cancelada depois de paga.
  const c3 = calcularColaborador(COLAB, PROP, [OS("a"), OS("b", { fat: "CANCELADO", pag: "CANCELADO" })]);
  const s3 = situacao(COLAB, c3, [pg]);
  assert.equal(s3.aPagar.length, 1);
  assert.equal(s3.aPagar[0].estorno, true);
  assert.equal(s3.totalAPagar, -2.5);
  // Valor da OS mudou: só a diferença.
  const c4 = calcularColaborador(COLAB, PROP, [OS("a", { valor: 300 }), OS("b")]);
  assert.equal(situacao(COLAB, c4, [pg]).totalAPagar, 0.5);
});

test("OS já paga a outro colaborador não é paga de novo", () => {
  const c = calcularColaborador(COLAB, PROP, [OS("a"), OS("b")]);
  const s = situacao(COLAB, c, [], new Set(["a"]));
  assert.deepEqual(s.aPagar.map((i) => i.id), ["b"]);
  assert.deepEqual(s.deOutro.map((i) => i.id), ["a"]);
  assert.equal(pagoPorOS([{ colaboradorId: "x", itens: [{ osId: "a", valor: 1 }, { osId: "a", valor: 2 }] }]).x.a.valor, 3);
});

test("cadastro do colaborador", () => {
  assert.equal(validarColaborador(COLAB), "");
  assert.match(validarColaborador({ ...COLAB, crmId: "" }), /CRM/);
  assert.match(validarColaborador({ ...COLAB, taxas: [{ desde: "2026-10-01", pct: 50 }] }), /30%/);
  assert.match(validarColaborador({ ...COLAB, taxas: [{ desde: "2026-10-01", pct: 1 }, { desde: "2026-10-01", pct: 2 }] }), /mesmo dia/);
});
