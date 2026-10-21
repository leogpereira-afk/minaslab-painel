import test from "node:test";
import assert from "node:assert/strict";
import { somarMesesData, situacao, matrizReciclagem, periodosEmVigor, agenda } from "./reciclagem.js";

test("soma meses respeitando o fim do mês", () => {
  assert.equal(somarMesesData("2026-01-31", 1), "2026-02-28");
  assert.equal(somarMesesData("2025-10-16", 12), "2026-10-16");
  assert.equal(somarMesesData("2026-11-10", 6), "2027-05-10");
});

test("situação: reciclagem, feito sem reciclagem, novo colaborador e nunca fez", () => {
  assert.equal(situacao("2026-01-10", 12, "2026-10-16").status, "em-dia");
  assert.equal(situacao("2025-11-01", 12, "2026-10-16").status, "vence");
  assert.equal(situacao("2025-10-01", 12, "2026-10-16").status, "vencido");
  assert.equal(situacao("2020-01-01", 0, "2026-10-16").status, "em-dia");
  assert.equal(situacao(null, 12, "2026-10-16").status, "nunca");
  const novo = situacao(null, 12, "2026-10-16", { entrouEm: "2026-10-13", prazoNovo: 30 });
  assert.deepEqual([novo.status, novo.vence], ["pendente", "2026-11-12"]);
  assert.equal(situacao(null, 12, "2026-12-01", { entrouEm: "2026-10-13", prazoNovo: 30 }).status, "vencido");
});

test("matriz: cargos, período gravado, novos, ordem do que fazer e próxima data agendada", () => {
  const trilhas = [{ id: "a", nome: "A" }, { id: "b", nome: "B" }, { id: "c", nome: "C" }];
  const registros = [
    { id: "periodicidade", periodos: { a: 12, b: 6, c: 0 }, cargos: { b: ["f-com"] }, prazoNovo: { a: 30 } },
    { id: "r1", trilhaId: "a", data: "2025-09-01", participantes: [{ pessoaId: "p1", presente: true }] },
    { id: "r3", trilhaId: "b", data: "2026-05-01", participantes: [{ pessoaId: "p1", presente: true }] },
    { id: "ag1", tipo: "agenda", trilhaId: "a", data: "2026-10-30", hora: "14:00" },
    { id: "ag0", tipo: "agenda", trilhaId: "a", data: "2026-09-01" },
  ];
  const pessoas = [{ id: "p1", nome: "Um", funcaoId: "f-com" }, { id: "p2", nome: "Dois", funcaoId: "f-col", entrouEm: "2026-10-01" }];
  const m = matrizReciclagem({ trilhas, registros, pessoas, hoje: "2026-10-16" });
  assert.deepEqual(m.periodicas.map((t) => t.id), ["a", "b"]);
  assert.equal(m.linhas[0].celulas.a.status, "vencido");
  assert.equal(m.linhas[0].celulas.b.status, "vence");
  assert.equal(m.linhas[1].celulas.a.status, "pendente"); // entrou 01/10, prazo 30 dias
  assert.equal(m.linhas[1].celulas.b.status, "nao-se-aplica"); // cargo diferente
  assert.deepEqual(m.pendencias.map((x) => `${x.pessoa.id}:${x.trilha.id}:${x.status}`), ["p1:a:vencido", "p1:b:vence", "p2:a:pendente"]);
  assert.equal(m.proxima.a.id, "ag1");
  assert.equal(m.pendencias[0].agendada.data, "2026-10-30");
  assert.equal(periodosEmVigor([]).spin, 0);
  assert.deepEqual(agenda(registros, { desde: "2026-10-16" }).map((x) => x.id), ["ag1"]);
});

test("nota abaixo da mínima pede refazer; agenda realizada não conta como próxima", () => {
  const trilhas = [{ id: "a", nome: "A" }];
  const registros = [
    { id: "periodicidade", periodos: { a: 12 } },
    { id: "r1", trilhaId: "a", data: "2026-09-01", participantes: [{ pessoaId: "p1", presente: true, nota: 5 }] },
    { id: "ag1", tipo: "agenda", trilhaId: "a", data: "2026-10-20", status: "realizado" },
    { id: "ag2", tipo: "agenda", trilhaId: "a", data: "2026-11-20" },
  ];
  const m = matrizReciclagem({ trilhas, registros, pessoas: [{ id: "p1", nome: "Um" }], hoje: "2026-10-16" });
  assert.equal(m.linhas[0].celulas.a.status, "refazer");
  assert.equal(m.proxima.a.id, "ag2");
});
