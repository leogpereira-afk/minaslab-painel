import test from "node:test";
import assert from "node:assert/strict";
import { mover, formularioDaVersao, duracaoTotalMin, tipoAula, MODALIDADES, novoModulo } from "./regras.js";

test("mover reordena sem mutar e ignora limites", () => {
  const l = ["a", "b", "c"];
  assert.deepEqual(mover(l, 0, 2), ["b", "c", "a"]);
  assert.deepEqual(l, ["a", "b", "c"]);
  assert.equal(mover(l, 0, -1), l);
  assert.equal(mover(l, 1, 3), l);
});

test("somente 'conclusão das aulas' está disponível nesta etapa", () => {
  assert.deepEqual(MODALIDADES.filter((m) => m.disponivel).map((m) => m.valor), ["nenhuma"]);
});

test("tipo de aula desconhecido cai em texto e cada tipo tem seu campo", () => {
  assert.equal(tipoAula("x").valor, "texto");
  assert.equal(tipoAula("video").campo, "url");
  assert.equal(tipoAula("pratica").campo, "enunciado");
});

test("formulário reflete a versão do servidor e soma durações", () => {
  const f = formularioDaVersao({
    versao: { titulo: "T", descricao: "D", modalidade: "nenhuma", nota_minima: null, max_tentativas: null, obrigatorio: true, prazo_dias: 30, validade_meses: 12, carga_horaria_min: null, exige_qualidade: false, notas_versao: "" },
    modulos: [{ titulo: "M", descricao: null, aulas: [{ titulo: "A", tipo: "texto", conteudo: { texto: "x" }, duracaoMin: 10 }, { titulo: "B", tipo: "video", conteudo: { url: "https://x.com" }, duracaoMin: null }] }],
    materiais: [{ titulo: "Apostila", url: "https://x.com/a.pdf" }],
  });
  assert.equal(f.prazoDias, 30);
  assert.equal(f.notaMinima, "");
  assert.equal(f.modulos[0].aulas.length, 2);
  assert.equal(duracaoTotalMin(f.modulos), 10);
  assert.equal(novoModulo().aulas.length, 1);
});
