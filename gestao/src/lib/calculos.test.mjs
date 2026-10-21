import test from "node:test";
import assert from "node:assert/strict";
import { realizado, totaisMes, mediaAnterior, pontos, roteiroFeedback, avaliar, situacao, metasDe, serie, criteriosDaFuncao, previsaoMes } from "./calculos.js";
import { somarMeses, mesesAte, mesLongo, mesDeData } from "./format.js";

// Números fictícios, no formato que a função ml-comercial devolve.
const historico = { "2026-03": 62, "2026-04": 44, "2026-05": 64, "2026-06": 48, "2026-07": 54, "2026-08": 56 };
const resumo = { porMes: {} };
for (const [mes, n] of Object.entries(historico)) {
  resumo.porMes[mes] = { total: { enviadas: n, aprovadas: 0 }, porPessoa: { pessoaA: { enviadas: n, aprovadas: Math.round(n * 0.6), recusadas: 0, abertas: 0, valorAprovado: 0 } } };
}
resumo.porMes["2026-09"] = {
  total: { enviadas: 87, aprovadas: 38, recusadas: 2, abertas: 40, valorAprovado: 30801 },
  porPessoa: {
    pessoaA: { enviadas: 20, aprovadas: 5, recusadas: 1, abertas: 14, valorAprovado: 0 },
    _sem: { enviadas: 47, aprovadas: 21, recusadas: 1, abertas: 25, valorAprovado: 0 },
  },
};
const pessoa = { id: "m1", nome: "Pessoa A", crmProfileId: "pessoaA", metas: { propostas: 70, aprovacao: 80, ligacoes: 3 } };

test("datas: soma de meses atravessa o ano", () => {
  assert.equal(somarMeses("2026-01", -1), "2025-12");
  assert.equal(somarMeses("2026-11", 3), "2027-02");
  assert.deepEqual(mesesAte("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
  assert.equal(mesLongo("2026-09"), "Setembro 2026");
});

test("mês em Brasília: 01/10 00:30 UTC ainda é setembro", () => {
  assert.equal(mesDeData(new Date("2026-10-01T00:30:00Z")), "2026-09");
  assert.equal(mesDeData(new Date("2026-10-01T03:30:00Z")), "2026-10");
});

test("realizado e totais do mês", () => {
  const r = realizado(resumo, pessoa, "2026-09");
  assert.equal(r.enviadas, 20);
  assert.equal(r.taxa, 25);
  const t = totaisMes(resumo, "2026-09");
  assert.equal(t.semResponsavel, 47);
  assert.equal(Math.round(t.pctSemResponsavel), 54);
  assert.equal(realizado(resumo, { crmProfileId: null }, "2026-09").enviadas, 0);
});

test("média anterior ignora meses sem movimento", () => {
  const m = mediaAnterior(resumo, pessoa, "2026-09");
  assert.equal(Math.round(m), 55); // (62+44+64+48+54+56)/6 = 54,7
});

test("situação frente à meta", () => {
  assert.equal(situacao({ enviadas: 70, taxa: 85 }, metasDe(pessoa)).rotulo, "Na meta");
  assert.equal(situacao({ enviadas: 60, taxa: 85 }, metasDe(pessoa)).rotulo, "Atenção");
  assert.equal(situacao({ enviadas: 20, taxa: 25 }, metasDe(pessoa)).rotulo, "Abaixo");
  assert.equal(situacao({ enviadas: 20, taxa: 25 }, metasDe({})).rotulo, "Sem meta");
});

test("pontos do mês: meta, aprovação, queda e ligações", () => {
  const p = pontos(resumo, pessoa, "2026-09", 1);
  const tipos = p.map((x) => x.tipo);
  assert.deepEqual(tipos, ["propostas", "aprovacao", "queda", "ligacoes", "ocorrencias"]);
  assert.match(p[0].titulo, /20 de 70/);
  assert.match(p[2].titulo, /Queda de 63%/);
  const rot = roteiroFeedback(p, pessoa);
  assert.equal(rot.combinar.length, 5);
  assert.match(rot.combinar[0], /18 propostas/);
});

test("pessoa sem vínculo com o CRM recebe um aviso só", () => {
  const p = pontos(resumo, { nome: "X" }, "2026-09");
  assert.equal(p.length, 1);
  assert.equal(p[0].tipo, "vinculo");
});

test("avaliação: bônus sai da nota FINAL, não da média antes das ocorrências", () => {
  // Metas batidas (10), técnicos e comportamentais 9 → base 9,5; 2 ocorrências → 8,5 → faixa 2.
  const res = { porMes: { "2026-09": { porPessoa: { pessoaA: { enviadas: 70, aprovadas: 63 } } } } };
  const notas = { org: 9, com: 9, atd: 9, iso: 9, pro: 9, eq: 9, resp: 9, qual: 9 };
  const a = avaliar({ resumo: res, membro: pessoa, mes: "2026-09", notas, nOcorrencias: 2 });
  assert.equal(a.base.toFixed(2), "9.50");
  assert.equal(a.final.toFixed(2), "8.50");
  assert.equal(a.bonus, 50);
  assert.equal(a.completa, true);
});

test("avaliação: desconto tem teto de 2,0 e nota incompleta não paga bônus", () => {
  const res = { porMes: { "2026-09": { porPessoa: { pessoaA: { enviadas: 70, aprovadas: 63 } } } } };
  const a = avaliar({ resumo: res, membro: pessoa, mes: "2026-09", notas: { org: 10 }, nOcorrencias: 9 });
  assert.equal(a.desconto, 2);
  assert.equal(a.completa, false);
  assert.equal(a.bonus, null);
  assert.ok(a.pendencias.some((p) => /7 critérios sem nota/.test(p)));
});

test("avaliação: sem meta definida, metas não se aplicam e o peso vai para os outros grupos", () => {
  const a = avaliar({ resumo, membro: { crmProfileId: "pessoaA", metas: {} }, mes: "2026-09", notas: { org: 8, com: 8, atd: 8, iso: 8, pro: 6, eq: 6, resp: 6, qual: 6 } });
  // (8×30 + 6×20) / 50 = 7,2
  assert.equal(a.base.toFixed(1), "7.2");
  assert.equal(a.completa, true);
});

test("série da equipe soma o total do mês", () => {
  const s = serie(resumo, "equipe", "2026-09", 2);
  assert.deepEqual(s.map((x) => x.enviadas), [56, 87]);
});

test("critérios técnicos da função substituem os padrão", () => {
  const f = { criterios: [{ id: "edital", nome: "Análise de edital" }, { nome: "" }] };
  const c = criteriosDaFuncao(f);
  assert.deepEqual(c.map((x) => x.id), ["edital"]);
  assert.equal(criteriosDaFuncao(null).length, 4);
  const res = { porMes: { "2026-09": { porPessoa: { pessoaA: { enviadas: 70, aprovadas: 63 } } } } };
  const a = avaliar({ resumo: res, membro: pessoa, mes: "2026-09", notas: { edital: 9, pro: 9, eq: 9, resp: 9, qual: 9 }, criteriosTecnicos: c });
  assert.equal(a.completa, true);
});

test("previsão do mês: base, pessimista e otimista", () => {
  const p = previsaoMes({ aprovado: 10000, abertas: [{ valor: 4000, chance: 0.6 }, { valor: 2000, chance: 0.1 }] });
  assert.equal(p.base, 10000 + 2400 + 200);
  assert.equal(p.pessimista, 12400);
  assert.equal(p.otimista, 12600 + (16000 - 12600) / 2);
});

test("metas da função saem dos indicadores da descrição de cargo", async () => {
  const { metasDaFuncao } = await import("./calculos.js");
  const m = metasDaFuncao({ kpis: "Coletas no prazo — coletas na data agendada — 95% ou mais\nAmostras perdidas — ocorrências no mês — zero" });
  assert.deepEqual(m.map((x) => [x.indicador, x.meta]), [["Coletas no prazo", "95% ou mais"], ["Amostras perdidas", "zero"]]);
});

test("avaliação: função sem propostas (metas zeradas) fecha só com técnicos e comportamentais", () => {
  const notas = { org: 9, com: 9, atd: 9, iso: 9, pro: 10, eq: 10, resp: 10, qual: 8 };
  const a = avaliar({ resumo, membro: { crmProfileId: "pessoaA", metas: { propostas: 0, aprovacao: 0, ligacoes: 0 } }, mes: "2026-09", notas });
  assert.equal(a.completa, true);
  assert.equal(a.pendencias.length, 0);
  assert.ok(a.auto.every((c) => c.naoAplica));
  assert.notEqual(a.bonus, null);
});

test("equipe do mês segue entrada e saída", async () => {
  const { naEquipeNoMes } = await import("./calculos.js");
  const saiu = { ativo: false, desligadoEm: "2026-10-13" };
  assert.equal(naEquipeNoMes(saiu, "2026-09"), true);
  assert.equal(naEquipeNoMes(saiu, "2026-10"), false);
  assert.equal(naEquipeNoMes(saiu, "2026-11"), false);
  assert.equal(naEquipeNoMes({ ativo: false }, "2026-09"), false);
  const novo = { ativo: true, entrouEm: "2026-08-04" };
  assert.equal(naEquipeNoMes(novo, "2026-07"), false);
  assert.equal(naEquipeNoMes(novo, "2026-08"), true);
  assert.equal(naEquipeNoMes({ ativo: true }, "2025-01"), true);
});

import { nomeProprio } from "./format.js";
test("nome próprio para documentos", () => {
  assert.equal(nomeProprio("MARIA DA SILVA SOUZA"), "Maria da Silva Souza");
  assert.equal(nomeProprio("  joão  dos santos e souza "), "João dos Santos e Souza");
  assert.equal(nomeProprio("ÉRICA D'ÁVILA"), "Érica D'Ávila");
});
