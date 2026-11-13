import test from "node:test";
import assert from "node:assert/strict";
import { modelosDoSetor, nomeRepetido } from "./modelosFuncoes.js";

const COM_HOJE = ["Auxiliar Administrativo Comercial I", "Auxiliar Administrativo Comercial II", "Estagiário de Suporte Operacional", "Operador de Coletas e Logística"].map((nome, i) => ({ id: `f${i}`, nome }));

test("Comercial: mantém as 4 que existem (inclusive por nome antigo) e traz só as que faltam", () => {
  const nomes = modelosDoSetor("comercial", COM_HOJE).map((m) => m.nome).sort();
  assert.deepEqual(nomes, ["Analista Administrativo Comercial", "Analista Financeiro", "Auxiliar Administrativo Financeiro", "Gerente Administrativo", "Gerente Financeiro", "Supervisor Administrativo", "Técnico de Amostragem e Coleta"].sort());
});

test("Laboratório: só cargos de laboratório e qualidade; Supervisor da Qualidade já existe", () => {
  const ms = modelosDoSetor("laboratorio", [{ id: "fun_mvlabsupqual", nome: "Supervisor da Qualidade" }]);
  const nomes = ms.map((m) => m.nome);
  assert.equal(nomes.length, 9);
  assert.ok(!nomes.includes("Supervisor da Qualidade"));
  assert.ok(!nomes.some((n) => /Comercial|Financeir|Coleta/.test(n)));
  assert.equal(ms.find((m) => m.nome === "Analista de Laboratório I").idFixo, "fun_mvlabanalis1");
});

test("nome repetido é recusado, ignorando acento, caixa e a própria função", () => {
  assert.equal(nomeRepetido(COM_HOJE, "operador de coletas e logistica"), true);
  assert.equal(nomeRepetido(COM_HOJE, "Operador de Coletas e Logística", "f3"), false);
  assert.equal(nomeRepetido(COM_HOJE, "Gerente Financeiro"), false);
});
