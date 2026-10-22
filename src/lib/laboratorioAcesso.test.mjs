import test from "node:test";
import assert from "node:assert/strict";
import { secoesLiberadas } from "./laboratorioAcesso.js";

const TODAS = [{ valor: "inicio" }, { valor: "entradas" }, { valor: "qualidade" }, { valor: "microbiologia" }, { valor: "fisicoquimico" }];
const valores = (l) => l.map((s) => s.valor);

test("direção e página inteira abrem todas as seções", () => {
  assert.equal(secoesLiberadas({ papel: "direcao", paginas_consulta: [] }, TODAS).length, 5);
  assert.equal(secoesLiberadas({ papel: "equipe", paginas_consulta: ["__matriz_v1", "laboratorio"] }, TODAS).length, 5);
});

test("só as seções marcadas em Acessos", () => {
  const s = { papel: "equipe", paginas_consulta: ["__matriz_v1", "inicio", "laboratorio/entradas", "laboratorio/microbiologia"] };
  assert.deepEqual(valores(secoesLiberadas(s, TODAS)), ["entradas", "microbiologia"]);
});

test("sem nenhuma seção, nada; conta antiga (sem matriz) segue abrindo tudo; sem sessão passa a lista", () => {
  assert.deepEqual(secoesLiberadas({ papel: "equipe", paginas_consulta: ["__matriz_v1", "inicio"] }, TODAS), []);
  assert.equal(secoesLiberadas({ papel: "equipe", paginas_consulta: ["compras"] }, TODAS).length, 5);
  assert.equal(secoesLiberadas(null, TODAS).length, 5);
});
