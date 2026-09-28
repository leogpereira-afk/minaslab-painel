import { test } from "node:test";
import assert from "node:assert/strict";
import { compararContaOfx, perguntaContaOfx } from "./contaOfx.js";

const c6 = { nome: "C6 S.A", banco: "336", agencia: "0001", conta: "12345678-9" };

test("arquivo de outro banco é diferente (o caso que entrava calado)", () => {
  const r = compararContaOfx({ banco: "0341", agencia: "1234", conta: "55555-5" }, c6);
  assert.equal(r.estado, "diferente");
  assert.equal(r.diferencas.length, 3);
  assert.deepEqual(r.meta, {});
});

test("mesma conta com zeros e pontuação diferentes é igual, e vai para o servidor", () => {
  const r = compararContaOfx({ banco: "0336", agencia: "1", conta: "123456789" }, c6);
  assert.equal(r.estado, "igual");
  assert.deepEqual(r.meta, { banco: "0336", agencia: "1", conta: "123456789" });
});

test("conta sem o dígito verificador é parecida e não trava; a conta não vai para o servidor", () => {
  const r = compararContaOfx({ banco: "336", agencia: "0001", conta: "12345678" }, c6);
  assert.equal(r.estado, "parecida");
  assert.deepEqual(r.meta, { banco: "336", agencia: "0001" });
});

test("conta que só compartilha o começo não é parecida", () => {
  assert.equal(compararContaOfx({ conta: "1234567" }, c6).estado, "diferente");
  assert.equal(compararContaOfx({ conta: "223456789" }, c6).estado, "diferente");
});

test("número curto demais não ganha a folga do dígito", () => {
  assert.equal(compararContaOfx({ conta: "12" }, { conta: "123" }).estado, "diferente");
});

test("CSV do C6 traz banco 'C6': fica fora da comparação e fora do servidor", () => {
  const r = compararContaOfx({ banco: "C6", agencia: "0001", conta: "12345678-9" }, c6);
  assert.equal(r.estado, "igual");
  assert.equal(r.meta.banco, undefined);
});

test("arquivo sem dados de conta, ou conta sem cadastro, não tem o que comparar", () => {
  assert.equal(compararContaOfx({ banco: "", agencia: "", conta: "" }, c6).estado, "sem_dados");
  assert.equal(compararContaOfx({ banco: "336", conta: "1" }, { nome: "Caixinha" }).estado, "sem_dados");
  assert.equal(compararContaOfx(undefined, c6).estado, "sem_dados");
});

test("letra no cadastro não tira a conta da comparação (vale o número, como no servidor)", () => {
  const comLetra = { nome: "Conta X", banco: "336", agencia: "0001", conta: "CC 12345-6" };
  assert.equal(compararContaOfx({ banco: "336", agencia: "0001", conta: "99999-9" }, comLetra).estado, "diferente");
  assert.equal(compararContaOfx({ banco: "336", agencia: "0001", conta: "123456" }, comLetra).estado, "igual");
  const digitoX = { nome: "Conta Y", banco: "001", agencia: "1234", conta: "12345-X" };
  assert.equal(compararContaOfx({ banco: "001", agencia: "1234", conta: "12345" }, digitoX).estado, "igual");
});

test("agência com e sem dígito verificador não pergunta à toa", () => {
  const r = compararContaOfx({ banco: "336", agencia: "1234", conta: "12345678-9" }, { ...c6, agencia: "1234-5" });
  assert.equal(r.estado, "parecida");
  assert.equal(r.meta.agencia, undefined);
});

test("confirmado um arquivo diferente, o servidor ainda confere o que bateu", () => {
  const r = compararContaOfx({ banco: "6336", agencia: "0001", conta: "12345678-9" }, c6);
  assert.equal(r.estado, "diferente");
  assert.deepEqual(r.meta, { agencia: "0001", conta: "12345678-9" });
});

test("a pergunta mostra a conta escolhida e cada diferença", () => {
  const r = compararContaOfx({ banco: "341" }, c6);
  const p = perguntaContaOfx(c6.nome, r.diferencas);
  assert.match(p, /conta C6 S\.A/);
  assert.match(p, /banco: no arquivo 341, na conta 336/);
});
