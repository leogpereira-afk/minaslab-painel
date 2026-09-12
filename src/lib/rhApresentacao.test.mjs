import test from "node:test";
import assert from "node:assert/strict";
import { filtrarPessoasPorNome } from "./rhApresentacao.js";

const pessoas = Object.freeze([
  Object.freeze({ id: "ativa", nome: "José Pereira", ativo: true }),
  Object.freeze({ id: "desligada", nome: "Ana Souza", apelido: "Jô", ativo: false }),
  Object.freeze({ id: "incompleta" }),
]);

test("busca por nome ignora acentos, caixa e espaços nas pontas", () => {
  assert.deepEqual(filtrarPessoasPorNome(pessoas, " JOSÉ "), [pessoas[0]]);
  assert.deepEqual(filtrarPessoasPorNome(pessoas, "jose"), [pessoas[0]]);
});

test("apelido e desligados seguem a mesma busca dos ativos", () => {
  assert.deepEqual(filtrarPessoasPorNome(pessoas, "jo"), pessoas.slice(0, 2));
  assert.deepEqual(filtrarPessoasPorNome(pessoas.filter((p) => p.ativo === false), "ANA"), [pessoas[1]]);
  assert.deepEqual(filtrarPessoasPorNome(pessoas.filter((p) => p.ativo === false), "José"), []);
});

test("busca vazia preserva ordem, identidade e registros sem nome", () => {
  assert.deepEqual(filtrarPessoasPorNome(pessoas, "  "), pessoas);
  assert.equal(filtrarPessoasPorNome(pessoas, "")[1], pessoas[1]);
  assert.deepEqual(filtrarPessoasPorNome(pessoas, "inexistente"), []);
});
