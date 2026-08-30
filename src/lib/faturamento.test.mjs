import test from "node:test";
import assert from "node:assert/strict";
import { vendasDosTitulos, indiceDeCategorias, nomeDaCategoria } from "./faturamento.js";

const CATS = [
  { codigo: "1.01.02", descricao: "Análises Ambientais" },
  { codigo: "1.01.05", descricao: "" },
];

const T = (extra) => ({
  id: "rec_1", omieId: "1", numero: "RPS 1", valor: 250,
  emissao: "2025-10-24", categoria: "1.01.02", clienteId: "484", status: "pago",
  ...extra,
});

test("o título vira venda com emissão como data", () => {
  const [v] = vendasDosTitulos([T()], CATS);
  assert.equal(v.data, "2025-10-24");
  assert.equal(v.valor, 250);
  assert.equal(v.clienteId, "484");
  assert.equal(v.cancelada, false);
});

test("cancelado é MARCADO, não descartado — quem conta é recortarVendas", () => {
  const vs = vendasDosTitulos([T(), T({ id: "rec_2", status: "cancelado" })], CATS);
  assert.equal(vs.length, 2, "os dois títulos continuam na lista");
  assert.equal(vs[1].cancelada, true);
});

test("o item é a categoria, com a descrição do cadastro", () => {
  const [v] = vendasDosTitulos([T()], CATS);
  assert.equal(v.itens.length, 1);
  assert.equal(v.itens[0].descricao, "1.01.02 — Análises Ambientais");
  assert.equal(v.itens[0].valor, 250);
});

test("quantidade viaja NULA — categoria financeira não tem unidades", () => {
  const [v] = vendasDosTitulos([T()], CATS);
  assert.equal(v.itens[0].quantidade, null,
    "1 por título faria a coluna Quantidade repetir a coluna Títulos");
});

test("categoria sem cadastro aparece pelo CÓDIGO — não some nem vira travessão", () => {
  const [v] = vendasDosTitulos([T({ categoria: "9.99" })], CATS);
  assert.equal(v.itens[0].descricao, "9.99");
});

test("categoria cadastrada sem descrição também cai no código", () => {
  const [v] = vendasDosTitulos([T({ categoria: "1.01.05" })], CATS);
  assert.equal(v.itens[0].descricao, "1.01.05");
});

test("título sem categoria entra SEM item — o valor não some junto", () => {
  const [v] = vendasDosTitulos([T({ categoria: "" })], CATS);
  assert.deepEqual(v.itens, []);
  assert.equal(v.valor, 250, "o valor do título continua lá para a aba Clientes");
});

test("valor ausente continua ausente — nunca vira zero", () => {
  const [a] = vendasDosTitulos([T({ valor: null })], CATS);
  const [b] = vendasDosTitulos([T({ valor: "" })], CATS);
  const [c] = vendasDosTitulos([T({ valor: "abc" })], CATS);
  assert.equal(a.valor, null);
  assert.equal(b.valor, null);
  assert.equal(c.valor, null);
});

test("valor em texto do banco vira número", () => {
  const [v] = vendasDosTitulos([T({ valor: "1250.5" })], CATS);
  assert.equal(v.valor, 1250.5);
});

test("NENHUMA venda traz vendedor — a aba precisa poder dizer isso", () => {
  const vs = vendasDosTitulos([T(), T({ id: "rec_2" })], CATS);
  assert.ok(vs.every((v) => v.vendedor === undefined && v.vendedorNome === undefined));
});

test("entrada vazia, nula ou com buraco não quebra", () => {
  assert.deepEqual(vendasDosTitulos([], CATS), []);
  assert.deepEqual(vendasDosTitulos(null, null), []);
  assert.deepEqual(vendasDosTitulos(undefined, undefined), []);
  assert.equal(vendasDosTitulos([null, T()], CATS).length, 1);
});

test("o índice de categorias ignora cadastro sem código", () => {
  const i = indiceDeCategorias([{ descricao: "solta" }, ...CATS]);
  assert.equal(i.size, 1, "só a que tem código E descrição");
  assert.equal(i.get("1.01.02"), "Análises Ambientais");
});

test("nomeDaCategoria com código vazio devolve vazio, não travessão", () => {
  assert.equal(nomeDaCategoria("", indiceDeCategorias(CATS)), "");
  assert.equal(nomeDaCategoria(null, indiceDeCategorias(CATS)), "");
});
