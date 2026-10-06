import test from "node:test";
import assert from "node:assert/strict";
import { resumoGastos, montarOpcoesAlvo, buscarAlvos } from "./manutencaoGastos.js";

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
