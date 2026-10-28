import test from "node:test";
import assert from "node:assert/strict";
import { situacaoNoRH } from "./comissoes.mjs";

const RH = [
  { nome: "Pessoa Teste da Silva", ativo: false, desligadoEm: "2026-10-20" },
  { nome: "Outra Pessoa", ativo: true, desligadoEm: "" },
  { nome: "Maria Souza", ativo: true }, { nome: "Maria Souza Lima", ativo: true },
  { nome: "Readmitida Teste", ativo: false, desligadoEm: "2025-01-10" }, { nome: "Readmitida Teste", ativo: true, desligadoEm: "" },
];

test("acha pelo nome (exato ou com todas as palavras) e devolve só a data", () => {
  assert.deepEqual(situacaoNoRH("Pessoa Teste", RH), { rh: "desligado", desligadoEm: "2026-10-20" });
  assert.deepEqual(situacaoNoRH("OUTRA PESSOA", RH), { rh: "ativo", desligadoEm: "" });
});
test("na dúvida não adivinha", () => {
  assert.equal(situacaoNoRH("Maria Souza", RH).rh, "ativo"); // exato vence
  assert.equal(situacaoNoRH("Maria", RH).rh, "nao_encontrado"); // uma palavra só não basta
  assert.equal(situacaoNoRH("Souza Maria", [{ nome: "Maria Souza" }, { nome: "Maria Souza Lima" }]).rh, "ambiguo");
  assert.equal(situacaoNoRH("Ninguém", RH).rh, "nao_encontrado");
});
test("readmitida: vale o vínculo ativo", () => {
  assert.equal(situacaoNoRH("Readmitida Teste", RH).rh, "ativo");
});
