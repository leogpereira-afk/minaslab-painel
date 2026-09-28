import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarRecebimentos, statusVisto } from "../../supabase/functions/_shared/financeiro-resumo.mjs";
import { statusVisto as statusVistoTela } from "./tituloVencido.js";

// datas longe de hoje para o teste não depender do dia em que roda
const itens = [
  { id: 1, status: "A RECEBER", data_vencimento: "2020-01-10", valor_pendente: 100 },
  { id: 2, status: "PARCIAL", data_vencimento: "2020-01-10", valor_pendente: 50 },
  { id: 3, status: "VENCIDO", data_vencimento: "2020-01-10", valor_pendente: 70 },
  { id: 4, status: "A RECEBER", data_vencimento: "2099-01-10", valor_pendente: 80 },
  { id: 5, status: "PAGO", data_vencimento: "2020-01-10", valor_pendente: 0 },
  { id: 6, status: "PARCIAL", data_vencimento: "2099-01-10", valor_pendente: 10 },
];
const ids = (filtro) => filtrarRecebimentos(itens, { status: filtro }).map((x) => x.id);

test("coluna Status no servidor: VENCIDO pela data, com o parcial vencido junto", () => {
  assert.deepEqual(ids("VENCIDO"), [1, 2, 3]);
});

test("A RECEBER não traz o que já venceu (o selo desses é VENCIDO)", () => {
  assert.deepEqual(ids("A RECEBER"), [4]);
});

test("PARCIAL traz o parcial vencido e o em dia", () => {
  assert.deepEqual(ids("PARCIAL"), [2, 6]);
});

test("PAGO e RECEBIDO continuam iguais", () => {
  assert.deepEqual(ids("PAGO"), [5]);
  assert.deepEqual(ids("RECEBIDO"), [5]);
});

test("a regra do servidor é a mesma da tela", () => {
  const hoje = "2026-09-28";
  for (const x of itens) assert.equal(statusVisto(x, hoje), statusVistoTela(x, hoje), `título ${x.id}`);
});
