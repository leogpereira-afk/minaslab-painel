import test from "node:test";
import assert from "node:assert/strict";
import { extrairDadosKit } from "./leituraKit.js";

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
