import test from "node:test";
import assert from "node:assert/strict";
import { rankingDestaque, mediaLideranca, podio } from "./destaque.js";

const notas = (v) => Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i + 1}`, v]));

test("liderança 0–5 vira 0–10 e entra com peso 60%", () => {
  assert.equal(mediaLideranca({ notas: notas(4) }), 4);
  assert.equal(mediaLideranca({ notas: { p1: 5 } }), null);
  const r = rankingDestaque({
    pessoas: [{ id: "a", nome: "Ana B" }, { id: "b", nome: "Bia C" }],
    equipe: { equipe: [{ id: "a", n: 5, media: 9, oculto: false }, { id: "b", n: 5, media: 7, oculto: false }] },
    avaliacoes: [{ pessoaId: "a", notas: notas(3) }, { pessoaId: "b", notas: notas(5) }],
  });
  // a: 0,4×9 + 0,6×6 = 7,2 · b: 0,4×7 + 0,6×10 = 8,8
  assert.deepEqual(r.map((x) => [x.id, x.total]), [["b", 8.8], ["a", 7.2]]);
});

test("eliminatório e votos abaixo do mínimo saem do pódio", () => {
  const r = rankingDestaque({
    pessoas: [{ id: "a", nome: "A" }, { id: "b", nome: "B" }, { id: "c", nome: "C" }],
    equipe: { equipe: [{ id: "a", n: 5, media: 10 }, { id: "b", n: 2, oculto: true, media: null }, { id: "c", n: 4, media: 6 }] },
    avaliacoes: [{ pessoaId: "a", notas: notas(5), eliminatorio: "Recebeu advertência" }, { pessoaId: "b", notas: notas(5) }, { pessoaId: "c", notas: notas(2) }],
  });
  assert.deepEqual(podio(r).map((x) => x.id), ["c"]);
  assert.equal(r.find((x) => x.id === "a").apto, false);
  assert.equal(r.find((x) => x.id === "b").completo, false);
});

test("duas avaliações da liderança: média entre avaliadores", () => {
  const r = rankingDestaque({ pessoas: [{ id: "a", nome: "A" }], equipe: { equipe: [{ id: "a", n: 3, media: 8 }] }, avaliacoes: [{ pessoaId: "a", notas: notas(4) }, { pessoaId: "a", notas: notas(5) }] });
  assert.equal(r[0].lideranca, 9);
});
