import test from "node:test";
import assert from "node:assert/strict";
import {
  hojeSP, somarDias, aniversarioNoAno, aniversariantesDoMes, parabensRecentes, informativoFerias,
  ehRefAniversario, validarPost, validarComentario,
} from "../../supabase/functions/ml-canais/regras.mjs";
import { tempoRelativo, periodoFerias } from "./canais.js";
import { validarDestaque, normNome } from "../../supabase/functions/ml-canais/regras.mjs";

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
    { pessoaId: "b", nome: "Pessoa B", dia: 3, mes: 10, foto: "" },
    { pessoaId: "a", nome: "Pessoa A", dia: 21, mes: 10, foto: "" },
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
    { nome: "Pessoa A", inicio: "2026-10-10", retorno: "2026-10-30", emCurso: true },
    { nome: "Pessoa B", inicio: "2026-11-10", retorno: "2026-11-30", emCurso: false },
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


test("destaque do mês: valida e separa as qualidades", () => {
  assert.equal(validarDestaque({ nome: "", mes: "2026-09" }).ok, false);
  assert.equal(validarDestaque({ nome: "Pessoa A", mes: "2026-13" }).ok, false);
  assert.deepEqual(validarDestaque({ limpar: true }), { ok: true, destaque: null });
  const v = validarDestaque({ nome: " Pessoa A ", mes: "2026-09", itens: "Laboratório: excelência\n\nSem rótulo\na:b\nc:d\ne:f", fotoId: "x" });
  assert.equal(v.destaque.nome, "Pessoa A");
  assert.equal(v.destaque.itens.length, 4);
  assert.deepEqual(v.destaque.itens[0], { rotulo: "Laboratório", texto: "excelência" });
  assert.deepEqual(v.destaque.itens[1], { rotulo: "", texto: "Sem rótulo" });
  assert.equal(normNome("José  Roberto"), "JOSE ROBERTO");
});

test("ficha duplicada no RH não vira dois parabéns", () => {
  const pessoas = [P("a", { nome: "Pessoa Dup", dataNascimento: "1990-10-21" }), P("b", { nome: "PESSOA DUP", dataNascimento: "1990-10-21" })];
  assert.equal(parabensRecentes(pessoas, "2026-10-21").length, 1);
  assert.equal(aniversariantesDoMes(pessoas, 2026, 10).length, 1);
});

test("foto anexada: só imagem e caminho guardado válido", async () => {
  const { lerFoto, ehFotoGuardada } = await import("../../supabase/functions/ml-canais/regras.mjs");
  assert.equal(lerFoto("data:image/png;base64,iVBORw0KGgo=").ext, "png");
  assert.equal(lerFoto("data:text/html;base64,PGI+").ok, false);
  assert.equal(ehFotoGuardada("canais/123e4567-e89b-12d3-a456-426614174000.jpg"), true);
  assert.equal(ehFotoGuardada("../outros/x.jpg"), false);
  assert.equal(validarPost({ titulo: "x", imagem: "canais/123e4567-e89b-12d3-a456-426614174000.jpg" }).ok, true);
});

test("mural mostra primeiro e último nome", async () => {
  const { nomeCurto } = await import("../../supabase/functions/ml-canais/regras.mjs");
  assert.equal(nomeCurto({ nome: "JOSE ROBERTO DOS SANTOS ALVES", apelido: "ZE" }), "Jose Alves");
});

test("foto do aniversariante: só imagem embutida", async () => {
  const { fotoValida } = await import("../../supabase/functions/ml-canais/regras.mjs");
  const f = "data:image/jpeg;base64,AAAA";
  assert.equal(fotoValida(f), f);
  assert.equal(fotoValida("https://x.com/a.jpg"), "");
  const l = parabensRecentes([P("a", { dataNascimento: "1990-10-21", foto: f })], "2026-10-21");
  assert.equal(l[0].foto, f);
  assert.equal(aniversariantesDoMes([P("a", { dataNascimento: "1990-10-21", foto: "javascript:x" })], 2026, 10)[0].foto, "");
});
