import test from "node:test";
import assert from "node:assert/strict";
import { pontuarFape, classificarFape, normalizarRespostaFape, textoNotaFape, qtdCriteriosAvaliacao } from "./estoqueFape.js";

test("respostas aceitam variações e viram a forma canônica", () => {
  assert.equal(normalizarRespostaFape("sim"), "SIM");
  assert.equal(normalizarRespostaFape(" nao "), "NÃO");
  assert.equal(normalizarRespostaFape("Não se aplica"), "NÃO SE APLICA");
  assert.equal(normalizarRespostaFape("talvez"), "");
});
test("tudo sim = 8/8 ÓTIMO e tudo não = 0/8 RUIM", () => {
  assert.deepEqual(pontuarFape(["SIM", "SIM", "SIM", "SIM"]), { respostas: ["SIM", "SIM", "SIM", "SIM"], notas: [2, 2, 2, 2], nota: 8, maximo: 8, aplicaveis: 4, percentual: 100, classificacao: "ÓTIMO" });
  const ruim = pontuarFape(["NÃO", "NÃO", "NÃO", "NÃO"]);
  assert.equal(ruim.nota, 0); assert.equal(ruim.classificacao, "RUIM");
});
test("não se aplica sai da conta e não pune o fornecedor", () => {
  const p = pontuarFape(["SIM", "SIM", "NÃO SE APLICA", "NÃO SE APLICA"]);
  assert.equal(p.nota, 4); assert.equal(p.maximo, 4); assert.equal(p.percentual, 100); assert.equal(p.classificacao, "ÓTIMO");
  assert.deepEqual(p.notas, [2, 2, null, null]);
});
test("faixas iguais às do modelo antigo quando os 4 critérios se aplicam", () => {
  const por = (n) => classificarFape(n, 8);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(por), ["RUIM", "RUIM", "RUIM", "BOM", "BOM", "BOM", "ÓTIMO", "ÓTIMO", "ÓTIMO"]);
});
test("faixas com menos critérios aplicáveis usam o percentual", () => {
  assert.equal(classificarFape(2, 6), "BOM");   // 33,3%
  assert.equal(classificarFape(4, 6), "ÓTIMO"); // 66,7%
  assert.equal(classificarFape(0, 2), "RUIM");
  assert.equal(classificarFape(1 * 2, 4 * 2), "RUIM"); // 25% exato
});
test("resposta faltando, inválida ou nenhum critério aplicável = inválido", () => {
  assert.equal(pontuarFape(["SIM", "SIM", "SIM", ""]), null);
  assert.equal(pontuarFape(["SIM", "SIM", "SIM", "TALVEZ"]), null);
  assert.equal(pontuarFape([]), null);
  assert.equal(pontuarFape(Array(13).fill("SIM")), null);
  assert.equal(pontuarFape(["NÃO SE APLICA", "NÃO SE APLICA", "NÃO SE APLICA", "NÃO SE APLICA"]), null);
});
test("avaliação antiga continua x / 8 e a nova mostra o máximo e o percentual", () => {
  assert.equal(textoNotaFape({ notaFinal: 5 }), "5 / 8");
  assert.equal(textoNotaFape({ notaFinal: 4, notaMaxima: 6 }), "4 / 6 (66,7%)");
  assert.equal(textoNotaFape({}), "—");
});
test("quantidade variável de critérios: 1, 3 e 6", () => {
  assert.deepEqual([pontuarFape(["SIM"]).nota, pontuarFape(["SIM"]).maximo, pontuarFape(["SIM"]).classificacao], [2, 2, "ÓTIMO"]);
  const tres = pontuarFape(["SIM", "NÃO", "NÃO SE APLICA"]);
  assert.deepEqual([tres.nota, tres.maximo, tres.percentual, tres.classificacao], [2, 4, 50, "BOM"]);
  const seis = pontuarFape(["SIM", "SIM", "SIM", "SIM", "NÃO", "NÃO"]);
  assert.deepEqual([seis.nota, seis.maximo, seis.classificacao], [8, 12, "ÓTIMO"]);
});
test("qtdCriteriosAvaliacao: usa o gravado, descobre pelos campos ou assume 4", () => {
  assert.equal(qtdCriteriosAvaliacao({ qtdCriterios: 6 }), 6);
  assert.equal(qtdCriteriosAvaliacao({ criterio1Resposta: "SIM", criterio2Resposta: "NÃO", criterio3Resposta: "SIM" }), 3);
  assert.equal(qtdCriteriosAvaliacao({ criterio1Nota: 2, criterio2Nota: 1, criterio3Nota: 2, criterio4Nota: 0 }), 4);
  assert.equal(qtdCriteriosAvaliacao({}), 4);
});
