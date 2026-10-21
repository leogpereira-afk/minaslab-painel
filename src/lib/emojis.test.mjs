import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIAS, buscarEmojis, comRecente, inserirNoTexto, RAPIDAS } from "./emojis.js";
import { formatarDuracao, formatoDeGravacao, fracaoDoClique, proximaVelocidade } from "./audioVoz.js";

test("busca por palavra em português, sem acento e sem repetir", () => {
  assert.ok(buscarEmojis("coração").includes("❤️"));
  assert.ok(buscarEmojis("COPO").includes("🥤"));
  assert.ok(buscarEmojis("laboratorio").includes("🧪"));
  assert.deepEqual(buscarEmojis("  "), []);
  assert.deepEqual(buscarEmojis("zzzzzz"), []);
  const f = buscarEmojis("fogo"); assert.equal(new Set(f).size, f.length);
  assert.ok(buscarEmojis("a", 5).length <= 5);
});
test("dados: categorias com emojis e rápidas conhecidas", () => {
  assert.ok(CATEGORIAS.length >= 5 && CATEGORIAS.every((c) => c.itens.length >= 20));
  const todos = new Set(CATEGORIAS.flatMap((c) => c.itens.map(([e]) => e)));
  for (const r of RAPIDAS) assert.ok(todos.has(r), `rápida fora da lista: ${r}`);
});
test("inserir no cursor e no lugar da seleção", () => {
  assert.deepEqual(inserirNoTexto("Olá ", 4, 4, "😀"), { texto: "Olá 😀", cursor: 6 });
  assert.deepEqual(inserirNoTexto("Oi mundo", 3, 8, "🌎"), { texto: "Oi 🌎", cursor: 5 });
  assert.deepEqual(inserirNoTexto("abc", undefined, undefined, "👍"), { texto: "abc👍", cursor: 5 });
  assert.deepEqual(inserirNoTexto("", 0, 0, "👍"), { texto: "👍", cursor: 2 });
});
test("recentes: último primeiro, sem repetir, limite 24", () => {
  assert.deepEqual(comRecente(["👍", "❤️"], "❤️"), ["❤️", "👍"]);
  assert.equal(comRecente(Array.from({ length: 24 }, (_, i) => `e${i}`), "novo").length, 24);
});
test("duração, formato de gravação e barra", () => {
  assert.equal(formatarDuracao(75), "1:15"); assert.equal(formatarDuracao(7.4), "0:07"); assert.equal(formatarDuracao(null), "0:00");
  assert.deepEqual(formatoDeGravacao((m) => m === "audio/webm"), { mime: "audio/webm", ext: "webm" });
  assert.deepEqual(formatoDeGravacao((m) => m === "audio/mp4"), { mime: "audio/mp4", ext: "m4a" });
  assert.equal(formatoDeGravacao(() => false), null);
  assert.equal(fracaoDoClique(150, 100, 100), 0.5); assert.equal(fracaoDoClique(50, 100, 100), 0); assert.equal(fracaoDoClique(5, 0, 0), 0);
  assert.deepEqual([1, 1.5, 2, 1].map(proximaVelocidade), [1.5, 2, 1, 1.5]);
});
