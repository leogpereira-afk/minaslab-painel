import test from "node:test";
import assert from "node:assert/strict";
import { resumoGastos, montarOpcoesAlvo, buscarAlvos, estimarCalibracoes, gastoPorMes, rankingGastos, idOrcamento, orcamentoDoAno, situacaoOrcamento } from "./manutencaoGastos.js";

const HOJE = "2026-10-06";
const M = (extra) => ({ id: "m", alvoTipo: "equipamento", alvoId: "e1", status: "agendada", data: "2026-10-20", custo: null, ...extra });

test("gasto soma só as feitas do ano; previsto soma as agendadas", () => {
  const r = resumoGastos([
    M({ status: "feita", data: "2026-03-10", custo: 500 }),
    M({ status: "feita", data: "2025-12-10", custo: 999 }),
    M({ status: "feita", data: "2026-05-01", custo: 100.5 }),
    M({ custo: 1200 }),
    M({ alvoTipo: "carro", custo: 300 }),
  ], HOJE);
  assert.equal(r.ano, "2026");
  assert.equal(r.gasto.total, 600.5);
  assert.equal(r.gasto.qtd, 2);
  assert.equal(r.previsto.total, 1500);
  assert.equal(r.previsto.porCategoria.carro.total, 300);
  assert.equal(r.previsto.porCategoria.equipamento.total, 1200);
  assert.equal(r.previsto.porCategoria.bem.total, 0);
});

test("custo em branco não vira zero: conta como sem valor informado", () => {
  const r = resumoGastos([M({ custo: null }), M({ custo: "" }), M({ custo: 0 }), M({ custo: 80 })], HOJE);
  assert.equal(r.previsto.total, 80);
  assert.equal(r.previsto.comValor, 2);
  assert.equal(r.previsto.semValor, 2);
  assert.equal(r.previsto.qtd, 4);
});

test("agendadas atrasadas aparecem à parte", () => {
  const r = resumoGastos([M({ data: "2026-09-01", custo: 200 }), M({ data: "2026-10-06", custo: 50 }), M({ data: "2026-11-01", custo: 10 })], HOJE);
  assert.equal(r.previsto.atrasadas.total, 200);
  assert.equal(r.previsto.atrasadas.qtd, 1);
  assert.equal(r.previsto.total, 260);
});

test("soma com centavos não acumula erro de ponto flutuante", () => {
  const r = resumoGastos([M({ custo: 0.1 }), M({ custo: 0.2 })], HOJE);
  assert.equal(r.previsto.total, 0.3);
});

test("busca por digitação acha carro, equipamento e bem do patrimônio juntos", () => {
  const opcoes = montarOpcoesAlvo({
    carros: [{ id: "c1", nome: "Fiat Strada", placa: "ABC-1234", modelo: "Strada 1.4" }],
    equipamentos: [{ id: "e1", nome: "Balança analítica" }],
    bens: [{ id: "b1", nome: "PAT-0042 · Estufa · 100L", codigo: "PAT-0042", nomeGenerico: "Estufa", marca: "Quimis", setor: "Microbiologia" }],
  });
  assert.equal(opcoes.length, 3);
  assert.deepEqual(buscarAlvos(opcoes, "balanca").map((o) => o.id), ["e1"]);
  assert.deepEqual(buscarAlvos(opcoes, "abc 1234").map((o) => o.id), ["c1"]);
  assert.deepEqual(buscarAlvos(opcoes, "estufa quimis").map((o) => o.id), ["b1"]);
  assert.deepEqual(buscarAlvos(opcoes, "pat-0042").map((o) => o.id), ["b1"]);
  assert.deepEqual(buscarAlvos(opcoes, "microbiologia").map((o) => o.id), ["b1"]);
  assert.deepEqual(buscarAlvos(opcoes, "").length, 3);
  assert.deepEqual(buscarAlvos(opcoes, "").map((o) => o.id), ["c1", "e1", "b1"]);
  assert.deepEqual(buscarAlvos(opcoes, "", "bem").map((o) => o.id), ["b1"]);
  assert.deepEqual(buscarAlvos(opcoes, "estufa", "carro"), []);
});

const F = (extra) => ({ id: Math.random().toString(36), status: "feita", alvoTipo: "bem", alvoId: "b1", alvoNome: "Estufa", tipo: "calibracao", data: "2026-03-10", custo: 1200, proxima: "2026-12-10", ...extra });

test("calibração a vencer sem agendamento vira gasto estimado com o custo da última", () => {
  const est = estimarCalibracoes([F()], HOJE);
  assert.equal(est.length, 1);
  assert.equal(est[0].custo, 1200);
  assert.equal(est[0].data, "2026-12-10");
  const r = resumoGastos([F()], HOJE);
  assert.equal(r.previsto.total, 1200);
  assert.equal(r.previsto.estimadas.total, 1200);
  assert.equal(r.previsto.agendadas.total, 0);
  assert.equal(r.previsto.porCategoria.bem.total, 1200);
});

test("calibração já agendada não é contada duas vezes", () => {
  const itens = [F(), M({ alvoTipo: "bem", alvoId: "b1", tipo: "calibracao", data: "2026-12-05", custo: 1300 })];
  assert.equal(estimarCalibracoes(itens, HOJE).length, 0);
  assert.equal(resumoGastos(itens, HOJE).previsto.total, 1300);
});

test("calibração só conta se vence até o fim do ano e se a próxima é de calibração", () => {
  assert.equal(estimarCalibracoes([F({ proxima: "2027-03-10" })], HOJE).length, 0);
  assert.equal(estimarCalibracoes([F({ tipo: "preventiva" })], HOJE).length, 0);
  assert.equal(estimarCalibracoes([F({ proxima: null })], HOJE).length, 0);
  // calibração vencida e ainda sem agendamento também é gasto que vem aí
  assert.equal(estimarCalibracoes([F({ proxima: "2026-09-01" })], HOJE).length, 1);
});

test("calibração anterior sem custo fica sem valor, não zero", () => {
  const r = resumoGastos([F({ custo: null })], HOJE);
  assert.equal(r.previsto.total, 0);
  assert.equal(r.previsto.semValor, 1);
  assert.equal(r.previsto.comValor, 0);
});

test("gasto por mês separa feito, agendado e estimado", () => {
  const itens = [
    F({ data: "2026-03-10", custo: 500, proxima: null }),
    F({ data: "2026-03-20", custo: 100, proxima: null, alvoId: "b2" }),
    M({ data: "2026-10-25", custo: 300 }),
    M({ data: "2027-01-10", custo: 999 }),
    F({ data: "2025-12-30", custo: 777, proxima: null, alvoId: "b3" }),
  ];
  const est = [{ data: "2026-12-10", custo: 1200 }, { data: "2026-11-01", custo: null }];
  const m = gastoPorMes(itens, est, "2026");
  assert.equal(m.length, 12);
  assert.equal(m[2].feito, 600);
  assert.equal(m[9].previsto, 300);
  assert.equal(m[11].estimado, 1200);
  assert.equal(m.reduce((s, x) => s + x.feito + x.previsto + x.estimado, 0), 2100);
});

test("ranking soma por alvo, ignora sem custo, ordena e respeita o ano", () => {
  const itens = [
    F({ alvoId: "b1", alvoNome: "Estufa", data: "2026-01-10", custo: 100, proxima: null }),
    F({ alvoId: "b1", alvoNome: "Estufa nova", data: "2026-06-10", custo: 400, proxima: null }),
    F({ alvoId: "b2", alvoNome: "Autoclave", data: "2026-02-10", custo: 900, proxima: null }),
    F({ alvoId: "b3", alvoNome: "Sem custo", data: "2026-02-10", custo: null, proxima: null }),
    F({ alvoId: "b4", alvoNome: "Ano passado", data: "2025-02-10", custo: 5000, proxima: null }),
    M({ alvoId: "b5", custo: 7000 }),
  ];
  const r = rankingGastos(itens, { ano: "2026" });
  assert.deepEqual(r.map((x) => [x.alvoId, x.total, x.qtd]), [["b2", 900, 1], ["b1", 500, 2]]);
  assert.equal(r[1].nome, "Estufa nova");
  assert.equal(rankingGastos(itens, { ano: "" })[0].alvoId, "b4");
  assert.equal(rankingGastos(itens, { ano: "2026", limite: 1 }).length, 1);
});

test("orçamento do ano e situação", () => {
  const reg = [{ id: idOrcamento("2026"), status: "config", valor: 10000 }, { id: idOrcamento("2025"), status: "config", valor: 5 }];
  assert.equal(orcamentoDoAno(reg, "2026"), 10000);
  assert.equal(orcamentoDoAno(reg, "2027"), null);
  assert.equal(orcamentoDoAno([{ id: idOrcamento("2026"), status: "feita", valor: 1 }], "2026"), null);
  const s = situacaoOrcamento(10000, 3000, 2000);
  assert.equal(s.pctGasto, 30);
  assert.equal(s.pctPrevisto, 20);
  assert.equal(s.restante, 5000);
  assert.equal(s.acima, false);
  const estouro = situacaoOrcamento(1000, 800, 500);
  assert.equal(estouro.acima, true);
  assert.equal(estouro.gastoAcima, false);
  assert.equal(estouro.restante, -300);
  assert.equal(estouro.pctPrevisto, 20);
  assert.equal(situacaoOrcamento(null, 1, 1), null);
  assert.equal(situacaoOrcamento(0, 1, 1), null);
});
