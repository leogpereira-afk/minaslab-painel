import test from "node:test";
import assert from "node:assert/strict";
import { comSeparadores, contadorTexto, filtrarConversas, horaNaLista, mesclarMensagens, quemViu, rotuloDoDia, situacaoDaMensagem } from "./mensagens.js";
import { horaLocal } from "./tarefas.js";

const agora = new Date("2026-10-21T15:00:00Z"); // 12:00 em São Paulo

test("rótulo do dia: hoje, ontem e data", () => {
  assert.equal(rotuloDoDia("2026-10-21T13:00:00Z", agora), "Hoje");
  assert.equal(rotuloDoDia("2026-10-20T20:00:00Z", agora), "Ontem");
  assert.equal(rotuloDoDia("2026-10-10T20:00:00Z", agora), "10/10/2026");
  assert.equal(rotuloDoDia("2026-10-21T02:00:00Z", agora), "Ontem"); // 23h do dia 20 em São Paulo
});

test("separadores só quando o dia muda", () => {
  const l = comSeparadores([{ id: "a", seq: 1, criadoEm: "2026-10-20T13:00:00Z" }, { id: "b", seq: 2, criadoEm: "2026-10-20T14:00:00Z" }, { id: "c", seq: 3, criadoEm: "2026-10-21T13:00:00Z" }], agora);
  assert.deepEqual(l.map((x) => x.tipo), ["dia", "msg", "msg", "dia", "msg"]);
  assert.deepEqual(l.filter((x) => x.tipo === "dia").map((x) => x.rotulo), ["Ontem", "Hoje"]);
});

test("mesclar não duplica por seq e deixa as locais no fim", () => {
  const atuais = [{ seq: 1, id: "a" }, { seq: 2, id: "b" }, { seq: null, id: "tmp", texto: "enviando" }];
  const r = mesclarMensagens(atuais, [{ seq: 2, id: "b" }, { seq: 3, id: "c" }]);
  assert.deepEqual(r.map((m) => m.id), ["a", "b", "c", "tmp"]);
  // a local que já voltou do servidor (mesmo id) some
  assert.deepEqual(mesclarMensagens([{ seq: null, id: "c" }], [{ seq: 3, id: "c" }]).map((m) => m.id), ["c"]);
});

test("tique: enviando, enviada e visualizada (todos os outros viram)", () => {
  const membros = [{ usuario: "ana", lidoAte: 9 }, { usuario: "ruth", lidoAte: 5 }, { usuario: "lid", lidoAte: 2 }];
  assert.equal(situacaoDaMensagem({ seq: null }, membros, "ana"), "enviando");
  assert.equal(situacaoDaMensagem({ seq: 5 }, membros, "ana"), "enviada"); // lid ainda não viu
  assert.equal(situacaoDaMensagem({ seq: 2 }, membros, "ana"), "visualizada");
  assert.deepEqual(quemViu({ seq: 5 }, membros, "ana"), ["ruth"]);
  assert.equal(situacaoDaMensagem({ seq: 1 }, [{ usuario: "ana", lidoAte: 1 }], "ana"), "enviada"); // sozinha no grupo
});

test("filtrar conversas: busca sem acento e só não lidas", () => {
  const cs = [{ titulo: "Mônica", naoLidas: 2, ultima: { texto: "oi" } }, { titulo: "RH", naoLidas: 0, ultima: { texto: "reunião amanhã" } }];
  assert.equal(filtrarConversas(cs, { busca: "monica" }).length, 1);
  assert.equal(filtrarConversas(cs, { busca: "reuniao" })[0].titulo, "RH");
  assert.equal(filtrarConversas(cs, { soNaoLidas: true }).length, 1);
});

test("hora na lista e contador", () => {
  assert.equal(horaNaLista("2026-10-21T13:05:00Z", agora, horaLocal), "10:05");
  assert.equal(horaNaLista("2026-10-20T20:00:00Z", agora, horaLocal), "Ontem");
  assert.equal(horaNaLista("2026-10-10T20:00:00Z", agora, horaLocal), "10/10");
  assert.equal(horaNaLista("", agora, horaLocal), "");
  assert.equal(contadorTexto(120), "99+");
  assert.equal(contadorTexto(3), "3");
});
