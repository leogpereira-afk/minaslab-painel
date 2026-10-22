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

import { alternarReacaoLocal, conversasNovas, fotografiaDasNovas, tituloComContagem } from "./mensagens.js";

test("avisos: primeira consulta não avisa; depois só o que chegou e subiu", () => {
  const c1 = [{ id: "a", naoLidas: 2, em: "t1" }, { id: "b", naoLidas: 1, em: "t1" }];
  assert.deepEqual(conversasNovas(null, c1), []);
  const antes = fotografiaDasNovas(c1);
  const c2 = [{ id: "a", naoLidas: 3, em: "t2" }, { id: "b", naoLidas: 1, em: "t1" }, { id: "c", naoLidas: 1, em: "t2" }];
  assert.deepEqual(conversasNovas(antes, c2).map((c) => c.id), ["a", "c"]);
  assert.deepEqual(conversasNovas(antes, c1), []); // nada mudou
  assert.deepEqual(conversasNovas(antes, [{ id: "a", naoLidas: 1, em: "t3" }]), []); // leu parte: contagem desceu, não é mensagem nova
});
test("avisos: não avisa a conversa aberta com a aba visível", () => {
  const antes = fotografiaDasNovas([{ id: "a", naoLidas: 0, em: "t1" }]);
  const atuais = [{ id: "a", naoLidas: 1, em: "t2" }];
  assert.equal(conversasNovas(antes, atuais, { abertaId: "a", abaVisivel: true }).length, 0);
  assert.equal(conversasNovas(antes, atuais, { abertaId: "a", abaVisivel: false }).length, 1); // aba em segundo plano avisa
});
test("título da aba com contagem", () => {
  assert.equal(tituloComContagem("Mensagens · MinasLab", 3), "(3) Mensagens · MinasLab");
  assert.equal(tituloComContagem("(3) Mensagens · MinasLab", 5), "(5) Mensagens · MinasLab");
  assert.equal(tituloComContagem("(5) Mensagens · MinasLab", 0), "Mensagens · MinasLab");
  assert.equal(tituloComContagem("X", 120), "(99+) X");
});

test("reação local: põe, soma, tira e limpa", () => {
  let r = alternarReacaoLocal({}, "m1", "👍", "ana");
  assert.deepEqual(r, { m1: [{ emoji: "👍", usuarios: ["ana"] }] });
  r = alternarReacaoLocal(r, "m1", "👍", "ruth"); assert.deepEqual(r.m1[0].usuarios, ["ana", "ruth"]);
  r = alternarReacaoLocal(r, "m1", "❤️", "ana"); assert.equal(r.m1.length, 2);
  r = alternarReacaoLocal(r, "m1", "👍", "ana"); assert.deepEqual(r.m1.find((g) => g.emoji === "👍").usuarios, ["ruth"]);
  r = alternarReacaoLocal(r, "m1", "👍", "ruth"); r = alternarReacaoLocal(r, "m1", "❤️", "ana"); assert.deepEqual(r, {}); // sem reação: some a mensagem do mapa
  const antes = { m1: [{ emoji: "👍", usuarios: ["ana"] }] }; alternarReacaoLocal(antes, "m1", "👍", "ana"); assert.deepEqual(antes.m1[0].usuarios, ["ana"]); // não mexe no original
});

test("editadas/apagadas chegam pelo id; última editável é a minha mais recente de texto", async () => {
  const { aplicarAlteradas, ultimaEditavel } = await import("./mensagens.js");
  const lista = [
    { id: "a", seq: 1, autor: "eu", tipo: "mensagem", texto: "oi", apagada: false },
    { id: "b", seq: 2, autor: "eu", tipo: "mensagem", texto: "", anexo: { nome: "x.webm", tipo: "audio/webm", duracao: 3 }, apagada: false },
    { id: "c", seq: 3, autor: "ana", tipo: "mensagem", texto: "tudo bem?", apagada: false },
  ];
  const nova = aplicarAlteradas(lista, [{ id: "a", seq: 1, texto: "oi, pessoal", apagada: false, editadaEm: "2026-10-22T20:00:00Z" }, { id: "c", seq: 3, texto: "", apagada: true, editadaEm: null }, { id: "zz", texto: "fora" }]);
  assert.equal(nova[0].texto, "oi, pessoal");
  assert.equal(nova[0].editadaEm, "2026-10-22T20:00:00Z");
  assert.equal(nova[2].apagada, true);
  assert.equal(nova.length, 3);
  assert.equal(aplicarAlteradas(lista, []), lista);
  assert.equal(ultimaEditavel(lista, "eu").id, "a"); // pula o áudio
  assert.equal(ultimaEditavel(lista, "ninguem"), null);
});
