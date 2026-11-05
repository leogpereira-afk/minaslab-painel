import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroContrato, contratosPendentes, contratoDaProposta, totalContrato, diasParaVencer, gerarParcelas, saldoServicos, novoAgendamento, planoAutomatico, datasRepeticao, agendarPlano, mesclarAgendamentos } from "./contratos.js";

const prop = () => ({ id: "p1", num: 959, ano: 2026, ver: 1, status: "Aceito", clienteId: "c1", itens: [{ descricao: "Potabilidade", qtd: 4, params: [{ id: "a", preco: 30 }, { id: "b", preco: 20 }] }], outros: 100 });
const ger = { inicio: "2026-11-04", fim: "2026-12-31", ciclo: "Parcelado", parcelas: 3, primeiroPag: "2026-11-10", tipoPeriodo: "Por dia Fixo", cobrarDia: "10" };

test("número do contrato é o da proposta sem versão", () => {
  assert.equal(numeroContrato({ num: 959, ano: 2026 }), "00000959/2026");
});

test("pendentes: aceitas sem contrato", () => {
  const ps = [prop(), { ...prop(), id: "p2" }, { ...prop(), id: "p3", status: "Salvo" }];
  assert.deepEqual(contratosPendentes(ps, [{ propostaId: "p1" }]).map((p) => p.id), ["p2"]);
});

test("contrato herda os serviços da proposta e confere datas", () => {
  const c = contratoDaProposta(prop(), ger, "Ana");
  assert.equal(c.proposta, "00000959/2026.1");
  assert.equal(c.servicos.length, 1);
  assert.equal(c.servicos[0].sid, "s1");
  assert.equal(totalContrato(c), 4 * 50 + 100);
  assert.throws(() => contratoDaProposta(prop(), { ...ger, fim: "2026-11-01" }), /data final/);
  assert.throws(() => contratoDaProposta(prop(), { ...ger, primeiroPag: "" }), /primeira parcela/);
  assert.equal(diasParaVencer(c, "2026-12-01"), 30);
});

test("parcelas: valor dividido com sobra na última, dia fixo e dia útil", () => {
  const p = gerarParcelas(100, 3, "2026-11-10", "Por dia Fixo", "31");
  assert.deepEqual(p.map((x) => x.valor), [33.33, 33.33, 33.34]);
  assert.deepEqual(p.map((x) => x.venc), ["2026-11-10", "2026-12-31", "2027-01-31"]);
  const u = gerarParcelas(90, 2, "2026-11-10", "Por dia útil", "1", ["2026-12-01"]);
  assert.equal(u[1].venc, "2026-12-02"); // 1º dia útil de dezembro, pulando o feriado de 01/12
});

test("agendamento respeita o saldo contratado", () => {
  const c = contratoDaProposta(prop(), ger, "Ana");
  const a = novoAgendamento(c, { data: "2026-11-05T08:00", servicos: [{ sid: "s1", qtd: 3 }] });
  const c2 = { ...c, agendamentos: [a] };
  assert.equal(saldoServicos(c2)[0].saldo, 1);
  assert.throws(() => novoAgendamento(c2, { data: "2026-11-06T08:00", servicos: [{ sid: "s1", qtd: 2 }] }), /saldo/);
  assert.throws(() => novoAgendamento(c2, { data: "", servicos: [{ sid: "s1", qtd: 1 }] }), /data/);
  // cancelado devolve o saldo
  assert.equal(saldoServicos({ ...c, agendamentos: [{ ...a, status: "Cancelado" }] })[0].saldo, 4);
});

test("plano automático: a cada N dias, pula fim de semana e para no saldo", () => {
  const c = contratoDaProposta(prop(), ger, "Ana");
  // 07/11/2026 é sábado → vai para segunda 09/11
  const ag = planoAutomatico(c, { inicio: "2026-11-07", fim: "2026-12-31", intervaloDias: 7, sids: ["s1"] });
  assert.equal(ag.length, 4);
  assert.equal(ag[0].data, "2026-11-09T08:00");
  assert.throws(() => planoAutomatico(c, { inicio: "2026-11-07", fim: "2026-12-31", intervaloDias: 0, sids: ["s1"] }), /frequência/);
});

test("repetição do plano de coleta (Único, Semanal, Mensal, dias livres)", () => {
  assert.deepEqual(datasRepeticao({ inicio: "2026-11-07T10:30" }), ["2026-11-07T10:30"]);
  // 07/11/2026 é sábado: "segunda á sexta" leva para segunda 09/11
  assert.deepEqual(datasRepeticao({ inicio: "2026-11-07T08:00", fim: "2026-11-30", repetir: "Semanal", cada: 1 }), ["2026-11-09T08:00", "2026-11-16T08:00", "2026-11-23T08:00", "2026-11-30T08:00"]);
  assert.deepEqual(datasRepeticao({ inicio: "2026-11-02T08:00", fim: "2026-11-20", repetir: "Diariamente", cada: 7, dia: "Quarta Feira" }), ["2026-11-04T08:00", "2026-11-11T08:00", "2026-11-18T08:00"]);
  assert.equal(datasRepeticao({ inicio: "2026-01-31T08:00", fim: "2026-04-30", repetir: "Mensal", dia: "Livre - todos os dias" })[1], "2026-02-28T08:00");
  assert.throws(() => datasRepeticao({ inicio: "2026-11-07T08:00", repetir: "Semanal" }), /última coleta/);
});

test("agendar plano respeita saldo e mesclar soma os serviços", () => {
  const c = { servicos: [{ sid: "s1", qtd: 3, params: [{ id: "a" }, { id: "b" }] }], agendamentos: [] };
  const ags = agendarPlano(c, { datas: ["2026-11-09T08:00", "2026-11-16T08:00"], servicos: [{ sid: "s1", qtd: 1, params: ["a"] }] });
  assert.equal(ags.length, 2);
  assert.deepEqual(ags[0].servicos[0].params, ["a"]);
  assert.throws(() => agendarPlano(c, { datas: ["2026-11-09T08:00", "2026-11-16T08:00"], servicos: [{ sid: "s1", qtd: 2 }] }), /saldo/);
  const m = mesclarAgendamentos({ ...c, agendamentos: ags }, ags.map((a) => a.id));
  assert.equal(m.agendamentos.length, 1);
  assert.equal(m.agendamentos[0].servicos[0].qtd, 2);
});
