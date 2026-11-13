import test from "node:test";
import assert from "node:assert/strict";
import { proximoCodigoAno, pendenciasEficacia, emSupervisao, cumprimentoPat, faltaNaEficacia } from "../../supabase/functions/_shared/pessoal-regras.mjs";

test("códigos por ano", () => {
  assert.equal(proximoCodigoAno("TRE", [], 2026), "TRE 001/2026");
  assert.equal(proximoCodigoAno("AUTZ", ["AUTZ 004/2026", "AUTZ 009/2025"], 2026), "AUTZ 005/2026");
});

test("eficácia pendente e atrasada um mês depois", () => {
  const t = { id: "t1", status: "REALIZADO", data: "2026-10-01", participantes: [{ id: "a" }, { id: "b" }] };
  const r = pendenciasEficacia(t, [{ treinamento_id: "t1", pessoa_id: "a" }], "2026-11-05");
  assert.deepEqual(r.pendentes.map((p) => p.id), ["b"]);
  assert.equal(r.prazo, "2026-10-31");
  assert.equal(r.atrasada, true);
  assert.equal(pendenciasEficacia({ ...t, status: "PLANEJADO" }, [], "2026-12-01").atrasada, false);
});

test("supervisão de 90 dias", () => {
  assert.equal(emSupervisao({ admissao: "2026-10-01" }, "2026-11-13"), "2026-12-30");
  assert.equal(emSupervisao({ admissao: "2026-01-01" }, "2026-11-13"), null);
  assert.equal(emSupervisao({ admissao: "2026-10-01", ativo: false }, "2026-11-13"), null);
});

test("cumprimento do PAT", () => {
  const ts = [{ origem: "PAT", data: "2026-03-01", status: "REALIZADO" }, { origem: "PAT", data: "2026-06-01", status: "PLANEJADO" }, { origem: "PAT", data: "2026-07-01", status: "CANCELADO" }, { origem: "EVENTUAL", data: "2026-05-01", status: "REALIZADO" }];
  assert.deepEqual(cumprimentoPat(ts, 2026), { previstos: 2, realizados: 1, pct: 50 });
});

test("AVET completa; não eficaz exige plano", () => {
  const ok = { nota_conhecimento: 4, nota_aplicacao: 4, nota_resultados: 4, nota_geral: 4, eficaz: true };
  assert.equal(faltaNaEficacia(ok), null);
  assert.match(faltaNaEficacia({ ...ok, nota_geral: 0 }), /eficácia/);
  assert.match(faltaNaEficacia({ ...ok, eficaz: false }), /plano de ação/);
});
