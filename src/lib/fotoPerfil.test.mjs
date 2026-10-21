import test from "node:test";
import assert from "node:assert/strict";
import { recorteQuadrado } from "./fotoPerfil.js";

test("recorte quadrado centralizado em foto horizontal e vertical", () => {
  assert.deepEqual(recorteQuadrado(400, 200), { x: 100, y: 0, lado: 200 });
  assert.deepEqual(recorteQuadrado(200, 400), { x: 0, y: 100, lado: 200 });
  assert.deepEqual(recorteQuadrado(300, 300), { x: 0, y: 0, lado: 300 });
});
test("zoom aproxima e o deslocamento nunca sai da imagem", () => {
  assert.deepEqual(recorteQuadrado(400, 200, 2), { x: 150, y: 50, lado: 100 });
  const canto = recorteQuadrado(400, 200, 2, 5, -3);
  assert.ok(canto.x + canto.lado <= 400 && canto.x >= 0 && canto.y >= 0);
  assert.equal(recorteQuadrado(400, 200, 0.2).lado, 200); // zoom menor que 1 não existe
});
