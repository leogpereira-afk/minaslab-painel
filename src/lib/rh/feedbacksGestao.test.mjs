import test from "node:test";
import assert from "node:assert/strict";
import { feedbacksDaGestao } from "./feedbacksGestao.js";

test("feedback da Gestão sobe para a ficha ligada; sem ligação não sobe", () => {
  const pessoas = [{ id: "rh1", nome: "PESSOA UM" }];
  const gestao = {
    comercial: {
      equipe: [{ id: "eq1", rhPessoaId: "rh1" }, { id: "eq2" }],
      feedbacks: [
        { id: "f1", pessoaId: "eq1", data: "2026-10-05", texto: "Bom mês", combinados: "Ligar para 3 clientes", prazo: "2026-10-20" },
        { id: "f2", pessoaId: "eq2", data: "2026-10-05", texto: "Sem ficha" },
      ],
    },
    lab: { equipe: [{ id: "l1", rhPessoaId: "rh1" }], feedbacks: [{ id: "f3", pessoaId: "l1", data: "data ruim", texto: "x" }] },
  };
  const r = feedbacksDaGestao(gestao, pessoas);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "gestao:comercial:f1");
  assert.equal(r[0].pessoaId, "rh1");
  assert.equal(r[0].ocorridoEm, "2026-10-05");
  assert.equal(r[0].tipo, "individual");
  assert.equal(r[0].combinado, "Ligar para 3 clientes · prazo 20/10/2026");
  assert.equal(r[0].somenteLeitura, true);
});
