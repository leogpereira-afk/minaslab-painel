import test from "node:test";
import assert from "node:assert/strict";
import { NIVEIS, TRILHAS_CARREIRA, LATERAIS, nivelDaFuncao, proximosPassos, exigenciaPCMSO, mesesEntre, proximoCiclo, prontidao, GRUPOS_RISCO } from "./planoCarreira.js";
import { TRILHAS } from "./trilhas.js";
import { TRILHAS_QUALIDADE } from "./treinamentosQualidade.js";

test("todo nível das trilhas existe e tem grupo de risco do PCMSO", () => {
  const ids = new Set(NIVEIS.map((n) => n.id));
  for (const t of TRILHAS_CARREIRA) for (const n of t.niveis) assert.ok(ids.has(n), n);
  for (const l of LATERAIS) assert.ok(ids.has(l.de) && ids.has(l.para));
  for (const n of NIVEIS) assert.ok(GRUPOS_RISCO[n.grupo], n.id);
});

test("treinamentos dos níveis existem no catálogo", () => {
  const conhecidas = new Set([...TRILHAS.map((t) => t.id), ...TRILHAS_QUALIDADE.map((t) => t.id)]);
  for (const n of NIVEIS) for (const t of n.treinamentos) assert.ok(conhecidas.has(t), `${n.id}: ${t}`);
});

test("liga a função do sistema ao nível e aponta os próximos passos", () => {
  assert.equal(nivelDaFuncao("analista de laboratório i")?.id, "lab-an1");
  assert.equal(nivelDaFuncao("Gerente"), null);
  assert.equal(nivelDaFuncao("Auxiliar Administrativo Comercial II")?.id, "com-an1");
  assert.equal(nivelDaFuncao("Analista Comercial")?.id, "com-an1");
  assert.equal(nivelDaFuncao("Auxiliar Administrativo Comercial I")?.id, "com-ass");
  assert.equal(nivelDaFuncao("Analista Administrativo Comercial")?.id, "com-an2");
  assert.deepEqual(proximosPassos("lab-an1").map((p) => p.para), ["lab-an2"]);
  assert.deepEqual(proximosPassos("col-tec").map((p) => [p.para, p.tipo]), [["lab-an1", "lateral"]]);
  assert.deepEqual(proximosPassos("lab-an3").map((p) => p.para), ["lab-sup", "qual-an", "qual-sup"]);
});

test("PCMSO: ASO só quando muda o grupo de risco", () => {
  assert.equal(exigenciaPCMSO("lab-an1", "lab-an2").aso, false);
  assert.equal(exigenciaPCMSO("col-tec", "lab-an1").aso, true);
  assert.equal(exigenciaPCMSO("col-op", "com-ass").aso, false);
  assert.equal(exigenciaPCMSO("", "lab-an1").aso, true);
});

test("tempo e ciclo", () => {
  assert.equal(mesesEntre("2025-11-10", "2026-11-04"), 11);
  assert.equal(mesesEntre("2025-11-04", "2026-11-04"), 12);
  assert.equal(proximoCiclo("2026-11-04"), "2027-01-01");
  assert.equal(proximoCiclo("2026-03-10"), "2026-07-01");
});

test("prontidão a partir dos registros", () => {
  const base = { nivel: NIVEIS[1], hoje: "2026-11-04", desde: "2025-09-01", estagio: "autonomo" };
  const ok = prontidao({
    ...base,
    notas: [{ mes: "2026-08", final: 8.5 }, { mes: "2026-09", final: 9 }, { mes: "2026-10", final: 8 }, { mes: "2025-01", final: 2 }],
    pdi: [{ trimestre: "2026-T3", status: "concluido" }],
    obrigatorios: [{ id: "a", nome: "A", feito: true }],
  });
  assert.equal(ok.situacao, "pronta", JSON.stringify(ok.criterios));
  const falta = prontidao({ ...base, desde: "2026-06-01", notas: [{ mes: "2026-10", final: 9 }], ocorrencias: [{ mes: "2026-10" }, { mes: "2026-09" }, { mes: "2026-08" }], obrigatorios: [{ id: "a", nome: "SPIN", feito: false }], naoEficazes: 1 });
  const por = Object.fromEntries(falta.criterios.map((c) => [c.id, c.ok]));
  assert.deepEqual(por, { tempo: false, desempenho: false, treinamentos: false, eficacia: false, pdi: null, ocorrencias: false, estagio: true });
  assert.equal(falta.situacao, "desenvolvimento");
  assert.match(falta.criterios[2].detalhe, /SPIN/);
});

import { faixaSalarial, lerReais, formatarFaixa, avisosFaixas } from "./planoCarreira.js";

test("todo cargo tem faixa salarial padrão coerente", () => {
  for (const n of NIVEIS) {
    assert.ok(n.salario && n.salario.min > 0 && n.salario.min <= n.salario.max, n.id);
  }
  assert.deepEqual(avisosFaixas({}), []);
});

test("faixa salarial: padrão aprovado e ajuste da direção", () => {
  const p = faixaSalarial("lab-an3", {});
  assert.equal(p.min, 2250); assert.equal(p.max, 2550); assert.equal(p.ajustada, false);
  const a = faixaSalarial("lab-an3", { "lab-an3": { salarioMin: 2300 } });
  assert.equal(a.min, 2300); assert.equal(a.max, 2550); assert.equal(a.ajustada, true);
  // ajuste vazio volta ao padrão
  const v = faixaSalarial("lab-an3", { "lab-an3": { salarioMin: null, salarioMax: "" } });
  assert.equal(v.min, 2250); assert.equal(v.ajustada, false);
  // ajuste antigo em texto vira observação
  assert.equal(faixaSalarial("lab-an1", { "lab-an1": { faixa: "R$ 2.400 a R$ 2.800" } }).obs, "R$ 2.400 a R$ 2.800");
  assert.equal(faixaSalarial("lab-an1", {}).min, 1800);
  assert.equal(faixaSalarial("qual-ger", {}).max, 4000);
  assert.equal(faixaSalarial("fin-ger", {}).min, 3600);
  assert.equal(faixaSalarial("lab-est", {}).min, 800);
  assert.equal(faixaSalarial("nao-existe", {}), null);
});

test("lê reais e formata faixa", () => {
  assert.equal(lerReais("2.400,50"), 2400.5);
  assert.equal(lerReais("R$ 2400"), 2400);
  assert.equal(lerReais("1621"), 1621);
  assert.equal(lerReais(""), null);
  assert.equal(lerReais("abc"), null);
  assert.equal(formatarFaixa({ min: 2250, max: 2550 }), "R$ 2.250 a R$ 2.550");
});

test("avisos: degrau abaixo do anterior e mínimo maior que máximo", () => {
  const av = avisosFaixas({ "lab-an2": { salarioMin: 1500 } });
  assert.equal(av.length, 1); assert.equal(av[0].trilha, "laboratorio");
  assert.equal(avisosFaixas({ "lab-an1": { salarioMin: 1900, salarioMax: 1850 } }).some((a) => a.para === "lab-an1"), true);
  // cargo em duas trilhas (Supervisor Administrativo) conferido nas duas
  assert.ok(avisosFaixas({ "adm-sup": { salarioMin: 1000 } }).length >= 1);
});

test("novos cargos e trilhas", () => {
  assert.deepEqual(TRILHAS_CARREIRA.find((t) => t.id === "laboratorio").niveis, ["lab-est", "lab-aux", "lab-an1", "lab-an2", "lab-an3", "lab-sup"]);
  assert.deepEqual(TRILHAS_CARREIRA.find((t) => t.id === "qualidade").niveis, ["qual-est", "qual-an", "qual-sup", "qual-ger"]);
  assert.deepEqual(TRILHAS_CARREIRA.find((t) => t.id === "financeiro").niveis, ["adm-fin", "fin-an", "fin-ger"]);
  assert.ok(proximosPassos("adm-sup").some((p) => p.para === "adm-ger"));
  assert.deepEqual(proximosPassos("lab-an2").map((p) => p.para), ["lab-an3", "qual-an"]);
  assert.equal(nivelDaFuncao("Gerente"), null);
  assert.equal(nivelDaFuncao("Gerente Financeiro")?.id, "fin-ger");
});
