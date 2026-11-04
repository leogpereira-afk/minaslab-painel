import { test } from "node:test";
import assert from "node:assert/strict";
import { pesquisar, filtrarColunas, ordenar, paginar } from "./grade.js";

const cols = [
  { t: "ID", v: (l) => l.id },
  { t: "Status", v: (l) => l.status, filtro: "lista" },
  { t: "Cliente", v: (l) => l.cliente, filtro: true },
];
const linhas = [
  { id: 3, status: "Aceito", cliente: "SAAE Bocaiúva" },
  { id: 10, status: "Salvo", cliente: "Laticínios Serra Verde" },
  { id: 2, status: "Aceito", cliente: "Hospital Santa Rita" },
];

test("pesquisa ignora acento e maiúsculas em qualquer coluna", () => {
  assert.deepEqual(pesquisar(linhas, cols, "bocaiuva").map((l) => l.id), [3]);
  assert.deepEqual(pesquisar(linhas, cols, "  ").length, 3);
});

test("filtro por coluna: lista compara inteiro, texto compara parte; Todos não filtra", () => {
  assert.deepEqual(filtrarColunas(linhas, cols, { 1: "Aceito" }).map((l) => l.id), [3, 2]);
  assert.deepEqual(filtrarColunas(linhas, cols, { 1: "Todos", 2: "serra" }).map((l) => l.id), [10]);
  assert.equal(filtrarColunas(linhas, cols, { 1: "Aceit" }).length, 0);
});

test("ordena número como número e texto em pt-BR", () => {
  assert.deepEqual(ordenar(linhas, cols[0], "asc").map((l) => l.id), [2, 3, 10]);
  assert.deepEqual(ordenar(linhas, cols[0], "desc").map((l) => l.id), [10, 3, 2]);
  assert.deepEqual(ordenar(linhas, cols[2]).map((l) => l.id), [2, 10, 3]);
});

test("paginação mostra 'Mostrando de X até Y' e encurta com reticências", () => {
  const p = paginar(1103, 0, 100);
  assert.equal(p.paginas, 12);
  assert.equal(p.de, 1);
  assert.equal(p.ate, 100);
  assert.deepEqual(p.botoes, [0, 1, "…", 10, 11]);
  const meio = paginar(1103, 5, 100);
  assert.deepEqual(meio.botoes, [0, 1, "…", 4, 5, 6, "…", 10, 11]);
  assert.equal(paginar(0, 3, 10).de, 0);
  assert.equal(paginar(25, 99, 10).atual, 2);
});
