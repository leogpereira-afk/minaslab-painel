// A CURVA ABC — a inteligência da aba Clientes do Painel da Impresilk, trazida
// para cá como regra pura (nenhum React, nenhuma tela, nenhum Supabase). Lá ela
// morava dentro de uma função SQL; aqui ela roda no navegador sobre a lista que
// a tela já tem na mão, e por isso pode ser testada sem banco.
//
// A RÉGUA É DO DONO, escrita por ele na própria faixa de explicação da tela:
//
//   "todos os compradores do recorte, classificados pelo valor — A+ são os que
//    somam os primeiros 30%, A até 80%, B+ até 90%, B até 95%, C o resto.
//    Toque num cliente para o comportamento dele; grupos de CNPJ contam juntos."
//
// O A+ e o B+ não são enfeite: nasceram de olhar a discrepância DENTRO da
// classe A na Impresilk (o topo com R$ 2 milhões e o pé com R$ 35 mil na mesma
// caixa). E o corte é por SHARE, não por valor fixo: valor fixo envelhece e
// erra em cada recorte — o share é a régua da própria curva, e cada faixa desce
// com o menor valor dela para a tela poder dizer o corte em reais ("entra quem
// passa de R$ 6.161,49").
//
// ESTE ARQUIVO NÃO FORMATA NADA. Devolve números crus e frações; quem escreve
// "R$" e "%" é a tela, com moeda/moedaCheia de lib/format.js. No dia em que ele
// aprender a formatar, passa a errar em toda tela que não é de dinheiro.

import { diaLocalISO, ymdLocal } from "./format.js";

/* AS CINCO FAIXAS FINAS, com o teto do ACUMULADO de cada uma. A ordem importa:
   a classificação percorre esta lista de cima para baixo e para na primeira em
   que cabe. O teto da C é 1 (o resto, por definição) — sem ele um item de
   acumulado 0,99 não teria classe nenhuma. */
export const CLASSES = [
  { classe: "A+", rotulo: "A+", teto: 0.30 },
  { classe: "A", rotulo: "A", teto: 0.80 },
  { classe: "B+", rotulo: "B+", teto: 0.90 },
  { classe: "B", rotulo: "B", teto: 0.95 },
  { classe: "C", rotulo: "C", teto: 1 },
];

/* AS TRÊS FAIXAS GROSSAS — os cartões da tela. Pedido do dono: o cartão mostra
   a SOMA das irmãs (A+ e A juntas), e a diferença entre elas só abre no clique,
   como sub-cartões. `fatiaTipica` é só o que se espera de uma curva ABC sadia
   (80/15/5), para a tela poder dizer "esperado ~80%" ao lado do medido — NÃO é
   usada em conta nenhuma. */
export const FAIXAS = [
  { id: "A*", rotulo: "A", titulo: "Classe A", membros: ["A+", "A"], fatiaTipica: 0.80 },
  { id: "B*", rotulo: "B", titulo: "Classe B", membros: ["B+", "B"], fatiaTipica: 0.15 },
  { id: "C", rotulo: "C", titulo: "Classe C", membros: ["C"], fatiaTipica: 0.05 },
];

// De uma classe fina para o cartão que a contém — a tela acende o cartão certo
// quando alguém filtra "B+" sem ter tocado no cartão "Classe B".
export function faixaDaClasse(classe) {
  return FAIXAS.find((f) => f.membros.includes(classe)) || null;
}

/* Meio centavo de folga. Empate em dinheiro é igualdade em CENTAVOS: somar
   float não devolve o mesmo número que digitar o total (6161.489999999999 e
   6161.49 são o mesmo cliente), e duas notas que diferem de um centavo inteiro
   (0,01 > 0,005) continuam sendo valores diferentes. A comparação é sempre
   contra o PRIMEIRO do empate, nunca contra o anterior — senão uma fila de
   valores quase iguais se emendaria de dois em dois e formaria um empate que
   ninguém tem. */
const FOLGA_EMPATE = 0.005;

const centavos = (n) => Math.round(n * 100) / 100;
const numeroOuNulo = (v) => {
  // Number(null) e 0 e Number("") tambem — o coercitivo do JS transforma
  // ausencia em zero medido calado. Aqui ausencia continua ausencia.
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/* A classe sai do acumulado ANTES do item — o item que CRUZA o teto pertence à
   faixa de onde ele veio, não à de baixo. É a mesma conta da função SQL da
   Impresilk (`sum(valor) over (order by valor desc) - valor`). */
function classePeloAcumulado(fracaoAntes) {
  for (const c of CLASSES) if (fracaoAntes < c.teto) return c.classe;
  return CLASSES[CLASSES.length - 1].classe;
}

function resumoZerado() {
  return {
    classes: CLASSES.map((c) => ({
      classe: c.classe,
      rotulo: c.rotulo,
      teto: c.teto,
      quantidade: 0,
      valor: 0,
      participacao: null,
      corte: null,
    })),
    faixas: FAIXAS.map((f) => ({
      id: f.id,
      rotulo: f.rotulo,
      titulo: f.titulo,
      membros: f.membros,
      fatiaTipica: f.fatiaTipica,
      quantidade: 0,
      valor: 0,
      participacao: null,
      corte: null,
      partes: [],
    })),
  };
}

/**
 * A CURVA ABC de qualquer lista.
 *
 * curvaAbc(itens, { valorDe, chaveDe, rotuloDe })
 *
 * Devolve os itens ordenados pelo valor DESCENDENTE, cada um com `posicao`
 * (1-based, da curva INTEIRA — quem filtra a classe B tem de continuar vendo
 * "99º", não um ranking que recomeça do 1), `valor`, `participacao` (fração do
 * total), `acumulado` (fração acumulada até ele, inclusive) e `classe`.
 *
 * A CLASSE SAI DO ACUMULADO, NÃO DA POSIÇÃO. Faixa por contagem ("os 20
 * primeiros são A") é a versão errada da curva: ela responde "quantos", quando
 * a pergunta é "quanto dinheiro". Dez clientes que compraram exatamente o mesmo
 * valor cairiam em classes diferentes só pela ordem do desempate — e a ordem do
 * desempate é alfabética, quer dizer, é acaso. Por isso, além de classificar
 * pelo acumulado, os EMPATES SÃO NORMALIZADOS: um bloco de valores iguais
 * atravessa a fronteira como um corpo só e recebe inteiro a classe de onde o
 * bloco começou. Sem isso, o desempate — não o dinheiro — decidiria quem é A.
 *
 * `itens` de valor ZERO OU NEGATIVO não entram na curva: quem não comprou não
 * tem posição na curva de quem comprou. Empurrá-los para a classe C infla a
 * contagem da C e derruba o corte dela para R$ 0,00 — a tela passaria a
 * anunciar "entra quem passa de R$ 0,00", que é uma frase sem informação. Eles
 * voltam à parte, em `foraDaCurva`, contados.
 */
export function curvaAbc(itens, opcoes = {}) {
  const {
    valorDe = (x) => x?.valor,
    chaveDe = (x) => x?.chave,
    rotuloDe = (x) => x?.rotulo,
  } = opcoes;

  const lista = Array.isArray(itens) ? itens : [];
  const dentro = [];
  const fora = [];
  let semMedida = 0;

  for (const item of lista) {
    const chave = chaveDe(item);
    const rotulo = rotuloDe(item);
    const medido = numeroOuNulo(valorDe(item));
    // Arredonda ANTES de decidir quem entra: o teste tem de ser sobre o mesmo
    // numero que a tela vai mostrar, senao R$ 0,004 entra na curva valendo
    // R$ 0,00 e derruba o corte da classe C.
    const valor = medido === null ? null : centavos(medido);
    const linha = {
      chave: chave == null ? "" : String(chave),
      rotulo: rotulo == null || rotulo === "" ? String(chave ?? "") : String(rotulo),
      item,
      valor,
    };
    if (valor === null) semMedida += 1;
    if (valor !== null && valor > 0) dentro.push(linha);
    else fora.push(linha);
  }

  // Desempate alfabético pela chave: só para o resultado ser o MESMO em duas
  // leituras seguidas. Comparação de texto crua (não localeCompare) porque a
  // ordem do desempate não pode depender do idioma do aparelho.
  dentro.sort((a, b) => (b.valor - a.valor) || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));

  const total = centavos(dentro.reduce((t, l) => t + l.valor, 0));
  const vazio = dentro.length === 0;

  const { classes, faixas } = resumoZerado();
  const porClasse = new Map(classes.map((c) => [c.classe, c]));
  const curva = [];

  let acumulado = 0; // em reais, INCLUSIVE do que já entrou
  let i = 0;
  while (i < dentro.length) {
    // O bloco de empatados: todos os seguintes a meio centavo do primeiro.
    let fim = i;
    while (fim + 1 < dentro.length && Math.abs(dentro[fim + 1].valor - dentro[i].valor) <= FOLGA_EMPATE) {
      fim += 1;
    }
    const classe = classePeloAcumulado(total > 0 ? acumulado / total : 0);
    for (let k = i; k <= fim; k += 1) {
      const l = dentro[k];
      acumulado += l.valor;
      curva.push({
        chave: l.chave,
        rotulo: l.rotulo,
        item: l.item,
        valor: l.valor,
        posicao: k + 1,
        participacao: total > 0 ? l.valor / total : null,
        acumulado: total > 0 ? acumulado / total : null,
        classe,
      });
      const b = porClasse.get(classe);
      b.quantidade += 1;
      b.valor += l.valor;
      // O CORTE é o menor valor que entrou na faixa — o "entra quem passa de
      // R$ 6.161,49" do cartão. Faixa vazia fica com corte NULO, nunca zero:
      // zero se lê como "entra qualquer um", que é o contrário de vazia.
      b.corte = b.corte === null ? l.valor : Math.min(b.corte, l.valor);
    }
    i = fim + 1;
  }

  for (const b of classes) {
    b.valor = centavos(b.valor);
    b.corte = b.corte === null ? null : centavos(b.corte);
    b.participacao = total > 0 ? b.valor / total : null;
  }
  for (const f of faixas) {
    const partes = f.membros.map((m) => porClasse.get(m));
    const cortes = partes.map((p) => p.corte).filter((c) => c !== null);
    f.partes = partes;
    f.quantidade = partes.reduce((t, p) => t + p.quantidade, 0);
    f.valor = centavos(partes.reduce((t, p) => t + p.valor, 0));
    f.participacao = total > 0 ? f.valor / total : null;
    f.corte = cortes.length ? Math.min(...cortes) : null;
  }

  return {
    /* `vazio` existe para a tela poder dizer "ninguém comprou neste recorte" em
       vez de mostrar um quadro em branco, que se lê como "não carregou". E os
       dois números ao lado terminam de contar a história: `recebidos` = 0 é
       lista que não chegou; `recebidos` = 40 com `foraDaCurva.quantidade` = 40
       é gente cadastrada que não comprou nada. São coisas diferentes e a tela
       tem de falar diferente de cada uma. */
    vazio,
    recebidos: lista.length,
    total,
    curva,
    classes,
    faixas,
    foraDaCurva: {
      quantidade: fora.length,
      valor: centavos(fora.reduce((t, l) => t + (l.valor || 0), 0)),
      semMedida, // sem número nenhum (nulo, texto, NaN): ausência, não zero
      itens: fora,
    },
  };
}

/**
 * GRUPOS DE CNPJ — "grupos de CNPJ contam juntos", da faixa de explicação.
 *
 * agruparPor(itens, mapaDeGrupos, { chaveDe, valorDe })
 *
 * `mapaDeGrupos` é { chaveOriginal: nomeDoGrupo }. Quem não está no mapa fica
 * sozinho, com a própria chave. Devolve, para cada linha, de quantas chaves ela
 * foi feita (`chaves`) e se veio do mapa (`ehGrupo`) — é o selo "grupo" da
 * tela.
 *
 * O AGRUPAMENTO VEM ANTES DA CURVA, nunca depois: o dono que compra por três
 * CNPJs aparece três vezes no meio da lista e sobe para a classe certa quando
 * os três somam. Somar as classes depois de classificar em separado daria
 * outra resposta — e a errada.
 *
 * A ordem devolvida é a de primeira aparição; ranking e posição são assunto de
 * curvaAbc, que recalcula tudo sobre a lista já somada.
 */
export function agruparPor(itens, mapaDeGrupos, opcoes = {}) {
  const { chaveDe = (x) => x?.chave, valorDe = (x) => x?.valor } = opcoes;
  const mapa = mapaDeGrupos && typeof mapaDeGrupos === "object" ? mapaDeGrupos : {};
  const lista = Array.isArray(itens) ? itens : [];
  const baldes = new Map();

  for (const item of lista) {
    const original = chaveDe(item);
    const chaveTexto = original == null ? "" : String(original);
    const nomeGrupo = Object.prototype.hasOwnProperty.call(mapa, chaveTexto) ? mapa[chaveTexto] : null;
    const ehGrupo = nomeGrupo != null && nomeGrupo !== "";
    /* Balde com prefixo: um cliente avulso que por acaso se chame igual a um
       grupo não pode cair dentro dele em silêncio. Ficam duas linhas — e é
       `ehGrupo` que as distingue, inclusive na chave de render da tela. */
    const idBalde = ehGrupo ? `g:${nomeGrupo}` : `s:${chaveTexto}`;
    let b = baldes.get(idBalde);
    if (!b) {
      b = {
        chave: ehGrupo ? String(nomeGrupo) : chaveTexto,
        rotulo: ehGrupo ? String(nomeGrupo) : chaveTexto,
        ehGrupo,
        chaves: [],
        valor: 0,
        itens: [],
      };
      baldes.set(idBalde, b);
    }
    if (!b.chaves.includes(chaveTexto)) b.chaves.push(chaveTexto);
    const v = numeroOuNulo(valorDe(item));
    if (v !== null) b.valor += v;
    b.itens.push(item);
  }

  return [...baldes.values()].map((b) => ({ ...b, valor: centavos(b.valor) }));
}

/* A data de um registro, em AAAA-MM-DD LOCAL. Nunca slice(0,10) de timestamp
   UTC: depois das 21h no Brasil isso devolve o dia de AMANHÃ, e a venda de
   terça à noite entra no mês seguinte quando cai na virada. */
function diaDe(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : ymdLocal(v);
  if (v == null || v === "") return null;
  const dia = diaLocalISO(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null;
}

function agruparNoTempo(itens, opcoes, tamanhoDaChave, nomeDoCampo) {
  const { dataDe = (x) => x?.data, valorDe = (x) => x?.valor } = opcoes || {};
  const lista = Array.isArray(itens) ? itens : [];
  const baldes = new Map();
  const semData = { quantidade: 0, valor: 0 };
  let semMedida = 0;

  for (const item of lista) {
    const dia = diaDe(dataDe(item));
    const v = numeroOuNulo(valorDe(item));
    if (v === null) semMedida += 1;
    if (dia === null) {
      // Registro sem data não some: some do gráfico e aparece contado ao lado.
      // Corte calado é o jeito de a soma da tela nunca bater com a do ERP.
      semData.quantidade += 1;
      semData.valor += v || 0;
      continue;
    }
    const chave = dia.slice(0, tamanhoDaChave);
    let b = baldes.get(chave);
    if (!b) {
      b = { [nomeDoCampo]: chave, ano: dia.slice(0, 4), valor: 0, quantidade: 0 };
      baldes.set(chave, b);
    }
    b.valor += v || 0;
    b.quantidade += 1;
  }

  /* Só os períodos COM movimento. Mês sem registro é ausência, não zero — se
     este arquivo preenchesse a grade de 12 casas, entregaria onze zeros que a
     tela desenharia como "vendeu nada", inclusive nos meses que ainda não
     chegaram. Quem quiser a grade fechada monta na tela, que sabe qual é hoje. */
  const casas = [...baldes.values()]
    .sort((a, b) => (a[nomeDoCampo] < b[nomeDoCampo] ? -1 : 1))
    .map((b) => ({ ...b, valor: centavos(b.valor) }));

  return {
    casas,
    semData: { ...semData, valor: centavos(semData.valor) },
    semMedida,
    total: centavos(casas.reduce((t, b) => t + b.valor, 0)),
  };
}

/** O comportamento no tempo, mês a mês — o detalhe que abre no toque.
 *  Devolve { meses: [{ mes:"AAAA-MM", ano, valor, quantidade }], semData, total }. */
export function porMes(itens, opcoes = {}) {
  const r = agruparNoTempo(itens, opcoes, 7, "mes");
  return { meses: r.casas, semData: r.semData, semMedida: r.semMedida, total: r.total };
}

/** O mesmo, ano a ano.
 *  Devolve { anos: [{ ano:"AAAA", valor, quantidade }], semData, total }. */
export function porAno(itens, opcoes = {}) {
  const r = agruparNoTempo(itens, opcoes, 4, "ano");
  return {
    anos: r.casas.map(({ ano, valor, quantidade }) => ({ ano, valor, quantidade })),
    semData: r.semData,
    semMedida: r.semMedida,
    total: r.total,
  };
}
