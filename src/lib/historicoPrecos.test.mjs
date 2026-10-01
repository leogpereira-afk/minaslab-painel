import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarCompras, resumirPorProduto, avaliarValor, encontrarResumo, chaveTexto } from "./historicoPrecos.js";

const item = (x) => ({ status: "INTEGRADO", unidade: "mL", conteudoKit: 500, quantidadeKits: 1, grupo: "REAGENTE", ...x });

test("pendente, cancelado e valor simbólico não viram preço de referência", () => {
  const compras = normalizarCompras([
    item({ id: "1", produto: "Ácido Nítrico", fornecedor: "A", valor: 100, dataPedido: "2026-01-10" }),
    item({ id: "2", produto: "ACIDO NITRICO", fornecedor: "B", valor: 50, dataPedido: "2026-02-10", status: "PENDENTE" }),
    item({ id: "3", produto: "acido nitrico", fornecedor: "C", valor: 40, dataPedido: "2026-03-10", status: "CANCELADO" }),
    item({ id: "4", produto: "ACIDO NITRICO", fornecedor: "D", valor: 0.01, dataPedido: "2026-04-10" }),
    item({ id: "5", produto: "ACIDO NITRICO", fornecedor: "E", valor: 0, dataPedido: "2026-05-10" }),
  ]);
  assert.equal(compras.length, 4, "valor zero é descartado");
  const [r] = resumirPorProduto(compras.map((c) => ({ ...c, valor: c.valorKit, dataPedido: c.data })));
  assert.equal(r.qtdCompras, 1);
  assert.equal(r.menor.fornecedor, "A");
  assert.equal(r.ultima.fornecedor, "A");
});

test("junta o mesmo produto escrito de jeitos diferentes", () => {
  assert.equal(chaveTexto(" Ácido  nítrico "), "ACIDO NITRICO");
  const resumos = resumirPorProduto([
    item({ produto: "Ácido Nítrico", fornecedor: "A", valor: 100, dataPedido: "2026-01-10" }),
    item({ produto: "ACIDO NITRICO", fornecedor: "B", valor: 90, dataPedido: "2026-02-10" }),
  ]);
  assert.equal(resumos.length, 1);
  assert.equal(resumos[0].fornecedores.length, 2);
  assert.equal(resumos[0].fornecedores[0].fornecedor, "B", "fornecedor mais barato primeiro");
});

test("kits de tamanhos diferentes comparam pelo preço por unidade", () => {
  const [r] = resumirPorProduto([
    item({ produto: "PADRAO PH", fornecedor: "A", valor: 100, conteudoKit: 1000, dataPedido: "2026-01-10" }),
    item({ produto: "PADRAO PH", fornecedor: "B", valor: 60, conteudoKit: 500, dataPedido: "2026-02-10" }),
  ]);
  assert.equal(r.base, "unidade");
  assert.equal(r.menor.fornecedor, "A", "R$0,10/mL é menor que R$0,12/mL mesmo com kit mais caro");
  assert.ok(Math.abs(r.ultimaAcimaDoMenor - 0.2) < 1e-9);
});

test("unidades misturadas voltam a comparar pelo kit", () => {
  const [r] = resumirPorProduto([
    item({ produto: "X", fornecedor: "A", valor: 100, unidade: "mL", dataPedido: "2026-01-10" }),
    item({ produto: "X", fornecedor: "B", valor: 80, unidade: "g", dataPedido: "2026-02-10" }),
  ]);
  assert.equal(r.base, "kit");
  assert.equal(r.menor.fornecedor, "B");
  assert.equal(r.ultimaAcimaDoMenor, 0);
});

test("avaliarValor avisa quando o pedido novo sai mais caro", () => {
  const resumos = resumirPorProduto([
    item({ produto: "KIT SULFETO", fornecedor: "MM", valor: 350, conteudoKit: 100, unidade: "UN", dataPedido: "2026-08-03" }),
  ]);
  const r = encontrarResumo(resumos, "kit sulfeto");
  assert.equal(avaliarValor(r, { valor: 420, conteudoKit: 100, unidade: "UN" }).situacao, "acima");
  assert.equal(avaliarValor(r, { valor: 351, conteudoKit: 100, unidade: "UN" }).situacao, "igual");
  assert.equal(avaliarValor(r, { valor: 300, conteudoKit: 100, unidade: "UN" }).situacao, "abaixo");
  assert.equal(avaliarValor(r, { valor: "", conteudoKit: 100 }).situacao, "sem-valor");
  assert.equal(avaliarValor(null, { valor: 10 }).situacao, "sem-historico");
  // Kit com o dobro do conteúdo pelo dobro do preço é o mesmo preço.
  assert.equal(avaliarValor(r, { valor: 700, conteudoKit: 200, unidade: "UN" }).situacao, "igual");
});

test("diferença absurda vira 'conferir cadastro', não 'mais caro'", () => {
  const [r] = resumirPorProduto([
    item({ produto: "PLACA DE PETRI", fornecedor: "A", valor: 163.9, conteudoKit: 200, unidade: "UN", dataPedido: "2026-07-10" }),
    item({ produto: "PLACA DE PETRI", fornecedor: "B", valor: 190.6, conteudoKit: 10, unidade: "UN", dataPedido: "2026-07-28" }),
  ]);
  assert.equal(r.ultimaAcimaDoMenor, 0);
  assert.equal(r.comparacaoDuvidosa, true);
  assert.equal(avaliarValor(r, { valor: 190, conteudoKit: 10, unidade: "UN" }).situacao, "duvidosa");
});
