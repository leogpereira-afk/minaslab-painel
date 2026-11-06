import test from "node:test";
import assert from "node:assert/strict";
import { compromissosVisiveis, compromissoVisivelPara, quemVeTexto, criadorDe } from "./compromissosVisiveis.js";

const ana = { usuario: "ana", nome: "ANA CLAUDIA GONÇALVES PESSOA", papel: "direcao" };
const brenda = { usuario: "brenda", nome: "BRENDA KAILANY SOARES BARBOSA", papel: "equipe" };
const thayna = { usuario: "thayna", nome: "THAYNA LOPES CARDOSO", papel: "equipe" };
const leo = { usuario: "leonardo", nome: "LEONARDO PEREIRA", papel: "direcao" };

const lista = [
  { id: "todos", titulo: "Reunião geral", criador: "ana", paraTodos: true, participantes: [] },
  { id: "so-ana", titulo: "Só meu", criador: "ana", paraTodos: false, participantes: [] },
  { id: "ana-brenda", titulo: "Com a Brenda", criador: "ana", paraTodos: false, participantes: ["brenda"] },
  { id: "antigo-resp", titulo: "Antigo, responsável Thayna", responsavelNome: "THAYNA LOPES CARDOSO", atualizadoPor: "ana" },
  { id: "antigo-sem", titulo: "Antigo, sem responsável", atualizadoPor: "ana" },
];
const ids = (s) => compromissosVisiveis(lista, s).map((c) => c.id);

test("toda a equipe: todo mundo vê", () => {
  for (const s of [ana, brenda, thayna, leo]) assert.ok(ids(s).includes("todos"));
});

test("ninguém escolhido: só quem criou vê — inclusive para a direção", () => {
  assert.ok(ids(ana).includes("so-ana"));
  assert.ok(!ids(leo).includes("so-ana"));
  assert.ok(!ids(brenda).includes("so-ana"));
});

test("pessoas escolhidas: só elas e quem criou", () => {
  assert.ok(ids(ana).includes("ana-brenda"));
  assert.ok(ids(brenda).includes("ana-brenda"));
  assert.ok(!ids(thayna).includes("ana-brenda"));
  assert.ok(!ids(leo).includes("ana-brenda"));
});

test("compromisso antigo: quem gravou e o responsável pelo nome; sem responsável, só quem gravou", () => {
  assert.ok(ids(thayna).includes("antigo-resp"));
  assert.ok(ids(ana).includes("antigo-resp"));
  assert.ok(!ids(brenda).includes("antigo-resp"));
  assert.deepEqual(compromissosVisiveis([lista[4]], leo), []);
  assert.equal(criadorDe(lista[4]), "ana");
});

test("criador explícito vale mais que quem gravou por último", () => {
  const c = { id: "x", criador: "ana", atualizadoPor: "brenda", paraTodos: false, participantes: [] };
  assert.ok(compromissoVisivelPara(c, ana));
  assert.ok(!compromissoVisivelPara(c, brenda));
});

test("sem sessão não mostra nada; lista nula passa direto", () => {
  assert.deepEqual(compromissosVisiveis(lista, null), []);
  assert.equal(compromissosVisiveis(null, ana), null);
});

test("texto de quem vê", () => {
  const nomes = { ana: "ANA CLAUDIA", brenda: "BRENDA KAILANY", thayna: "THAYNA LOPES" };
  assert.equal(quemVeTexto(lista[0], ana, nomes), "Toda a equipe");
  assert.equal(quemVeTexto(lista[1], ana, nomes), "Só você");
  assert.equal(quemVeTexto(lista[1], brenda, nomes), "Só ANA");
  assert.equal(quemVeTexto(lista[2], brenda, nomes), "ANA e Você");
  assert.equal(quemVeTexto({ criador: "ana", participantes: ["brenda", "thayna"] }, ana, nomes), "Você, BRENDA e THAYNA");
  assert.equal(quemVeTexto(lista[3], ana, nomes), "THAYNA LOPES CARDOSO");
});
