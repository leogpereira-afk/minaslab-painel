import { test } from "node:test";
import assert from "node:assert/strict";
import { estaVencido, hojeSaoPaulo, statusVisto } from "./tituloVencido.js";

const HOJE = "2026-09-28";
const titulo = (status, data_vencimento, valor_pendente = 100) => ({ status, data_vencimento, valor_pendente });

test("lançado à mão em aberto depois do vencimento está vencido (o caso que o painel perdia)", () => {
  assert.equal(estaVencido(titulo("A PAGAR", "2026-09-20"), HOJE), true);
  assert.equal(estaVencido(titulo("A RECEBER", "2026-09-27"), HOJE), true);
  assert.equal(statusVisto(titulo("A PAGAR", "2026-09-20"), HOJE), "VENCIDO");
});

test("vencer hoje ainda não é vencido; sem data também não", () => {
  assert.equal(estaVencido(titulo("A PAGAR", HOJE), HOJE), false);
  assert.equal(estaVencido(titulo("A PAGAR", ""), HOJE), false);
  assert.equal(estaVencido(titulo("A PAGAR", null), HOJE), false);
  assert.equal(statusVisto(titulo("A PAGAR", HOJE), HOJE), "A PAGAR");
});

test("pago, cancelado ou sem saldo nunca é vencido", () => {
  assert.equal(estaVencido(titulo("PAGO", "2026-01-01", 0), HOJE), false);
  assert.equal(estaVencido(titulo("CANCELADO", "2026-01-01"), HOJE), false);
  assert.equal(estaVencido(titulo("A PAGAR", "2026-01-01", 0), HOJE), false);
  assert.equal(estaVencido(titulo("A PAGAR", "2026-01-01", "0"), HOJE), false);
});

test("parcial vencido continua dizendo que é parcial", () => {
  assert.equal(estaVencido(titulo("PARCIAL", "2026-09-01"), HOJE), true);
  assert.equal(statusVisto(titulo("PARCIAL", "2026-09-01"), HOJE), "PARCIAL VENCIDO");
});

test("marca VENCIDO gravada: o selo mantém; a conta segue a data, como o filtro do servidor", () => {
  assert.equal(statusVisto(titulo("VENCIDO", "2026-09-01"), HOJE), "VENCIDO");
  assert.equal(estaVencido(titulo("VENCIDO", "2026-09-01"), HOJE), true);
  assert.equal(estaVencido(titulo("VENCIDO", "2026-10-10"), HOJE), false);
});

test("status em minúsculas e data com hora", () => {
  assert.equal(estaVencido(titulo("a pagar", "2026-09-20T00:00:00"), HOJE), true);
});

test("hoje é o dia de São Paulo, não o de Londres", () => {
  // 28/09 às 23h30 em São Paulo já é 29/09 em UTC
  assert.equal(hojeSaoPaulo(new Date("2026-09-29T02:30:00Z")), "2026-09-28");
  assert.equal(hojeSaoPaulo(new Date("2026-09-29T03:30:00Z")), "2026-09-29");
});
