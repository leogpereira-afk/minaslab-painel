import test from "node:test";
import assert from "node:assert/strict";
import { tarefaEficacia, todosAvaliados, resultadoEficacia, avaliacoesEficacia, ehAplicacao, folhasRT, textoCarga, somarDias, requisicoes } from "./formulariosTreinamento.js";

test("critério de eficácia: IV 4 ou 5 e nenhuma nota I a III abaixo de 3", () => {
  assert.equal(resultadoEficacia({ i: 4, ii: 4, iii: 3, iv: 4 }), "eficaz");
  assert.equal(resultadoEficacia({ i: 5, ii: 2, iii: 5, iv: 5 }), "nao-eficaz");
  assert.equal(resultadoEficacia({ i: 4, ii: 4, iii: 4, iv: 3 }), "nao-eficaz");
  assert.equal(resultadoEficacia({ i: 4, ii: 4, iv: 4 }), "");
});

test("aplicação é só o registro sem tipo e com participantes", () => {
  assert.equal(ehAplicacao({ participantes: [] }), true);
  assert.equal(ehAplicacao({ tipo: "agenda", participantes: [] }), false);
  assert.equal(ehAplicacao({ tipo: "requisicao", pessoas: [] }), false);
});

test("avaliações pendentes por participante, 30 dias depois", () => {
  const regs = [
    { id: "a", data: "2026-09-01", participantes: [{ pessoaId: "p1", nome: "Pessoa Um" }, { pessoaId: "p2", nome: "Pessoa Dois" }, { pessoaId: "p3", presente: false }],
      eficacia: { p2: { i: 4, ii: 4, iii: 4, iv: 5 } } },
    { id: "b", data: "2026-10-30", dataFim: "2026-10-31", participantes: [{ pessoaId: "p1", nome: "Pessoa Um" }] },
    { id: "r", tipo: "requisicao", pessoas: [{ pessoaId: "p1" }] },
  ];
  const l = avaliacoesEficacia(regs, "2026-11-03");
  assert.deepEqual(l.map((x) => [x.aplicacao.id, x.participante.pessoaId, x.situacao, x.prevista]), [
    ["a", "p1", "atrasada", "2026-10-01"],
    ["b", "p1", "agendada", "2026-11-30"],
    ["a", "p2", "eficaz", "2026-10-01"],
  ]);
  assert.equal(requisicoes(regs).length, 1);
});

test("não eficaz abre plano e usa a nova data", () => {
  const regs = [{ id: "a", data: "2026-09-01", participantes: [{ pessoaId: "p1" }], eficacia: { p1: { i: 2, ii: 2, iii: 2, iv: 2, plano: { novaAvaliacaoEm: "2026-12-01" } } } }];
  const [x] = avaliacoesEficacia(regs, "2026-11-03");
  assert.equal(x.situacao, "plano");
  assert.equal(x.prevista, "2026-12-01");
});

test("folhas do RT e carga horária", () => {
  assert.equal(folhasRT(Array.from({ length: 15 }, (_, i) => i)).length, 2);
  assert.equal(folhasRT([]).length, 1);
  assert.equal(textoCarga("35"), "35 horas");
  assert.equal(textoCarga("1,5"), "1h30");
  assert.equal(textoCarga("0.5"), "30 minutos");
  assert.equal(somarDias("2026-09-04", 30), "2026-10-04");
});

test("tarefa da eficácia no painel", () => {
  const reg = { titulo: "5S", data: "2026-09-01", dataFim: "2026-09-04", participantes: [{ pessoaId: "a", nome: "Pessoa A" }, { pessoaId: "b", nome: "Pessoa B", presente: false }] };
  const t = tarefaEficacia(reg, { responsavel: "ana" });
  assert.equal(t.prazo, "2026-10-04T09:00:00-03:00");
  assert.equal(t.lembrete, 1440);
  assert.equal(t.checklist.length, 1);
  assert.match(t.titulo, /5S \(01\/09\/2026\)/);
  assert.equal(todosAvaliados(reg), false);
  assert.equal(todosAvaliados({ ...reg, eficacia: { a: { i: 4, ii: 4, iii: 4, iv: 4 } } }), true);
});
