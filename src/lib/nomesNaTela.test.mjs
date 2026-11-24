import test from "node:test";
import assert from "node:assert/strict";
import { registrarPessoas, tabelaCurtos, montarRegex, encurtarTexto } from "./nomesNaTela.js";

test("primeiro e último nome, com desempate pelo segundo nome", () => {
  const t = tabelaCurtos(["ANA CLAUDIA GONÇALVES PESSOA", "ANA MARIA DA SILVA PESSOA", "GIOVANNA FROES DA SILVA CAPUCHINHO", "José Roberto Dias"]);
  assert.equal(t.get("ana claudia gonçalves pessoa"), "Ana Claudia Pessoa");
  assert.equal(t.get("ana maria da silva pessoa"), "Ana Maria Pessoa");
  assert.equal(t.get("giovanna froes da silva capuchinho"), "Giovanna Capuchinho");
  assert.equal(t.get("josé roberto dias"), "José Dias");
});

test("troca só nomes conhecidos, inteiros, em qualquer caixa", () => {
  const t = tabelaCurtos(["GIOVANNA FROES DA SILVA CAPUCHINHO", "PEDRO HENRIQUE COSTA"]);
  const r = montarRegex(t);
  assert.equal(encurtarTexto("Pagamento · GIOVANNA FROES DA SILVA CAPUCHINHO", t, r), "Pagamento · Giovanna Capuchinho");
  assert.equal(encurtarTexto("Giovanna Froes da Silva Capuchinho e Pedro  Henrique Costa", t, r), "Giovanna Capuchinho e Pedro Costa");
  assert.equal(encurtarTexto("PEDRO HENRIQUE COSTAS LTDA", t, r), "PEDRO HENRIQUE COSTAS LTDA");
  assert.equal(encurtarTexto("MINERAÇÃO GERAIS DO BRASIL", t, r), "MINERAÇÃO GERAIS DO BRASIL");
});

test("aprende nomes de colaboradores da resposta, não de empresas", () => {
  const vistos = [];
  const orig = tabelaCurtos;
  registrarPessoas({
    pessoas: [{ id: "1", nome: "MARIA APARECIDA DOS SANTOS", apelido: "" }],
    lista: [{ pessoaNome: "CARLOS EDUARDO MOURA LIMA" }, { nome: "LABORATORIO ALFA BETA SA", cnpj: "1", usuario: "x" }],
    nomes: { joao: "JOÃO PAULO FERREIRA" },
  });
  const t = orig();
  for (const k of t.keys()) vistos.push(k);
  assert.ok(vistos.includes("maria aparecida dos santos"));
  assert.ok(vistos.includes("carlos eduardo moura lima"));
  assert.ok(vistos.includes("joão paulo ferreira"));
  assert.ok(!vistos.includes("laboratorio alfa beta sa"));
});
