import { test } from "node:test";
import assert from "node:assert/strict";
import { erroSolicitante, normalizarSolicitante, enderecoDoCadastro, erroEndereco, emailsDoSolicitante, rotuloSolicitante } from "./solicitantes.js";

test("validação no padrão do GerenciaLab", () => {
  assert.equal(erroSolicitante({ pessoa: "PJ", nome: "" })[0], "sNome");
  assert.equal(erroSolicitante({ pessoa: "PJ", nome: "Ana" })[0], "sRazao");
  assert.match(erroSolicitante({ pessoa: "PJ", nome: "Ana", razao: "X Ltda", doc: "12.345" })[1], /CNPJ/);
  assert.match(erroSolicitante({ pessoa: "PF", nome: "Ana", doc: "123" })[1], /CPF/);
  assert.equal(erroSolicitante({ pessoa: "PF", nome: "Ana", doc: "123.456.789-01" }), null);
  assert.equal(erroSolicitante({ pessoa: "PJ", nome: "Ana", razao: "X", email: "a@" })[0], "sEmail");
});

test("pessoa física usa o nome como razão social", () => {
  const n = normalizarSolicitante({ pessoa: "PF", nome: " Ana ", razao: "lixo", fantasia: "f", ie: "1", email: " A@B.COM " });
  assert.deepEqual([n.razao, n.fantasia, n.ie, n.email], ["Ana", "", "", "a@b.com"]);
});

test("endereço principal, e-mails e rótulo", () => {
  const e = enderecoDoCadastro({ nome: "Ana", email: "a@x.com", cidade: "BH" });
  assert.equal(e.tipo, "Principal");
  assert.equal(erroEndereco({ ...e, tipo: "" })[0], "eTipo");
  assert.equal(erroEndereco(e), null);
  const s = { email: "a@x.com", enderecos: [{ tipo: "Resultados", email: "R@x.com" }, { tipo: "Nota Fiscal", email: "a@x.com" }] };
  assert.deepEqual(emailsDoSolicitante(s), ["a@x.com", "r@x.com"]);
  assert.deepEqual(emailsDoSolicitante(s, "Resultados"), ["a@x.com", "r@x.com"]);
  assert.equal(rotuloSolicitante({ nome: "Ana", razao: "X Ltda" }), "X Ltda (Ana)");
  assert.equal(rotuloSolicitante({ nome: "Ana", razao: "Ana" }), "Ana");
});
