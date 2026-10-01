import test from "node:test";
import assert from "node:assert/strict";
// sessao.js lê localStorage; simulamos um armazenamento mínimo.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
const { capacidadesAcademy, podeAbrir } = await import("../sessao.js");
const s = (papel, paginas_consulta = []) => ({ usuario: "u", papel, paginas_consulta });

test("direção tem todas as capacidades da Academy", () => {
  const c = capacidadesAcademy(s("direcao"));
  assert.deepEqual(Object.values(c), [true, true, true, true, true]);
  assert.equal(podeAbrir("academy", s("direcao")), true);
});

test("conta legada (sem matriz) não abre nem administra a Academy", () => {
  for (const papel of ["equipe", "leitura"]) {
    assert.equal(podeAbrir("academy", s(papel)), false);
    assert.equal(capacidadesAcademy(s(papel)).gestao, false);
  }
});

test("matriz: cada chave libera só a sua capacidade (sem herança)", () => {
  const base = s("equipe", ["__matriz_v1", "academy"]);
  assert.equal(podeAbrir("academy", base), true);
  const c = capacidadesAcademy(base);
  assert.equal(c.colaborador, true);
  assert.equal(c.gestao, false);
  assert.equal(c.qualidade, false);
  const q = capacidadesAcademy(s("equipe", ["__matriz_v1", "academy-qualidade"]));
  assert.equal(q.qualidade, true);
  assert.equal(q.gestao, false);
});

test("chave da Academy sem a marca da matriz não vale", () => {
  assert.equal(capacidadesAcademy(s("equipe", ["academy-gestao"])).gestao, false);
});

test("conta da matriz sem nenhuma chave da Academy não abre o módulo", () => {
  assert.equal(podeAbrir("academy", s("equipe", ["__matriz_v1", "compras"])), false);
});
