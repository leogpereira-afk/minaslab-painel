import test from "node:test";
import assert from "node:assert/strict";
import { faltasProdutoBase, normalizarProdutoBase, produtoAtivo, normalizarFornecedor, proximaAvaliacao, statusReavaliacao, classificarFornecedor } from "./estoqueCadastros.js";

test("produto base: obrigatórios e maiúsculas", () => {
  assert.deepEqual(faltasProdutoBase({ produto: "x", fornecedorAtual: "f", grupo: "g", unidade: "UN", setor: "s", qtdMinima: 0 }), []);
  assert.equal(faltasProdutoBase({ produto: "", qtdMinima: "" }).length, 6);
  assert.ok(faltasProdutoBase({ produto: "x", fornecedorAtual: "f", grupo: "g", unidade: "UN", setor: "s", qtdMinima: -1 }).some((r) => /mínima/i.test(r)));
  const n = normalizarProdutoBase({ produto: " ácido ", especificacao: "p.a.", grupo: "reagente", setor: "lab", fornecedor: "acs" });
  assert.deepEqual([n.produto, n.especificacao, n.grupo, n.setor, n.fornecedorAtual], ["ÁCIDO", "P.A.", "REAGENTE", "LAB", "ACS"]);
});
test("produto inativo", () => {
  assert.equal(produtoAtivo({ statusQuantidade: "INATIVO" }), false);
  assert.equal(produtoAtivo({}), true);
});
test("fornecedor: maiúsculas e minúsculas do legado", () => {
  const f = normalizarFornecedor({ nome: "ceimic", endereco: "rua a", email: "A@B.COM", website: "HTTPS://X.COM", tipoFornecedor: "reagentes" });
  assert.deepEqual([f.nome, f.endereco, f.email, f.website, f.tipoFornecedor], ["CEIMIC", "RUA A", "a@b.com", "https://x.com", "REAGENTES"]);
});
test("próxima avaliação: +6 meses mantendo o dia ou o fim do mês", () => {
  assert.equal(proximaAvaliacao("2026-03-15", "SIM", "SEMESTRAL"), "2026-09-15");
  assert.equal(proximaAvaliacao("2026-08-31", "SIM", "SEMESTRAL"), "2027-02-28");
  assert.equal(proximaAvaliacao("2026-03-15", "SIM", "ANUAL"), "");
  assert.equal(proximaAvaliacao("2026-03-15", "NÃO", "SEMESTRAL"), "");
  assert.equal(proximaAvaliacao("", "SIM", "SEMESTRAL"), "");
});
test("status de reavaliação como no legado", () => {
  const hoje = "2026-10-01";
  assert.equal(statusReavaliacao("INATIVO", "SIM", "SEMESTRAL", "2027-01-01", hoje), "NÃO SE APLICA");
  assert.equal(statusReavaliacao("ATIVO", "SIM", "ANUAL", "2027-01-01", hoje), "NÃO SE APLICA");
  assert.equal(statusReavaliacao("ATIVO", "SIM", "SEMESTRAL", "", hoje), "NÃO CONFIGURADA");
  assert.equal(statusReavaliacao("ATIVO", "SIM", "SEMESTRAL", "2026-10-01", hoje), "VENCIDA");
  assert.equal(statusReavaliacao("ATIVO", "SIM", "SEMESTRAL", "2026-10-31", hoje), "REAVALIAR EM BREVE");
  assert.equal(statusReavaliacao("ATIVO", "SIM", "SEMESTRAL", "2026-11-01", hoje), "EM DIA");
});
test("classificar grava próxima avaliação e status", () => {
  const r = classificarFornecedor({ status: "ativo", requerQualificacao: "SIM", periodicidade: "SEMESTRAL", dataUltimaAvaliacao: "2026-04-01", tipoFornecedor: "reagente" }, "2026-10-01");
  assert.equal(r.dataProximaAvaliacao, "2026-10-01");
  assert.equal(r.statusReavaliacao, "VENCIDA");
  assert.equal(r.tipoFornecedor, "REAGENTE");
});
