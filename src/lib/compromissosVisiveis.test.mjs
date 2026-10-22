import test from "node:test";
import assert from "node:assert/strict";
import { compromissosVisiveis, compromissoEhMeu, meuIdNoElenco } from "./compromissosVisiveis.js";

const lista = [
  { id: "1", titulo: "da Brenda", responsavelId: "pes_b", responsavelNome: "BRENDA KAILANY SOARES BARBOSA" },
  { id: "2", titulo: "da Thayna", responsavelId: "pes_t", responsavelNome: "THAYNA LOPES CARDOSO" },
  { id: "3", titulo: "sem responsável" },
  { id: "4", titulo: "criado pela Brenda para a Thayna", responsavelId: "pes_t", responsavelNome: "THAYNA LOPES CARDOSO", atualizadoPor: "brenda" },
  { id: "5", titulo: "só pelo nome (id velho)", responsavelId: "outro", responsavelNome: "Brenda Barbosa" },
];
const equipe = [{ id: "pes_b", nome: "BRENDA KAILANY SOARES BARBOSA", apelido: "" }, { id: "pes_t", nome: "THAYNA LOPES CARDOSO", apelido: "" }];
const brenda = { usuario: "brenda", nome: "BRENDA KAILANY SOARES BARBOSA", papel: "equipe" };
const thayna = { usuario: "thayna", nome: "THAYNA LOPES CARDOSO", papel: "equipe" };
const direcao = { usuario: "ana", nome: "ANA CLAUDIA GONÇALVES PESSOA", papel: "direcao" };

test("direção vê todos os compromissos", () => {
  assert.equal(compromissosVisiveis(lista, direcao, equipe).length, 5);
});

test("a equipe vê só o que foi delegado a ela (ou que ela mesma gravou)", () => {
  assert.deepEqual(compromissosVisiveis(lista, brenda, equipe).map((c) => c.id), ["1", "4", "5"]);
  assert.deepEqual(compromissosVisiveis(lista, thayna, equipe).map((c) => c.id), ["2", "4"]);
});

test("sem responsável só a direção vê; sem elenco carregado, vale o nome e quem gravou", () => {
  assert.ok(!compromissosVisiveis(lista, brenda, equipe).some((c) => c.id === "3"));
  assert.deepEqual(compromissosVisiveis(lista, thayna, []).map((c) => c.id), ["2", "4"]);
});

test("sem sessão não mostra nada; lista nula passa direto", () => {
  assert.deepEqual(compromissosVisiveis(lista, null, equipe), []);
  assert.equal(compromissosVisiveis(null, brenda, equipe), null);
});

test("achar a ficha pelo nome no elenco", () => {
  assert.equal(meuIdNoElenco(brenda, equipe), "pes_b");
  assert.equal(meuIdNoElenco({ nome: "Fulano de Tal" }, equipe), "");
  assert.equal(compromissoEhMeu(lista[1], brenda, "pes_b"), false);
});
