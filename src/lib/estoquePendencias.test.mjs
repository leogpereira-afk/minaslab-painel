import test from "node:test";
import assert from "node:assert/strict";
import { calcularPendencias } from "./estoquePendencias.js";

const chaves = (r) => r.grupos.map((g) => g.chave);

test("sem dados não há pendência", () => {
  assert.deepEqual(calcularPendencias(), { grupos: [], total: 0 });
});
test("fornecedores: CNPJ repetido, sem CNPJ e sem tipo; inativos ficam de fora", () => {
  const r = calcularPendencias({ fornecedores: [
    { id: "F-1", nome: "A", cnpj: "01.530.501/0001-42", tipoFornecedor: "COMPRAS" },
    { id: "F-2", nome: "B", cnpj: "01530501000142", tipoFornecedor: "COMPRAS" },
    { id: "F-3", nome: "C", cnpj: "", tipoFornecedor: "" },
    { id: "F-4", nome: "D", cnpj: "", tipoFornecedor: "", status: "INATIVO" },
  ] });
  assert.deepEqual(chaves(r), ["cnpj-repetido", "sem-cnpj", "sem-tipo"]);
  assert.equal(r.grupos[0].itens[0].codigo, "F-1 / F-2");
  assert.deepEqual(r.grupos[1].itens.map((i) => i.codigo), ["F-3"]);
  assert.equal(r.total, 3);
});
test("produtos: sem conteúdo do kit e duplicados (ignora acento, caixa e inativos)", () => {
  const r = calcularPendencias({ produtos: [
    { id: "ML-1", produto: "Amido Solúvel", especificacao: "Reagente P.A.", conteudoKit: 100 },
    { id: "ML-2", produto: "AMIDO SOLUVEL", especificacao: "reagente p.a.", conteudoKit: 0 },
    { id: "ML-3", produto: "Outro", especificacao: "", conteudoKit: 5, statusQuantidade: "INATIVO" },
    { id: "ML-4", produto: "Outro", especificacao: "", conteudoKit: 5 },
  ] });
  assert.deepEqual(chaves(r), ["produto-sem-kit", "produto-duplicado"]);
  assert.deepEqual(r.grupos[0].itens.map((i) => i.codigo), ["ML-2"]);
  assert.equal(r.grupos[1].itens[0].codigo, "ML-1 / ML-2");
});
test("pedidos integrados sem lote e lotes com saldo negativo", () => {
  const r = calcularPendencias({
    pedidos: [{ id: "PC-1-item-01", status: "INTEGRADO", produto: "X" }, { id: "PC-1-item-02", status: "INTEGRADO", loteId: "ML-5" }, { id: "PC-2-item-01", status: "PENDENTE" }],
    lotes: [{ id: "ML-9", produto: "Y", totalAtual: -2 }, { id: "ML-10", produto: "Z", totalAtual: 0 }],
  });
  assert.deepEqual(chaves(r), ["pedido-sem-lote", "lote-negativo"]);
  assert.deepEqual(r.grupos[0].itens.map((i) => i.codigo), ["PC-1-item-01"]);
  assert.deepEqual(r.grupos[1].itens.map((i) => i.codigo), ["ML-9"]);
});
