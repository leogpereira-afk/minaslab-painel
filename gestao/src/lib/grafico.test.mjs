import test from "node:test";
import assert from "node:assert/strict";
import { lerDados, numeroBR } from "./grafico.js";

test("números no jeito brasileiro", () => {
  assert.equal(numeroBR("1.234,5"), 1234.5);
  assert.equal(numeroBR("R$ 30.800"), 30800);
  assert.equal(numeroBR("12,5%"), 12.5);
  assert.equal(numeroBR("7.5"), 7.5);
  assert.equal(numeroBR("abc"), null);
});

test("uma série e várias séries com cabeçalho", () => {
  assert.deepEqual(lerDados("Água | 311\nAlimento | 50"), { series: ["Valor"], rotulos: ["Água", "Alimento"], valores: [[311], [50]] });
  const d = lerDados("Mês | Micro | FQ\nAgo | 293 | 164\nSet | 329 | 219");
  assert.deepEqual(d.series, ["Micro", "FQ"]);
  assert.deepEqual(d.valores, [[293, 164], [329, 219]]);
});
