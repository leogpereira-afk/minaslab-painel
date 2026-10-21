import test from "node:test";
import assert from "node:assert/strict";
import { validarAvaliacao, conviteValido } from "./lideranca.mjs";

const conv = { mes: "2026-10", avaliador: "lider1", avaliadorNome: "Líder Um", status: "ativo", validoAte: "2099-01-01T00:00:00Z", pessoas: [{ id: "rh1", nome: "Maria" }] };
const dez = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i + 1}`, 4]));

test("ficha completa vira registro no nome de quem recebeu o link", () => {
  const r = validarAvaliacao(conv, { pessoaId: "rh1", notas: dez, obs: "  ótima   no mês " });
  assert.equal(r.limpo.id, "2026-10_rh1_lider1");
  assert.equal(r.limpo.avaliador, "lider1");
  assert.equal(r.limpo.obs, "ótima no mês");
});

test("recusa pessoa fora do link, nota fora de 0 a 5 e ficha incompleta", () => {
  assert.ok(validarAvaliacao(conv, { pessoaId: "rh9", notas: dez }).erro);
  assert.ok(validarAvaliacao(conv, { pessoaId: "rh1", notas: { ...dez, p3: 7 } }).erro);
  assert.ok(validarAvaliacao(conv, { pessoaId: "rh1", notas: { ...dez, p3: 2.5 } }).erro);
  assert.ok(validarAvaliacao(conv, { pessoaId: "rh1", notas: { p1: 3 } }).erro);
  assert.ok(validarAvaliacao(conv, { pessoaId: "rh1", notas: dez, eliminatorio: "inventado" }).erro);
});

test("eliminatório dispensa as notas", () => {
  const r = validarAvaliacao(conv, { pessoaId: "rh1", notas: {}, eliminatorio: "Férias ou afastamento no mês" });
  assert.deepEqual(r.limpo.notas, {});
});

test("convite revogado ou vencido não vale", () => {
  assert.equal(conviteValido(conv), true);
  assert.equal(conviteValido({ ...conv, status: "revogado" }), false);
  assert.equal(conviteValido({ ...conv, validoAte: "2020-01-01T00:00:00Z" }), false);
});
