import test from "node:test";
import assert from "node:assert/strict";
import { extrairDadosKit, extrairDadosFichaRegistro } from "./leituraKit.js";

test("kit admissional extrai campos e identifica conflitos sem sobrescrever", () => {
  const texto = "NOME COMPLETO: BRENDA KAILANY SOARES BARBOSA CPF: 123.456.789-00 DATA DE NASCIMENTO: 10/02/2000 DATA DE ADMISSÃO: 01/09/2026 CARGO: Auxiliar de Laboratório TELEFONE: (38) 99999-1111";
  const r = extrairDadosKit(texto, { cargo: "Analista de Laboratório" });
  assert.equal(r.dados.nome, "BRENDA KAILANY SOARES BARBOSA");
  assert.equal(r.dados.cpf, "12345678900");
  assert.equal(r.dados.dataNascimento, "2000-02-10");
  assert.equal(r.dados.admissao, "2026-09-01");
  assert.equal(r.dados.cargo, "Auxiliar de Laboratório");
  assert.equal(r.conflitos.length, 1);
  assert.equal(r.leituraStatus, "CONCLUIDA");
});

test("ficha de registro reconhece o layout da folha cadastral", () => {
  const texto = "Ficha.: 9 9 - Brenda Kailany Soares Barbosa CPF: 700.250.406-18 Data Nascimento: 22/12/2003 Data Admissão: 10/08/2026 CBO: 324205 Analista de Laboratorio Salário/Cpl. Sal. 1.621,0000 Endereço: Lago Kivu Município: Montes Claros CEP: 39.402-804 Matrícula eSocial: SEMLABSERV00000000000000000010";
  const r = extrairDadosFichaRegistro(texto);
  assert.equal(r.dados.nome, "Brenda Kailany Soares Barbosa");
  assert.equal(r.dados.cpf, "70025040618");
  assert.equal(r.dados.dataNascimento, "2003-12-22");
  assert.equal(r.dados.admissao, "2026-08-10");
  assert.equal(r.dados.cargo, "Analista de Laboratorio");
  assert.equal(r.dados.salario, "1621.0000");
  assert.equal(r.dados.cidade, "Montes Claros");
  assert.equal(r.dados.cep, "39.402-804");
  assert.equal(r.dados.matriculaEsocial, "SEMLABSERV00000000000000000010");
});
