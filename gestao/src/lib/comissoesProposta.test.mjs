import test from "node:test";
import assert from "node:assert/strict";
import { donosDasPropostas, pagosPorProposta, extratoColaborador, itensPagamentoPropostas, geradaNoMes, osDoExtrato, serieMensal, situacaoOS } from "./comissoesProposta.js";

const RUTH = { id: "r", nome: "RUTH", crmId: "u1", desde: "2026-10-01", taxas: [{ desde: "2026-10-01", pct: 1 }] };
const VERA = { id: "v", nome: "VERA", crmId: "u2", desde: "2026-10-01", taxas: [{ desde: "2026-01-01", pct: 1 }], ativo: false };
const OS = (id, proposta, dataOs, valor, fat = "FATURADO", pag = "PAGO", emissao = dataOs) => ({ id, os: id, proposta, dataOs, emissao: fat === "FATURADO" ? emissao : "", valor, fat, pag });

function contexto(registros, propostas, os) {
  const colabs = [RUTH, VERA];
  const osPorProposta = new Map();
  for (const o of os) osPorProposta.set(o.proposta, [...(osPorProposta.get(o.proposta) || []), o]);
  const pagamentos = registros.filter((r) => r.tipo === "pagamento");
  return (c) => extratoColaborador(c, {
    dono: donosDasPropostas(colabs, registros, propostas),
    propsPorNumero: new Map(propostas.map((p) => [p.numero, p])),
    osPorProposta, pagos: pagosPorProposta(pagamentos),
    planilha: registros.filter((r) => r.tipo === "planilha" && r.colaboradorId === c.id).flatMap((r) => r.linhas),
  });
}

const REG = [
  { tipo: "planilha", colaboradorId: "r", linhas: [
    { proposta: "434", data: "2026-05-04", base: 450, valor: 4.5, pago: true },
    { proposta: "648", data: "2026-07-23", base: 11760, valor: 117.6, pago: true },
    { proposta: "16", data: "2026-09-17", base: 210, valor: 2.1, pago: true },
  ] },
  { tipo: "planilha", colaboradorId: "v", linhas: [{ proposta: "16", data: "2026-01-05", base: 200, valor: 2, pago: true }] },
  { tipo: "pagamento", colaboradorId: "r", pagoEm: "2026-06-01", planilha: true, itens: [{ proposta: "434", valor: 4.5, planilha: true }, { proposta: "648", valor: 117.6, planilha: true }, { proposta: "16", valor: 2.1, planilha: true }] },
  { tipo: "pagamento", colaboradorId: "v", pagoEm: "2026-02-01", planilha: true, itens: [{ proposta: "16", valor: 2, planilha: true }] },
];
const PROPS = [
  { numero: "434", responsavel: "u1", aceite: "2026-05-04", valor: 450, status: "APROVADA" },
  { numero: "900", responsavel: "u1", aceite: "2026-10-05", valor: 500, status: "APROVADA" },
  { numero: "800", responsavel: "u1", aceite: "2026-09-20", valor: 300, status: "APROVADA" }, // antes da contagem, fora da planilha
];
const OSS = [
  OS("a", "434", "2026-05-05", 450), OS("b", "434", "2026-06-10", 450), OS("c", "434", "2026-07-16", 450),
  OS("d", "648", "2026-07-25", 3060),
  OS("e", "900", "2026-10-06", 250, "FATURADO", "A RECEBER"), OS("f", "900", "2026-10-20", 250, "PRONTO PARA FATURAR", "AGUARDANDO"),
  OS("g", "800", "2026-10-02", 300),
  OS("h", "16", "2026-10-19", 210, "FATURADO", "A RECEBER"),
];

test("proposta antiga da planilha: regra nova menos o já pago; adiantado não vira dívida", () => {
  const ex = contexto(REG, PROPS, OSS)(RUTH);
  const l434 = ex.linhas.find((l) => l.numero === "434");
  assert.deepEqual([l434.osGeradas, l434.geradas, l434.faltaGerar, l434.gerada, l434.pago, l434.aPagar], [3, 1350, 0, 13.5, 4.5, 9]);
  const l648 = ex.linhas.find((l) => l.numero === "648");
  assert.deepEqual([l648.gerada, l648.pago, l648.aPagar, l648.adiantado, l648.faltaGerar], [30.6, 117.6, 0, 87, 8700]);
});

test("proposta nova: só aceite e OS a partir da contagem; previsão das OS a faturar", () => {
  const ex = contexto(REG, PROPS, OSS)(RUTH);
  const l900 = ex.linhas.find((l) => l.numero === "900");
  assert.deepEqual([l900.origem, l900.osGeradas, l900.faturado, l900.pagoCliente, l900.gerada, l900.previsao, l900.faltaGerar], ["crm", 2, 250, 0, 2.5, 2.5, 0]);
  assert.ok(!ex.linhas.some((l) => l.numero === "800"));
  assert.equal(geradaNoMes(ex, "2026-10"), 4.6); // 900 (2,50) + 16 (2,10)
});

test("proposta paga a duas pessoas fica com a linha mais recente e soma o pago de todos", () => {
  const run = contexto(REG, PROPS, OSS);
  const l16 = run(RUTH).linhas.find((l) => l.numero === "16");
  assert.equal(l16.pago, 4.1);
  assert.equal(l16.aPagar, 0); // gerou 2,10, já pagaram 4,10
  assert.ok(!run(VERA).linhas.some((l) => l.numero === "16"));
});

test("pagar o que falta zera a proposta", () => {
  const run = contexto(REG, PROPS, OSS);
  const ex = run(RUTH);
  const sel = ex.linhas.filter((l) => l.aPagar > 0);
  const pg = { tipo: "pagamento", colaboradorId: "r", pagoEm: "2026-10-30", itens: itensPagamentoPropostas(sel) };
  const ex2 = contexto([...REG, pg], PROPS, OSS)(RUTH);
  assert.equal(ex2.totais.aPagar, 0);
});

test("todas as OS: com e sem NF, comissão liberada ou prevista", () => {
  const ex = contexto(REG, PROPS, OSS)(RUTH);
  const os = osDoExtrato(ex);
  const f = os.find((o) => o.id === "f");
  assert.equal(f.sit.id, "faltaNF");
  assert.equal(f.prevista, 2.5);
  assert.equal(os.find((o) => o.id === "e").sit.id, "nf");
  assert.equal(situacaoOS({ fat: "CANCELADO", pag: "CANCELADO" }).id, "cancelada");
  assert.equal(ex.linhas.find((l) => l.numero === "900").semNF, 250);
});

test("série mensal: gerada pela NF, paga pela folha, média dos meses pagos", () => {
  const ex = contexto(REG, PROPS, OSS)(RUTH);
  const pg = [
    { pagoEm: "2026-06-01", total: 10 }, { pagoEm: "2026-08-01", total: 20 },
    { pagoEm: "2026-01-01", total: 5, planilha: true, obs: "Importado: pago, mas sem o mês da folha na planilha" },
  ];
  const s = serieMensal([ex], pg, { ate: "2026-10" });
  assert.equal(s.serie[0].mes, "2026-05");
  assert.equal(s.serie.at(-1).mes, "2026-10");
  assert.equal(s.mediaPaga, 15);
  assert.equal(s.pagoSemMes, 5);
  assert.equal(s.serie.find((x) => x.mes === "2026-10").gerada, 4.6);
});

test("situação da proposta: pendente, em andamento, finalizada e cancelada", async () => {
  const { statusProposta } = await import("./comissoesProposta.js");
  const L = (x) => ({ status: "APROVADA", os: [{ cancelada: false }], osGeradas: 1, geradas: 100, valorProposta: 100, semNF: 0, ...x });
  assert.equal(statusProposta(L({ os: [], osGeradas: 0, geradas: 0 })), "pendente");
  assert.equal(statusProposta(L({ geradas: 50 })), "andamento");
  assert.equal(statusProposta(L({ semNF: 10 })), "andamento");
  assert.equal(statusProposta(L({})), "finalizada");
  assert.equal(statusProposta(L({ status: "CANCELADA", os: [], osGeradas: 0, geradas: 0 })), "cancelada");
  assert.equal(statusProposta(L({ os: [{ cancelada: true }], osGeradas: 0 })), "cancelada");
});

test("conferência: status do CRM, aprovada sem OS e aceite atrasado", async () => {
  const { conferencia, statusProposta } = await import("./comissoesProposta.js");
  const L = (x) => ({ numero: "1", cliente: "", origem: "crm", status: "APROVADA", os: [], osGeradas: 0, geradas: 0, valorProposta: 100, semNF: 0, gerada: 0, aceite: "2026-05-01", ...x });
  const fat = { faturada: true, cancelada: false, dataOs: "2026-05-02" };
  const contas = [{ c: { nome: "X" }, ex: { linhas: [
    L({ numero: "a", status: "CANCELADA", os: [fat], osGeradas: 1, geradas: 100 }),
    L({ numero: "b" }),
    L({ numero: "c", aceite: "2026-08-01", os: [fat], osGeradas: 1, geradas: 100 }),
    L({ numero: "d", status: "", origem: "planilha", aceite: "" }),
  ] } }];
  const r = conferencia(contas, "2026-10-27");
  assert.deepEqual(r.map((x) => `${x.proposta}:${x.tipo}`).sort(), ["a:crmStatus", "b:semOS", "c:aceiteAtrasado", "d:semCadastro"]);
  assert.equal(statusProposta(contas[0].ex.linhas[0]), "finalizada"); // cancelada no CRM, mas com OS
});

test("regra de setembro: responsável automático e proposta quitada pela planilha", async () => {
  const { colaboradoresComAutomaticos, extratoColaborador, donosDasPropostas, pagosPorProposta } = await import("./comissoesProposta.js");
  const props = [
    { numero: "10", responsavel: "u9", aceite: "2026-09-05", valor: 300, status: "APROVADA" },
    { numero: "11", responsavel: "u9", aceite: "2026-08-30", valor: 300, status: "APROVADA" },
    { numero: "12", responsavel: "u9", aceite: "2026-09-10", valor: 500, status: "APROVADA" },
  ];
  const colabs = colaboradoresComAutomaticos([], [{ id: "u9", nome: "Fulana Teste" }], props);
  assert.equal(colabs.length, 1);
  assert.equal(colabs[0].id, "auto_u9");
  const regs = [{ tipo: "planilha", colaboradorId: "auto_u9", linhas: [{ proposta: "12", quitada: true, data: "2026-09-10" }] }];
  const os = new Map([["10", [{ id: "a", proposta: "10", dataOs: "2026-09-06", emissao: "2026-09-08", valor: 300, fat: "FATURADO", pag: "A RECEBER" }]],
    ["12", [{ id: "b", proposta: "12", dataOs: "2026-09-11", emissao: "2026-09-12", valor: 500, fat: "FATURADO", pag: "PAGO" }]]]);
  const ex = extratoColaborador(colabs[0], { dono: donosDasPropostas(colabs, regs, props), propsPorNumero: new Map(props.map((p) => [p.numero, p])), osPorProposta: os, pagos: pagosPorProposta([]), planilha: regs[0].linhas });
  const l10 = ex.linhas.find((l) => l.numero === "10");
  const l12 = ex.linhas.find((l) => l.numero === "12");
  assert.equal(l10.aPagar, 3);
  assert.deepEqual([l12.quitada, l12.pago, l12.aPagar], [true, 5, 0]);
  assert.ok(!ex.linhas.some((l) => l.numero === "11"));
});
