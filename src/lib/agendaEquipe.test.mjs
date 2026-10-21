import test from "node:test";
import assert from "node:assert/strict";
import { conferirForm, expandirEventos, foraNoDia, formVazio, periodoTexto, textoDoEvento } from "./agendaEquipe.js";

const nomes = { ana: "ANA PESSOA", ruth: "RUTH DIAS", caro: "CAROLINE SOUZA" };
const ferias = { id: "f1", tipo: "ferias", titulo: "Férias de RUTH", diaInicio: "2026-11-02", diaFim: "2026-11-04", horaInicio: "", horaFim: "", paraTodos: false, participantes: [], ausentes: ["ruth"], responsaveis: ["caro"] };
const treino = { id: "t1", tipo: "treinamento", titulo: "Biossegurança", diaInicio: "2026-10-28", diaFim: "2026-10-28", horaInicio: "14:00", horaFim: "16:00", paraTodos: true, participantes: [], ausentes: [], responsaveis: [] };

test("texto de linha: ausência mostra quem e o responsável; treinamento mostra o título", () => {
  assert.equal(textoDoEvento(ferias, nomes), "Férias: RUTH (resp.: CAROLINE)");
  assert.equal(textoDoEvento(treino, nomes), "Treinamento: Biossegurança");
});
test("período em texto", () => {
  assert.equal(periodoTexto(treino), "28/10/2026 às 14:00 até 16:00");
  assert.equal(periodoTexto({ ...treino, horaInicio: "", horaFim: "" }), "28/10/2026 · dia inteiro");
  assert.equal(periodoTexto(ferias), "02/11/2026 a 04/11/2026");
});
test("expandir: um item por dia, recortado pela janela, com hora e cor", () => {
  const dias = expandirEventos([ferias, treino], nomes);
  assert.deepEqual(dias.filter((d) => d.agendaId === "f1").map((d) => d.dia), ["2026-11-02", "2026-11-03", "2026-11-04"]);
  assert.equal(dias.find((d) => d.agendaId === "t1").hora, "14:00");
  assert.equal(dias.find((d) => d.agendaId === "f1").cor, "neutral");
  assert.deepEqual(expandirEventos([ferias], nomes, "2026-11-03", "2026-11-03").map((d) => d.dia), ["2026-11-03"]);
  assert.equal(expandirEventos([{ ...ferias, diaFim: "2030-01-01" }], nomes).length, 400); // teto
});
test("quem está fora no dia", () => {
  assert.deepEqual(foraNoDia([ferias, treino], "2026-11-03", nomes).map((f) => [f.nome, f.responsaveis]), [["RUTH DIAS", ["CAROLINE SOUZA"]]]);
  assert.equal(foraNoDia([ferias], "2026-11-05", nomes).length, 0);
});
test("formulário: padrões e conferência", () => {
  assert.equal(formVazio("treinamento", "2026-10-28", "ana").paraTodos, true);
  assert.deepEqual(formVazio("ferias", "2026-11-02", "ana").ausentes, ["ana"]);
  assert.match(conferirForm({ ...formVazio("treinamento", "2026-10-28", "ana"), titulo: " " }), /nome/);
  assert.equal(conferirForm({ ...formVazio("treinamento", "2026-10-28", "ana"), titulo: "X" }), "");
  assert.match(conferirForm(formVazio("ferias", "2026-11-02", "ana")), /responsável/);
  assert.match(conferirForm({ ...formVazio("ferias", "2026-11-02", "ana"), responsaveis: ["ana"] }), /própria pessoa/);
  assert.equal(conferirForm({ ...formVazio("ferias", "2026-11-02", "ana"), responsaveis: ["caro"] }), "");
  assert.match(conferirForm({ ...formVazio("reuniao", "2026-10-28", "ana"), titulo: "X", diaFim: "2026-10-27" }), /data final/);
  assert.match(conferirForm({ ...formVazio("reuniao", "2026-10-28", "ana"), titulo: "X", horaInicio: "15:00", horaFim: "14:00" }), /hora final/);
});
