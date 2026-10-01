import test from "node:test";
import assert from "node:assert/strict";
import { listasConfig, comUsados, adicionarOpcao, removerOpcao, GRUPOS_PADRAO } from "./estoqueConfig.js";

test("sem configuração valem os padrões do legado", () => {
  assert.deepEqual(listasConfig([]).grupos, GRUPOS_PADRAO);
  assert.deepEqual(listasConfig(undefined).unidades, ["UN", "mL", "L", "g", "Kg"]);
});
test("lê grupos e unidades do registro, uma por linha", () => {
  const l = listasConfig([{ grupos: "reagente\n\n Kit \nREAGENTE", unidades: "UN\nmL" }]);
  assert.deepEqual(l.grupos, ["REAGENTE", "KIT"]);
  assert.deepEqual(l.unidades, ["UN", "mL"]);
});
test("adicionar não duplica e remover tira pelo índice", () => {
  assert.deepEqual(adicionarOpcao(["A"], " b ", true), ["A", "B"]);
  assert.deepEqual(adicionarOpcao(["A"], "a", true), ["A"]);
  assert.deepEqual(removerOpcao(["A", "B", "C"], 1), ["A", "C"]);
});
test("valores já usados continuam aparecendo", () => {
  assert.deepEqual(comUsados(["UN"], ["mL", "un", ""]), ["UN", "mL"]);
});
