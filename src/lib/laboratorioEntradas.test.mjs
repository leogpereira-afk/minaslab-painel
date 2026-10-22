import test from "node:test";
import assert from "node:assert/strict";
import {
  etapa, prazoDescarte, diasAtendimento, atrasada, contarAmostras, filtrar, contagens, validar,
  normalizarParaSalvar, dataHora, ordenar, tempoMedio, linhaPlanilha, COLUNAS_PLANILHA,
  camposAlterados, camposBloqueados, corPessoa, corTipo, PALETA,
} from "./laboratorioEntradas.js";

const HOJE = "2026-10-22";
const base = { id: "a", os: "100/2026", amostras: "1/2-2026", recebidoEm: "2026-10-01T10:00", tipos: ["ÁGUA"], recebidoPor: ["RUTH"], retiradoPor: [], origem: ["INTERNO"] };

test("etapa sai das datas, na ordem do fluxo", () => {
  assert.equal(etapa(base, HOJE), "RECEBIDA");
  assert.equal(etapa({ ...base, retiradaLabEm: "2026-10-02T09:00" }, HOJE), "EM_ANALISE");
  assert.equal(etapa({ ...base, finalizadoLab: true }, HOJE), "FINALIZADA");
  assert.equal(etapa({ ...base, liberadoCliente: true, liberadoEm: "2026-10-20T00:00" }, HOJE), "LIBERADA");
  assert.equal(etapa({ ...base, liberadoCliente: true, liberadoEm: "2026-10-17T00:00" }, HOJE), "DESCARTE_PENDENTE");
  assert.equal(etapa({ ...base, liberadoEm: "2026-10-17T00:00", descartado: true }, HOJE), "DESCARTADA");
  assert.equal(etapa({ ...base, cancelada: true, descartado: true }, HOJE), "CANCELADA");
});

test("prazo de descarte é 5 dias depois da liberação, virando o mês", () => {
  assert.equal(prazoDescarte({ liberadoEm: "2026-10-29T15:00" }), "2026-11-03");
  assert.equal(prazoDescarte({}), "");
});

test("dias de atendimento e atraso", () => {
  assert.equal(diasAtendimento({ ...base, liberadoEm: "2026-10-07T00:00" }, HOJE), 6);
  assert.equal(diasAtendimento(base, HOJE), 21);
  assert.equal(atrasada(base, HOJE), true);
  assert.equal(atrasada({ ...base, recebidoEm: "2026-10-20T08:00" }, HOJE), false);
  assert.equal(atrasada({ ...base, liberadoEm: "2026-10-30T00:00" }, HOJE), false);
  // liberação antes do recebimento (erro de digitação) não vira número negativo
  assert.equal(diasAtendimento({ ...base, liberadoEm: "2026-09-01T00:00" }, HOJE), null);
});

test("conta amostras sem contar o ano", () => {
  assert.equal(contarAmostras("150/151-2026"), 2);
  assert.equal(contarAmostras("276/277/278/279/280/281/282/283/284/285/286-2026"), 11);
  assert.equal(contarAmostras("4426/2026"), 1);
  assert.equal(contarAmostras(""), 0);
});

test("filtro por coluna combina com abas e busca, sem acento", () => {
  const lista = [
    base,
    { ...base, id: "b", os: "200/2026", tipos: ["EFLUENTE"], recebidoPor: ["ANA CLÁUDIA"], parametroImediato: true, recebidoEm: "2026-10-21T10:00" },
    { ...base, id: "c", os: "300/2026", liberadoEm: "2026-10-05T00:00", liberadoCliente: true, descartado: true, observacao: "Somente fósforo" },
  ];
  assert.deepEqual(filtrar(lista, { filtros: { tipo: "EFLUENTE" }, hoje: HOJE }).map((e) => e.id), ["b"]);
  assert.deepEqual(filtrar(lista, { filtros: { recebidoDe: "2026-10-21", recebidoAte: "2026-10-21" }, hoje: HOJE }).map((e) => e.id), ["b"]);
  assert.deepEqual(filtrar(lista, { busca: "fosforo", hoje: HOJE }).map((e) => e.id), ["c"]);
  assert.deepEqual(filtrar(lista, { busca: "ana claudia", hoje: HOJE }).map((e) => e.id), ["b"]);
  assert.deepEqual(filtrar(lista, { aba: "IMEDIATO", hoje: HOJE }).map((e) => e.id), ["b"]);
  assert.deepEqual(filtrar(lista, { aba: "ABERTAS", hoje: HOJE }).map((e) => e.id), ["a", "b"]);
  assert.deepEqual(filtrar(lista, { aba: "DESCARTADA", hoje: HOJE }).map((e) => e.id), ["c"]);
  assert.deepEqual(filtrar(lista, { filtros: { liberado: "NAO" }, hoje: HOJE }).map((e) => e.id), ["a", "b"]);
  const c = contagens(lista, HOJE);
  assert.equal(c.ABERTAS, 2);
  assert.equal(c.ATRASADAS, 1);
  assert.equal(c.DESCARTADA, 1);
});

test("validação bloqueia o essencial e avisa OS repetida e data fora de ordem", () => {
  assert.equal(validar({ os: "", recebidoEm: "", tipos: [] }).erros.length, 3);
  const r = validar({ ...base, id: "novo", liberadoEm: "2026-09-01T00:00" }, [base]);
  assert.equal(r.erros.length, 0);
  assert.equal(r.avisos.length, 2);
});

test("ao gravar: texto aparado, pendência de importação sai e campo do outro setor não é mexido", () => {
  const r = normalizarParaSalvar({ ...base, os: " 100/2026 ", liberadoEm: "2026-10-05T00:00", liberadoCliente: null, finalizadoLab: null, pendencias: ["x"] });
  assert.equal(r.os, "100/2026");
  assert.equal(r.liberadoCliente, null);
  assert.equal(r.finalizadoLab, null);
  assert.equal(r.qtdAmostras, 2);
  assert.deepEqual(r.pendencias, []);
});

test("data com hora zero mostra só o dia; ordena pela recepção mais nova", () => {
  assert.equal(dataHora("2026-01-19T00:00"), "19/01/2026");
  assert.equal(dataHora("2026-10-13T11:40"), "13/10/2026 11:40");
  assert.equal(dataHora(""), "");
  assert.deepEqual(ordenar([base, { ...base, id: "z", recebidoEm: "" }, { ...base, id: "n", recebidoEm: "2026-10-10T00:00" }]).map((e) => e.id), ["n", "a", "z"]);
});

test("tempo médio considera liberadas nos últimos 30 dias; planilha tem uma célula por coluna", () => {
  const lista = [{ ...base, liberadoEm: "2026-10-05T00:00" }, { ...base, recebidoEm: "2026-10-10T00:00", liberadoEm: "2026-10-20T00:00" }, { ...base, recebidoEm: "2026-01-01T00:00", liberadoEm: "2026-01-10T00:00" }];
  assert.equal(tempoMedio(lista, HOJE), 7);
  assert.equal(Object.keys(linhaPlanilha(base, HOJE)).length, COLUNAS_PLANILHA.length);
});

test("setores: cada um só altera os seus campos; observação é dos dois", () => {
  const antes = { ...base, liberadoCliente: null, finalizadoLab: false, observacao: "" };
  assert.deepEqual(camposAlterados(antes, { ...antes, finalizadoLab: null }), []); // null e false são o mesmo "não"
  const adm = { ...antes, os: "101/2026", observacao: "ok" };
  assert.deepEqual(camposBloqueados(antes, adm, ["administrativo"]), []);
  assert.deepEqual(camposBloqueados(antes, adm, ["laboratorio"]), ["os"]);
  const lab = { ...antes, liberadoEm: "2026-10-05T10:00", liberadoCliente: true };
  assert.deepEqual(camposBloqueados(antes, lab, ["administrativo"]), ["liberadoCliente", "liberadoEm"]);
  assert.deepEqual(camposBloqueados(antes, lab, ["laboratorio"]), []);
  assert.deepEqual(camposBloqueados(antes, { ...antes, observacao: "x" }, []), ["observacao"]);
  // entrada nova: campos do laboratório vazios não contam como alteração
  assert.deepEqual(camposBloqueados(null, { ...base, tipos: ["ÁGUA"] }, ["administrativo"]), []);
});

test("cores fixas por pessoa e por tipo", () => {
  assert.notEqual(corPessoa("ANDERSON"), corPessoa("VICTORIA"));
  assert.equal(corPessoa("anderson"), corPessoa("ANDERSON"));
  assert.ok(PALETA.includes(corPessoa("FULANO NOVO")));
  assert.match(corTipo("ÁGUA"), /sky/);
});

test("pessoas: nome da planilha casa com a conta; quem não tem conta é desligado; nome curto sem repetir", async () => {
  const { casarPessoa, montarPessoas } = await import("./laboratorioEntradas.js");
  const contas = [
    { usuario: "ana", nome: "ANA CLAUDIA GONÇALVES PESSOA", ativo: true }, { usuario: "joseroberto", nome: "JOSE ROBERTO DOS SANTOS", ativo: true },
    { usuario: "thayna", nome: "THAYNA LOPES CARDOSO", ativo: true }, { usuario: "ruth", nome: "RUTH DIAS", ativo: true }, { usuario: "rute", nome: "RUTE SOUZA", ativo: true },
    { usuario: "caroline", nome: "CAROLINE DE SOUZA", ativo: false },
  ];
  assert.equal(casarPessoa("JOSE ROBERTO", contas).usuario, "joseroberto");
  assert.equal(casarPessoa("THAYNÁ", contas).usuario, "thayna");
  assert.equal(casarPessoa("ANA CLÁUDIA", contas).usuario, "ana");
  assert.equal(casarPessoa("VERA LUCIA", contas), null);
  const p = montarPessoas(contas, [{ recebidoPor: ["VERA LUCIA"], retiradoPor: [] }]);
  assert.equal(p.curto("ANA CLAUDIA GONÇALVES PESSOA"), "ANA");
  assert.equal(p.desligado("VERA LUCIA"), true);
  assert.equal(p.desligado("CAROLINE DE SOUZA"), true);
  assert.equal(p.desligado("RUTH DIAS"), false);
  assert.deepEqual(p.ativas.map((x) => x.usuario).sort(), ["ana", "joseroberto", "rute", "ruth", "thayna"]);
  assert.notEqual(p.cor("RUTH DIAS"), p.cor("RUTE SOUZA"));
});

test("provedor: Administrativo lança as datas de retirada; interno continua só Laboratório", () => {
  const antes = { ...base, origem: ["PROVEDOR"], retiradaLabEm: "" };
  assert.deepEqual(camposBloqueados(antes, { ...antes, retiradaLabEm: "2026-10-02T09:00" }, ["administrativo"]), []);
  const interno = { ...base, origem: ["INTERNO"], retiradaLabEm: "" };
  assert.deepEqual(camposBloqueados(interno, { ...interno, retiradaLabEm: "2026-10-02T09:00" }, ["administrativo"]), ["retiradaLabEm"]);
  assert.deepEqual(camposBloqueados(antes, { ...antes, liberadoEm: "2026-10-05T09:00" }, ["administrativo"]), ["liberadoEm"]);
});
