import { test } from "node:test";
import assert from "node:assert/strict";
import { erroCliente, normalizarCliente } from "./clientes.js";

const pj = { pessoa: "PJ", resp: "Carlos", doc: "12.345.678/0001-90", razao: "Laticínios Serra Verde Ltda", email: "" };

test("pessoa jurídica pede responsável, CNPJ com 14 dígitos e razão social", () => {
  assert.equal(erroCliente(pj), null);
  assert.deepEqual(erroCliente({ ...pj, resp: " " })[0], "resp");
  assert.deepEqual(erroCliente({ ...pj, doc: "12.345.678/0001" })[0], "doc");
  assert.deepEqual(erroCliente({ ...pj, razao: "" })[0], "razao");
  assert.deepEqual(erroCliente({ ...pj, email: "sem-arroba" })[0], "email");
});

test("pessoa física pede CPF e usa o nome como razão social", () => {
  const pf = { pessoa: "PF", resp: "João Neves", doc: "123.456.789-09", razao: "", fantasia: "X", ie: "1" };
  assert.equal(erroCliente(pf), null);
  assert.match(erroCliente({ ...pf, doc: "123" })[1], /CPF/);
  const n = normalizarCliente(pf);
  assert.equal(n.razao, "João Neves");
  assert.equal(n.fantasia, "");
  assert.equal(n.ie, "");
});

test("tipo Ambos, endereços antigos e e-mail por tipo", async () => {
  const { tipoCadastro, enderecosDoCliente, emailDoTipo, erroAcesso } = await import("./clientes.js");
  assert.equal(tipoCadastro("Cliente / Fornecedor"), "Ambos");
  const antigo = { resp: "Ana", email: "ana@x.com", end: "Rua A", cidade: "BH" };
  assert.equal(enderecosDoCliente(antigo)[0].tipo, "Principal");
  assert.deepEqual(enderecosDoCliente({}), []);
  const c = { email: "geral@x.com", enderecos: [{ tipo: "Resultados", email: "r1@x.com" }, { tipo: "Resultados", email: "r2@x.com", padrao: "Sim" }, { tipo: "Nota Fiscal", email: "nf@x.com", status: "Inativo" }] };
  assert.equal(emailDoTipo(c, "Resultados"), "r2@x.com");
  assert.equal(emailDoTipo(c, "Nota Fiscal"), "geral@x.com");
  assert.equal(erroAcesso({ nome: "A", email: "a@x.com", permissoes: [] })[0], "aPerm");
  assert.equal(erroAcesso({ nome: "A", email: "a@x.com", permissoes: ["Download"] }), null);
});
