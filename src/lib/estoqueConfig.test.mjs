import test from "node:test";
import assert from "node:assert/strict";
import { listasConfig, comUsados, adicionarOpcao, removerOpcao, tiposFornecedorDisponiveis, usoTipoFornecedor, podeCorrigirSaida, listaQuemCorrigeSaidas, GRUPOS_PADRAO } from "./estoqueConfig.js";

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
test("tipos de fornecedor: cadastrados + usados, sem repetir e em ordem", () => {
  assert.deepEqual(listasConfig([]).tiposFornecedor, []);
  const cfg = [{ tiposFornecedor: "compras\nlaboratório" }];
  assert.deepEqual(tiposFornecedorDisponiveis(cfg, ["Fabricante", "COMPRAS", ""]), ["COMPRAS", "FABRICANTE", "LABORATÓRIO"]);
});
test("uso do tipo conta fornecedores e regras", () => {
  const f = [{ tipoFornecedor: "compras" }, { tipoFornecedor: "COMPRAS" }, { tipoFornecedor: "OUTRO" }];
  const r = [{ tipoFornecedor: "Compras" }];
  assert.deepEqual(usoTipoFornecedor("COMPRAS", f, r), { fornecedores: 2, regras: 1 });
  assert.deepEqual(usoTipoFornecedor("NADA", f, r), { fornecedores: 0, regras: 0 });
});
test("correção de saída: só direção e as pessoas listadas", () => {
  const cfg = [{ quemCorrigeSaidas: "Ana\n\n joao " }];
  assert.deepEqual(listaQuemCorrigeSaidas(cfg), ["Ana", "joao"]);
  assert.equal(podeCorrigirSaida(cfg, "ana", false), true);
  assert.equal(podeCorrigirSaida(cfg, "JOAO", false), true);
  assert.equal(podeCorrigirSaida(cfg, "maria", false), false);
  assert.equal(podeCorrigirSaida([], "maria", true), true);
  assert.equal(podeCorrigirSaida([], "", false), false);
});
