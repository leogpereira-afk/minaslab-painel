import test from "node:test";
import assert from "node:assert/strict";
import { somarMeses, bensComoAlvos, PERIODO_CALIBRACAO_PADRAO } from "./manutencaoRegra.js";

test("somarMeses soma meses e vira o ano", () => {
  assert.equal(somarMeses("2026-03-10", 12), "2027-03-10");
  assert.equal(somarMeses("2026-11-15", 3), "2027-02-15");
  assert.equal(PERIODO_CALIBRACAO_PADRAO, 12);
});

test("somarMeses não pula para o mês seguinte em dia inexistente", () => {
  assert.equal(somarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(somarMeses("2024-02-29", 12), "2025-02-28");
});

test("somarMeses devolve vazio com entrada inválida", () => {
  assert.equal(somarMeses("", 12), "");
  assert.equal(somarMeses("2026-01-10", "x"), "");
});

test("bensComoAlvos nomeia pela etiqueta e marca baixado como inativo", () => {
  const r = bensComoAlvos({
    a: { codigo: "Lab010", nomeGenerico: "Estufa", situacao: "uso" },
    b: { codigo: "Lab002", nomeGenerico: "Balão", volume: "25ML", situacao: "baixado" },
  });
  assert.deepEqual(r.map((x) => [x.id, x.nome, x.ativo]), [["b", "Lab002 · Balão · 25ML", false], ["a", "Lab010 · Estufa", true]]);
});
