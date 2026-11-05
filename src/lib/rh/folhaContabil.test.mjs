import test from "node:test";
import assert from "node:assert/strict";
import { lerRelatorioFolha, casarPessoa, classificarEvento } from "./folhaContabil.js";

// Linhas no formato que o leitor de PDF entrega (células separadas por " | ").
// Nomes e valores FICTÍCIOS — este repositório é público.
const EVENTOS = [
  "0423 | - | Empresa Exemplo Ltda | Pág.: | 1",
  "Relação de Eventos",
  "Período: | 10/2026 | a | 10/2026 | Tipo: | Cálculo Mensal",
  "Evento | Colaborador | SIT | Competência | Pagamento | Referência | Valor",
  "0001 | - | Horas Normais",
  "7 | Maria Teste da Silva | 001 | 10/2026 | 06/11/2026 | 220,00 | 3.000,00",
  "9 | Joana Exemplo Souza | 001 | 10/2026 | 06/11/2026 | 110,00 | 900,00",
  "Total de Colaboradores: | 02 | 330,00 | 3.900,00",
  "0163 | - | Troco Mês",
  "7 | Maria Teste da Silva | 001 | 10/2026 | 06/11/2026 | 0,00 | 0,58",
  "0165 | - | Troco Mês Anterior",
  "9 | Joana Exemplo Souza | 001 | 10/2026 | 06/11/2026 | 0,00 | 0,76",
  "0300 | - | FGTS",
  "7 | Maria Teste da Silva | 001 | 10/2026 | 06/11/2026 | 8,00 | 240,00",
  "0302 | - | INSS",
  "7 | Maria Teste da Silva | 001 | 10/2026 | 06/11/2026 | 12,00 | 248,58",
  "9 | Joana Exemplo Souza | 001 | 10/2026 | 06/11/2026 | 7,50 | 67,50",
  "1003 | - | Líquido Folha",
  "7 | Maria Teste da Silva | 001 | 10/2026 | 06/11/2026 | 0,00 | 2.752,00",
  "9 | Joana Exemplo Souza | 001 | 10/2026 | 06/11/2026 | 0,00 | 831,74",
  "FPRF004.OPE - 30/10/2026 - 10:03:10 | CONTABILIDADE EXEMPLO | Usuário: x",
];

test("Relação de Eventos: empresa, competência, eventos e líquido conferido por pessoa", () => {
  const r = lerRelatorioFolha(EVENTOS);
  assert.equal(r.tipo, "eventos");
  assert.deepEqual(r.empresa, { codigo: "0423", nome: "Empresa Exemplo Ltda" });
  assert.equal(r.competencia, "2026-10");
  const maria = r.pessoas.find((p) => p.cadastro === "7");
  assert.equal(maria.proventos, 3000.58);
  assert.equal(maria.descontos, 248.58);
  assert.equal(maria.liquido, 2752);
  assert.equal(maria.confere, true);
  assert.equal(maria.fgts, 240, "FGTS é informativo: não entra no líquido");
  assert.equal(maria.salarioBase, 3000);
  const joana = r.pessoas.find((p) => p.cadastro === "9");
  assert.equal(joana.salarioBase, 1800, "meio mês: o valor-hora vezes 220");
  assert.equal(joana.confere, true, "troco do mês anterior é desconto");
});

test("Relação de Líquidos: só o líquido de cada um", () => {
  const r = lerRelatorioFolha([
    "0424 | - | Outra Empresa Ltda | Pág.: | 1",
    "Relação Líquidos",
    "Ordem | Cadastro | Nome | Situação | Pagamento | Valor",
    "00001 | 2 | Maria Teste da Silva | 001 | Trabalhando | 06/11/2026 | 2.670,00",
    "Total Empresa | 00001 | 2.670,00",
  ]);
  assert.equal(r.tipo, "liquidos");
  assert.equal(r.empresa.codigo, "0424");
  assert.equal(r.pessoas[0].liquido, 2670);
  assert.equal(r.pessoas[0].confere, null);
});

test("soma que não fecha com o líquido sai marcada", () => {
  const linhas = EVENTOS.map((l) => l.replace("2.752,00", "2.700,00"));
  assert.equal(lerRelatorioFolha(linhas).pessoas.find((p) => p.cadastro === "7").confere, false);
});

test("relatório que não é de folha não é lido", () => {
  assert.equal(lerRelatorioFolha(["Resumo da Folha", "qualquer coisa"]).tipo, null);
});

test("classificação dos eventos", () => {
  assert.equal(classificarEvento("0302", "INSS"), "desconto");
  assert.equal(classificarEvento("0300", "FGTS"), "informativo");
  assert.equal(classificarEvento("1004", "Líquido Pró-Labore"), "liquido");
  assert.equal(classificarEvento("0056", "Hrs Atestado até 15 dias"), "provento");
});

test("casar com a ficha: sem acento, por palavras, e nunca no escuro", () => {
  const fichas = [{ id: "a", nome: "MARIA TESTE DA SILVA" }, { id: "b", nome: "JOANA EXEMPLO SOUZA" }, { id: "c", nome: "JOANA EXEMPLO LIMA" }];
  assert.equal(casarPessoa("Maria Teste da Silva", fichas)?.id, "a");
  assert.equal(casarPessoa("Maria Silva", fichas)?.id, "a", "nome curto do Gestão");
  assert.equal(casarPessoa("Joana Exemplo", fichas), null, "duas Joanas: ambíguo");
  assert.equal(casarPessoa("Pedro Nada", fichas), null);
});
