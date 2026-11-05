import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaveMetodo, acreditadoNoEscopo, gruposDaMatriz, conferirParametros } from "./escopo.js";

const escopo = JSON.parse(readFileSync(new URL("./escopoCRL1943.json", import.meta.url), "utf8"));

test("chave do método", () => {
  assert.equal(chaveMetodo("SMWW, 24ª Edição, Método 4500 Cl- B"), chaveMetodo("SMWW, 24ª Edição, Método 4500 Cl- B"));
  assert.equal(chaveMetodo("SM24 2130B:2023"), chaveMetodo("SMWW, 24ª Edição, Método 2130 B"));
  assert.equal(chaveMetodo("SMWW, 24ª Edição, Método 9222-I"), chaveMetodo("SMWW, 24ª Edição, Método 9222 I"));
  assert.equal(chaveMetodo("POP-LAB-016"), "POPLAB016");
  assert.notEqual(chaveMetodo("SMWW, 24ª Edição, Método 9222 E e G"), chaveMetodo("SMWW, 24ª Edição, Método 9221 E e G"));
});

test("acreditação depende do método e da matriz", () => {
  const mn = { acreditado: "Sim", parametro: "Manganês" };
  assert.equal(acreditadoNoEscopo(escopo, { parametro: mn, metodoTexto: "POP-LAB-016", matriz: "Água para Consumo Humano" }), true);
  assert.equal(acreditadoNoEscopo(escopo, { parametro: mn, metodoTexto: "POP-LAB-016", matriz: "Solo" }), false);
  assert.equal(acreditadoNoEscopo(escopo, { parametro: { ...mn, acreditado: "Não" }, metodoTexto: "POP-LAB-016", matriz: "Água tratada" }), false);
  assert.equal(acreditadoNoEscopo(escopo, { parametro: { acreditado: "Sim", parametro: "Tolueno" }, metodoTexto: "EPA 8260 D", matriz: "Água tratada" }), false);
  // pH: o escopo só tem o de campo
  assert.equal(acreditadoNoEscopo(escopo, { parametro: { acreditado: "Sim", parametro: "pH (In Situ)", inloco: "Sim" }, metodoTexto: "SMWW, 24ª Edição, Método 4500 H+ B", matriz: "Água tratada" }), true);
  assert.equal(acreditadoNoEscopo(escopo, { parametro: { acreditado: "Sim", parametro: "pH" }, metodoTexto: "SMWW, 24ª Edição, Método 4500 H+ B", matriz: "Água tratada" }), false);
  // Endotoxina só em saúde humana
  assert.deepEqual(gruposDaMatriz("Água para Hemodiálise"), ["agua de hemodialise"]);
});

test("conferência aponta o que diverge", () => {
  const ps = [{ id: "a", parametro: "Tolueno", acreditado: "Sim", metodo: "EPA 8260 D" }, { id: "b", parametro: "pH", acreditado: "Não", metodo: "SMWW, 24ª Edição, Método 2120 B" }, { id: "c", parametro: "Turbidez", acreditado: "Sim", metodo: "SMWW, 24ª Edição, Método 2130 B" }];
  const r = conferirParametros(escopo, ps, (x) => x);
  assert.deepEqual(r.map((x) => x.situacao), ["Marcado acreditado, método fora do escopo", "Método do escopo, mas não marcado acreditado", "Conforme o escopo"]);
});
