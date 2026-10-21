import test from "node:test";
import assert from "node:assert/strict";
import { validarVoto, aplicarVoto, resultado, gerarCodigos, codigoValido, normalizarCodigo } from "./pesquisa.mjs";

const reg = { avaliados: [{ id: "a", nome: "A" }, { id: "b", nome: "B" }], lideres: [{ id: "g", nome: "G" }], minimo: 3 };

test("voto válido é limpo; pular pessoa é permitido", () => {
  const { limpo, erro } = validarVoto(reg, { equipe: { a: [10, 9, 8, 7, 6] }, comentarios: { a: "  ótima   colega " }, sugestao: "x" });
  assert.equal(erro, undefined);
  assert.deepEqual(limpo.equipe, { a: [10, 9, 8, 7, 6] });
  assert.equal(limpo.comentarios.a, "ótima colega");
});

test("voto recusa nota fora de 0–10, pessoa estranha e voto vazio", () => {
  assert.ok(validarVoto(reg, { equipe: { a: [11, 9, 8, 7, 6] } }).erro);
  assert.ok(validarVoto(reg, { equipe: { a: [9, 9, 8, 7] } }).erro);
  assert.ok(validarVoto(reg, { equipe: { z: [9, 9, 8, 7, 6] } }).erro);
  assert.ok(validarVoto(reg, { gestao: { a: [9, 9, 8, 7, 6] } }).erro);
  assert.ok(validarVoto(reg, { sugestao: "só texto" }).erro);
});

test("somas acumulam e não guardam voto individual", () => {
  let s = {};
  const votos = [[10, 10, 10, 10, 10], [8, 8, 8, 8, 8], [6, 6, 6, 6, 6]];
  for (const v of votos) s = aplicarVoto(s, validarVoto(reg, { equipe: { a: v }, gestao: { g: v } }).limpo, () => 0);
  assert.deepEqual(s.equipe.a, { n: 3, soma: [24, 24, 24, 24, 24] });
  const r = resultado({ ...reg, somas: s, totalVotos: 3 });
  assert.equal(r.equipe[0].media, 8);
  assert.equal(r.gestao[0].media, 8);
  assert.equal(r.equipe[1].oculto, true);
});

test("abaixo do mínimo: só a contagem, sem média nem comentário", () => {
  let s = aplicarVoto({}, validarVoto(reg, { equipe: { a: [9, 9, 9, 9, 9] }, comentarios: { a: "oi" } }).limpo);
  const r = resultado({ ...reg, somas: s, totalVotos: 1 });
  assert.deepEqual([r.equipe[0].n, r.equipe[0].media, r.equipe[0].comentarios.length], [1, null, 0]);
  assert.equal(r.sugestoes.length, 0);
});

test("códigos: 8 caracteres do alfabeto, sem repetição", () => {
  const cs = gerarCodigos(50, () => Math.floor(Math.random() * 256));
  assert.equal(new Set(cs).size, 50);
  assert.ok(cs.every(codigoValido));
  assert.equal(normalizarCodigo(" ab cd-ef 23 "), "ABCDEF23");
  assert.equal(codigoValido("ABCDEF2O"), false);
});

test("votação sem código: ninguém vota em si mesmo", () => {
  assert.ok(validarVoto(reg, { equipe: { a: [9, 9, 9, 9, 9] } }, "a").erro);
  assert.ok(validarVoto(reg, { equipe: { b: [9, 9, 9, 9, 9] }, comentarios: { a: "eu" } }, "a").erro);
  assert.equal(validarVoto(reg, { equipe: { b: [9, 9, 9, 9, 9] } }, "a").erro, undefined);
});

test("liderança também não se avalia; comentário sem nota é ignorado", () => {
  const r2 = { ...reg, lideres: [{ id: "a", nome: "A" }, { id: "g", nome: "G" }] };
  assert.ok(validarVoto(r2, { gestao: { a: [9, 9, 9, 9, 9] } }, "a").erro);
  const { limpo } = validarVoto(reg, { equipe: { b: [9, 9, 9, 9, 9] }, comentarios: { a: "sem nota" } });
  assert.deepEqual(limpo.comentarios, {});
});
