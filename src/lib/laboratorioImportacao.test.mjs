import test from "node:test";
import assert from "node:assert/strict";
import { lerData, lista, simNao, lerXlsx, converterPlanilha } from "./laboratorioImportacao.js";
import { planilhaBytes } from "./planilha.js";

const ler = (v) => { const p = []; return [lerData(v, "Data", p), p]; };

test("datas digitadas à mão viram data de verdade", () => {
  assert.equal(ler("03/06/2026 10;00")[0], "2026-06-03T10:00");
  assert.equal(ler("30/04/202614:03")[0], "2026-04-30T14:03");
  assert.equal(ler("21/08/2026:1700")[0], "2026-08-21T17:00");
  assert.equal(ler("26032026 15:00")[0], "2026-03-26T15:00");
  assert.equal(ler("17/09/ 2026 13:40")[0], "2026-09-17T13:40");
  assert.equal(ler("05/052026 15;48")[0], "2026-05-05T15:48");
  assert.equal(ler("1205/2026 16:20")[0], "2026-05-12T16:20");
  assert.equal(ler("10:07/2026 15:15")[0], "2026-07-10T15:15");
  assert.equal(ler("01/04/2026 14:!0")[0], "2026-04-01T14:10");
  assert.equal(ler(26082026)[0], "2026-08-26T00:00");
  assert.equal(ler(260320261545)[0], "2026-03-26T15:45");
});

test("número de série do Excel vira data e hora (arredondada ao minuto)", () => {
  assert.equal(ler(46041)[0], "2026-01-19T00:00");
  assert.equal(ler(46308.4861111)[0], "2026-10-13T11:40");
});

test("o que não dá para ler fica como pendência, nunca inventado", () => {
  for (const v of ["12/03/0202", "#VALUE!", "30/07/20216:26", "22/0/2026 06;40", "Os cancelada virou a"]) {
    const [d, p] = ler(v);
    assert.equal(d, "", v);
    assert.equal(p.length, 1, v);
  }
  assert.match(ler(0.38)[1][0], /só hora/);
  assert.match(ler(47237)[1][0], /ano 2029/);
  assert.deepEqual(ler(""), ["", []]);
});

test("nomes e tipos separados e padronizados; SIM/NÃO tolerante", () => {
  assert.deepEqual(lista("LUCAS, JOSE ROBERTO"), ["LUCAS", "JOSE ROBERTO"]);
  assert.deepEqual(lista("ANDERSON E VICTORIA"), ["ANDERSON", "VICTORIA"]);
  assert.deepEqual(lista("Ana Claudia"), ["ANA CLÁUDIA"]);
  assert.deepEqual(lista("CONTROLE DE QUALIDADE, ÁGUA", { "CONTROLE DE QUALIDADE": "CQ", AGUA: "ÁGUA" }), ["CQ", "ÁGUA"]);
  assert.deepEqual(lista("NA"), []);
  assert.equal(simNao("sím"), true);
  assert.equal(simNao("SM"), true);
  assert.equal(simNao("NÃO"), false);
  assert.equal(simNao(""), null);
});

test("lê um .xlsx e converte as linhas a partir da 3ª", () => {
  const colunas = "ABCDEFGHIJKLMNOPQ".split("").map((c) => ({ chave: c, rotulo: c, tipo: "texto" }));
  const linhas = [
    { A: "057/2026", B: "150/151-2026", C: "19/01/2026 09;30", D: "RUTH", E: "EFLUENTE", F: "NÃO", G: "INTERNO", H: "VICTORIA", K: "NA", L: "SIM", N: "13/02/2026", O: "sim", P: "06/02/2026", Q: "descartado" },
    { A: "1541/2026", B: "4426/2026", C: "13/10/2026 11:40", F: "NÃO", G: "PROVEDOR", P: "CANCELADA" },
    {},
  ];
  const bytes = planilhaBytes({ colunas, linhas, titulo: "Protocolo" });
  const regs = converterPlanilha(lerXlsx(bytes), { arquivo: "teste.xlsx" });
  assert.equal(regs.length, 2);
  const [a, b] = regs;
  assert.equal(a.id, "labent-imp-00003");
  assert.equal(a.qtdAmostras, 2);
  assert.equal(a.recebidoEm, "2026-01-19T09:30");
  assert.deepEqual(a.tipos, ["EFLUENTE"]);
  assert.equal(a.liberadoCliente, true);
  assert.equal(a.descartado, true);
  assert.equal(a.observacao, "");
  assert.deepEqual(a.pendencias, []);
  assert.equal(b.cancelada, true);
  assert.equal(b.liberadoEm, "");
});
