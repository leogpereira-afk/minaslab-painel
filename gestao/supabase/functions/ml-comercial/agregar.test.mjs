import test from "node:test";
import assert from "node:assert/strict";
import { agregarPropostas, mesBR } from "./agregar.mjs";

test("mês em Brasília", () => {
  assert.equal(mesBR("2026-10-01T02:59:00Z"), "2026-09");
  assert.equal(mesBR("2026-10-01T03:00:00Z"), "2026-10");
  assert.equal(mesBR(null), null);
});

test("agrega por mês de envio, separa sem responsável e ignora rascunho/cancelada/excluída", () => {
  const props = [
    { responsavel_comercial_id: "a", status: "APROVADA", valor: 1000, data_envio: "2026-09-10T12:00:00Z", data_aceite: "2026-10-02T12:00:00Z" },
    { responsavel_comercial_id: "a", status: "ENVIADA", valor: 500, data_envio: "2026-09-11T12:00:00Z" },
    { responsavel_comercial_id: null, status: "RECUSADA", valor: 300, data_envio: "2026-09-12T12:00:00Z" },
    { responsavel_comercial_id: "a", status: "RASCUNHO", data_envio: "2026-09-12T12:00:00Z" },
    { responsavel_comercial_id: "a", status: "CANCELADA", data_envio: "2026-09-12T12:00:00Z" },
    { responsavel_comercial_id: "a", status: "ENVIADA", deleted_at: "2026-09-20T00:00:00Z", data_envio: "2026-09-12T12:00:00Z" },
    { responsavel_comercial_id: "b", status: "APROVADA", valor: 200, created_at: "2026-08-31T23:00:00Z" },
  ];
  const r = agregarPropostas(props);
  assert.deepEqual(r["2026-09"].total, { enviadas: 3, aprovadas: 1, recusadas: 1, abertas: 1, valorAprovado: 0 });
  assert.equal(r["2026-09"].porPessoa._sem.recusadas, 1);
  // valor aprovado entra no mês do aceite (outubro), não no do envio
  assert.equal(r["2026-10"].porPessoa.a.valorAprovado, 1000);
  assert.equal(r["2026-10"].porPessoa.a.enviadas, 0);
  // 31/08 23:00 UTC = 31/08 20:00 em Brasília → agosto
  assert.equal(r["2026-08"].porPessoa.b.aprovadas, 1);
  assert.equal(r["2026-08"].total.valorAprovado, 200);
});

test("filtro desde corta meses antigos", () => {
  const r = agregarPropostas([{ responsavel_comercial_id: "a", status: "ENVIADA", data_envio: "2025-01-10T12:00:00Z" }], { desde: "2026-01" });
  assert.deepEqual(r, {});
});

import { probabilidadesPorIdade, chanceDaIdade, carteiraClientes } from "./agregar.mjs";

test("chance por idade: quem passou de 30 dias sem resposta aprova menos", () => {
  const hoje = "2026-10-01T12:00:00Z";
  const props = [];
  // 20 aprovadas rápido (5 dias), 10 recusadas aos 40 dias, 10 abertas há 90 dias
  for (let i = 0; i < 20; i++) props.push({ status: "APROVADA", data_envio: "2026-05-01T12:00:00Z", data_aceite: "2026-05-06T12:00:00Z" });
  for (let i = 0; i < 10; i++) props.push({ status: "RECUSADA", data_envio: "2026-05-01T12:00:00Z", data_recusa: "2026-06-10T12:00:00Z" });
  for (let i = 0; i < 10; i++) props.push({ status: "ENVIADA", data_envio: "2026-07-01T12:00:00Z" });
  const f = probabilidadesPorIdade(props, hoje);
  assert.equal(f[0].casos, 40);
  assert.equal(f[0].chance, 0.5); // 20 de 40
  assert.equal(f[1].casos, 20);   // as 20 aprovadas decidiram antes dos 7 dias
  assert.equal(f[1].chance, 0);
  assert.equal(chanceDaIdade(f, 3), 0.5);
  assert.equal(chanceDaIdade(f, 200), f.at(-1).chance);
});

test("carteira: curva ABC e cliente em risco", () => {
  const hoje = "2026-10-01T12:00:00Z";
  const props = [
    { cliente_id: "a", status: "APROVADA", valor: 7000, data_aceite: "2026-09-01T12:00:00Z" },
    { cliente_id: "b", status: "APROVADA", valor: 1000, data_aceite: "2026-01-01T12:00:00Z" },
    { cliente_id: "b", status: "APROVADA", valor: 1000, data_aceite: "2026-02-01T12:00:00Z" },
    { cliente_id: "c", status: "APROVADA", valor: 500, data_aceite: "2026-08-01T12:00:00Z" },
    { cliente_id: "c", status: "RECUSADA", valor: 900, data_envio: "2026-08-01T12:00:00Z" },
  ];
  const l = carteiraClientes(props, hoje);
  assert.deepEqual(l.map((c) => [c.clienteId, c.curva]), [["a", "A"], ["b", "B"], ["c", "C"]]);
  const b = l.find((c) => c.clienteId === "b");
  assert.equal(b.intervaloMedio, 31);
  assert.equal(b.emRisco, true);
  assert.equal(l.find((c) => c.clienteId === "a").emRisco, false);
});

test("data sem hora ou meia-noite UTC fica no próprio mês", async () => {
  const { mesBR } = await import("./agregar.mjs");
  assert.equal(mesBR("2026-10-01"), "2026-10");
  assert.equal(mesBR("2026-10-01T00:00:00+00:00"), "2026-10");
  assert.equal(mesBR("2026-10-01 00:00:00+00"), "2026-10");
  assert.equal(mesBR("2026-10-01T02:00:00Z"), "2026-09"); // 23h de 30/09 em Brasília
  assert.equal(mesBR("2026-10-01T03:00:00+00:00"), "2026-10");
});
