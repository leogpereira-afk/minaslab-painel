import test from "node:test";
import assert from "node:assert/strict";
import { treinamentosDaPessoa, pessoasParaTreinamento } from "./treinamentosPessoa.js";

test("lista: equipe do setor primeiro, depois o resto do RH sem repetir", () => {
  const l = pessoasParaTreinamento([{ id: "equ1", nome: "ANA", rhPessoaId: "rh1" }], [{ id: "rh1", nome: "ANA" }, { id: "rh3", nome: "CARLA" }, { id: "rh2", nome: "BIA" }]);
  assert.deepEqual(l.map((x) => x.id), ["equ1", "rh2", "rh3"]);
  assert.equal(l[0].daEquipe, true);
  assert.equal(l[1].rhPessoaId, "rh2");
});

test("perfil: conta presença pelo id da equipe ou pelo id do RH, mais recente primeiro", () => {
  const regs = [
    { id: "a", data: "2026-09-01", trilhaId: "t1", participantes: [{ pessoaId: "equ1", presente: true, nota: 80 }] },
    { id: "b", data: "2026-10-10", trilhaId: "t2", participantes: [{ pessoaId: "rh1", rhPessoaId: "rh1", presente: true, nota: null }] },
    { id: "c", data: "2026-10-12", trilhaId: "t3", participantes: [{ pessoaId: "equ1", presente: false }] },
    { id: "d", data: "2026-10-13", trilhaId: "t4", participantes: [{ pessoaId: "outra", presente: true }] },
  ];
  const r = treinamentosDaPessoa(regs, { id: "equ1", rhPessoaId: "rh1" });
  assert.deepEqual(r.map((x) => x.id), ["b", "a"]);
  assert.equal(r[1].nota, 80);
});

import { notaDe, fmtNota, mediaNotas, aprovado } from "./treinamentosPessoa.js";
test("nota de 0 a 10, com registros antigos em porcentagem", () => {
  assert.equal(notaDe(10), 10);
  assert.equal(notaDe(90), 9);
  assert.equal(fmtNota(9.5), "9,5");
  assert.equal(mediaNotas([{ nota: 10 }, { nota: 10 }, { nota: 10 }]), 10);
  assert.equal(aprovado({ presente: true, nota: 6 }), false);
  assert.equal(aprovado({ presente: true, nota: null }), true);
});
