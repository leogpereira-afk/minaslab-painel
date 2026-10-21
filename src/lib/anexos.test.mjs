import test from "node:test";
import assert from "node:assert/strict";
import { ehImagem, extensaoDo, familiaDoArquivo, formatarTamanho, ladoReduzido, problemaDoArquivo } from "./anexos.js";

const arq = (name, size) => ({ name, size });

test("tamanho em texto", () => {
  assert.equal(formatarTamanho(500), "500 B");
  assert.equal(formatarTamanho(2048), "2 KB");
  assert.equal(formatarTamanho(2.5 * 1024 * 1024), "2,5 MB");
});
test("extensão e imagem", () => {
  assert.equal(extensaoDo("Laudo Final.PDF"), "pdf");
  assert.equal(extensaoDo("semextensao"), "");
  assert.equal(ehImagem("foto.JPG"), true);
  assert.equal(ehImagem("image/png"), true);
  assert.equal(ehImagem("planilha.xlsx"), false);
});
test("problemas do arquivo: tipo, vazio e tamanho (imagem grande é reduzida, o resto não)", () => {
  assert.equal(problemaDoArquivo(arq("a.pdf", 1000)), "");
  assert.match(problemaDoArquivo(arq("a.exe", 1000)), /Não aceito arquivo \.exe/);
  assert.match(problemaDoArquivo(arq("sem", 10)), /sem extensão/);
  assert.match(problemaDoArquivo(arq("a.pdf", 0)), /vazio/);
  assert.match(problemaDoArquivo(arq("a.pdf", 9 * 1024 * 1024)), /passa de 8 MB/);
  assert.equal(problemaDoArquivo(arq("foto.jpg", 12 * 1024 * 1024)), "");
  assert.match(problemaDoArquivo(null), /Escolha/);
});
test("família para o ícone", () => {
  assert.deepEqual(["a.pdf", "a.xlsx", "a.csv", "a.docx", "a.txt", "a.pptx", "a.zip", "a.png", "a.xml"].map(familiaDoArquivo), ["pdf", "planilha", "planilha", "documento", "documento", "apresentacao", "compactado", "imagem", "arquivo"]);
});
test("redução mantém proporção e não amplia", () => {
  assert.deepEqual(ladoReduzido(4000, 3000), { w: 2000, h: 1500 });
  assert.deepEqual(ladoReduzido(1000, 500), { w: 1000, h: 500 });
});
