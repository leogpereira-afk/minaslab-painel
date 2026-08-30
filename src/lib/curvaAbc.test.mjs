// Testes da curva ABC. Rodar com TZ=UTC (o script npm test ja fixa): teste que
// so passa no fuso de quem escreveu nao e teste.
//
// O que esta aqui nao e "cobertura": e cada regra que, se quebrar, faz a tela
// AFIRMAR uma coisa falsa com cara de certa — cliente na classe errada, corte
// em reais errado, ou um quadro vazio que se le como "nao carregou".
import test from "node:test";
import assert from "node:assert/strict";
import { curvaAbc, agruparPor, porMes, porAno, CLASSES, FAIXAS, faixaDaClasse } from "./curvaAbc.js";

const abc = (valores, opcoes) =>
  curvaAbc(
    valores.map(([chave, valor]) => ({ chave, valor })),
    opcoes
  );
const classeDe = (r, chave) => r.curva.find((c) => c.chave === chave)?.classe;
const faixa = (r, id) => r.faixas.find((f) => f.id === id);
const classe = (r, nome) => r.classes.find((c) => c.classe === nome);

/* A regua da tela, palavra por palavra: "A+ sao os que somam os primeiros 30%,
   A ate 80%, B+ ate 90%, B ate 95%, C o resto". */
test("as cinco faixas sao a regua que o dono escreveu na tela", () => {
  assert.deepEqual(
    CLASSES.map((c) => [c.classe, c.teto]),
    [["A+", 0.30], ["A", 0.80], ["B+", 0.90], ["B", 0.95], ["C", 1]]
  );
  assert.deepEqual(FAIXAS.map((f) => f.membros), [["A+", "A"], ["B+", "B"], ["C"]]);
  assert.equal(faixaDaClasse("B+").id, "B*");
  assert.equal(faixaDaClasse("A+").id, "A*");
});

/* ========================================================= A CLASSE E DO ACUMULADO */

test("a classe sai do acumulado, nao da posicao", () => {
  // 1000 no total. O acumulado ANTES de cada um decide.
  const r = abc([["a", 350], ["b", 300], ["c", 200], ["d", 60], ["e", 50], ["f", 25], ["g", 15]]);
  assert.equal(r.total, 1000);
  assert.equal(classeDe(r, "a"), "A+");  // antes 0%
  assert.equal(classeDe(r, "b"), "A");   // antes 35%
  assert.equal(classeDe(r, "c"), "A");   // antes 65%
  assert.equal(classeDe(r, "d"), "B+");  // antes 85%
  assert.equal(classeDe(r, "e"), "B");   // antes 91%
  assert.equal(classeDe(r, "f"), "C");   // antes 96%
  assert.equal(classeDe(r, "g"), "C");   // antes 98,5%
  // A posicao e da curva INTEIRA e nao se confunde com a classe: o 3o lugar e
  // classe A, o 4o e B+ — a fronteira caiu entre eles por causa do dinheiro.
  assert.deepEqual(r.curva.map((c) => c.posicao), [1, 2, 3, 4, 5, 6, 7]);
});

/* O CASO QUE JUSTIFICA A REGRA: dois clientes que compraram EXATAMENTE o mesmo
   valor, um de cada lado da fronteira dos 80%. Classificando um a um, o
   quarto cairia em B+ (acumulado antes de 85%) e o terceiro ficaria em A — dois
   clientes identicos em classes diferentes, decididos pela ordem alfabetica do
   desempate. O bloco de empatados atravessa a fronteira como um corpo so. */
test("empate na fronteira: valores iguais caem na MESMA faixa", () => {
  const r = abc([["a", 40], ["b", 30], ["c", 15], ["d", 15]]);
  assert.equal(r.total, 100);
  assert.equal(classeDe(r, "a"), "A+");
  assert.equal(classeDe(r, "b"), "A");
  assert.equal(classeDe(r, "c"), "A");
  assert.equal(classeDe(r, "d"), "A", "o empatado nao pode cair uma faixa abaixo do igual dele");
  assert.equal(classe(r, "B+").quantidade, 0);
  // Faixa vazia mostra travessao, nunca "entra quem passa de R$ 0,00".
  assert.equal(classe(r, "B+").corte, null);
  // Empatar nao e ocupar o mesmo lugar: a posicao continua sequencial.
  assert.deepEqual(r.curva.map((c) => c.posicao), [1, 2, 3, 4]);
});

test("empate de centavos e empate: somar float nao muda a classe de ninguem", () => {
  const quaseIgual = 0.1 + 0.2 + 14.7; // 15.000000000000002
  const r = abc([["a", 40], ["b", 30], ["c", 15], ["d", quaseIgual]]);
  assert.equal(classeDe(r, "d"), "A");
  // Um centavo inteiro de diferenca NAO e empate — sao valores diferentes.
  const r2 = abc([["a", 40], ["b", 30], ["c", 15], ["d", 14.99]]);
  assert.equal(classeDe(r2, "d"), "B+");
});

/* Cinco clientes indistinguiveis nao tem curva: qualquer corte entre eles seria
   o alfabeto decidindo quem e A e quem e C. Todos sobem juntos. */
test("todos iguais: ninguem e separado pelo desempate", () => {
  const r = abc([["a", 20], ["b", 20], ["c", 20], ["d", 20], ["e", 20]]);
  assert.deepEqual([...new Set(r.curva.map((c) => c.classe))], ["A+"]);
  assert.equal(classe(r, "A+").quantidade, 5);
  assert.equal(classe(r, "C").quantidade, 0);
});

/* ==================================================================== O CORTE */

test("o corte de cada faixa e o menor valor que entrou nela", () => {
  const r = abc([["a", 350], ["b", 300], ["c", 200], ["d", 60], ["e", 50], ["f", 25], ["g", 15]]);
  assert.equal(classe(r, "A+").corte, 350);
  assert.equal(classe(r, "A").corte, 200);
  assert.equal(classe(r, "B+").corte, 60);
  assert.equal(classe(r, "B").corte, 50);
  assert.equal(classe(r, "C").corte, 15);
  // Os tres cartoes: A e A+ e A juntas, B e B+ e B, C fica so.
  assert.deepEqual(
    r.faixas.map((f) => [f.id, f.quantidade, f.valor, f.corte]),
    [["A*", 3, 850, 200], ["B*", 2, 110, 50], ["C", 2, 40, 15]]
  );
  assert.equal(faixa(r, "A*").participacao, 0.85);
});

/* O print da Impresilk: "entra quem passa de R$ 6.161,49". O corte e um valor
   real da carteira, com centavos — e um centavo a menos e outra classe. */
test("o corte sai em reais de verdade, e um centavo decide", () => {
  // Total exato de 100.000: acumulado ANTES de 6.161,49 = 78% (ainda A);
  // depois dele = 84,16% (ja B+), e o de 6.161,48 fica do lado de la.
  const r = abc([
    ["a", 40000], ["b", 38000], ["c", 6161.49], ["d", 6161.48],
    ["e", 5000], ["f", 3000], ["g", 1000], ["h", 677.03],
  ]);
  assert.equal(r.total, 100000);
  assert.equal(classeDe(r, "c"), "A");
  assert.equal(classeDe(r, "d"), "B+", "um centavo a menos e outra classe");
  assert.equal(classe(r, "A").corte, 6161.49);
  assert.equal(classe(r, "A+").corte, 40000);
  assert.equal(classe(r, "B+").corte, 6161.48);
  assert.equal(classe(r, "B").corte, 5000);
  assert.equal(classe(r, "C").corte, 677.03);
});

/* ================================================= ZERO NAO E POSICAO NA CURVA */

test("valor zero ou negativo fica FORA da curva, contado a parte", () => {
  const r = abc([
    ["a", 350], ["b", 300], ["c", 200], ["d", 60], ["e", 50], ["f", 25], ["g", 15],
    ["h", 0], ["i", -100],
  ]);
  assert.equal(r.curva.length, 7);
  assert.equal(r.total, 1000, "quem nao comprou nao muda o total nem os cortes");
  assert.equal(classe(r, "C").quantidade, 2);
  // Sem a regra, o zero entraria na C e o cartao anunciaria "entra quem passa
  // de R$ 0,00" — uma frase que nao informa nada.
  assert.equal(classe(r, "C").corte, 15);
  assert.equal(r.foraDaCurva.quantidade, 2);
  assert.equal(r.foraDaCurva.valor, -100);
  assert.equal(r.recebidos, 9);
  assert.equal(r.vazio, false);
});

test("valor que nao e numero e ausencia, nao zero", () => {
  const r = abc([["a", 100], ["b", null], ["c", "sem informacao"]]);
  assert.equal(r.curva.length, 1);
  assert.equal(r.foraDaCurva.quantidade, 2);
  assert.equal(r.foraDaCurva.semMedida, 2);
});

/* ====================================================== VAZIO NAO PODE QUEBRAR */

test("lista vazia devolve vazio:true, total 0 e faixas zeradas, sem quebrar", () => {
  for (const entrada of [[], null, undefined]) {
    const r = curvaAbc(entrada);
    assert.equal(r.vazio, true);
    assert.equal(r.total, 0);
    assert.deepEqual(r.curva, []);
    assert.equal(r.classes.length, 5);
    assert.equal(r.faixas.length, 3);
    for (const c of r.classes) {
      assert.equal(c.quantidade, 0);
      assert.equal(c.valor, 0);
      assert.equal(c.corte, null, "faixa sem ninguem nao tem corte — travessao, nao zero");
      assert.equal(c.participacao, null);
    }
    for (const f of r.faixas) {
      assert.equal(f.quantidade, 0);
      assert.equal(f.corte, null);
    }
  }
});

/* "Ninguem comprou" e "nao carregou" sao respostas diferentes e a tela tem de
   dizer diferente. `vazio` sozinho nao separa as duas — `recebidos` separa. */
test("vazio de quem nao comprou se distingue de vazio de quem nao carregou", () => {
  const naoCarregou = curvaAbc([]);
  assert.equal(naoCarregou.vazio, true);
  assert.equal(naoCarregou.recebidos, 0);

  const ninguemComprou = abc([["a", 0], ["b", 0], ["c", 0]]);
  assert.equal(ninguemComprou.vazio, true);
  assert.equal(ninguemComprou.recebidos, 3);
  assert.equal(ninguemComprou.foraDaCurva.quantidade, 3);
});

/* ========================================================== GRUPOS DE CNPJ */

test("grupo soma dois CNPJs e a posicao e recalculada DEPOIS do agrupamento", () => {
  const itens = [
    { cnpj: "11", nome: "OSORIO MATRIZ", valor: 100 },
    { cnpj: "22", nome: "OUTRO CLIENTE", valor: 90 },
    { cnpj: "33", nome: "OSORIO FILIAL", valor: 80 },
  ];
  const opcoes = { chaveDe: (x) => x.cnpj, valorDe: (x) => x.valor };

  // Sem agrupar: tres linhas, e o dono aparece em 1o e em 3o.
  const solto = curvaAbc(itens, opcoes);
  assert.deepEqual(solto.curva.map((c) => c.chave), ["11", "22", "33"]);

  const juntos = agruparPor(itens, { 11: "Grupo Osorio", 33: "Grupo Osorio" }, opcoes);
  assert.equal(juntos.length, 2);
  const g = juntos.find((l) => l.ehGrupo);
  assert.equal(g.chave, "Grupo Osorio");
  assert.equal(g.valor, 180);
  assert.deepEqual(g.chaves, ["11", "33"], "a tela mostra de quantos CNPJs o grupo foi feito");
  assert.equal(g.itens.length, 2);
  // Quem nao esta no mapa fica sozinho, com a propria chave.
  const sozinho = juntos.find((l) => !l.ehGrupo);
  assert.equal(sozinho.chave, "22");
  assert.deepEqual(sozinho.chaves, ["22"]);

  const r = curvaAbc(juntos, { chaveDe: (l) => l.chave, valorDe: (l) => l.valor, rotuloDe: (l) => l.rotulo });
  assert.equal(r.total, 270);
  assert.deepEqual(r.curva.map((c) => [c.posicao, c.chave]), [[1, "Grupo Osorio"], [2, "22"]]);
  assert.equal(classeDe(r, "Grupo Osorio"), "A+");
});

test("agrupar antes de classificar muda a classe — e e por isso que vem antes", () => {
  // Tres CNPJs de R$ 40 mil do mesmo dono, atras de um cliente de R$ 100 mil.
  const itens = [
    { cnpj: "big", valor: 100000 },
    { cnpj: "a", valor: 40000 },
    { cnpj: "b", valor: 40000 },
    { cnpj: "c", valor: 40000 },
  ];
  const opcoes = { chaveDe: (x) => x.cnpj, valorDe: (x) => x.valor };
  const soltos = curvaAbc(itens, opcoes);
  assert.equal(classeDe(soltos, "a"), "A"); // total 220 mil, antes de "a" = 45%

  const mapa = { a: "Grupo X", b: "Grupo X", c: "Grupo X" };
  const r = curvaAbc(agruparPor(itens, mapa, opcoes), {
    chaveDe: (l) => l.chave,
    valorDe: (l) => l.valor,
  });
  // Somados, os R$ 120 mil PASSAM o cliente de R$ 100 mil: o dono nao so muda
  // de classe, ele muda de lugar. Classificar antes de agrupar diria o oposto.
  assert.deepEqual(r.curva.map((c) => c.chave), ["Grupo X", "big"]);
  assert.equal(classeDe(r, "Grupo X"), "A+");
  assert.equal(classeDe(r, "big"), "A");
});

test("sem mapa de grupos, cada um fica sozinho", () => {
  const itens = [{ chave: "a", valor: 10 }, { chave: "b", valor: 5 }];
  for (const mapa of [null, undefined, {}]) {
    const r = agruparPor(itens, mapa);
    assert.equal(r.length, 2);
    assert.deepEqual(r.map((l) => l.ehGrupo), [false, false]);
  }
});

/* ============================================== A SOMA TEM DE FECHAR EM 100% */

test("participacao soma 100% e o ultimo acumulado chega a 1", () => {
  const r = abc([["a", 6161.49], ["b", 3333.33], ["c", 1234.56], ["d", 987.65], ["e", 42.07]]);
  assert.equal(r.total, 11759.10);
  const soma = r.curva.reduce((t, c) => t + c.participacao, 0);
  assert.ok(Math.abs(soma - 1) < 1e-9, `participacoes somaram ${soma}`);
  assert.ok(Math.abs(r.curva[r.curva.length - 1].acumulado - 1) < 1e-9);
  const somaClasses = r.classes.reduce((t, c) => t + (c.participacao || 0), 0);
  assert.ok(Math.abs(somaClasses - 1) < 1e-9, `classes somaram ${somaClasses}`);
  const somaFaixas = r.faixas.reduce((t, f) => t + (f.participacao || 0), 0);
  assert.ok(Math.abs(somaFaixas - 1) < 1e-9, `faixas somaram ${somaFaixas}`);
  // O acumulado e ate o item, INCLUSIVE dele.
  assert.ok(Math.abs(r.curva[0].acumulado - 6161.49 / 11759.10) < 1e-12);
});

/* ========================================================= O TEMPO (detalhe) */

test("porMes junta pelo dia LOCAL e soma o mes", () => {
  const itens = [
    { data: "2026-01-05", valor: 100 },
    { data: "2026-01-31T23:30:00", valor: 50 },
    { data: "2026-02-10", valor: 70 },
    { data: "2025-12-01", valor: 30 },
  ];
  const r = porMes(itens);
  assert.deepEqual(r.meses, [
    { mes: "2025-12", ano: "2025", valor: 30, quantidade: 1 },
    { mes: "2026-01", ano: "2026", valor: 150, quantidade: 2 },
    { mes: "2026-02", ano: "2026", valor: 70, quantidade: 1 },
  ]);
  assert.equal(r.total, 250);
  // Mes sem movimento NAO aparece: ausencia nao e zero, e a grade de 12 casas e
  // decisao da tela, que sabe qual e o mes de hoje.
  assert.equal(r.meses.length, 3);
});

test("porAno soma o ano e aceita objeto Date", () => {
  const r = porAno([
    { data: new Date(2026, 0, 5), valor: 100 },
    { data: "2026-06-30", valor: 20 },
    { data: "2025-03-03", valor: 7 },
  ]);
  assert.deepEqual(r.anos, [
    { ano: "2025", valor: 7, quantidade: 1 },
    { ano: "2026", valor: 120, quantidade: 2 },
  ]);
});

test("registro sem data nao some calado", () => {
  const r = porMes([
    { data: "2026-01-05", valor: 100 },
    { data: null, valor: 9 },
    { data: "", valor: 1 },
  ]);
  assert.deepEqual(r.meses, [{ mes: "2026-01", ano: "2026", valor: 100, quantidade: 1 }]);
  assert.equal(r.semData.quantidade, 2);
  assert.equal(r.semData.valor, 10, "o que ficou fora do grafico continua contado");
});

test("o tempo tambem nao quebra com lista vazia", () => {
  for (const entrada of [[], null, undefined]) {
    assert.deepEqual(porMes(entrada).meses, []);
    assert.deepEqual(porAno(entrada).anos, []);
    assert.equal(porMes(entrada).total, 0);
  }
});
