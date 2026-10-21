import test from "node:test";
import assert from "node:assert/strict";
import {
  hojeSP, somarDias, aniversarioNoAno, aniversariantesDoMes, parabensRecentes, informativoFerias,
  ehRefAniversario, validarPost, validarComentario,
} from "../../supabase/functions/ml-canais/regras.mjs";
import { tempoRelativo, periodoFerias } from "./canais.js";

const P = (id, extra = {}) => ({ id, nome: `Pessoa ${id}`, ativo: true, ...extra });

test("hoje em Brasília vira o dia certo perto da meia-noite UTC", () => {
  assert.equal(hojeSP(new Date("2026-10-22T02:00:00Z")), "2026-10-21");
  assert.equal(hojeSP(new Date("2026-10-22T04:00:00Z")), "2026-10-22");
});

test("somarDias atravessa mês e ano", () => {
  assert.equal(somarDias("2026-12-30", 3), "2027-01-02");
  assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
});

test("29/02 cai em 28/02 nos anos comuns", () => {
  assert.deepEqual(aniversarioNoAno("1992-02-29", 2026), { dia: 28, mes: 2, data: "2026-02-28" });
  assert.equal(aniversarioNoAno("1992-02-29", 2028).dia, 29);
  assert.equal(aniversarioNoAno("", 2026), null);
});

test("aniversariantes do mês: só quem está na casa, sem ano, ordenados", () => {
  const pessoas = [
    P("a", { dataNascimento: "1990-10-21" }),
    P("b", { dataNascimento: "1985-10-03", apelido: "Bia" }),
    P("c", { dataNascimento: "1980-10-05", ativo: false }),
    P("d", { dataNascimento: "1980-10-06", desligadoEm: "2026-01-10" }),
    P("e", { dataNascimento: "1980-11-06" }),
    P("f"),
    P("g", { dataNascimento: "1999-10-09" }),
  ];
  const l = aniversariantesDoMes(pessoas, 2026, 10, ["g"]);
  assert.deepEqual(l, [
    { pessoaId: "b", nome: "Bia", dia: 3, mes: 10 },
    { pessoaId: "a", nome: "Pessoa a", dia: 21, mes: 10 },
  ]);
  assert.ok(!JSON.stringify(l).includes("1990"));
});

test("parabéns automático no dia e nos dias seguintes", () => {
  const pessoas = [P("a", { dataNascimento: "1990-10-21" }), P("b", { dataNascimento: "1990-10-10" })];
  const hoje = parabensRecentes(pessoas, "2026-10-21");
  assert.equal(hoje.length, 1);
  assert.equal(hoje[0].id, "aniv-2026-a");
  assert.equal(hoje[0].hoje, true);
  assert.ok(ehRefAniversario(hoje[0].id));
  const depois = parabensRecentes(pessoas, "2026-10-25");
  assert.equal(depois.length, 1);
  assert.equal(depois[0].hoje, false);
  assert.equal(parabensRecentes(pessoas, "2026-10-28").length, 0);
  assert.equal(parabensRecentes(pessoas, "2026-10-21", { ocultos: ["a"] }).length, 0);
});

test("refs de aniversário não aceitam lixo", () => {
  assert.equal(ehRefAniversario("aniv-2026-abc"), true);
  assert.equal(ehRefAniversario("aniv-2026-a b"), false);
  assert.equal(ehRefAniversario("drop table"), false);
});

test("informativo de férias: em curso e próximas 30 dias", () => {
  const pessoas = [P("a"), P("b"), P("c"), P("d", { ativo: false })];
  const ferias = [
    { pessoaId: "a", inicio: "2026-10-10T12:00:00.000Z", retorno: "2026-10-30", status: "marcada" },
    { pessoaId: "b", inicio: "2026-11-10", retorno: "2026-11-30", status: "marcada" },
    { pessoaId: "c", inicio: "2026-12-20", retorno: "2027-01-10", status: "marcada" },
    { pessoaId: "b", inicio: "2026-10-01", retorno: "2026-10-21", status: "marcada" },
    { pessoaId: "a", inicio: "2026-10-25", retorno: "2026-11-01", status: "cancelada" },
    { pessoaId: "d", inicio: "2026-10-20", retorno: "2026-10-30", status: "marcada" },
  ];
  const l = informativoFerias(ferias, pessoas, "2026-10-21");
  assert.deepEqual(l, [
    { nome: "Pessoa a", inicio: "2026-10-10", retorno: "2026-10-30", emCurso: true },
    { nome: "Pessoa b", inicio: "2026-11-10", retorno: "2026-11-30", emCurso: false },
  ]);
});

test("validação de publicação e comentário", () => {
  assert.equal(validarPost({ titulo: "" }).ok, false);
  assert.equal(validarPost({ titulo: "Oi", imagem: "javascript:alert(1)" }).ok, false);
  const v = validarPost({ titulo: " Oi ", tipo: "xpto", imagem: "https://x.com/a.png", fixado: 1 });
  assert.deepEqual(v.post, { tipo: "noticia", titulo: "Oi", texto: "", imagem: "https://x.com/a.png", fixado: true });
  assert.equal(validarComentario("  ").ok, false);
  assert.equal(validarComentario("x".repeat(1001)).ok, false);
  assert.equal(validarComentario(" parabéns ").texto, "parabéns");
});

test("tempo relativo e período de férias na tela", () => {
  const agora = new Date("2026-10-21T15:00:00Z");
  assert.equal(tempoRelativo("2026-10-21T14:59:40Z", agora), "agora");
  assert.equal(tempoRelativo("2026-10-21T14:30:00Z", agora), "há 30 min");
  assert.equal(tempoRelativo("2026-10-21T10:00:00Z", agora), "há 5 h");
  assert.equal(tempoRelativo("2026-10-20T10:00:00Z", agora), "ontem");
  assert.equal(periodoFerias({ inicio: "2026-11-10", retorno: "2026-11-30" }), "10/11 a 29/11 · volta 30/11");
});
