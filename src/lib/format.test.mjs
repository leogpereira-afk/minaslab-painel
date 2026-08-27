// Testes das regras que erram em dinheiro e em dia. Rodar com TZ=UTC (o
// script npm test ja fixa): teste que so passa no fuso de quem escreveu nao e
// teste.
import test from "node:test";
import assert from "node:assert/strict";
import { paraNumero, diasEntre, diaLocalISO, ymdLocal } from "./format.js";

test("paraNumero: o ultimo sinal decide o decimal", () => {
  assert.equal(paraNumero("1.500,50"), 1500.5);
  assert.equal(paraNumero("1500.50"), 1500.5);
  assert.equal(paraNumero("1.500"), 1500); // milhar, nao 1,5
  assert.equal(paraNumero("85.000"), 85000);
  assert.equal(paraNumero("R$ 2.350,00"), 2350);
  assert.equal(paraNumero(""), 0);
  assert.equal(paraNumero(1500.5), 1500.5);
});

/* O caso do laboratorio (achado da revisao de 27/08/2026): quantidade em
   fracao. Virgula em pt-BR e SEMPRE decimal — a regra do teto de 2 casas so
   vale para o ponto, que e o sinal ambiguo. Antes, "0,125" virava 125 e uma
   retirada de 125 mL zerava um estoque de litros. */
test("paraNumero: virgula e sempre decimal, mesmo com 3 casas", () => {
  assert.equal(paraNumero("0,125"), 0.125);
  assert.equal(paraNumero("1,250"), 1.25);
  assert.equal(paraNumero("12,500"), 12.5);
  assert.equal(paraNumero("1.500,125"), 1500.125);
  // E o ponto continua ambiguo, resolvido pelo teto de 2 casas:
  assert.equal(paraNumero("1.500"), 1500);
  assert.equal(paraNumero("0.125"), 125); // sem virgula, 3 casas = milhar
});

test("diasEntre conta dias de calendario, nunca instantes", () => {
  assert.equal(diasEntre("2026-08-27", "2026-08-27"), 0);
  assert.equal(diasEntre("2026-08-27", "2026-08-28"), 1);
  assert.equal(diasEntre("2026-08-27", "2026-08-20"), -7);
  // atravessa mes e ano
  assert.equal(diasEntre("2026-12-30", "2027-01-02"), 3);
});

test("diaLocalISO: data pura passa intacta", () => {
  assert.equal(diaLocalISO("2026-08-27"), "2026-08-27");
});

test("ymdLocal monta AAAA-MM-DD com zero a esquerda", () => {
  assert.equal(ymdLocal(new Date(2026, 0, 5)), "2026-01-05");
});
