import test from "node:test";
import assert from "node:assert/strict";
import { extrairDadosKit, extrairDadosFichaRegistro } from "./leituraKit.js";

test("kit admissional extrai campos e identifica conflitos sem sobrescrever", () => {
  const texto = "NOME COMPLETO: MARIA EXEMPLO DE SOUZA CPF: 111.444.777-35 DATA DE NASCIMENTO: 15/01/1990 DATA DE ADMISSÃO: 01/03/2024 CARGO: Auxiliar de Laboratório TELEFONE: (38) 99999-0000";
  const r = extrairDadosKit(texto, { cargo: "Analista de Laboratório" });
  assert.equal(r.dados.nome, "MARIA EXEMPLO DE SOUZA");
  assert.equal(r.dados.cpf, "11144477735");
  assert.equal(r.dados.dataNascimento, "1990-01-15");
  assert.equal(r.dados.admissao, "2024-03-01");
  assert.equal(r.dados.cargo, "Auxiliar de Laboratório");
  assert.equal(r.conflitos.length, 1);
  assert.equal(r.leituraStatus, "CONCLUIDA");
});

test("ficha de registro reconhece o layout da folha cadastral", () => {
  const texto = "Ficha.: 9 9 - Maria Exemplo de Souza CPF: 529.982.247-25 Data Nascimento: 15/01/1990 Data Admissão: 01/03/2024 CBO: 324205 Analista de Laboratorio Salário/Cpl. Sal. 1.500,0000 Endereço: Rua Exemplo Município: Montes Claros CEP: 39.400-000 Matrícula eSocial: SEMLABSERV12345678901234567890";
  const r = extrairDadosFichaRegistro(texto);
  assert.equal(r.dados.nome, "Maria Exemplo de Souza");
  assert.equal(r.dados.cpf, "52998224725");
  assert.equal(r.dados.dataNascimento, "1990-01-15");
  assert.equal(r.dados.admissao, "2024-03-01");
  assert.equal(r.dados.cargo, "Analista de Laboratorio");
  assert.equal(r.dados.salario, "1500.0000");
  assert.equal(r.dados.cidade, "Montes Claros");
  assert.equal(r.dados.cep, "39.400-000");
  assert.equal(r.dados.matriculaEsocial, "SEMLABSERV12345678901234567890");
});
