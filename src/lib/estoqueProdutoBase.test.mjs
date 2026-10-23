import test from "node:test";
import assert from "node:assert/strict";
import { acharProdutoBase } from "./estoqueProdutoBase.js";

const base = [
  { id: "ML-1", produto: "KIT LAL", especificacao: "0,03 EU/mL", qtdMinima: 2, grupo: "KIT" },
  { id: "ML-2", produto: "KIT LAL", especificacao: "0,06 EU/mL", qtdMinima: 5, grupo: "KIT" },
  { id: "ML-3", produto: "ETANOL", especificacao: "", qtdMinima: 1 },
];
test("mesmo nome: escolhe pela especificação", () => {
  assert.equal(acharProdutoBase(base, "KIT LAL", "0,06 EU/mL").id, "ML-2");
  assert.equal(acharProdutoBase(base, "kit lal", " 0,03 eu/ml ").id, "ML-1");
});
test("id tem prioridade", () => {
  assert.equal(acharProdutoBase(base, "KIT LAL", "0,03 EU/mL", "ML-2").id, "ML-2");
});
test("nome único ignora a especificação; GERAL equivale a vazio", () => {
  assert.equal(acharProdutoBase(base, "ETANOL", "GERAL").id, "ML-3");
  assert.equal(acharProdutoBase(base, "ETANOL", "outra coisa").id, "ML-3");
});
test("sem especificação que bata, cai no primeiro ativo; inativo só se não houver ativo", () => {
  assert.equal(acharProdutoBase(base, "KIT LAL", "").id, "ML-1");
  const lista = [{ id: "A", produto: "X", especificacao: "1", status: "INATIVO" }, { id: "B", produto: "X", especificacao: "2" }];
  assert.equal(acharProdutoBase(lista, "X", "9").id, "B");
  assert.equal(acharProdutoBase(lista, "Y", ""), null);
});
