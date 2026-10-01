import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { statusValidade, estoqueCriticoPorProduto, lotesVencidos, tabela, COLUNAS_LOTE, gerarXlsx, gerarCsv } from "./estoqueRelatorios.js";

const HOJE = "2026-10-01";

test("status de validade com os textos do legado", () => {
  assert.equal(statusValidade("", HOJE), "");
  assert.equal(statusValidade("2026-09-30", HOJE), "Vencido");
  assert.equal(statusValidade("2026-10-01", HOJE), "Vencimento em 30 dias");
  assert.equal(statusValidade("2026-10-30", HOJE), "Vencimento em 30 dias");
  assert.equal(statusValidade("2026-10-31", HOJE), "Dentro do prazo");
  assert.equal(statusValidade("lixo", HOJE), "Erro verificar");
});

test("estoque crítico é consolidado por produto e ignora lote vencido", () => {
  const lotes = [
    { id: "ML-1", produto: "Ácido X", qtdMinima: 10, totalAtual: 6, validade: "2027-01-01", unidade: "L" },
    { id: "ML-2", produto: "ÁCIDO X ", qtdMinima: 10, totalAtual: 3, validade: "2027-01-01", unidade: "L" },
    { id: "ML-3", produto: "ácido x", qtdMinima: 10, totalAtual: 50, validade: "2026-01-01", unidade: "L" },
    { id: "ML-4", produto: "Outro", qtdMinima: 5, totalAtual: 20, validade: "2027-01-01", unidade: "UN" },
  ];
  const r = estoqueCriticoPorProduto(lotes, HOJE);
  assert.equal(r.length, 1);
  assert.equal(r[0].produto, "ÁCIDO X");
  assert.equal(r[0].disponivel, 9);
  assert.equal(r[0].falta, 1);
  assert.equal(r[0].vencidosIgnorados, 50);
});

test("produtos vencidos listam todo lote vencido, mesmo zerado", () => {
  const lotes = [{ id: "a", validade: "2026-01-01", totalAtual: 0 }, { id: "b", validade: "2027-01-01", totalAtual: 5 }, { id: "c", validade: "", totalAtual: 1 }];
  assert.deepEqual(lotesVencidos(lotes, HOJE).map((l) => l.id), ["a"]);
});

test("tabela usa cabeçalhos legíveis e o código do lote", () => {
  const t = tabela(COLUNAS_LOTE, [{ codigoAuto: "ML-9", produto: "P", totalAtual: 3 }]);
  assert.equal(t[0][0], "ID Sistema");
  assert.equal(t[1][0], "ML-9");
  assert.equal(t[1][COLUNAS_LOTE.findIndex(([k]) => k === "totalAtual")], 3);
});

test("xlsx: pacote com abas, texto escapado e números", () => {
  const bin = gerarXlsx([{ nome: "ESTOQUE", linhas: [["A", "B"], ["x & <y>", 5]] }, { nome: "estoque", linhas: [["Z"]] }]);
  const z = unzipSync(bin);
  assert.ok(z["[Content_Types].xml"] && z["xl/workbook.xml"] && z["xl/worksheets/sheet2.xml"]);
  assert.match(strFromU8(z["xl/workbook.xml"]), /name="ESTOQUE"[\s\S]*name="estoque 2"/);
  const s1 = strFromU8(z["xl/worksheets/sheet1.xml"]);
  assert.match(s1, /x &amp; &lt;y&gt;/);
  assert.match(s1, /<c r="B2"><v>5<\/v><\/c>/);
});

test("csv com BOM e aspas escapadas", () => {
  assert.equal(gerarCsv([["a", 'b"c']]), '﻿"a";"b""c"');
});
