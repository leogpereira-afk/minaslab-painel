import test from "node:test";
import assert from "node:assert/strict";
import { mensagemAmigavel } from "./errosAmigaveis.js";

test("traduz erro de chave duplicada", () => {
  const m = mensagemAmigavel('duplicate key value violates unique constraint "ml_registros_pkey"');
  assert.match(m, /Já existe um registro/);
  assert.doesNotMatch(m, /ml_registros_pkey/);
});
test("traduz outros erros do banco", () => {
  assert.match(mensagemAmigavel("null value in column \"x\" violates not-null constraint"), /campo obrigatório/);
  assert.match(mensagemAmigavel("canceling statement due to statement timeout"), /demorou demais/);
  assert.match(mensagemAmigavel('invalid input syntax for type integer: "a"'), /formato inválido/);
});
test("mensagem já escrita para a pessoa passa sem mudar", () => {
  const t = "Quantidade maior que o saldo disponível.";
  assert.equal(mensagemAmigavel(t), t);
  assert.equal(mensagemAmigavel(undefined), "");
});
