import test from "node:test";
import assert from "node:assert/strict";
import { eventoParaPainel, acaoNoPainel, temConvidados, nomeCurto } from "./agendaPainel.js";

test("monta o evento do painel a partir do agendamento", () => {
  const e = eventoParaPainel({ data: "2026-10-30", hora: "09:00", horaFim: "08:00", local: "Sala", responsavel: "Pessoa X", obs: "Trazer caderno" }, { tipo: "treinamento", titulo: "Gestão do tempo", participantes: ["a", "b", "a"] });
  assert.equal(e.tipo, "treinamento");
  assert.equal(e.diaInicio, "2026-10-30");
  assert.equal(e.horaInicio, "09:00");
  assert.equal(e.horaFim, "");
  assert.deepEqual(e.participantes, ["a", "b"]);
  assert.match(e.descricao, /Quem aplica: Pessoa X/);
  assert.equal(eventoParaPainel({ data: "2026-10-30" }, { tipo: "outro", titulo: "x", paraTodos: true, participantes: ["a"] }).participantes.length, 0);
  assert.equal(eventoParaPainel({ data: "2026-10-30" }, { tipo: "outro", titulo: "x" }).tipo, "evento");
});

test("decide criar, atualizar, cancelar ou nada", () => {
  assert.equal(acaoNoPainel(null, { participantes: ["a"] }), "criar");
  assert.equal(acaoNoPainel(null, { participantes: [] }), "nada");
  assert.equal(acaoNoPainel({ id: "x" }, { paraTodos: true }), "atualizar");
  assert.equal(acaoNoPainel({ id: "x" }, { participantes: [] }), "cancelar");
  assert.equal(temConvidados(undefined), false);
});

test("nome curto", () => {
  assert.equal(nomeCurto("GIOVANNA FROES DA SILVA CAPUCHINHO"), "Giovanna Capuchinho");
});
