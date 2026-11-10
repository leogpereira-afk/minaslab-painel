import test from "node:test";
import assert from "node:assert/strict";
import { blocosMarkdown, trechosInline } from "./markdownSimples.js";

test("títulos, listas, parágrafos e código", () => {
  const b = blocosMarkdown("# Plano\n\nTexto **forte** aqui.\n\n- um\n- dois\n\n1. a\n2. b\n\n```\nx = 1\n```");
  assert.deepEqual(b.map((x) => x.tipo), ["titulo", "paragrafo", "lista", "numerada", "codigo"]);
  assert.deepEqual(b[2].itens, ["um", "dois"]);
  assert.equal(b[4].texto, "x = 1");
});

test("tabela com separador", () => {
  const [t] = blocosMarkdown("| Item | Valor |\n|---|---:|\n| A | 10 |\n| B | 20 |");
  assert.equal(t.tipo, "tabela");
  assert.deepEqual(t.cabecalho, ["Item", "Valor"]);
  assert.deepEqual(t.linhas, [["A", "10"], ["B", "20"]]);
});

test("inline: negrito, código e link só http(s)", () => {
  const p = trechosInline("Veja **isto**, `cod` e [site](https://ex.com/a) mas não [x](javascript:alert(1))");
  assert.deepEqual(p.filter((x) => x.tipo !== "texto").map((x) => x.tipo), ["negrito", "codigo", "link"]);
  assert.equal(p.find((x) => x.tipo === "link").url, "https://ex.com/a");
  assert.ok(p.some((x) => x.tipo === "texto" && x.texto.includes("javascript:")));
});

test("entrada vazia ou nula", () => {
  assert.deepEqual(blocosMarkdown(""), []);
  assert.deepEqual(blocosMarkdown(null), []);
  assert.deepEqual(trechosInline(""), []);
});
