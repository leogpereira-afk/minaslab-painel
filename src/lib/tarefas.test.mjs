import test from "node:test";
import assert from "node:assert/strict";
import { agruparPorPrazo, atalhosDePrazo, atrasoTexto, colunaDoPrazo, corDoAvatar, deInputLocal, diasDeAtraso, diaLocal, iniciais, paraInputLocal, progressoChecklist, resumoDasTarefas, rotuloPrazo, semanaDe, tempoRelativo } from "./tarefas.js";

// Quarta-feira, 21/10/2026, 14:00 em São Paulo (17:00 UTC).
const AGORA = new Date("2026-10-21T17:00:00Z");
const em = (iso) => ({ status: "em_andamento", prazo: iso });

test("semana vai de segunda a domingo", () => {
  assert.deepEqual(semanaDe("2026-10-21"), ["2026-10-19", "2026-10-25"]);
  assert.deepEqual(semanaDe("2026-10-25"), ["2026-10-19", "2026-10-25"]); // domingo fecha a semana
  assert.deepEqual(semanaDe("2026-10-19"), ["2026-10-19", "2026-10-25"]);
});

test("dia local usa o horário de São Paulo, não o UTC", () => {
  assert.equal(diaLocal("2026-10-22T02:00:00Z"), "2026-10-21"); // 23:00 de quarta em SP
  assert.equal(diaLocal("2026-10-21T03:00:00Z"), "2026-10-21"); // 00:00 em SP
  assert.equal(diaLocal("2026-10-21T02:59:00Z"), "2026-10-20");
});

test("colunas do prazo", () => {
  assert.equal(colunaDoPrazo(em("2026-10-21T16:59:00Z"), AGORA), "vencido"); // 13:59 já passou
  assert.equal(colunaDoPrazo(em("2026-10-21T21:00:00Z"), AGORA), "hoje"); // hoje 18:00
  assert.equal(colunaDoPrazo(em("2026-10-22T21:00:00Z"), AGORA), "semana"); // quinta
  assert.equal(colunaDoPrazo(em("2026-10-26T01:59:00Z"), AGORA), "semana"); // domingo 22:59 em SP ainda é esta semana
  assert.equal(colunaDoPrazo(em("2026-10-26T15:00:00Z"), AGORA), "proxima"); // segunda 26
  assert.equal(colunaDoPrazo(em("2026-11-01T20:00:00Z"), AGORA), "proxima"); // domingo 1/11
  assert.equal(colunaDoPrazo(em("2026-11-02T20:00:00Z"), AGORA), "depois");
  assert.equal(colunaDoPrazo({ status: "nova", prazo: null }, AGORA), "sem_prazo");
  assert.equal(colunaDoPrazo({ status: "concluida", prazo: "2020-01-01T00:00:00Z" }, AGORA), null);
  assert.equal(colunaDoPrazo({ status: "nova", prazo: "lixo" }, AGORA), "sem_prazo");
});

test("agrupar: ordem fixa das colunas e urgentes primeiro", () => {
  const cols = agruparPorPrazo([
    { id: 1, titulo: "B", status: "nova", prazo: "2026-10-22T21:00:00Z", urgente: false },
    { id: 2, titulo: "A", status: "nova", prazo: "2026-10-23T21:00:00Z", urgente: true },
    { id: 3, titulo: "C", status: "nova", prazo: null },
    { id: 4, titulo: "D", status: "concluida", prazo: null },
    { id: 5, titulo: "E", status: "nova", prazo: "2026-10-01T12:00:00Z" },
  ], AGORA);
  assert.deepEqual(cols.map((c) => c.id), ["vencido", "hoje", "semana", "proxima", "depois", "sem_prazo"]);
  assert.deepEqual(cols[2].tarefas.map((t) => t.id), [2, 1]); // urgente antes, mesmo com prazo depois
  assert.deepEqual(cols[0].tarefas.map((t) => t.id), [5]);
  assert.deepEqual(cols[5].tarefas.map((t) => t.id), [3]);
  assert.equal(cols.flatMap((c) => c.tarefas).some((t) => t.id === 4), false); // concluída não entra
});

test("atraso em texto e em dias", () => {
  const dia = (n) => new Date(AGORA.getTime() - n * 86400000).toISOString();
  assert.equal(atrasoTexto(dia(-1), AGORA), ""); // ainda não venceu
  assert.equal(atrasoTexto(new Date(AGORA.getTime() - 30 * 60000).toISOString(), AGORA), "30 minutos");
  assert.equal(atrasoTexto(new Date(AGORA.getTime() - 3 * 3600000).toISOString(), AGORA), "3 horas");
  assert.equal(atrasoTexto(dia(1), AGORA), "1 dia");
  assert.equal(atrasoTexto(dia(5), AGORA), "5 dias");
  assert.equal(atrasoTexto(dia(15), AGORA), "2 semanas");
  assert.equal(atrasoTexto(dia(90), AGORA), "3 meses");
  assert.equal(diasDeAtraso(dia(19), AGORA), 19);
  assert.equal(diasDeAtraso(dia(-2), AGORA), 0);
});

test("rótulo do prazo", () => {
  assert.equal(rotuloPrazo("2026-10-21T21:00:00Z", AGORA), "Hoje, 18:00");
  assert.equal(rotuloPrazo("2026-10-22T12:30:00Z", AGORA), "Amanhã, 09:30");
  assert.equal(rotuloPrazo("2026-10-20T21:00:00Z", AGORA), "Ontem, 18:00");
  assert.equal(rotuloPrazo("2026-10-24T21:00:00Z", AGORA), "24 de outubro, 18:00");
  assert.equal(rotuloPrazo("2027-01-05T21:00:00Z", AGORA), "5 de janeiro de 2027, 18:00");
  assert.equal(rotuloPrazo(null, AGORA), "Sem prazo");
});

test("campo de data e hora: ida e volta em São Paulo", () => {
  assert.equal(deInputLocal("2026-11-16T18:00"), "2026-11-16T21:00:00.000Z");
  assert.equal(paraInputLocal("2026-11-16T21:00:00.000Z"), "2026-11-16T18:00");
  assert.equal(paraInputLocal(deInputLocal("2026-12-31T23:30")), "2026-12-31T23:30");
  assert.equal(deInputLocal(""), null);
  assert.equal(deInputLocal("16/11/2026"), null);
  assert.equal(paraInputLocal(null), "");
});

test("atalhos de prazo", () => {
  const a = atalhosDePrazo(AGORA);
  assert.deepEqual(a.map((x) => x.valor), ["2026-10-21T18:00", "2026-10-22T18:00", "2026-10-26T18:00"]);
  const segunda = atalhosDePrazo(new Date("2026-10-26T15:00:00Z")); // numa segunda, "próxima segunda" é daqui a 7 dias
  assert.equal(segunda[2].valor, "2026-11-02T18:00");
  const domingo = atalhosDePrazo(new Date("2026-10-25T15:00:00Z"));
  assert.equal(domingo[2].valor, "2026-10-26T18:00");
});

test("iniciais, cor estável e progresso", () => {
  assert.equal(iniciais("ANA CLAUDIA PESSOA"), "AP");
  assert.equal(iniciais("Léo"), "LÉ");
  assert.equal(iniciais(""), "?");
  assert.equal(corDoAvatar("ana"), corDoAvatar("ana"));
  assert.match(corDoAvatar("ruthdias"), /^#[0-9a-f]{6}$/);
  assert.equal(progressoChecklist({ feitos: 1, total: 4 }), 25);
  assert.equal(progressoChecklist({ feitos: 0, total: 0 }), 0);
  assert.equal(progressoChecklist(undefined), 0);
});

test("resumo do topo", () => {
  const r = resumoDasTarefas([
    { status: "nova", prazo: "2026-10-01T12:00:00Z", naoLidas: 1 },
    { status: "nova", prazo: "2026-10-21T21:00:00Z", naoLidas: 0 },
    { status: "concluida", prazo: "2026-10-01T12:00:00Z", naoLidas: 3 },
  ], AGORA);
  assert.deepEqual(r, { atrasadas: 1, hoje: 1, naoLidas: 1 });
});

test("tempo relativo do sino", () => {
  assert.equal(tempoRelativo("2026-10-21T16:59:40Z", AGORA), "agora");
  assert.equal(tempoRelativo("2026-10-21T16:30:00Z", AGORA), "há 30 min");
  assert.equal(tempoRelativo("2026-10-21T10:00:00Z", AGORA), "há 7 h");
  assert.equal(tempoRelativo("2026-10-19T17:00:00Z", AGORA), "há 2 dias");
  assert.equal(tempoRelativo("2026-10-01T17:00:00Z", AGORA), "01/10/2026");
});
