import { test } from "node:test";
import assert from "node:assert/strict";
import { resultadoAso } from "./resultadoAso.js";

const casos = (lista, esperado) => {
  for (const obs of lista) assert.equal(resultadoAso(obs), esperado, obs);
};

test("negação vem primeiro: nenhum destes pode virar apto", () => {
  casos(
    ["INAPTO", "Inapta", "inaptos", "Não apto", "Não-apto", "nao-apto", "Não apta", "Não está apto",
     "Não foi considerado apto", "não será apto para altura", "Apto; INAPTO", "Periódico: inapto temporariamente"],
    "inapto",
  );
});

test("restrição em qualquer grafia comum", () => {
  casos(
    ["Apto com restrição", "Apto c/ restrição", "Apto, com restrição para altura", "Apto (com restrições)",
     "apta com restricao", "Periódico - apto com restrição a esforço", "Apto, restrito a trabalho em solo",
     "Apto com restrição para altura, sem restrição para as demais atividades"],
    "apto_com_restricao",
  );
});

test("apto de verdade", () => {
  casos(
    ["Apto", "apta", "Periódico, apto, clínica X", "APTO PARA TRABALHO EM ALTURA", "Apto sem restrições",
     "Não apresenta restrições. Apto", "Apto, não possui restrições", "Apto, nenhuma restrição", "Apto irrestrito"],
    "apto",
  );
});

test("sem a palavra, ou em branco: aguardando", () => {
  casos(["", null, undefined, "aguardando laudo", "periódico, clínica X", "Não se aplica"], "aguardando");
});
