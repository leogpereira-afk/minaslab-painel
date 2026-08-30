import test from "node:test";
import assert from "node:assert/strict";
import { vendasDosTitulos, indiceDeCategorias, nomeDaCategoria, anosDoFiltro } from "./faturamento.js";

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

/* ---------------------------------------------------------------------------
   OS ANOS DO FILTRO — a lista de pílulas em cima da Curva ABC.
   O caso que motivou tudo: a MinasLab começou em 2024 e a tela oferecia 2020.
   --------------------------------------------------------------------------- */

test("o piso é o primeiro ano COM faturamento — 2020..2023 somem", () => {
  const anos = anosDoFiltro({
    anosComVenda: ["2024", "2025", "2026"], anoAtual: "2026", anoEscolhido: "2026",
  });
  assert.deepEqual(anos, ["2024", "2025", "2026"]);
});

test("o ano corrente entra mesmo sem nenhum título dele — a virada de janeiro", () => {
  const anos = anosDoFiltro({
    anosComVenda: ["2024", "2025"], anoAtual: "2026", anoEscolhido: "",
  });
  assert.ok(anos.includes("2026"), "sem isto o ano novo seria inalcançável em janeiro");
  assert.deepEqual(anos, ["2024", "2025", "2026"]);
});

test("ano com faturamento FORA da faixa não some — um título de 2019 aparece", () => {
  const anos = anosDoFiltro({
    anosComVenda: ["2019", "2024", "2025"], anoAtual: "2025", anoEscolhido: "",
  });
  assert.deepEqual(anos, ["2019", "2020", "2021", "2022", "2023", "2024", "2025"],
    "o piso desce até o dado mais antigo, sem buraco até hoje");
});

test("ano do meio SEM faturamento continua clicável — 'não teve' é resposta", () => {
  const anos = anosDoFiltro({
    anosComVenda: ["2024", "2026"], anoAtual: "2026", anoEscolhido: "",
  });
  assert.ok(anos.includes("2025"), "sumir viraria uma pergunta que ninguém pode fazer");
});

test("o ano JÁ ESCOLHIDO entra sempre — senão a tela fica sem pílula acesa", () => {
  const anos = anosDoFiltro({
    anosComVenda: ["2024"], anoAtual: "2024", anoEscolhido: "2030",
  });
  assert.ok(anos.includes("2030"));
});

test("sem faturamento nenhum sobra o ano corrente — não sete anos vazios", () => {
  assert.deepEqual(anosDoFiltro({ anosComVenda: [], anoAtual: "2026", anoEscolhido: "" }), ["2026"]);
});

test("lixo no aparelho não vira pílula", () => {
  const anos = anosDoFiltro({
    anosComVenda: ["2024", "abc", "", null, "20260"], anoAtual: "2026", anoEscolhido: "todos",
  });
  assert.deepEqual(anos, ["2024", "2025", "2026"]);
});

test("chamada sem argumento nenhum não quebra", () => {
  assert.deepEqual(anosDoFiltro(), []);
  assert.deepEqual(anosDoFiltro({}), []);
});

test("a lista sai ordenada e sem repetição", () => {
  const anos = anosDoFiltro({
    anosComVenda: ["2026", "2024", "2024", "2025"], anoAtual: "2026", anoEscolhido: "2024",
  });
  assert.deepEqual(anos, ["2024", "2025", "2026"]);
});
