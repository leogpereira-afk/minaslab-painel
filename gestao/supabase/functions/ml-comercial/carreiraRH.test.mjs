import test from "node:test";
import assert from "node:assert/strict";
import { aplicarCarreiraRH } from "./carreiraRH.mjs";
import { CARGO_POR_NIVEL } from "./cargosPlano.mjs";
import { NIVEIS } from "../../../src/lib/planoCarreira.js";

const pessoa = { id: "pes_1", nome: "FULANA", cargo: "Analista II", salario: "2300" };
const base = { pessoa, historico: [], nivelId: "lab-an3", data: "2026-11-01", movId: "car_x", hoje: "2026-11-13" };

test("nomes do servidor batem com o plano", () => {
  for (const n of NIVEIS) assert.equal(CARGO_POR_NIVEL[n.id], n.cargo, n.id);
  assert.equal(Object.keys(CARGO_POR_NIVEL).length, NIVEIS.length);
});

test("recusa data futura e nível desconhecido", () => {
  assert.match(aplicarCarreiraRH({ ...base, data: "2026-11-14" }).erro, /futura/);
  assert.match(aplicarCarreiraRH({ ...base, nivelId: "x" }).erro, /Cargo/);
});

test("muda cargo e salário e gera marcos com ids da movimentação", () => {
  const r = aplicarCarreiraRH({ ...base, salario: 2400 });
  assert.equal(r.pessoa.cargo, "Analista de Laboratório III");
  assert.equal(r.pessoa.salario, 2400);
  assert.deepEqual(r.marcos.map((m) => [m.id, m.tipo, m.data, m.valorDe, m.valorPara]), [
    ["rhc_car_x_cargo", "cargo", "2026-11-01", "Analista II", "Analista de Laboratório III"],
    ["rhc_car_x_salario", "salario", "2026-11-01", (2300).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}), (2400).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})],
  ]);
  assert.equal(r.marcos[0].pessoaId, "pes_1");
});

test("salário igual ou vazio não gera marco", () => {
  assert.equal(aplicarCarreiraRH({ ...base, salario: "2300" }).marcos.length, 1);
  assert.equal(aplicarCarreiraRH({ ...base, salario: null }).marcos.length, 1);
});

test("cargo já igual e sem salário: nada a fazer", () => {
  const r = aplicarCarreiraRH({ ...base, pessoa: { ...pessoa, cargo: "Analista de Laboratório III" } });
  assert.equal(r.pessoa, null); assert.equal(r.marcos.length, 0);
});

test("retroativo mais antigo que marco existente não sobrescreve a ficha", () => {
  const historico = [{ pessoaId: "pes_1", tipo: "cargo", data: "2026-11-05" }];
  const r = aplicarCarreiraRH({ ...base, historico, salario: 2400 });
  assert.equal(r.pessoa.cargo, "Analista II");      // cargo fica
  assert.equal(r.pessoa.salario, 2400);             // salário (sem marco mais novo) muda
  assert.equal(r.marcos.length, 2);                 // os dois marcos entram no histórico
});
