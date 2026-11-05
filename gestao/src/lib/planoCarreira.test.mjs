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
  assert.deepEqual(proximosPassos("lab-an3").map((p) => p.para), ["lab-sup", "qual-sup"]);
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
