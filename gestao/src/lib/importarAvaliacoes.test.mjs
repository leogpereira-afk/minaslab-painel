import test from "node:test";
import assert from "node:assert/strict";
import { importarPlanilha, casarPessoa } from "./importarAvaliacoes.js";

const cabL = ["Mês", "Data da Avaliação", "Nome do Colaborador", "Cargo", "Avaliador", "P1 Prazo", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "Média", "Critério Eliminatório", "Motivo", "Apto"];
const cabE = ["Colaborador", "Mês", "Carimbo de data/hora", "Você é o colaborador X?", "Avaliação da Equipe: x", "Comunicação", "Colaboração", "Organização", "Postura", "Deseja deixar algum comentário adicional?", "Média"];
const elenco = [{ id: "rh1", nome: "Maria Souza Lima" }, { id: "rh2", nome: "João Pereira" }];

test("casa nome da planilha com o RH pelo primeiro e último nome", () => {
  assert.equal(casarPessoa("MARIA LIMA", elenco).id, "rh1");
  assert.equal(casarPessoa("Pedro Alves", elenco).id, "plan_pedro-alves");
  assert.equal(casarPessoa("Maria Brandaozino", [...elenco, { id: "rh3", nome: "Maria Teles Brandaozinho" }]).id, "plan_maria-brandaozino");
  assert.equal(casarPessoa("Maria Teles", [...elenco, { id: "rh3", nome: "Maria Teles Brandaozinho" }]).id, "rh3");
});

test("liderança: zerada não entra, eliminatório mapeado, ano pela data", () => {
  const abas = { "Avaliação Liderança": [cabL,
    ["JULHO", 46275, "Maria Souza Lima", "x", "Ana Claudia", 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, null, null, null, "Sim"],
    ["JULHO", 46275, "João Pereira", "x", "Ana Claudia", 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, null, "Não entregou atestado dentro do prazo", null, "Não"],
    ["SETEMBRO", null, "Maria Souza Lima", "x", "Avaliadora", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null],
  ] };
  const r = importarPlanilha(abas, elenco, 2026);
  assert.equal(r.lideranca.length, 2);
  assert.equal(r.lideranca[0].mes, "2026-09".slice(0, 5) + "07");
  assert.equal(r.lideranca[1].eliminatorio, "Não entregou documento no prazo");
  assert.ok(r.avisos.some((a) => a.includes("zerada")));
});

test("equipe: vira soma por mês, sem voto próprio nem voto de quem não conviveu", () => {
  const abas = { "Avaliação Equipe": [cabE,
    ["Maria Souza Lima", "JUNHO", "2026-07-01 15:21:50", "Não", 9, 9, 9, 9, 10, "", null],
    ["MARIA SOUZA LIMA", "JUNHO", "2026-07-01 15:25:27", "Não", 8, 9, 10, 8, 8, "Ótima colega, ajuda todo mundo", null],
    ["Maria Souza Lima", "JUNHO", "2026-07-01 17:57:46", "Sim", null, null, null, null, null, "", null],
    ["Maria Souza Lima", "JUNHO", "2026-07-01 18:00:00", "Não", 1, 1, 1, 1, 1, "Não estava presente no mês", null],
    ["Maria Souza Lima", "JUNHO", "2026-07-01 18:01:00", "Não", 7, 7, 7, 7, 7, "JULHO", null],
  ] };
  const r = importarPlanilha(abas, elenco, 2026);
  const p = r.pesquisas[0];
  assert.equal(p.mes, "2026-06");
  assert.deepEqual(p.somas.equipe.rh1, { n: 3, soma: [24, 25, 26, 24, 25] });
  assert.deepEqual(p.somas.comentarios.rh1, ["Ótima colega, ajuda todo mundo"]);
  assert.equal(p.status, "encerrada");
  assert.ok(r.avisos.some((a) => a.includes("deixado de fora")));
});

test("avaliador com o mesmo primeiro nome de quem importa vira o login dela", () => {
  const abas = { "Avaliação Liderança": [cabL,
    ["JULHO", 46275, "Maria Souza Lima", "x", "Paula Reis", 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, null, null, null, "Sim"],
    ["JULHO", 46275, "Maria Souza Lima", "x", "Outra Pessoa", 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, null, null, null, "Sim"]] };
  const r = importarPlanilha(abas, elenco, 2026, { usuario: "paula", nome: "Paula Teixeira" });
  assert.deepEqual(r.lideranca.map((x) => x.avaliador), ["paula", "plan:outra-pessoa"]);
  assert.equal(r.lideranca[0].id, "2026-07_rh1_paula");
});
