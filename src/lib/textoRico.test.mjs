import test from "node:test";
import assert from "node:assert/strict";
import { lerTextoRico, textoSimples, mencionaUsuario, envolver, inserirLink, mencaoEmDigitacao, completarMencao, sugestoesMencao, temFormatacao, enderecoValido } from "./textoRico.js";

const existe = (u) => ["giovanna", "joseroberto", "ana"].includes(u);

test("formatação básica e aninhada", () => {
  assert.deepEqual(lerTextoRico("oi *todos*"), [{ t: "texto", v: "oi " }, { t: "b", filhos: [{ t: "texto", v: "todos" }] }]);
  assert.deepEqual(lerTextoRico("__sub__ e _it_ e ~ris~").map((n) => n.t), ["u", "texto", "i", "texto", "s"]);
  assert.deepEqual(lerTextoRico("*_os dois_*")[0].filhos[0].t, "i");
  // não formata o que não fecha, nem asterisco com espaço
  assert.deepEqual(lerTextoRico("2 * 3 = 6").map((n) => n.t), ["texto"]);
  assert.deepEqual(lerTextoRico("arquivo_nome_teste.pdf").map((n) => n.t), ["texto"]);
  assert.deepEqual(lerTextoRico("linha1\nlinha2").map((n) => n.t), ["texto", "quebra", "texto"]);
});

test("links: com texto, soltos e www; só http(s)", () => {
  const [l] = lerTextoRico("[Painel](https://exemplo.com/a?b=1)");
  assert.equal(l.t, "link"); assert.equal(l.href, "https://exemplo.com/a?b=1"); assert.equal(l.filhos[0].v, "Painel");
  const nos = lerTextoRico("veja https://site.com.br/x, ok");
  assert.equal(nos[1].href, "https://site.com.br/x");
  assert.equal(nos[2].v, ", ok");
  assert.equal(lerTextoRico("www.minaslab.online")[0].href, "https://www.minaslab.online");
  assert.deepEqual(lerTextoRico("[x](javascript:alert(1))").map((n) => n.t), ["texto"]);
});

test("menções: só de quem existe; e-mail não vira menção; @todos", () => {
  const nos = lerTextoRico("oi @giovanna e @fulano", existe);
  assert.deepEqual(nos.filter((n) => n.t === "mencao").map((n) => n.usuario), ["giovanna"]);
  assert.deepEqual(lerTextoRico("mande para x@giovanna.com", existe).map((n) => n.t), ["texto"]);
  assert.equal(mencionaUsuario("*Atenção* @todos", "ana", existe), true);
  assert.equal(mencionaUsuario("oi @Giovanna.", "giovanna", existe), true);
  assert.equal(mencionaUsuario("oi @joseroberto", "giovanna", existe), false);
});

test("texto simples para prévia e aviso", () => {
  assert.equal(textoSimples("*Bom dia* @giovanna, veja [o painel](https://x.com)\nok", (u) => (u === "giovanna" ? "GIOVANNA FROES" : u)), "Bom dia @GIOVANNA, veja o painel ok");
  assert.equal(temFormatacao("sem nada"), false);
  assert.equal(temFormatacao("com *algo*"), true);
});

test("botões: envolve a seleção, liga/desliga e ignora espaço na ponta", () => {
  assert.deepEqual(envolver("ola mundo", 4, 9, "*"), { texto: "ola *mundo*", ini: 5, fim: 10 });
  assert.deepEqual(envolver("ola *mundo*", 5, 10, "*"), { texto: "ola mundo", ini: 4, fim: 9 });
  assert.equal(envolver("ola mundo ", 4, 10, "__").texto, "ola __mundo__ ");
  assert.deepEqual(envolver("abc", 3, 3, "_"), { texto: "abc__", ini: 4, fim: 4 });
  assert.equal(inserirLink("veja aqui", 5, 9, "https://a.com").texto, "veja [aqui](https://a.com)");
  assert.equal(inserirLink("veja ", 5, 5, "https://a.com").texto, "veja https://a.com");
  assert.equal(enderecoValido("https://a.com"), true);
  assert.equal(enderecoValido("a.com"), false);
});

test("@ enquanto digita: acha o trecho, completa e sugere sem acento", () => {
  assert.deepEqual(mencaoEmDigitacao("oi @gio", 7), { inicio: 3, busca: "gio" });
  assert.equal(mencaoEmDigitacao("email@gio", 9), null);
  assert.deepEqual(completarMencao("oi @gio", 3, 7, "giovanna"), { texto: "oi @giovanna ", cursor: 13 });
  const pessoas = [{ usuario: "ana", nome: "ANA CLÁUDIA" }, { usuario: "joseroberto", nome: "JOSÉ ROBERTO" }];
  assert.deepEqual(sugestoesMencao(pessoas, "clau").map((p) => p.usuario), ["ana"]);
  assert.deepEqual(sugestoesMencao(pessoas, "jose").map((p) => p.usuario), ["joseroberto"]);
  assert.deepEqual(sugestoesMencao(pessoas, "", { grupo: true }).map((p) => p.usuario), ["todos", "ana", "joseroberto"]);
});
