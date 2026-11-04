import { test } from "node:test";
import assert from "node:assert/strict";
import { numero, resultadoExibido, parecer, limiteDe, statusPelasAnalises, lancarResultado, enviarRevisao, revisar, inspecionar, registrarColeta, dataParaDescarte, valorAmostra, progressoOS, estatistica, violacoes, fluxoCaixa } from "./laboratorio.js";

const amostra = () => ({ status: "Laboratório", legislacao: "Portaria 888", sid: "s1", analises: [
  { pid: "ph", nome: "pH", lq: "", etapa: "Aguardando", resultado: "" },
  { pid: "tur", nome: "Turbidez", lq: "0,5", etapa: "Aguardando", resultado: "" },
] });

test("números em português", () => {
  assert.equal(numero("6,5"), 6.5);
  assert.equal(numero("1.234,5"), 1234.5);
  assert.equal(numero("7.2"), 7.2);
  assert.equal(numero("Ausente"), null);
  assert.equal(numero(""), null);
});

test("resultado abaixo do LQ sai como < LQ", () => {
  assert.equal(resultadoExibido("0,2", { lq: "0,5" }), "< 0,5");
  assert.equal(resultadoExibido("1,234", { lq: "0,5", casas: 2 }), "1,23");
  assert.equal(resultadoExibido("Ausente"), "Ausente");
});

test("parecer contra o VMP", () => {
  assert.equal(parecer("7,0", { minimo: 6, maximo: 9.5 }), "Conforme");
  assert.equal(parecer("10", { minimo: 6, maximo: 9.5 }), "Não conforme");
  assert.equal(parecer("5,9", { minimo: 6, maximo: "" }), "Não conforme");
  assert.equal(parecer("0,1", { minimo: 0.2, maximo: 2 }, "0,5"), "Não conforme");
  assert.equal(parecer("Presente", { texto: "Ausência em 100 mL" }), "Não conforme");
  assert.equal(parecer("Ausente", { texto: "Ausência em 100 mL" }), "Conforme");
  assert.equal(parecer("7", null), "");
});

test("limite vem da legislação da amostra", () => {
  const dados = { legislacoes: [{ id: "L1", nome: "Portaria 888" }], resultado_la: [{ legislacao: "L1", limites: [{ parametro: "tur", maximo: 5 }] }] };
  assert.deepEqual(limiteDe(dados, amostra(), "tur"), { parametro: "tur", maximo: 5 });
  assert.equal(limiteDe(dados, amostra(), "ph"), null);
});

test("fluxo: lançar → revisão → aprovar → assinatura", () => {
  let a = amostra();
  assert.throws(() => enviarRevisao(a, "t"), /Falta resultado em: pH, Turbidez/);
  a = { ...a, analises: a.analises.map((x) => lancarResultado(x, { resultado: "7", analista: "ana", quando: "t1" })) };
  assert.equal(a.analises[0].etapa, "Em análise");
  a = enviarRevisao(a, "t2");
  assert.equal(a.status, "Em Revisão");
  assert.throws(() => lancarResultado(a.analises[0], { resultado: "8", analista: "ana", quando: "t" }), /revisão/);
  assert.throws(() => revisar(a, ["ph"], { aprovar: true, revisor: "ana", quando: "t3" }), /não pode revisá-lo/);
  assert.throws(() => revisar(a, ["ph"], { aprovar: false, revisor: "leo", quando: "t3" }), /motivo/);
  const devolvida = revisar(a, ["ph"], { aprovar: false, revisor: "leo", quando: "t3", motivo: "Refazer" });
  assert.equal(devolvida.status, "Laboratório");
  assert.equal(devolvida.analises[0].motivoRetorno, "Refazer");
  a = revisar(a, ["ph", "tur"], { aprovar: true, revisor: "leo", quando: "t3" });
  assert.equal(a.status, "Assinatura");
  assert.equal(statusPelasAnalises({ ...a, status: "Cancelado" }), "Cancelado");
});

test("inspeção com desvio exige observação", () => {
  const ok = { responsavel: "ana", temperaturaOk: "Sim", prazoOk: "Sim", integraOk: "Sim" };
  assert.equal(inspecionar(amostra(), ok, { quando: "2026-11-04T10:00" }).status, "Laboratório");
  assert.throws(() => inspecionar(amostra(), { ...ok, prazoOk: "Não" }, { quando: "t" }), /desvio/);
  const r = inspecionar(amostra(), { ...ok, prazoOk: "Não", observacoes: "Cliente autorizou" }, { quando: "t" });
  assert.equal(r.inspecao.desvios.length, 1);
  assert.throws(() => inspecionar(amostra(), { ...ok, responsavel: "" }, { quando: "t" }), /responsável/);
});

test("coleta grava os resultados in loco", () => {
  const r = registrarColeta(amostra(), { coletor: "joao", dataColeta: "2026-11-04T09:00", inloco: { ph: "7,1" } });
  assert.equal(r.status, "Aguardando Inspeção");
  assert.equal(r.analises[0].resultado, "7,1");
  assert.equal(r.analises[1].etapa, "Aguardando");
  assert.throws(() => registrarColeta(amostra(), { coletor: "", dataColeta: "x" }), /responsável/);
});

test("descarte, valor e progresso", () => {
  assert.equal(dataParaDescarte({ dataEntrada: "2026-11-04T10:00" }, 30), "2026-12-04");
  assert.equal(valorAmostra({ servicos: [{ sid: "s1", params: [{ preco: 25 }, { preco: 18 }] }] }, { sid: "s1" }), 43);
  assert.deepEqual(progressoOS([{ status: "Assinatura" }, { status: "Laboratório" }, { status: "Cancelado" }]), { total: 2, prontas: 1, pct: 50 });
});

test("carta controle: média, desvio e Westgard", () => {
  const e = estatistica(["10", "12", "11", "9", "8"]);
  assert.equal(e.media, 10);
  assert.ok(Math.abs(e.dp - 1.5811) < 1e-3);
  assert.deepEqual(violacoes([10, 15, 13.5, 13.4], 10, 1.5).map((v) => v.regra), ["1-3s", "2-2s", "2-2s"]);
});

test("fluxo de caixa junta receber e pagar no período", () => {
  const f = fluxoCaixa([{ id: 1, valor: 100, venc: "2026-11-10", status: "Em aberto" }, { id: 2, valor: 50, venc: "2026-10-01", pagoEm: "2026-11-02", status: "Pago" }], [{ id: 3, valor: 30, vencimento: "2026-11-05", statusPagamento: "Pago", dataPagamento: "2026-11-05" }], "2026-11-01", "2026-11-30");
  assert.equal(f.linhas.length, 3);
  assert.equal(f.entradas, 150);
  assert.equal(f.saidas, -30);
  assert.equal(f.realizado, 20);
  assert.equal(f.previsto, 120);
});
