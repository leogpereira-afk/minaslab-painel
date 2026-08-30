import test from "node:test";
import assert from "node:assert/strict";
import {
  ehBissexto, anosNoAniversario, ocorrenciaNoAno, estaNaCasa,
  aniversariosDoAno, textoDoAniversario,
} from "./aniversarios.js";

const P = (extra) => ({ id: "p1", nome: "Ana Silva", apelido: "Ana", ativo: true, ...extra });

test("bissexto pela regra dos 400 anos", () => {
  assert.equal(ehBissexto(2024), true);
  assert.equal(ehBissexto(2025), false);
  assert.equal(ehBissexto(1900), false, "século não divisível por 400 NÃO é bissexto");
  assert.equal(ehBissexto(2000), true);
});

test("29/02 cai em 28/02 no ano comum, e a ocorrência DIZ que foi ajustada", () => {
  const comum = ocorrenciaNoAno("2000-02-29", 2026);
  assert.equal(comum.dia, "2026-02-28");
  assert.equal(comum.ajustada, true, "mover em silêncio faria parecer ficha errada");
  const bis = ocorrenciaNoAno("2000-02-29", 2028);
  assert.equal(bis.dia, "2028-02-29");
  assert.equal(bis.ajustada, false);
});

test("data comum não é ajustada", () => {
  const o = ocorrenciaNoAno("1990-07-15", 2026);
  assert.equal(o.dia, "2026-07-15");
  assert.equal(o.ajustada, false);
});

test("ano ANTERIOR à data original não tem ocorrência — nem 0", () => {
  assert.equal(ocorrenciaNoAno("2027-03-10", 2026), null);
  assert.equal(anosNoAniversario("2027-03-10", 2026), null);
});

test("data inválida ou ausente devolve null, nunca uma data inventada", () => {
  for (const v of [null, undefined, "", "15/07/1990", "1990-7-5", "abc", 19900715]) {
    assert.equal(ocorrenciaNoAno(v, 2026), null, `falhou com ${JSON.stringify(v)}`);
    assert.equal(anosNoAniversario(v, 2026), null);
  }
});

test("quem saiu da casa não aparece — de duas formas", () => {
  assert.equal(estaNaCasa(P()), true);
  assert.equal(estaNaCasa(P({ ativo: false })), false);
  assert.equal(estaNaCasa(P({ desligadoEm: "2026-01-10" })), false);
  assert.equal(estaNaCasa(P({ ativo: undefined })), true, "ficha antiga sem o campo conta como ativa");
  assert.equal(estaNaCasa(null), false);
});

test("ZERO ano de casa NÃO é aniversário — o primeiro dia de trabalho não conta", () => {
  const r = aniversariosDoAno([P({ admissao: "2026-05-10" })], 2026);
  assert.deepEqual(r.ocorrencias, [], "0 anos encheria o calendário do que ninguém comemora");
});

test("um ano de casa aparece, e o texto usa o singular", () => {
  const r = aniversariosDoAno([P({ admissao: "2025-05-10" })], 2026);
  assert.equal(r.ocorrencias.length, 1);
  assert.equal(r.ocorrencias[0].anos, 1);
  assert.equal(textoDoAniversario(r.ocorrencias[0]), "1 ano de casa: Ana");
  const r5 = aniversariosDoAno([P({ admissao: "2021-05-10" })], 2026);
  assert.equal(textoDoAniversario(r5.ocorrencias[0]), "5 anos de casa: Ana");
});

test("admissão NÃO conferida chega marcada — o padrão não é otimista", () => {
  const semMarca = aniversariosDoAno([P({ admissao: "2021-05-10" })], 2026);
  assert.equal(semMarca.ocorrencias[0].conferida, false, "ausente = não conferida");
  const comMarca = aniversariosDoAno([P({ admissao: "2021-05-10", admissaoConferida: true })], 2026);
  assert.equal(comMarca.ocorrencias[0].conferida, true);
  const mentira = aniversariosDoAno([P({ admissao: "2021-05-10", admissaoConferida: "sim" })], 2026);
  assert.equal(mentira.ocorrencias[0].conferida, false, "só o booleano true vale");
});

test("o CASO REAL DA MINASLAB: fichas do relógio, nenhuma com nascimento", () => {
  const quadro = [
    P({ id: "a", admissao: "2024-01-15", admissaoConferida: false }),
    P({ id: "b", nome: "Bruno", admissao: "2023-06-01", admissaoConferida: false }),
    P({ id: "c", nome: "Carla", admissao: "2020-02-29", admissaoConferida: false }),
  ];
  const r = aniversariosDoAno(quadro, 2026);
  assert.equal(r.ativos, 3);
  assert.equal(r.semNascimento, 3, "a tela precisa deste número para não parecer quebrada");
  assert.equal(r.semAdmissao, 0);
  assert.equal(r.ocorrencias.length, 3, "só os de casa");
  assert.ok(r.ocorrencias.every((o) => o.tipo === "casa" && o.conferida === false));
  const carla = r.ocorrencias.find((o) => o.nome === "Carla");
  assert.equal(carla.dia, "2026-02-28", "29/02 num ano comum");
  assert.equal(carla.ajustada, true);
});

test("as ocorrências saem ordenadas por dia e, no empate, por nome", () => {
  const r = aniversariosDoAno(
    [
      P({ id: "z", nome: "Zeca", apelido: "Zeca", dataNascimento: "1990-03-10", admissao: "2020-01-05" }),
      P({ id: "a", nome: "Ana", apelido: "Ana", dataNascimento: "1990-03-10", admissao: "2020-12-31" }),
    ],
    2026
  );
  assert.deepEqual(
    r.ocorrencias.map((o) => `${o.dia} ${o.nome}`),
    ["2026-01-05 Zeca", "2026-03-10 Ana", "2026-03-10 Zeca", "2026-12-31 Ana"]
  );
});

test("uma pessoa gera as DUAS ocorrências quando tem as duas datas", () => {
  const r = aniversariosDoAno([P({ dataNascimento: "1990-07-15", admissao: "2019-03-02" })], 2026);
  assert.equal(r.ocorrencias.length, 2);
  assert.deepEqual(r.ocorrencias.map((o) => o.tipo).sort(), ["casa", "nascimento"]);
  assert.equal(r.semNascimento, 0);
});

test("o texto do aniversário traz a idade quando dá para saber", () => {
  const r = aniversariosDoAno([P({ dataNascimento: "1990-07-15" })], 2026);
  assert.equal(textoDoAniversario(r.ocorrencias[0]), "Aniversário: Ana (36)");
});

test("pessoa sem nome não quebra o texto", () => {
  const r = aniversariosDoAno([{ id: "x", ativo: true, admissao: "2020-04-01" }], 2026);
  assert.equal(r.ocorrencias[0].nome, "");
  assert.equal(typeof textoDoAniversario(r.ocorrencias[0]), "string");
});

test("entrada vazia ou estragada não quebra", () => {
  for (const v of [[], null, undefined, [null, undefined]]) {
    const r = aniversariosDoAno(v, 2026);
    assert.deepEqual(r.ocorrencias, []);
  }
  assert.equal(textoDoAniversario(null), "");
});
