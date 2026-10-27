import test from "node:test";
import assert from "node:assert/strict";
import { lerLinhasPlanilha, planoImportacao, dataPlanilha, numeroProposta } from "./comissoesPlanilha.js";
import { situacao, porMes, itensDoPagamento } from "./comissoes.js";

const CAB = ["COLABORADOR", "DATA CRIAÇÃO", "CÓDIGO", "CONTRATO", "CNPJ", "CLIENTE", "TOTAL", "R$ COMISSÃO 1 %", "MÊS FOLHA DE PAGAMENTO", "PAGAMENTO", "ANO", "MÊS"];
const L = (colab, serial, contrato, total, pago, folha = null) => [colab, serial, 1, contrato, "x", "Cliente Teste", total, total / 100, folha, pago ? "Pago" : "Não pago", 2026, "x"];
// 46027 = 05/01/2026; 46113 = 01/04/2026
const ABAS = { DADOS: [CAB,
  L("Pessoa A", 46027, "00000002/2026.0", 300, true),
  L("Pessoa A", 46027, "00000002/2026.0", 300, true),
  L("Pessoa A", 46113, "00000010/2026.1", 500, true, "ABRIL"),
  L("Pessoa A", 46113, "00000011/2026.0", 200, false),
  L("Pessoa  B", 46113, "00000010/2026.0", 500, true, "ABRIL"),
] };

test("datas, números de proposta e linhas da planilha", () => {
  assert.equal(dataPlanilha(46027), "2026-01-05");
  assert.equal(dataPlanilha("05/01/2026"), "2026-01-05");
  assert.equal(numeroProposta("00000002/2026.0"), "00000002/2026");
  const { linhas } = lerLinhasPlanilha(ABAS);
  assert.equal(linhas.length, 5);
  assert.deepEqual([linhas[2].folhaMes, linhas[2].pago, linhas[3].pago, linhas[0].valor], [4, true, false, 3]);
});

test("plano: pagos viram histórico por folha, não pagos viram saldo, conferência acha repetidas", () => {
  const { linhas } = lerLinhasPlanilha(ABAS);
  const colabs = [{ id: "c1", tipo: "colaborador", nome: "PESSOA A", crmId: "u1", desde: "2026-10-01", taxas: [{ desde: "2026-10-01", pct: 1 }] }];
  const pessoasCRM = [{ id: "u1", nome: "Pessoa A" }, { id: "u2", nome: "Pessoa B" }];
  const p = planoImportacao(linhas, { colabs, pessoasCRM });
  assert.equal(p.colaboradores.length, 1); // B entra fora do cálculo
  assert.equal(p.colaboradores[0].crmId, "u2");
  assert.equal(p.colaboradores[0].ativo, false);
  const pgA = p.pagamentos.filter((x) => x.colaboradorId === "c1");
  assert.equal(pgA.length, 2); // sem mês da folha (jan) e folha de abril
  assert.equal(pgA.find((x) => x.pagoEm === "2026-04-01").total, 5);
  assert.equal(p.planilhas.find((x) => x.colaboradorId === "c1").linhas.length, 4);
  assert.ok(p.alertas.some((a) => a.tipo === "repetida" && a.proposta === "00000002/2026" && a.valor === 3));
  assert.ok(p.alertas.some((a) => a.tipo === "duasPessoas" && a.proposta === "00000010/2026"));
  // Importar de novo dá os mesmos ids (não duplica).
  const p2 = planoImportacao(linhas, { colabs, pessoasCRM });
  assert.deepEqual(p2.pagamentos.map((x) => x.id), p.pagamentos.map((x) => x.id));
});

test("OS paga e ainda a faturar não vira estorno; cancelada vira", () => {
  const colab = { id: "c1", crmId: "u1", desde: "2026-10-01", taxas: [{ desde: "2026-10-01", pct: 1 }] };
  const pg = [{ id: "p", colaboradorId: "c1", itens: [{ osId: "o1", valor: 5 }, { osId: "o2", valor: 3 }] }];
  const osPorId = new Map([["o1", { fat: "PRONTO PARA FATURAR", pag: "AGUARDANDO" }], ["o2", { fat: "CANCELADO", pag: "CANCELADO" }]]);
  const s = situacao(colab, { itens: [], previsao: [] }, pg, new Set(), { osPorId });
  assert.deepEqual(s.aPagar.map((i) => [i.id, i.valor]), [["o2", -3]]);
});
