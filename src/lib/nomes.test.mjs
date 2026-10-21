import test from "node:test";
import assert from "node:assert/strict";
import { nomeCurto, encurtarNomes, suavizarTexto, pareceNomeCadastro } from "./nomes.js";

test("primeiro e último nome, sem partículas e sem caixa alta", () => {
  assert.equal(nomeCurto("ANA CLAUDIA GONÇALVES PESSOA"), "Ana Pessoa");
  assert.equal(nomeCurto("GIOVANNA FROES DA SILVA CAPUCHINHO"), "Giovanna Capuchinho");
  assert.equal(nomeCurto("PESSOA DE SOUZA"), "Pessoa Souza");
  assert.equal(nomeCurto("LEONARDO"), "Leonardo");
  assert.equal(nomeCurto("maria d'ávila"), "Maria D'Ávila");
  assert.equal(nomeCurto(""), "");
});

test("só encurta o que parece nome do cadastro", () => {
  assert.equal(pareceNomeCadastro("ANA PESSOA"), true);
  assert.equal(pareceNomeCadastro("Equipe do Laboratório"), false);
  assert.equal(pareceNomeCadastro("RELATORIO.PDF"), false);
  assert.equal(pareceNomeCadastro("ANA"), false);
});

test("encurta nomes na resposta, sem mexer em textos e arquivos", () => {
  const r = encurtarNomes({
    nomes: { ana: "ANA CLAUDIA GONÇALVES PESSOA" },
    conversas: [{ tipo: "direta", titulo: "RUTH DIAS OLIVEIRA" }, { tipo: "grupo", titulo: "EQUIPE LAB" }],
    posts: [{ autor_nome: "ANA CLAUDIA GONÇALVES PESSOA", texto: "BOM DIA EQUIPE", quemCurtiu: ["BRENDA KAILANY SOARES BARBOSA"], anexo: { nome: "FOTO.JPG" } }],
  });
  assert.equal(r.nomes.ana, "Ana Pessoa");
  assert.equal(r.conversas[0].titulo, "Ruth Oliveira");
  assert.equal(r.conversas[1].titulo, "EQUIPE LAB");
  assert.equal(r.posts[0].autor_nome, "Ana Pessoa");
  assert.equal(r.posts[0].texto, "BOM DIA EQUIPE");
  assert.deepEqual(r.posts[0].quemCurtiu, ["Brenda Barbosa"]);
  assert.equal(r.posts[0].anexo.nome, "FOTO.JPG");
});

test("aviso do sino com nome em maiúsculas", () => {
  assert.equal(suavizarTexto("ANA CLAUDIA GONÇALVES PESSOA comentou em \"Proposta\""), "Ana Pessoa comentou em \"Proposta\"");
  assert.equal(suavizarTexto("Nova notícia no Canais MinasLab"), "Nova notícia no Canais MinasLab");
});
