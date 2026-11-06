import test from "node:test";
import assert from "node:assert/strict";
import { chavesDaRota, chavesFinanceiroLiberadas, podeAbrirRotaFinanceiro, primeiraRotaFinanceiro, temFinanceiro, usaListasFinanceiro } from "./rotasFinanceiro.js";

const M = "__matriz_v1";

test("cada rota do financeiro pede a sua página", () => {
  assert.deepEqual(chavesDaRota("/financas"), ["financas/visao-geral"]);
  assert.deepEqual(chavesDaRota("/financas/"), ["financas/visao-geral"]);
  assert.deepEqual(chavesDaRota("/financas/recebimentos"), ["financas/receber"]);
  assert.deepEqual(chavesDaRota("/financas/despesas"), ["financas/pagar"]);
  assert.deepEqual(chavesDaRota("/financas/extrato"), ["financas/bancos"]);
  assert.deepEqual(chavesDaRota("/financas/fechamento-mlab"), ["financas/conciliacao"]);
  assert.deepEqual(chavesDaRota("/financas/notas-fiscais/emitir"), ["financas/notas/emitir"]);
  assert.deepEqual(chavesDaRota("/financas/plano-contas"), ["financas/configuracoes/plano-contas"]);
  assert.deepEqual(chavesDaRota("/financas/configuracoes/omie"), ["financas/configuracoes/omie"]);
  assert.deepEqual(chavesDaRota("/financas/configuracoes/categorias"), ["financas/configuracoes/categorias"]);
  assert.ok(chavesDaRota("/financas/configuracoes").includes("financas/configuracoes/contas"));
});

test("rota desconhecida ou fora do financeiro não abre", () => {
  assert.equal(chavesDaRota("/financas/qualquer-coisa"), null);
  assert.equal(chavesDaRota("/financas/configuracoes/inventada"), null);
  assert.equal(chavesDaRota("/rh"), null);
  assert.equal(podeAbrirRotaFinanceiro("/financas/qualquer-coisa", [M, "financas/receber"]), false);
});

test("sem a matriz, só Serviços Gerados vale (como antes)", () => {
  const antiga = ["financas/servicos-gerados", "financas/receber", "financas/pagar"];
  assert.deepEqual(chavesFinanceiroLiberadas(antiga), ["financas/servicos-gerados"]);
  assert.equal(podeAbrirRotaFinanceiro("/financas/contas-a-receber", antiga), false);
  assert.equal(podeAbrirRotaFinanceiro("/financas/servicos-gerados", antiga), true);
  assert.equal(temFinanceiro(["inicio", "compras"]), false);
});

test("com a matriz, abre só o que foi liberado", () => {
  const conta = [M, "financas/receber", "financas/notas"];
  assert.equal(podeAbrirRotaFinanceiro("/financas/contas-a-receber", conta), true);
  assert.equal(podeAbrirRotaFinanceiro("/financas/contas-a-pagar", conta), false);
  assert.equal(podeAbrirRotaFinanceiro("/financas", conta), false);
  assert.equal(podeAbrirRotaFinanceiro("/financas/notas-fiscais", conta), true);
  // Notas não libera emitir, cancelar nem importar: cada uma é liberada à parte.
  assert.equal(podeAbrirRotaFinanceiro("/financas/notas-fiscais/emitir", conta), false);
  assert.equal(podeAbrirRotaFinanceiro("/financas/notas-fiscais/cancelar", conta), false);
  assert.equal(podeAbrirRotaFinanceiro("/financas/notas-fiscais/importar-historico", conta), false);
  assert.equal(primeiraRotaFinanceiro(conta), "/financas/contas-a-receber");
});

test("uma seção de Configurações abre o hub e só a sua seção", () => {
  const conta = [M, "financas/configuracoes/categorias"];
  assert.equal(podeAbrirRotaFinanceiro("/financas/configuracoes", conta), true);
  assert.equal(podeAbrirRotaFinanceiro("/financas/configuracoes/categorias", conta), true);
  assert.equal(podeAbrirRotaFinanceiro("/financas/configuracoes/contas", conta), false);
  assert.equal(podeAbrirRotaFinanceiro("/financas/configuracoes/omie", conta), false);
  assert.equal(primeiraRotaFinanceiro(conta), "/financas/configuracoes");
});

test("sem nenhuma página do financeiro não há rota", () => {
  assert.equal(primeiraRotaFinanceiro([M, "compras"]), null);
  assert.equal(primeiraRotaFinanceiro([]), null);
});

test("cópia local das listas só para quem tem página que lista títulos", () => {
  assert.equal(usaListasFinanceiro([M, "financas/relatorios"]), true);
  assert.equal(usaListasFinanceiro([M, "financas/conciliacao"]), true);
  assert.equal(usaListasFinanceiro([M, "financas/recibos"]), false);
  assert.equal(usaListasFinanceiro(["financas/visao-geral"]), false);
});
