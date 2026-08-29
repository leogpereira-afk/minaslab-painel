// Ponto → aba RELATÓRIOS. O que sai do ponto em PAPEL e em PLANILHA.
//
// Pedido do Leonardo (28/08/2026): "quero relatório ano, mês e dia e comparação
// de período, para saber qual funcionário chega no horário etc, e ser possível
// baixar em pdf". São quatro perguntas diferentes, e cada uma virou uma visão:
//
//   DIA       quem estava aqui hoje, a que horas chegou e quanto deve
//   MÊS       uma linha por pessoa, com o mês inteiro somado e ordenável
//   ANO       uma linha por pessoa e doze colunas: a TENDÊNCIA, não o total
//   COMPARAR  dois períodos livres lado a lado, com a diferença explicada
//
// ESTA ABA NÃO GRAVA NADA — não recebe `gravar` nem `apagarReg`. Relatório que
// altera o dado que ele mesmo mostra é o jeito mais rápido de perder a
// confiança no número.
//
// ============================================================================
// AS DECISÕES DESTA TELA
//
// 1. EXISTEM DOIS ATRASOS, E ELES NÃO SE SOMAM. O relatório mostra o da
//    PONTUALIDADE: a batida de entrada contra o começo previsto pela escala,
//    com a tolerância do art. 58 § 1º já aplicada (atrasoDoDia). O outro — o
//    saldo trabalhado-contra-previsto que vira desconto na folha
//    (apurarCompetencia().atrasosMin) — mora na aba Fechamento e continua lá.
//    Somar as duas réguas cobraria o mesmo atraso duas vezes; mostrar uma sem
//    dizer qual é faria o RH descontar pelo número errado. Por isso a coluna se
//    chama "Atrasos na chegada" e a tela escreve, em toda visão, que este
//    número não é o do desconto.
//
// 2. TOLERÂNCIA É TUDO OU NADA. Até 5 min por marcação e 10 no dia não são
//    atraso (CLT art. 58 § 1º, Súmula 366 do TST); passando disso conta-se a
//    TOTALIDADE, não o excedente. Quem faz essa conta é a lib — aqui a tela só
//    DIZ, em voz alta, que o número já sai com a tolerância aplicada. Número de
//    atraso sem essa frase ao lado é acusação sem régua.
//
// 3. PONTUALIDADE SEM DIA MEDIDO É "sem registro", NUNCA 0%. Zero por cento
//    leria como "nunca chega no horário" — o oposto exato do que o dado diz de
//    quem estava de férias o mês inteiro. É a mesma regra do resto da casa
//    (dado ausente não é zero), no lugar onde ela seria mais cara.
//
// 4. PORCENTAGEM SOBRE BASE ZERO NÃO EXISTE. Na comparação, período anterior
//    zerado (ou sem medição) escreve "sem base para comparar" — nunca "+100%",
//    nunca ∞. Quem foi de 0 para 3 faltas não piorou "cem por cento": passou a
//    ter faltas, e é isso que a tela escreve.
//
// 5. PERÍODOS DE TAMANHOS DIFERENTES NÃO SE COMPARAM PELO TOTAL. 30 dias contra
//    15 dá o dobro de horas sem ninguém ter trabalhado mais. A tela avisa
//    quando os dois períodos têm quantidades diferentes de DIAS DE ESCALA e
//    mostra a média por dia ao lado do total, sempre.
//
// 6. NULL NUNCA VIRA ZERO NUMA SOMA (somaOuNulo). Uma pessoa sem apuração não
//    baixa o total do grupo: ela não entra. E se ninguém tiver medição, o total
//    é "sem registro" — não é zero.
//
// 7. O RECORTE VAI IMPRESSO. Relatório de ponto que circula sem dizer de qual
//    período é, de qual filtro saiu, quando foi emitido e QUANDO O RELÓGIO FOI
//    IMPORTADO PELA ÚLTIMA VEZ é papel perigoso: alguém desconta de um mês
//    achando que o dia de ontem já entrou. O bloco `.apenas-impressao` diz as
//    quatro coisas.
//
// ============================================================================
// CONTRATO — props que esta aba recebe da casca (pages/Ponto.jsx)
// ----------------------------------------------------------------------------
//   pessoas   Object[]  todas as fichas (rh_pessoas), ativas e desligadas. O
//                       relatório de um mês passado precisa do nome de quem já
//                       saiu — quem foi desligado no dia 15 trabalhou até o 15.
//   ativos    Object[]  só quem está no quadro, JÁ ordenado por nome.
//   ponto     Object[]  coleção "rh_ponto" — o FECHAMENTO por pessoa/mês. Aqui
//                       ele responde UMA pergunta: este mês já foi conferido e
//                       fechado? (ver o comentário em COLUNAS_MES).
//   pontoDia  Object[]  coleção "rh_ponto_dia" INTEIRA (todos os meses) — é o
//                       dia a dia que sustenta as quatro visões.
//   hojeISO   string    "AAAA-MM-DD" LOCAL (ymdLocal).
//   setAviso  (aviso|null) => void   { tipo: "ok" | "erro", texto }.
//
// A competência (e o dia, e o ano, e os dois períodos) é DESTA ABA: a casca não
// guarda o mês — ver o comentário longo em pages/Ponto.jsx.
//
// A configuração global (jornada, divisor, fatores) vem de lerCfg(). Enquanto
// ela não chega, vale o padrão da casa E A TELA DIZ ISSO: previsto e atraso
// saem da escala, e escala suposta em silêncio é atraso inventado.

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  AlarmClock, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CalendarOff, ChevronDown, ChevronUp,
  CircleAlert, Clock, Download, Minus, Percent, Printer, Settings2, Users,
} from "lucide-react";
import { lerCfg } from "../../services/dados.js";
import { dataCurta, dataLonga, diasEntre, ymdLocal, MESES, MESES_LONGOS } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import {
  apuracaoDoRelogio, apurarCompetencia, atrasoDoDia, ausenciaDoDia, cfgDoPonto, competenciaDe,
  descreverJornada, diaDaSemanaISO, diasDoMes, divisorDaJornada, duracaoTexto, ehCompetencia, fimPrevistoDoDia,
  horasDecimais, inicioPrevistoDoDia, minutosPrevistosDoDia, minutosPrevistosDoMes,
  minutosTrabalhados, NOMES_DIA_SEMANA, TOLERANCIA_DIA_MIN, TOLERANCIA_MARCACAO_MIN,
} from "../../lib/rh/ponto.js";
import { Card, Empty, Modal, SectionTitle, Segmented, StatCard } from "../ui.jsx";

// ============================================================================
// PALAVRAS E NÚMEROS — o vocabulário que as quatro visões dividem
// ============================================================================

const VISOES = [
  { valor: "dia", rotulo: "Dia" },
  { valor: "mes", rotulo: "Mês" },
  { valor: "ano", rotulo: "Ano" },
  { valor: "comparar", rotulo: "Comparar" },
];

/** A frase única para ausência de dado. Uma só, para a tela nunca hesitar. */
const SEM = "sem registro";
/** Ausência de MEDIÇÃO, que é outra coisa: houve o dia, ninguém apurou a faixa. */
const SEM_APURACAO = "sem apuração";

const TODAS = "__todas__";

const txt = (v) => String(v ?? "").trim();
const norm = (s) => String(s || "").toLowerCase();
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const ehData = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

/**
 * Número que pode não existir — a mesma régua da lib: "" e null NÃO são 0.
 * Number("") devolve 0, e é assim que "não veio" vira "foi zero" na planilha.
 */
const numOuNulo = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const horasOuNada = (min) => duracaoTexto(min) || SEM;
const horasOuSemApuracao = (min) => duracaoTexto(min) || SEM_APURACAO;

function rotuloCompetencia(c) {
  const [ano, mes] = String(c || "").split("-");
  const nome = MESES_LONGOS[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : String(c || "");
}

/**
 * SOMA QUE NÃO INVENTA ZERO.
 *
 * `null` não entra na conta (não é 0: é "não medi"), e quando NINGUÉM tem
 * número o total sai null — não sai 0. A diferença aparece no rodapé de toda
 * tabela daqui: "sem registro" é a linha que ainda não foi apurada; "0h00" é a
 * que foi apurada e deu zero.
 */
function somaOuNulo(valores) {
  let total = 0;
  let algum = false;
  for (const v of valores) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    total += v;
    algum = true;
  }
  return algum ? total : null;
}

/** Instante do servidor ("...T14:32:10Z") → "28/08/2026 às 11:32" no fuso de quem lê. */
function instanteLocal(iso) {
  const t = new Date(String(iso ?? ""));
  if (Number.isNaN(t.getTime())) return null;
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return `${dataLonga(ymdLocal(t))} às ${hh}:${mm}`;
}

/**
 * QUANDO O RELÓGIO FOI IMPORTADO PELA ÚLTIMA VEZ.
 *
 * O carimbo é da ponte (ml-ponto grava `atualizadoPor: "jibble"` e
 * `atualizadoEm` em todo dia que traz). Só esses contam: dia corrigido à mão
 * tem outro autor, e usá-lo faria a folha dizer que o relógio rodou quando
 * quem rodou foi uma pessoa.
 *
 * Nenhum carimbo devolve null, e a tela escreve "não sei dizer" — dizer
 * "nunca importado" seria afirmar sobre o Jibble a partir da ausência de um
 * campo que pode simplesmente ser velho.
 */
function ultimaImportacao(pontoDia) {
  let maior = "";
  for (const d of pontoDia || []) {
    if (txt(d.atualizadoPor) !== "jibble") continue;
    const q = txt(d.atualizadoEm);
    if (q > maior) maior = q;
  }
  return maior ? instanteLocal(maior) : null;
}

// ---- datas -----------------------------------------------------------------

/** "AAAA-MM-DD" + n dias, em data LOCAL (nada de UTC, que volta um dia no Brasil). */
function somarDias(iso, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return iso;
  return ymdLocal(new Date(+m[1], +m[2] - 1, +m[3] + n));
}

/** Dias CORRIDOS de um intervalo fechado dos dois lados. 1º a 1º = 1 dia. */
function diasCorridos(de, ate) {
  if (!ehData(de) || !ehData(ate)) return null;
  const n = diasEntre(de, ate) + 1;
  return n > 0 ? n : null;
}

/**
 * As datas de um intervalo, uma a uma.
 *
 * TETO DE SEGURANÇA: dez anos. Ano digitado errado ("20026-01-01") pediria
 * dezoito mil anos de laço e travaria a aba sem dizer por quê — com o teto, a
 * tela devolve o que cabe e o aviso de período inválido aparece antes.
 */
function datasDoIntervalo(de, ate) {
  if (!ehData(de) || !ehData(ate) || de > ate) return [];
  const out = [];
  let atual = de;
  while (atual <= ate && out.length < 3660) {
    out.push(atual);
    atual = somarDias(atual, 1);
  }
  return out;
}

/**
 * Quantos dias do intervalo a ESCALA prevê trabalho — o denominador honesto da
 * média diária.
 *
 * Estourou o teto do laço (ano digitado errado): devolve null, e a média sai
 * como "sem registro". Devolver a contagem truncada daria um denominador
 * errado, e denominador errado é média errada com cara de número certo.
 */
function diasDeEscala(de, ate, jornada) {
  const datas = datasDoIntervalo(de, ate);
  if (datas.length >= 3660) return null;
  return datas.filter((iso) => (minutosPrevistosDoDia(iso, jornada) ?? 0) > 0).length;
}

/** "2026-08" → "2026-07". Texto puro: mês não se calcula com Date. */
function competenciaAnterior(c) {
  const [ano, mes] = String(c || "").split("-").map(Number);
  if (!ano || !mes) return c;
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;
}

const primeiroDiaDoMes = (c) => `${c}-01`;
const ultimoDiaDoMes = (c) => diasDoMes(c).slice(-1)[0] || `${c}-28`;

// ============================================================================
// O ÍNDICE — os dias de rh_ponto_dia, resolvidos por pessoa, UMA vez
// ============================================================================

/**
 * ID MANDA, NOME SÓ EXIBE: o dia casa com a ficha por `pessoaId` ou por
 * `jibbleId`. Nome nunca — nome igual entre duas pessoas cria sósia, e nome que
 * mudou some com o dia inteiro.
 *
 * DIA REPETIDO NÃO SOMA DUAS VEZES. O mesmo dia aparece duplicado quando
 * alguém lançou à mão antes de a pessoa ser vinculada e a importação trouxe o
 * mesmo dia depois (ids diferentes, pdm_… e pd_…). Vale o corrigido — o que
 * alguém conferiu — e o repetido sai CONTADO, para a tela dizer que existe.
 *
 * BATIDA ÓRFÃ NÃO SOME: entra na contagem de pendências com o nome que o
 * relógio mandou. Sumir esconderia trabalho de gente real, e órfão quase sempre
 * é id variante — se reconecta, não se descarta.
 */
function montarIndice(pessoas, pontoDia) {
  const porId = new Map((pessoas || []).map((p) => [p.id, p]));
  const porJibble = new Map();
  for (const p of pessoas || []) {
    const j = txt(p.jibbleId);
    if (j) porJibble.set(j, p);
  }

  const porPessoa = new Map(); // pessoaId → { pessoa, dias: Map(data → dia) }
  const orfaos = new Map(); // jibbleId → { jibbleId, nomeNoRelogio, dias }
  let repetidos = 0;
  let semData = 0;

  for (const d of pontoDia || []) {
    const pessoa =
      (d.pessoaId && porId.get(d.pessoaId)) || (txt(d.jibbleId) && porJibble.get(txt(d.jibbleId))) || null;

    if (!pessoa) {
      const chave = txt(d.jibbleId) || "(sem id no relógio)";
      const g = orfaos.get(chave) || { jibbleId: chave, nomeNoRelogio: "", dias: 0 };
      g.dias += 1;
      if (!g.nomeNoRelogio && d.pessoaNome) g.nomeNoRelogio = d.pessoaNome;
      orfaos.set(chave, g);
      continue;
    }

    // Data ilegível não entra em recorte de período nenhum (não há onde
    // colocá-la), mas sai contada: registro que some calado é problema
    // escondido, e o Fechamento continua enxergando esse dia.
    if (!ehData(d.data)) {
      semData += 1;
      continue;
    }

    let grupo = porPessoa.get(pessoa.id);
    if (!grupo) {
      grupo = { pessoa, dias: new Map() };
      porPessoa.set(pessoa.id, grupo);
    }
    const atual = grupo.dias.get(d.data);
    if (!atual) {
      grupo.dias.set(d.data, d);
      continue;
    }
    repetidos += 1;
    if (d.corrigido === true && atual.corrigido !== true) grupo.dias.set(d.data, d);
  }

  return { porPessoa, orfaos: [...orfaos.values()], repetidos, semData };
}

/** Os dias de uma pessoa dentro de um intervalo fechado, em ordem de data. */
function diasNoPeriodo(grupo, de, ate) {
  if (!grupo) return [];
  const out = [];
  for (const [data, d] of grupo.dias) {
    if (data >= de && data <= ate) out.push(d);
  }
  return out.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

/**
 * Quem entra no relatório de um período: o QUADRO DE HOJE mais quem teve dia
 * no período. Desligada no dia 15 trabalhou até o dia 15 — some da lista e some
 * do relatório, e o mês fecha sem ela.
 */
function pessoasDoPeriodo(ativos, indice, de, ate) {
  const lista = [...(ativos || [])];
  const jaTem = new Set(lista.map((p) => p.id));
  for (const [id, grupo] of indice.porPessoa) {
    if (jaTem.has(id)) continue;
    if (diasNoPeriodo(grupo, de, ate).length === 0) continue;
    jaTem.add(id);
    lista.push(grupo.pessoa);
  }
  return lista.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));
}

// ============================================================================
// A AGREGAÇÃO — a régua única das visões Mês, Ano e Comparar
// ============================================================================

/**
 * O que um punhado de dias diz sobre uma pessoa.
 *
 * A parte do trabalho (horas da folha, extras, faltas, ausências) é
 * `apurarCompetencia`, a MESMA que o Fechamento usa — o relatório não pode ter
 * uma segunda opinião sobre o mês que o RH fechou.
 *
 * A parte da PONTUALIDADE é somada aqui, dia a dia, com `atrasoDoDia`:
 *  - `diasMedidos` são os dias em que dava para medir (a escala prevê trabalho
 *    E existe entrada batida). Fim de semana e dia sem batida não entram — e é
 *    por isso que a porcentagem não engana.
 *  - `atrasoChegadaMin` é a soma do que a TOLERÂNCIA DEIXA COBRAR, não do
 *    atraso cru. Os dois números existem na lib; este é o defensável.
 *  - tudo vira null quando `diasMedidos` é 0. Zero dia medido não é "chegou
 *    sempre na hora" nem "nunca chegou": é não ter havido o que medir.
 */
function agregar(dias, jornada) {
  const ap = apurarCompetencia(dias, jornada);

  let medidos = 0;
  let pontuais = 0;
  let atrasoMin = 0;
  for (const d of dias) {
    const p = atrasoDoDia(d, jornada);
    if (!p) continue;
    medidos += 1;
    if (p.pontual) pontuais += 1;
    atrasoMin += p.atrasoMin;
  }

  /* PERÍODO SEM NENHUM DIA NÃO TEM CONTAGEM ZERO — tem ausência de contagem.
     `apurarCompetencia` devolve 0 nas ausências, e ali o 0 é medida de verdade:
     o mês foi percorrido e ninguém lançou nada. Aqui não há mês percorrido —
     não existe uma linha sequer daquela pessoa naquele período (ela ainda não
     tinha entrado na casa, ou o relógio não trouxe nada). Deixar o 0 passar
     escreveria "0 faltas em janeiro" na coluna de quem foi admitido em agosto,
     e é justamente a leitura que a tabela de doze colunas convida a fazer. */
  const semNenhumDia = dias.length === 0;
  const contado = (n) => (semNenhumDia ? null : n);

  return {
    ...ap,
    diasComBatida: contado(ap.diasComBatida),
    diasEmAberto: contado(ap.diasEmAberto),
    ausenciasTotal: contado(ap.ausenciasTotal),
    faltasQueDescontam: contado(ap.faltasQueDescontam),
    ausenciasSemDesconto: contado(ap.ausenciasSemDesconto),
    ausenciasDesconhecidas: contado(ap.ausenciasDesconhecidas),
    diasComRegistro: dias.length,
    diasMedidos: medidos,
    diasPontuais: medidos > 0 ? pontuais : null,
    pontualidadePct: medidos > 0 ? (pontuais / medidos) * 100 : null,
    atrasoChegadaMin: medidos > 0 ? atrasoMin : null,
    atrasoMedioMin: medidos > 0 ? Math.round(atrasoMin / medidos) : null,
  };
}

// ---- as medidas (o número que o Ano e o Comparar escolhem) -----------------

/**
 * `sentido` é o que a seta de melhorou/piorou pode afirmar:
 *   "maisEhMelhor"   pontualidade — subir é melhorar
 *   "menosEhMelhor"  atraso e falta — subir é piorar
 *   "neutro"         horas e extras — subiram, e dizer se isso é bom depende do
 *                    mês; a tela escreve "subiu"/"desceu" e não julga. Hora
 *                    extra a mais pode ser entrega salva ou custo fora do
 *                    controle, e não é o relatório que decide qual.
 */
const MEDIDAS = [
  {
    chave: "horas",
    rotulo: "Horas da folha",
    unidade: "horas",
    sentido: "neutro",
    valor: (a) => a.trabalhadoMin,
    ajuda: "O que o relógio apurou para a folha (payrollHours), somado. Dia em aberto não entra.",
  },
  {
    chave: "extra",
    rotulo: "Extra +50%",
    unidade: "horas",
    sentido: "neutro",
    valor: (a) => a.extrasMin,
    ajuda: "Hora extra de dia normal, apurada pelo relógio (ou derivada, no dia lançado à mão).",
  },
  {
    chave: "extraDobro",
    rotulo: "Extra +100%",
    unidade: "horas",
    sentido: "neutro",
    valor: (a) => a.extrasDobroMin,
    ajuda: "Extra de descanso, feriado ou dobra. Sem dia apurado pelo relógio, fica sem apuração.",
  },
  {
    chave: "atrasos",
    rotulo: "Atrasos na chegada",
    unidade: "horas",
    sentido: "menosEhMelhor",
    valor: (a) => a.atrasoChegadaMin,
    ajuda: `Entrada batida contra o começo previsto pela escala, com a tolerância da CLT já aplicada (${TOLERANCIA_MARCACAO_MIN} min por marcação, ${TOLERANCIA_DIA_MIN} no dia). NÃO é o atraso que desconta na folha.`,
  },
  {
    chave: "faltas",
    rotulo: "Faltas que descontam",
    unidade: "dias",
    sentido: "menosEhMelhor",
    valor: (a) => a.faltasQueDescontam,
    ajuda: "Dias de falta injustificada LANÇADOS. Dia sem batida e sem lançamento é sem registro, não é falta.",
  },
  {
    chave: "pontualidade",
    rotulo: "Pontualidade",
    unidade: "pct",
    sentido: "maisEhMelhor",
    somavel: false,
    valor: (a) => a.pontualidadePct,
    ajuda: "Porcentagem dos dias medidos em que não havia nada a cobrar na chegada.",
  },
];

const medidaDe = (chave) => MEDIDAS.find((m) => m.chave === chave) || MEDIDAS[0];

/** O número da medida em palavras. null vira "sem registro" — nunca 0. */
function textoDaMedida(v, unidade) {
  if (v === null || v === undefined) return SEM;
  if (unidade === "horas") return duracaoTexto(v);
  if (unidade === "pct") return `${Math.round(v)}%`;
  return String(v);
}

/** O número da medida para a PLANILHA: número de verdade, nunca texto. */
function numeroDaMedida(v, unidade) {
  if (v === null || v === undefined) return null;
  if (unidade === "horas") return horasDecimais(v);
  if (unidade === "pct") return Math.round(v * 10) / 10;
  return v;
}

/**
 * A MÉDIA POR DIA, escrita na régua de cada unidade.
 *
 * Dia de falta não se arredonda para inteiro: 3 faltas em 21 dias de escala
 * viraria "0" e a coluna diria que ninguém faltou. Fração de dia se escreve
 * com casas; hora se escreve como hora.
 */
function textoPorDia(v, dias, unidade) {
  if (v === null || v === undefined || !dias) return null;
  const porDia = v / dias;
  if (unidade === "horas") return duracaoTexto(Math.round(porDia));
  return (Math.round(porDia * 100) / 100).toLocaleString("pt-BR");
}

/**
 * O total de um grupo, na régua certa de cada medida.
 *
 * PONTUALIDADE NÃO SE SOMA E NÃO É MÉDIA DE MÉDIAS: é a razão dos dias
 * juntados (pontuais ÷ medidos). Quem trabalhou 2 dias e quem trabalhou 22 não
 * pesam igual na pontualidade da casa — e a média de porcentagens faria
 * exatamente isso.
 */
function totalDaMedida(medida, agregados) {
  if (medida.chave === "pontualidade") {
    const medidos = agregados.reduce((s, a) => s + a.diasMedidos, 0);
    const pontuais = agregados.reduce((s, a) => s + (a.diasPontuais ?? 0), 0);
    return medidos > 0 ? (pontuais / medidos) * 100 : null;
  }
  return somaOuNulo(agregados.map((a) => medida.valor(a)));
}

// ---- a comparação ----------------------------------------------------------

/**
 * A diferença entre dois períodos, e o que se pode HONESTAMENTE dizer dela.
 *
 * Sem número em um dos lados não há diferença nenhuma a afirmar (null não é
 * zero: "não medi" menos 5 não é −5).
 *
 * BASE ZERO NÃO TEM PORCENTAGEM. Dividir por zero dá Infinity, e Infinity
 * impresso como "+∞%" ou disfarçado de "+100%" é o número que faz alguém
 * chamar a pessoa na sala. Quem foi de 0 para 3 faltas passou A TER faltas — e
 * é isso que a tela escreve.
 */
function compararValores(anterior, novo) {
  if (anterior === null || anterior === undefined || novo === null || novo === undefined) {
    return { diferenca: null, pct: null, motivo: "sem registro num dos períodos" };
  }
  const diferenca = novo - anterior;
  if (anterior === 0) return { diferenca, pct: null, motivo: "sem base para comparar" };
  return { diferenca, pct: (diferenca / Math.abs(anterior)) * 100, motivo: "" };
}

/** A palavra da variação. É ela que informa — a seta só acompanha. */
function sentidoDaVariacao(medida, diferenca) {
  if (diferenca === null || diferenca === undefined) return "sem comparação";
  if (diferenca === 0) return "sem mudança";
  const subiu = diferenca > 0;
  if (medida.sentido === "maisEhMelhor") return subiu ? "melhorou" : "piorou";
  if (medida.sentido === "menosEhMelhor") return subiu ? "piorou" : "melhorou";
  return subiu ? "subiu" : "desceu";
}

// ============================================================================
// PEÇAS DE TELA — declaradas FORA da página (componente aninhado remonta a cada
// render, perde o foco do campo, e o lint da casa reprova)
// ============================================================================

/** Ausência de dado, com a palavra escrita. Cinza na tela, palavra no papel. */
function Nada({ children }) {
  return <span className="text-slate-400">{children || SEM}</span>;
}

/** Cabeçalho de coluna que ordena. Sem `.btn-*`: no papel ele imprime o rótulo. */
function ThOrdenavel({ col, ordem, aoOrdenar, className }) {
  const ativa = ordem.chave === col.chave;
  return (
    <th scope="col" className={clsx("px-3 py-2 align-bottom", className)} title={col.ajuda || undefined}>
      <button
        type="button"
        onClick={() => aoOrdenar(col.chave)}
        className={clsx(
          "inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wide",
          ativa ? "text-brand-700" : "hover:text-slate-700"
        )}
        aria-label={`Ordenar por ${col.rotulo}`}
      >
        {col.rotulo}
        {ativa && (
          <span className="sem-impressao">
            {ordem.dir === "asc" ? <ChevronUp size={13} strokeWidth={2.6} /> : <ChevronDown size={13} strokeWidth={2.6} />}
          </span>
        )}
      </button>
    </th>
  );
}

/**
 * A variação em uma célula: seta, número e A PALAVRA.
 *
 * A palavra é obrigatória porque a folha impressa sai em cinza — uma seta
 * vermelha e uma verde viram o mesmo traço, e o sentido some justamente no
 * papel que circula pela mesa dos outros.
 */
function Variacao({ medida, valorA, valorB }) {
  const { diferenca, pct, motivo } = compararValores(valorA, valorB);
  const palavra = sentidoDaVariacao(medida, diferenca);
  const tom =
    palavra === "melhorou" ? "text-ok-700" : palavra === "piorou" ? "text-bad-700" : "text-slate-600";
  const Icone = diferenca === null || diferenca === 0 ? Minus : diferenca > 0 ? ArrowUpRight : ArrowDownRight;

  if (diferenca === null) {
    return (
      <div className="leading-tight">
        <Nada>{motivo}</Nada>
      </div>
    );
  }

  const sinal = diferenca > 0 ? "+" : diferenca < 0 ? "−" : "";
  const bruto =
    medida.unidade === "horas"
      ? duracaoTexto(Math.abs(diferenca))
      : medida.unidade === "pct"
        ? `${Math.round(Math.abs(diferenca))} p.p.`
        : String(Math.abs(diferenca));

  return (
    <div className={clsx("leading-tight", tom)}>
      <span className="inline-flex items-center gap-1 font-display font-semibold tnum">
        <Icone size={14} strokeWidth={2.6} className="sem-impressao" />
        {sinal}
        {bruto}
      </span>
      <span className="ml-1.5 text-xs">{palavra}</span>
      <div className="text-xs tnum">
        {pct === null ? (
          <Nada>{motivo}</Nada>
        ) : (
          `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(Math.round(pct))}%`
        )}
      </div>
    </div>
  );
}

/**
 * O RECORTE, impresso. Só existe no papel (`apenas-impressao`).
 *
 * Quatro coisas, e nenhuma é decoração: de qual período é a folha, de qual
 * filtro ela saiu, quando foi emitida e QUANDO O RELÓGIO FOI IMPORTADO PELA
 * ÚLTIMA VEZ. Sem a última, alguém desconta um mês achando que ontem já entrou.
 */
function RecorteImpresso({ titulo, recorte, jornadaEmPalavras, emitidoEm, importadoEm }) {
  return (
    <div className="apenas-impressao mb-3">
      <p className="font-display text-sm font-bold">{titulo}</p>
      <p className="text-xs">Recorte: {recorte}</p>
      <p className="text-xs">Escala usada como previsto: {jornadaEmPalavras}</p>
      <p className="text-xs">
        Atrasos com a tolerância da CLT já aplicada ({TOLERANCIA_MARCACAO_MIN} min por marcação,{" "}
        {TOLERANCIA_DIA_MIN} no dia) — não é o atraso que desconta na folha.
      </p>
      <p className="text-xs">
        Emitido em {dataLonga(emitidoEm)} · Última importação do relógio:{" "}
        {importadoEm || "não sei dizer (nenhum dia com carimbo de importação)"}
      </p>
    </div>
  );
}

/** A linha de pendências: o que a tabela NÃO está contando, dito em voz alta. */
function Pendencias({ indice }) {
  const { orfaos, repetidos, semData } = indice;
  if (orfaos.length === 0 && repetidos === 0 && semData === 0) return null;
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      <CircleAlert size={13} className="text-warn-600" />
      {orfaos.length > 0 && (
        <span className="chip-warn">
          {plural(orfaos.length, "crachá do relógio sem ficha", "crachás do relógio sem ficha")} — os dias
          deles ficam fora deste relatório
        </span>
      )}
      {repetidos > 0 && (
        <span className="chip-warn">
          {plural(repetidos, "dia repetido", "dias repetidos")} — vale o corrigido, e nada foi somado duas vezes
        </span>
      )}
      {semData > 0 && (
        <span className="chip-warn">{plural(semData, "dia com data ilegível", "dias com data ilegível")}</span>
      )}
      {orfaos.length > 0 && <span>Vincule na aba “Pessoas do relógio” para eles entrarem.</span>}
    </p>
  );
}

// ============================================================================
// O NOME É PORTA — as peças do detalhe da pessoa
// ----------------------------------------------------------------------------
// Diagnóstico do dia 28/08/2026: nas três telas do Ponto o nome da pessoa
// aparecia 72 vezes e NENHUMA era clicável. Lia-se "ANA CLAUDIA · 08:03" e não
// havia para onde ir — nem para o dia dela, nem para o mês, nem para a ficha.
// Cada linha era um beco sem saída. Daqui para baixo mora o que desfaz isso.
// ============================================================================

/**
 * "HH:MM" → minutos desde a meia-noite. Vazio e lixo viram null, NUNCA 0:
 * 0 aqui é meia-noite, e uma batida que não existe desenhada às 00:00 põe a
 * pessoa no começo da barra como se ela tivesse dormido na fábrica.
 */
function minutosDoRelogioLocal(hhmm) {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(txt(hhmm));
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return h * 60 + Number(m[2]);
}

/** Diferença em palavra curta e com sinal: "+3 min", "−1h05", "0 min". */
function minutosComSinal(min) {
  const n = Math.round(numOuNulo(min) ?? 0);
  const abs = Math.abs(n);
  const corpo = abs < 60 ? `${abs} min` : duracaoTexto(abs);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${corpo}`;
}

/**
 * A SITUAÇÃO DO DIA EM UMA PALAVRA, na ordem em que ela manda: dia em aberto é
 * pendência mesmo com ausência lançada; ausência explica o dia sem batida; sem
 * nenhum dos dois, ou a escala não prevê trabalho, ou ninguém registrou nada —
 * e essas duas não são a mesma coisa.
 *
 * Mora FORA da tabela porque a mesma frase sai em dois lugares (a linha do Dia
 * e o painel da pessoa). Duas cópias desta escada divergem no primeiro conserto
 * feito só de um lado, e aí a mesma pessoa fica "presente" numa tela e "sem
 * registro" na outra.
 */
function situacaoDoDia({ dia, ausencia, emAberto, previstoMin }) {
  if (emAberto) return { situacao: "em aberto (entrou e não saiu)", chip: "chip-warn" };
  if (ausencia) return { situacao: ausencia.rotulo, chip: ausencia.chip };
  if (dia) return { situacao: "presente", chip: "chip-ok" };
  if (previstoMin === 0) return { situacao: "a escala não prevê trabalho", chip: "chip" };
  return { situacao: SEM, chip: "chip-warn" };
}

/**
 * O NOME DA PESSOA COMO BOTÃO — a porta para o painel de detalhe.
 *
 * SEM `.btn-*` DE PROPÓSITO: as classes de botão somem na impressão (ver
 * index.css, "Controle não é dado"), e um relatório de ponto impresso sem os
 * nomes é papel inútil. Este imprime como o texto preto que já era, e na tela
 * se comporta como link: sublinha no hover e o foco do teclado aparece pela
 * regra global de :focus-visible.
 */
function NomeDaPessoa({ pessoa, aoAbrir, children }) {
  return (
    <button
      type="button"
      onClick={() => aoAbrir(pessoa)}
      className="block max-w-full text-left font-medium text-slate-800 underline-offset-2 hover:text-brand-700 hover:underline"
      title={`Abrir o detalhe de ${pessoa.nome}`}
    >
      {pessoa.nome}
      {children}
    </button>
  );
}

/**
 * A ENTRADA: a hora e, EMBAIXO, o que ela quer dizer.
 *
 * Pedido do Leonardo (28/08/2026): "mostrar certinho quando entrou". "08:03"
 * sozinho não responde nada — 08:03 é chegar no horário num turno que começa
 * 08:00 e é meia hora de atraso no que começa 07:30. Por isso a comparação vem
 * colada na hora.
 *
 * E VEM COM A PALAVRA, não só com a cor: a folha impressa sai em cinza (o verde
 * e o vermelho viram o mesmo tom), e quem não distingue as duas cores lê a
 * mesma coisa nos dois casos. A cor apressa a leitura de quem enxerga; a
 * palavra é quem informa.
 *
 * "+3 min" NÃO É ATRASO por si só: até 5 min por marcação e 10 no dia a CLT não
 * deixa cobrar (art. 58 § 1º). Por isso a frase separa os três estados —
 * "antes do previsto", "dentro da tolerância" e "atraso" —, que é a mesma régua
 * da coluna Atraso ao lado.
 */
function EntradaComparada({ dia, p }) {
  const hora = txt(dia?.entrada);
  if (!hora) return <Nada>{dia ? "não bateu a entrada" : SEM}</Nada>;
  if (!p) {
    return (
      <div className="leading-tight">
        <span className="tnum font-medium text-slate-800">{hora}</span>
        <span className="block text-xs text-slate-500">sem previsto para comparar</span>
      </div>
    );
  }
  const d = p.atrasoEntradaMin;
  const palavra =
    d === 0
      ? "no horário"
      : d < 0
        ? `${minutosComSinal(d)} · antes do previsto`
        : p.pontual
          ? `${minutosComSinal(d)} · dentro da tolerância`
          : `${minutosComSinal(d)} · atraso`;
  const tom = d > 0 ? (p.pontual ? "text-warn-700" : "text-bad-700") : "text-ok-700";
  return (
    <div className="leading-tight">
      <span className="tnum font-medium text-slate-800">{hora}</span>
      <span className={clsx("block text-xs tnum", tom)} title={`A escala começa às ${p.inicioPrevisto}`}>
        {palavra}
      </span>
    </div>
  );
}

/**
 * A MINI LINHA DO TEMPO DO DIA — 90 pixels que respondem "como foi o dia".
 *
 * Em cinza, a janela que a escala previu; em cor, o pedaço que foi batido de
 * verdade. Quem entrou depois começa a barra mais à direita, quem saiu antes
 * termina mais à esquerda, quem esticou passa da faixa cinza. É o que faz a
 * tela responder de relance, sem ler número por número — e nenhum número some
 * por causa dela: as colunas ao lado continuam escrevendo tudo.
 *
 * SAI DA IMPRESSÃO (a classe fica na célula, não aqui): no papel em cinza as
 * três cores viram um traço só, e traço que não distingue nada ocupando uma
 * coluna é pior que coluna nenhuma.
 */
function LinhaDoTempoDoDia({ dia, inicioPrevisto, fimPrevisto, p, emAberto }) {
  const ini = minutosDoRelogioLocal(inicioPrevisto);
  const fim = minutosDoRelogioLocal(fimPrevisto);
  const entrada = minutosDoRelogioLocal(dia?.entrada);
  const saida = minutosDoRelogioLocal(dia?.saida);

  // Sem escala não há régua — e barra sem régua é desenho bonito que afirma
  // coisa nenhuma. Sem entrada batida não há o que desenhar.
  if (ini === null || fim === null || fim <= ini) return <Nada>fora da escala</Nada>;
  if (entrada === null) return <Nada>{dia ? "sem entrada batida" : SEM}</Nada>;

  const MARGEM = 60; // uma hora de folga de cada lado, para o que estourou caber
  const de = Math.min(ini, entrada) - MARGEM;
  const ate = Math.max(fim, saida === null ? fim : saida) + MARGEM;
  const largura = ate - de;
  const pos = (m) => Math.max(0, Math.min(100, ((m - de) / largura) * 100));

  const cor = emAberto ? "bg-warn-500" : p && !p.pontual ? "bg-bad-500" : "bg-brand-500";
  const legenda =
    `Previsto ${inicioPrevisto} às ${fimPrevisto} · batido ${dia.entrada}` +
    (saida === null ? " e sem saída" : ` às ${dia.saida}`);

  return (
    <div className="leading-none">
      <div className="relative h-2.5 w-[90px] rounded-full bg-slate-100" title={legenda}>
        <div
          className="absolute inset-y-0 rounded-full bg-slate-200"
          style={{ left: `${pos(ini)}%`, width: `${pos(fim) - pos(ini)}%` }}
        />
        {saida === null ? (
          <div className={clsx("absolute inset-y-0 w-1 rounded-full", cor)} style={{ left: `${pos(entrada)}%` }} />
        ) : (
          <div
            className={clsx("absolute inset-y-0 rounded-full", cor)}
            style={{ left: `${pos(entrada)}%`, width: `${Math.max(2, pos(saida) - pos(entrada))}%` }}
          />
        )}
      </div>
      {/* A barra é atalho para o olho; para quem lê por leitor de tela a frase
          inteira continua existindo. */}
      <span className="sr-only">{legenda}</span>
    </div>
  );
}

/** Rótulo em cima, valor embaixo — o par que o painel repete. */
function Campo({ rotulo, children }) {
  return (
    <div>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <div className="text-sm text-slate-800">{children}</div>
    </div>
  );
}

/**
 * A saída contra o fim previsto, em palavra. Null quando falta um dos dois —
 * "saiu no horário" sem saber o horário é elogio inventado.
 */
function saidaEmPalavras(p) {
  const n = p ? numOuNulo(p.saidaAntesMin) : null;
  if (n === null) return null;
  if (n === 0) return { texto: `no horário (${p.fimPrevisto})`, tom: "text-ok-700" };
  if (n > 0) return { texto: `${minutosComSinal(-n)} · saiu antes das ${p.fimPrevisto}`, tom: "text-warn-700" };
  return { texto: `${minutosComSinal(-n)} · ficou além das ${p.fimPrevisto}`, tom: "text-slate-600" };
}

/**
 * O PAINEL DA PESSOA — o que a linha da tabela não cabia dizer.
 *
 * Abre pelo nome, em qualquer uma das quatro visões, e responde as duas
 * perguntas que vinham logo depois do nome e não tinham resposta em lugar
 * nenhum: COMO FOI ESTE DIA (a que horas entrou, contra o que a escala previa,
 * o que rendeu, o que ficou pendente) e COMO ESTÁ O MÊS DELA (o mês inteiro
 * somado e o dia a dia, clicável).
 *
 * O DIA EM FOCO É ESCOLHIDO POR QUEM ABRE, e isso é decisão: na visão Dia é o
 * dia que está na tela; nas outras é o PRIMEIRO DIA COM REGISTRO do recorte.
 * Abrir sempre no dia 1º mostraria uma ficha vazia para quem só tem batida a
 * partir do dia 12 — e ficha vazia lida como "não trabalhou".
 *
 * ESTE PAINEL NÃO GRAVA NADA, como o resto da aba. Ele leva para onde se grava:
 * o botão do rodapé abre o dia na visão Dia, e o do mês abre a visão Mês.
 */
function PessoaDetalhe({ pessoa, diaFoco, grupo, jornada, aoFechar, aoEscolherDia, aoVerNoDia, aoVerNoMes }) {
  const competencia = competenciaDe(diaFoco);
  const de = primeiroDiaDoMes(competencia);
  const ate = ultimoDiaDoMes(competencia);
  const diasDaPessoa = diasNoPeriodo(grupo, de, ate);
  const ag = agregar(diasDaPessoa, jornada);
  const previstoMes = minutosPrevistosDoMes(competencia, jornada);
  const semMedicaoNoMes = ag.diasComRegistro === 0;

  const d = grupo ? grupo.dias.get(diaFoco) || null : null;
  const p = d ? atrasoDoDia(d, jornada) : null;
  const ausencia = d ? ausenciaDoDia(d) : null;
  const min = d ? minutosTrabalhados(d) : null;
  const apurado = d ? apuracaoDoRelogio(d) : null;
  const emAberto = !!d && min === null;
  const previstoDia = minutosPrevistosDoDia(diaFoco, jornada);
  const inicioPrev = inicioPrevistoDoDia(diaFoco, jornada);
  const fimPrev = fimPrevistoDoDia(diaFoco, jornada);
  const semana = diaDaSemanaISO(diaFoco);
  const sit = situacaoDoDia({ dia: d, ausencia, emAberto, previstoMin: previstoDia });
  const saida = saidaEmPalavras(p);

  return (
    <Modal titulo={pessoa.nome} aberto aoFechar={aoFechar} largura="max-w-3xl">
      <p className="-mt-2 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className={pessoa.ativo === false ? "chip" : "chip-ok"}>
          {pessoa.ativo === false ? "fora do quadro" : "no quadro"}
        </span>
        {txt(pessoa.cargo) && <span>{txt(pessoa.cargo)}</span>}
        {txt(pessoa.setor) && <span>· {txt(pessoa.setor)}</span>}
        {txt(pessoa.apelido) && <span>· chamada de {txt(pessoa.apelido)}</span>}
        {ehData(pessoa.admissao) && <span className="tnum">· admissão em {dataLonga(pessoa.admissao)}</span>}
        <span>· crachá do relógio: {txt(pessoa.jibbleId) || "sem crachá vinculado"}</span>
      </p>

      {/* ---- O DIA EM FOCO ---- */}
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display text-sm font-semibold text-slate-900">
            {dataLonga(diaFoco)}
            {semana === null ? "" : ` · ${NOMES_DIA_SEMANA[semana]}`}
          </h4>
          <p className="text-xs text-slate-500 tnum">
            {previstoDia === null
              ? "esta data não existe no calendário"
              : previstoDia === 0
                ? "a escala não prevê trabalho neste dia — nada aqui é atraso"
                : `previsto ${inicioPrev} às ${fimPrev} (${duracaoTexto(previstoDia)})`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo rotulo="Entrada">
            <EntradaComparada dia={d} p={p} />
          </Campo>
          <Campo rotulo="Saída">
            {txt(d?.saida) ? (
              <div className="leading-tight">
                <span className="tnum font-medium text-slate-800">{txt(d.saida)}</span>
                {saida && <span className={clsx("block text-xs tnum", saida.tom)}>{saida.texto}</span>}
              </div>
            ) : (
              <Nada>{emAberto ? "não bateu a saída" : SEM}</Nada>
            )}
          </Campo>
          <Campo rotulo="Intervalo">
            {numOuNulo(d?.pausaMin) === null ? <Nada /> : <span className="tnum">{duracaoTexto(d.pausaMin)}</span>}
          </Campo>
          <Campo rotulo="Horas da folha">
            {min === null ? (
              <Nada>{emAberto ? "dia em aberto" : SEM}</Nada>
            ) : (
              <span className="tnum font-medium">{duracaoTexto(min)}</span>
            )}
          </Campo>
          <Campo rotulo="Extra +50%">
            {!d ? <Nada /> : apurado ? <span className="tnum">{duracaoTexto(apurado.extraMin)}</span> : <Nada>{SEM_APURACAO}</Nada>}
          </Campo>
          <Campo rotulo="Extra +100%">
            {!d ? (
              <Nada />
            ) : apurado ? (
              <span className="tnum">{duracaoTexto(apurado.extraDobroMin)}</span>
            ) : (
              <Nada>{SEM_APURACAO}</Nada>
            )}
          </Campo>
          <Campo rotulo="Atraso na chegada">
            {!p ? (
              <Nada>{previstoDia === 0 ? "fora da escala" : "sem entrada batida"}</Nada>
            ) : p.pontual ? (
              <span className="text-ok-700">no horário</span>
            ) : (
              <span className="tnum font-semibold text-bad-700">{duracaoTexto(p.atrasoMin)}</span>
            )}
          </Campo>
          <Campo rotulo="Como foi o dia">
            <LinhaDoTempoDoDia dia={d} inicioPrevisto={inicioPrev} fimPrevisto={fimPrev} p={p} emAberto={emAberto} />
          </Campo>
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className={sit.chip}>{sit.situacao}</span>
          {ausencia?.motivo && <span>{ausencia.motivo}</span>}
          {ausencia?.documento && <span>· documento: {ausencia.documento}</span>}
          {d?.origem === "manual" && <span className="chip">lançado à mão</span>}
          {d?.corrigido === true && <span className="chip">corrigido depois da importação</span>}
        </p>
      </div>

      {/* ---- O MÊS DELA ---- */}
      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display text-sm font-semibold text-slate-900">{rotuloCompetencia(competencia)}</h4>
          <button
            type="button"
            onClick={() => aoVerNoMes(competencia)}
            className="inline-flex items-center gap-1 text-xs text-brand-700 underline-offset-2 hover:underline"
          >
            ver o mês inteiro na visão Mês <ArrowRight size={12} strokeWidth={2.6} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo rotulo="Horas da folha">
            {semMedicaoNoMes ? <Nada /> : <span className="tnum font-medium">{horasOuNada(ag.trabalhadoMin)}</span>}
          </Campo>
          <Campo rotulo="Previsto no mês">
            <span className="tnum">{horasOuNada(previstoMes)}</span>
          </Campo>
          <Campo rotulo="Pontualidade">
            {ag.pontualidadePct === null ? (
              <Nada />
            ) : (
              <span className="tnum">
                {Math.round(ag.pontualidadePct)}%{" "}
                <span className="text-xs text-slate-500">
                  ({ag.diasPontuais}/{ag.diasMedidos} dias medidos)
                </span>
              </span>
            )}
          </Campo>
          <Campo rotulo="Atrasos na chegada">
            {ag.atrasoChegadaMin === null ? <Nada /> : <span className="tnum">{duracaoTexto(ag.atrasoChegadaMin)}</span>}
          </Campo>
          <Campo rotulo="Extra +50%">
            {semMedicaoNoMes ? <Nada /> : <span className="tnum">{horasOuSemApuracao(ag.extrasMin)}</span>}
          </Campo>
          <Campo rotulo="Extra +100%">
            {semMedicaoNoMes ? <Nada /> : <span className="tnum">{horasOuSemApuracao(ag.extrasDobroMin)}</span>}
          </Campo>
          <Campo rotulo="Faltas que descontam">
            {ag.faltasQueDescontam === null ? <Nada /> : <span className="tnum">{ag.faltasQueDescontam}</span>}
          </Campo>
          <Campo rotulo="Ausências justificadas">
            {ag.ausenciasSemDesconto === null ? <Nada /> : <span className="tnum">{ag.ausenciasSemDesconto}</span>}
          </Campo>
        </div>

        {/* O DIA A DIA, e cada linha é clicável: é daqui que se chega ao dia. */}
        {diasDaPessoa.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nenhum dia registrado neste mês para {pessoa.nome} — e isso não é zero hora trabalhada: é o relógio não ter
            trazido dia nenhum.
          </p>
        ) : (
          <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-100">
            <ul className="divide-y divide-slate-100">
              {diasDaPessoa.map((dd) => {
                const pp = atrasoDoDia(dd, jornada);
                const mm = minutosTrabalhados(dd);
                const aus = ausenciaDoDia(dd);
                const s = diaDaSemanaISO(dd.data);
                return (
                  <li key={dd.data}>
                    <button
                      type="button"
                      onClick={() => aoEscolherDia(dd.data)}
                      aria-current={dd.data === diaFoco ? "true" : undefined}
                      className={clsx(
                        "flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-left text-sm hover:bg-brand-50",
                        dd.data === diaFoco && "bg-brand-50"
                      )}
                    >
                      <span className="tnum w-24 shrink-0 text-slate-500">
                        {dataCurta(dd.data)} {s === null ? "" : NOMES_DIA_SEMANA[s].slice(0, 3)}
                      </span>
                      <span className="tnum w-28 shrink-0">
                        {txt(dd.entrada) || "—"} às {txt(dd.saida) || "—"}
                      </span>
                      <span className="tnum w-16 shrink-0 font-medium">{mm === null ? "—" : duracaoTexto(mm)}</span>
                      {aus ? (
                        <span className={aus.chip}>{aus.rotulo}</span>
                      ) : pp ? (
                        pp.pontual ? (
                          <span className="chip-ok">no horário</span>
                        ) : (
                          <span className="chip-bad">atraso de {duracaoTexto(pp.atrasoMin)}</span>
                        )
                      ) : (
                        <span className="chip">sem medida de chegada</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" className="btn-outline" onClick={() => aoVerNoDia(diaFoco)}>
          <CalendarDays size={16} strokeWidth={2.5} /> Ver {dataLonga(diaFoco)} na visão Dia
        </button>
        <button type="button" className="btn-outline" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}

// ---- as colunas do MÊS -----------------------------------------------------

/**
 * Cada coluna sabe DUAS coisas, e por isso a tabela, a ordenação e o rodapé
 * nunca discordam: `valor` (o número cru, que ordena e soma) e `tipo` (como se
 * escreve). A planilha leva as mesmas contas e MAIS colunas — lá cabe o que
 * não cabe na largura da tela (dias em aberto, dias medidos, atraso médio), e
 * é para somar que ela é baixada.
 *
 * NÃO HÁ COLUNA DE DINHEIRO AQUI, e é decisão. O dinheiro do mês tem carimbo
 * (salário, divisor, fatores) e só se confere com as parcelas ao lado — um
 * total de R$ sozinho numa tabela de 9 colunas é justamente o número que não se
 * defende. Quem paga olha o Fechamento, que mostra a conta escrita. O que esta
 * coluna responde é outra coisa, e é o que faltava: o mês já foi conferido?
 */
const COLUNAS_MES = [
  {
    chave: "dias",
    rotulo: "Dias trabalhados",
    tipo: "dias",
    valor: (l) => l.ag.diasComBatida,
    ajuda: "Dias com total apurado. Dia em aberto não entra — sai na coluna de pendência da linha.",
  },
  {
    chave: "horas",
    rotulo: "Horas da folha",
    tipo: "horas",
    valor: (l) => l.ag.trabalhadoMin,
    ajuda: "O payrollHours do relógio, somado.",
  },
  {
    chave: "extra",
    rotulo: "Extra +50%",
    tipo: "horas",
    valor: (l) => l.ag.extrasMin,
    ajuda: "Hora extra de dia normal.",
  },
  {
    chave: "extraDobro",
    rotulo: "Extra +100%",
    tipo: "horas",
    valor: (l) => l.ag.extrasDobroMin,
    ajuda: "Extra de descanso, feriado ou dobra.",
  },
  {
    chave: "atrasos",
    rotulo: "Atrasos na chegada",
    tipo: "horas",
    valor: (l) => l.ag.atrasoChegadaMin,
    ajuda: `Soma do que a tolerância deixa cobrar (${TOLERANCIA_MARCACAO_MIN} min por marcação, ${TOLERANCIA_DIA_MIN} no dia). Não é o atraso do desconto.`,
  },
  {
    chave: "faltas",
    rotulo: "Faltas que descontam",
    tipo: "dias",
    valor: (l) => l.ag.faltasQueDescontam,
    ajuda: "Só o tipo falta desconta (1/30 do salário).",
  },
  {
    chave: "abonadas",
    rotulo: "Ausências justificadas",
    tipo: "dias",
    valor: (l) => l.ag.ausenciasSemDesconto,
    ajuda: "Atestado, justificada, férias e folga: contadas, e não descontam.",
  },
  {
    chave: "pontualidade",
    rotulo: "Pontualidade",
    tipo: "pct",
    valor: (l) => l.ag.pontualidadePct,
    ajuda: "Dias sem nada a cobrar na chegada ÷ dias medidos. Sem dia medido, é sem registro — nunca 0%.",
  },
];

/** O texto de uma célula do Mês, na régua do tipo da coluna. */
function celulaDoMes(col, linha) {
  const v = col.valor(linha);
  if (v === null || v === undefined) {
    // AS DUAS AUSÊNCIAS TÊM NOMES DIFERENTES: hora extra sem número é "sem
    // apuração" (houve o dia, ninguém apurou aquela faixa); o resto é "sem
    // registro" (não houve dia nenhum). Escrever a mesma palavra nas duas faria
    // o RH procurar o dia que existe.
    const faixaDeExtra = col.chave === "extra" || col.chave === "extraDobro";
    return <Nada>{faixaDeExtra && linha.ag.diasComRegistro > 0 ? SEM_APURACAO : SEM}</Nada>;
  }
  if (col.tipo === "horas") return <span className="tnum">{duracaoTexto(v)}</span>;
  if (col.tipo === "pct") {
    return (
      <div className="leading-tight">
        <span className="tnum font-display font-semibold">{Math.round(v)}%</span>
        <div className="text-xs text-slate-500 tnum">
          {linha.ag.diasPontuais}/{linha.ag.diasMedidos} dias · atraso médio {duracaoTexto(linha.ag.atrasoMedioMin)}
        </div>
      </div>
    );
  }
  return <span className="tnum">{v}</span>;
}

// ============================================================================

export default function Relatorios({ pessoas, ativos, ponto, pontoDia, hojeISO, setAviso }) {
  const [visao, setVisao] = useState("dia");
  const [filtroPessoa, setFiltroPessoa] = useState(TODAS);

  // Cada visão tem o SEU recorte, e ele não se mistura: trocar de aba e voltar
  // devolve o dia que a pessoa estava olhando.
  const [dia, setDia] = useState(hojeISO);
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO));
  const [ano, setAno] = useState(() => String(hojeISO).slice(0, 4));
  const [medidaAno, setMedidaAno] = useState("horas");
  const [medidaComp, setMedidaComp] = useState("horas");
  const [ordem, setOrdem] = useState({ chave: "nome", dir: "asc" });

  /* QUEM ESTÁ ABERTO, E EM QUE DIA. O nome clicado em qualquer visão abre o
     painel da pessoa; o dia em foco viaja junto porque "detalhe da pessoa" sem
     dia não existe — a mesma pessoa é pontual num dia e chega tarde no outro.
     Guarda o ID, nunca a ficha inteira: ficha copiada para dentro do estado
     envelhece calada quando o servidor traz outra. */
  const [detalhe, setDetalhe] = useState(null); // { pessoaId, dia }

  // Os dois períodos da comparação: o mês corrente até hoje, contra o MESMO
  // PEDAÇO do mês passado. Começar com dois períodos de tamanhos iguais é o
  // padrão honesto — quem quiser comparar 30 dias com 15 muda as datas e a tela
  // avisa.
  const [periodos, setPeriodos] = useState(() => {
    const bDe = primeiroDiaDoMes(competenciaDe(hojeISO));
    const tamanho = diasCorridos(bDe, hojeISO) || 1;
    const aDe = primeiroDiaDoMes(competenciaAnterior(competenciaDe(hojeISO)));
    return { aDe, aAte: somarDias(aDe, tamanho - 1), bDe, bAte: hojeISO };
  });

  // ---- configuração (jornada, divisor, fatores) ----------------------------
  // null é AINDA NÃO CARREGOU, que não é "não existe": enquanto isso vale o
  // padrão da casa, e a tela diz que está usando o padrão.
  const [config, setConfig] = useState(null);
  const [cfgFalhou, setCfgFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    lerCfg()
      .then((c) => {
        if (!vivo) return;
        setConfig(c || {});
        setCfgFalhou(false);
      })
      .catch(() => {
        if (vivo) setCfgFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, []);
  const cfg = useMemo(() => cfgDoPonto(config), [config]);
  const jornadaEmPalavras = useMemo(() => descreverJornada(cfg.jornada), [cfg.jornada]);

  const indice = useMemo(() => montarIndice(pessoas, pontoDia), [pessoas, pontoDia]);
  const importadoEm = useMemo(() => ultimaImportacao(pontoDia), [pontoDia]);

  // Quem pode ser escolhido no filtro: o quadro mais quem tem dia gravado em
  // qualquer época (o relatório de março precisa de quem saiu em abril).
  const pessoasDoFiltro = useMemo(() => {
    const lista = [...(ativos || [])];
    const jaTem = new Set(lista.map((p) => p.id));
    for (const [id, grupo] of indice.porPessoa) {
      if (jaTem.has(id)) continue;
      jaTem.add(id);
      lista.push(grupo.pessoa);
    }
    return lista.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));
  }, [ativos, indice]);

  const pessoaEscolhida = filtroPessoa === TODAS ? null : pessoasDoFiltro.find((p) => p.id === filtroPessoa) || null;
  // A frase do recorte é a MESMA na tela, no papel e no nome da planilha —
  // "todas" inclui quem saiu e teve dia no período, e não só o quadro de hoje.
  const recorteDePessoa = pessoaEscolhida ? pessoaEscolhida.nome : "todas as pessoas com registro";
  const soAEscolhida = (lista) => (pessoaEscolhida ? lista.filter((p) => p.id === pessoaEscolhida.id) : lista);

  const anosDisponiveis = useMemo(() => {
    const set = new Set([Number(String(hojeISO).slice(0, 4))]);
    for (const d of pontoDia || []) {
      const a = Number(String(d.data || "").slice(0, 4));
      if (a) set.add(a);
    }
    for (const r of ponto || []) {
      const a = Number(String(r.competencia || "").slice(0, 4));
      if (a) set.add(a);
    }
    return [...set].filter(Boolean).sort((a, b) => b - a);
  }, [pontoDia, ponto, hojeISO]);

  // ==========================================================================
  // ABRIR A PESSOA, E NAVEGAR ENTRE AS VISÕES
  // --------------------------------------------------------------------------
  // O NOME É PORTA (28/08/2026). Cada visão sabe qual dia entregar ao painel:
  // na visão Dia é o dia que está na tela; nas outras é o PRIMEIRO DIA COM
  // REGISTRO do recorte — abrir sempre no dia 1º mostraria ficha vazia para
  // quem só tem batida a partir do 12, e ficha vazia lê como "não trabalhou".
  // Sem nenhum dia no recorte, vale o começo do recorte, e o painel escreve com
  // todas as letras que ali não há registro.
  // ==========================================================================
  const primeiroDiaComRegistro = (pessoaId, de, ate) => {
    const dias = diasNoPeriodo(indice.porPessoa.get(pessoaId), de, ate);
    return dias.length > 0 ? dias[0].data : null;
  };

  const diaDeFocoPara = (pessoa) => {
    if (visao === "dia") return ehData(dia) ? dia : hojeISO;
    if (visao === "mes") {
      const de = primeiroDiaDoMes(competencia);
      return primeiroDiaComRegistro(pessoa.id, de, ultimoDiaDoMes(competencia)) || de;
    }
    if (visao === "ano") {
      const de = `${ano}-01-01`;
      return primeiroDiaComRegistro(pessoa.id, de, `${ano}-12-31`) || de;
    }
    // Na comparação o período NOVO manda: é o que a pessoa está olhando agora.
    const { aDe, aAte, bDe, bAte } = periodos;
    const noNovo = ehData(bDe) && ehData(bAte) ? primeiroDiaComRegistro(pessoa.id, bDe, bAte) : null;
    const noAnterior = ehData(aDe) && ehData(aAte) ? primeiroDiaComRegistro(pessoa.id, aDe, aAte) : null;
    return noNovo || noAnterior || (ehData(bDe) ? bDe : hojeISO);
  };

  const abrirPessoa = (pessoa) => setDetalhe({ pessoaId: pessoa.id, dia: diaDeFocoPara(pessoa) });

  /* CLICAR NUM NÚMERO LEVA À VISÃO DELE, JÁ FILTRADA. Sem isto, para ver março
     a pessoa troca de visão e reencontra o filtro na mão — e é justamente aí
     que se olha o mês errado sem perceber. */
  const irParaDia = (data) => {
    if (!ehData(data)) return;
    setDia(data);
    setVisao("dia");
    setDetalhe(null);
  };

  const irParaMes = (comp, pessoa) => {
    if (!ehCompetencia(comp)) return;
    setCompetencia(comp);
    // Clicou na célula DE ALGUÉM: o mês abre com essa pessoa no filtro. Clicou
    // no rodapé (o total da casa), o filtro fica como estava.
    if (pessoa) setFiltroPessoa(pessoa.id);
    setVisao("mes");
    setDetalhe(null);
  };

  // ==========================================================================
  // VISÃO DIA
  // ==========================================================================
  const vmDia = useMemo(() => {
    const valida = ehData(dia);
    const semana = valida ? diaDaSemanaISO(dia) : null;
    const previsto = valida ? minutosPrevistosDoDia(dia, cfg.jornada) : null;
    const linhas = soAEscolhida(pessoasDoPeriodo(ativos, indice, dia, dia)).map((pessoa) => {
      const grupo = indice.porPessoa.get(pessoa.id);
      const d = grupo ? grupo.dias.get(dia) || null : null;
      const min = d ? minutosTrabalhados(d) : null;
      const apurado = d ? apuracaoDoRelogio(d) : null;
      const ausencia = d ? ausenciaDoDia(d) : null;
      const p = d ? atrasoDoDia(d, cfg.jornada) : null;
      const emAberto = !!d && min === null;
      const temEntrada = !!txt(d?.entrada);

      // A situação em uma palavra sai de `situacaoDoDia`, lá em cima: é a MESMA
      // escada que o painel da pessoa usa. Duas cópias divergiriam no primeiro
      // conserto feito só de um lado.
      const sit = situacaoDoDia({ dia: d, ausencia, emAberto, previstoMin: previsto });

      return {
        pessoa,
        d,
        min,
        apurado,
        ausencia,
        p,
        emAberto,
        temEntrada,
        situacao: sit.situacao,
        chipSituacao: sit.chip,
      };
    });

    /* A ORDEM DIZ O QUE OLHAR PRIMEIRO, e por isso ela não é alfabética.
       Ordem alfabética enterra o atraso no meio da lista: quem abre esta tela
       de manhã quer saber quem chegou depois, não quem começa com A. Então:
       atrasados (do maior atraso para o menor), depois quem chegou no horário,
       depois quem tem dia mas não dá para medir a chegada (fim de semana,
       ausência lançada), e no fim quem não tem registro nenhum.

       SEM REGISTRO VAI SEMPRE PARA O ÚLTIMO BALDE — "não medi" não pode
       encabeçar um ranking nem de melhores nem de piores. É a mesma regra da
       ordenação do Mês. */
    const balde = (l) => (l.p && !l.p.pontual ? 0 : l.p ? 1 : l.d ? 2 : 3);
    linhas.sort((a, b) => {
      const ba = balde(a);
      const bb = balde(b);
      if (ba !== bb) return ba - bb;
      if (ba === 0 && b.p.atrasoMin !== a.p.atrasoMin) return b.p.atrasoMin - a.p.atrasoMin;
      return norm(a.pessoa.nome).localeCompare(norm(b.pessoa.nome));
    });

    const presentes = linhas.filter((l) => l.temEntrada).length;
    const atrasados = linhas.filter((l) => l.p && !l.p.pontual).length;
    const pontuais = linhas.filter((l) => l.p && l.p.pontual).length;
    const faltas = linhas.filter((l) => l.ausencia?.desconta).length;
    const abonadas = linhas.filter((l) => l.ausencia && !l.ausencia.desconta).length;
    const emAberto = linhas.filter((l) => l.emAberto).length;
    const semRegistro = linhas.filter((l) => !l.d).length;

    return {
      valida,
      semana,
      previsto,
      inicio: valida ? inicioPrevistoDoDia(dia, cfg.jornada) : null,
      fim: valida ? fimPrevistoDoDia(dia, cfg.jornada) : null,
      linhas,
      kpi: { presentes, atrasados, pontuais, faltas, abonadas, emAberto, semRegistro, total: linhas.length },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia, cfg.jornada, ativos, indice, pessoaEscolhida]);

  // ==========================================================================
  // VISÃO MÊS
  // ==========================================================================
  const vmMes = useMemo(() => {
    const de = primeiroDiaDoMes(competencia);
    const ate = ultimoDiaDoMes(competencia);
    const regsDoMes = new Map();
    for (const r of ponto || []) {
      if (r.competencia === competencia && !regsDoMes.has(r.pessoaId)) regsDoMes.set(r.pessoaId, r);
    }

    const linhas = soAEscolhida(pessoasDoPeriodo(ativos, indice, de, ate)).map((pessoa) => {
      const dias = diasNoPeriodo(indice.porPessoa.get(pessoa.id), de, ate);
      const reg = regsDoMes.get(pessoa.id) || null;
      return {
        pessoa,
        nome: pessoa.nome,
        ag: agregar(dias, cfg.jornada),
        // O fechamento responde UMA pergunta aqui: este mês já foi conferido?
        fechamento: reg ? (reg.fechado ? "fechado" : "lançado, em aberto") : "sem lançamento",
        fechado: !!reg?.fechado,
        temLancamento: !!reg,
      };
    });

    const ags = linhas.map((l) => l.ag);
    const ordenadas = [...linhas].sort((a, b) => {
      const dir = ordem.dir === "asc" ? 1 : -1;
      if (ordem.chave === "nome") return dir * norm(a.nome).localeCompare(norm(b.nome));
      const col = COLUNAS_MES.find((c) => c.chave === ordem.chave);
      if (!col) return norm(a.nome).localeCompare(norm(b.nome));
      const va = col.valor(a);
      const vb = col.valor(b);
      // SEM REGISTRO VAI SEMPRE PARA O FIM, nas duas direções: "não medi" não
      // pode encabeçar um ranking nem de melhores nem de piores.
      if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1;
      if (vb === null || vb === undefined) return -1;
      return dir * (va - vb) || norm(a.nome).localeCompare(norm(b.nome));
    });

    return {
      de,
      ate,
      linhas: ordenadas,
      previstoMin: minutosPrevistosDoMes(competencia, cfg.jornada),
      totais: {
        porColuna: Object.fromEntries(
          COLUNAS_MES.map((c) => [
            c.chave,
            c.chave === "pontualidade" ? totalDaMedida(medidaDe("pontualidade"), ags) : somaOuNulo(linhas.map((l) => c.valor(l))),
          ])
        ),
        diasMedidos: ags.reduce((s, a) => s + a.diasMedidos, 0),
        diasPontuais: ags.reduce((s, a) => s + (a.diasPontuais ?? 0), 0),
        // Quem não tem dia nenhum não soma nada aqui (o `?? 0` é a ausência
        // NÃO contribuindo, não virando zero na conta de outra pessoa).
        emAberto: ags.reduce((s, a) => s + (a.diasEmAberto ?? 0), 0),
        estranhas: ags.reduce((s, a) => s + (a.ausenciasDesconhecidas ?? 0), 0),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia, ponto, ativos, indice, cfg.jornada, ordem, pessoaEscolhida]);

  // ==========================================================================
  // VISÃO ANO
  // ==========================================================================
  const vmAno = useMemo(() => {
    const medida = medidaDe(medidaAno);
    const de = `${ano}-01-01`;
    const ate = `${ano}-12-31`;
    const meses = MESES.map((_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);

    const linhas = soAEscolhida(pessoasDoPeriodo(ativos, indice, de, ate)).map((pessoa) => {
      const grupo = indice.porPessoa.get(pessoa.id);
      const porMes = meses.map((c) => agregar(diasNoPeriodo(grupo, primeiroDiaDoMes(c), ultimoDiaDoMes(c)), cfg.jornada));
      return {
        pessoa,
        nome: pessoa.nome,
        porMes,
        valores: porMes.map((a) => medida.valor(a)),
        // O total do ano na régua da medida: soma para o que soma, razão
        // juntada para a pontualidade.
        total: totalDaMedida(medida, porMes),
      };
    });

    return {
      medida,
      meses,
      linhas,
      // O rodapé é o total DO MÊS entre todas as pessoas — a linha da tendência
      // da casa, que é para o que a visão de ano existe.
      totalPorMes: meses.map((_, i) => totalDaMedida(medida, linhas.map((l) => l.porMes[i]))),
      totalGeral: totalDaMedida(medida, linhas.flatMap((l) => l.porMes)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, medidaAno, ativos, indice, cfg.jornada, pessoaEscolhida]);

  // ==========================================================================
  // VISÃO COMPARAR
  // ==========================================================================
  const vmComp = useMemo(() => {
    const medida = medidaDe(medidaComp);
    const { aDe, aAte, bDe, bAte } = periodos;
    const erroA = !ehData(aDe) || !ehData(aAte) ? "datas incompletas" : aDe > aAte ? "o fim vem antes do começo" : "";
    const erroB = !ehData(bDe) || !ehData(bAte) ? "datas incompletas" : bDe > bAte ? "o fim vem antes do começo" : "";
    if (erroA || erroB) return { medida, erroA, erroB, linhas: [], valido: false };

    const corridosA = diasCorridos(aDe, aAte);
    const corridosB = diasCorridos(bDe, bAte);
    const escalaA = diasDeEscala(aDe, aAte, cfg.jornada);
    const escalaB = diasDeEscala(bDe, bAte, cfg.jornada);

    const nomes = new Map();
    for (const p of soAEscolhida(pessoasDoPeriodo(ativos, indice, aDe, aAte))) nomes.set(p.id, p);
    for (const p of soAEscolhida(pessoasDoPeriodo(ativos, indice, bDe, bAte))) nomes.set(p.id, p);

    const linhas = [...nomes.values()]
      .sort((x, y) => norm(x.nome).localeCompare(norm(y.nome)))
      .map((pessoa) => {
        const grupo = indice.porPessoa.get(pessoa.id);
        const agA = agregar(diasNoPeriodo(grupo, aDe, aAte), cfg.jornada);
        const agB = agregar(diasNoPeriodo(grupo, bDe, bAte), cfg.jornada);
        return { pessoa, nome: pessoa.nome, agA, agB, valorA: medida.valor(agA), valorB: medida.valor(agB) };
      });

    return {
      medida,
      valido: true,
      corridosA,
      corridosB,
      escalaA,
      escalaB,
      // O AVISO SAI DO DENOMINADOR QUE IMPORTA: dias de escala, não dias
      // corridos. Fevereiro contra março difere em dias corridos e pode ter o
      // mesmo tanto de dias úteis — aí não há o que avisar.
      tamanhosDiferentes: escalaA !== escalaB,
      linhas,
      totalA: totalDaMedida(medida, linhas.map((l) => l.agA)),
      totalB: totalDaMedida(medida, linhas.map((l) => l.agB)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodos, medidaComp, ativos, indice, cfg.jornada, pessoaEscolhida]);

  // ==========================================================================
  // O RECORTE EM UMA FRASE — a mesma para o papel, para a planilha e para a tela
  // ==========================================================================
  const recorte = useMemo(() => {
    if (visao === "dia") {
      const semana = vmDia.semana === null ? "" : ` (${NOMES_DIA_SEMANA[vmDia.semana]})`;
      return `Dia ${ehData(dia) ? dataLonga(dia) : "não escolhido"}${semana} · ${recorteDePessoa}`;
    }
    if (visao === "mes") return `Mês de ${rotuloCompetencia(competencia)} · ${recorteDePessoa}`;
    if (visao === "ano") return `Ano de ${ano} · número: ${vmAno.medida.rotulo} · ${recorteDePessoa}`;
    return (
      `${dataLonga(periodos.aDe)} a ${dataLonga(periodos.aAte)} (anterior) contra ` +
      `${dataLonga(periodos.bDe)} a ${dataLonga(periodos.bAte)} (novo) · ` +
      `número: ${vmComp.medida.rotulo} · ${recorteDePessoa}`
    );
  }, [visao, dia, competencia, ano, periodos, vmDia.semana, vmAno.medida, vmComp.medida, recorteDePessoa]);

  const tituloDoPapel = `MinasLab — Relatório de ponto · ${VISOES.find((v) => v.valor === visao)?.rotulo || ""}`;

  // ==========================================================================
  // PLANILHA — o mesmo recorte que está na tela, com horas em NÚMERO
  // ==========================================================================
  const baixar = () => {
    let nome = "";
    let titulo = "";
    let colunas = [];
    let linhas = [];

    if (visao === "dia") {
      nome = `ponto-dia-${dia}`;
      titulo = `Ponto do dia — ${ehData(dia) ? dataLonga(dia) : dia}`;
      colunas = [
        { chave: "pessoa", rotulo: "Pessoa" },
        { chave: "data", rotulo: "Data", tipo: "data" },
        { chave: "entrada", rotulo: "Entrada" },
        { chave: "saida", rotulo: "Saída" },
        { chave: "intervaloMin", rotulo: "Intervalo (min)", tipo: "numero" },
        { chave: "horasFolha", rotulo: "Horas da folha (h)", tipo: "numero" },
        { chave: "extra50", rotulo: "Extra +50% (h)", tipo: "numero" },
        { chave: "extra100", rotulo: "Extra +100% (h)", tipo: "numero" },
        { chave: "atrasoCru", rotulo: "Atraso na entrada (min)", tipo: "numero" },
        { chave: "atrasoCobravel", rotulo: "Atraso cobrável (min)", tipo: "numero" },
        { chave: "situacao", rotulo: "Situação" },
        { chave: "ausencia", rotulo: "Ausência" },
        { chave: "motivo", rotulo: "Motivo" },
      ];
      linhas = vmDia.linhas.map((l) => ({
        pessoa: l.pessoa.nome,
        data: dia,
        entrada: l.d?.entrada || "",
        saida: l.d?.saida || "",
        // Célula VAZIA, nunca 0: zero em coluna que o RH soma vira desconto.
        // Number("") devolveria 0 — por isso o campo passa por numOuNulo.
        intervaloMin: numOuNulo(l.d?.pausaMin) ?? "",
        horasFolha: l.min === null ? "" : horasDecimais(l.min),
        extra50: l.apurado ? horasDecimais(l.apurado.extraMin) : "",
        extra100: l.apurado ? horasDecimais(l.apurado.extraDobroMin) : "",
        atrasoCru: l.p ? l.p.atrasoEntradaMin : "",
        atrasoCobravel: l.p ? l.p.atrasoMin : "",
        situacao: l.situacao,
        ausencia: l.ausencia?.curto || "",
        motivo: l.ausencia?.motivo || "",
      }));
    } else if (visao === "mes") {
      nome = `ponto-mes-${competencia}`;
      titulo = `Ponto do mês — ${rotuloCompetencia(competencia)}`;
      colunas = [
        { chave: "pessoa", rotulo: "Pessoa" },
        { chave: "diasTrabalhados", rotulo: "Dias trabalhados", tipo: "numero" },
        { chave: "diasEmAberto", rotulo: "Dias em aberto", tipo: "numero" },
        { chave: "horasFolha", rotulo: "Horas da folha (h)", tipo: "numero" },
        { chave: "extra50", rotulo: "Extra +50% (h)", tipo: "numero" },
        { chave: "extra100", rotulo: "Extra +100% (h)", tipo: "numero" },
        { chave: "atrasoChegadaMin", rotulo: "Atrasos na chegada (min)", tipo: "numero" },
        { chave: "atrasoMedioMin", rotulo: "Atraso médio por dia (min)", tipo: "numero" },
        { chave: "faltas", rotulo: "Faltas que descontam", tipo: "numero" },
        { chave: "ausenciasJustificadas", rotulo: "Ausências justificadas", tipo: "numero" },
        { chave: "diasMedidos", rotulo: "Dias medidos", tipo: "numero" },
        { chave: "diasPontuais", rotulo: "Dias pontuais", tipo: "numero" },
        { chave: "pontualidadePct", rotulo: "Pontualidade (%)", tipo: "numero" },
        { chave: "fechamento", rotulo: "Fechamento" },
      ];
      linhas = vmMes.linhas.map((l) => ({
        pessoa: l.nome,
        diasTrabalhados: l.ag.diasComBatida,
        diasEmAberto: l.ag.diasEmAberto,
        horasFolha: l.ag.trabalhadoMin === null ? "" : horasDecimais(l.ag.trabalhadoMin),
        extra50: l.ag.extrasMin === null ? "" : horasDecimais(l.ag.extrasMin),
        extra100: l.ag.extrasDobroMin === null ? "" : horasDecimais(l.ag.extrasDobroMin),
        atrasoChegadaMin: l.ag.atrasoChegadaMin === null ? "" : l.ag.atrasoChegadaMin,
        atrasoMedioMin: l.ag.atrasoMedioMin === null ? "" : l.ag.atrasoMedioMin,
        faltas: l.ag.faltasQueDescontam,
        ausenciasJustificadas: l.ag.ausenciasSemDesconto,
        diasMedidos: l.ag.diasMedidos,
        diasPontuais: l.ag.diasPontuais === null ? "" : l.ag.diasPontuais,
        pontualidadePct: l.ag.pontualidadePct === null ? "" : Math.round(l.ag.pontualidadePct * 10) / 10,
        fechamento: l.fechamento,
      }));
    } else if (visao === "ano") {
      nome = `ponto-ano-${ano}-${vmAno.medida.chave}`;
      titulo = `Ponto do ano — ${ano} · ${vmAno.medida.rotulo}`;
      colunas = [
        { chave: "pessoa", rotulo: "Pessoa" },
        ...MESES.map((m, i) => ({ chave: `m${i}`, rotulo: m, tipo: "numero" })),
        { chave: "total", rotulo: vmAno.medida.chave === "pontualidade" ? "Ano (%)" : "Total do ano", tipo: "numero" },
      ];
      linhas = vmAno.linhas.map((l) => {
        const linha = { pessoa: l.nome };
        l.valores.forEach((v, i) => {
          const n = numeroDaMedida(v, vmAno.medida.unidade);
          linha[`m${i}`] = n === null ? "" : n;
        });
        const t = numeroDaMedida(l.total, vmAno.medida.unidade);
        linha.total = t === null ? "" : t;
        return linha;
      });
    } else {
      nome = `ponto-comparacao-${periodos.aDe}-x-${periodos.bDe}`;
      titulo = `Comparação de períodos — ${vmComp.medida.rotulo}`;
      colunas = [
        { chave: "pessoa", rotulo: "Pessoa" },
        { chave: "anterior", rotulo: `Anterior (${dataLonga(periodos.aDe)} a ${dataLonga(periodos.aAte)})`, tipo: "numero" },
        { chave: "anteriorDia", rotulo: "Anterior por dia de escala", tipo: "numero" },
        { chave: "novo", rotulo: `Novo (${dataLonga(periodos.bDe)} a ${dataLonga(periodos.bAte)})`, tipo: "numero" },
        { chave: "novoDia", rotulo: "Novo por dia de escala", tipo: "numero" },
        { chave: "diferenca", rotulo: "Diferença", tipo: "numero" },
        { chave: "variacaoPct", rotulo: "Variação (%)", tipo: "numero" },
        { chave: "sentido", rotulo: "Leitura" },
      ];
      linhas = vmComp.linhas.map((l) => {
        const { diferenca, pct, motivo } = compararValores(l.valorA, l.valorB);
        const porDia = (v, dias) =>
          v === null || v === undefined || !dias || vmComp.medida.somavel === false
            ? ""
            : Math.round(numeroDaMedida(v, vmComp.medida.unidade) / dias * 100) / 100;
        return {
          pessoa: l.nome,
          anterior: numeroDaMedida(l.valorA, vmComp.medida.unidade) ?? "",
          anteriorDia: porDia(l.valorA, vmComp.escalaA),
          novo: numeroDaMedida(l.valorB, vmComp.medida.unidade) ?? "",
          novoDia: porDia(l.valorB, vmComp.escalaB),
          diferenca: diferenca === null ? "" : numeroDaMedida(diferenca, vmComp.medida.unidade),
          variacaoPct: pct === null ? "" : Math.round(pct * 10) / 10,
          sentido: motivo || sentidoDaVariacao(vmComp.medida, diferenca),
        };
      });
    }

    if (linhas.length === 0) {
      return setAviso({ tipo: "erro", texto: "Não há nada neste recorte para baixar." });
    }
    try {
      const arquivo = baixarPlanilha({ nome, titulo: `${titulo} — ${recorteDePessoa}`, colunas, linhas });
      setAviso({
        tipo: "ok",
        texto: `Planilha baixada: ${arquivo} (${plural(linhas.length, "linha", "linhas")}).`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  const ordenarPor = (chave) =>
    setOrdem((o) => (o.chave === chave ? { chave, dir: o.dir === "asc" ? "desc" : "asc" } : { chave, dir: "asc" }));

  /* A FICHA DO PAINEL SAI DA LISTA VIVA, e o estado só guarda o id: copiar a
     ficha para dentro do estado faria o painel continuar mostrando o cargo
     antigo depois de o servidor trazer o novo. Quem foi desligada continua
     achável — o relatório de março precisa de quem saiu em abril. */
  const pessoaDoDetalhe = useMemo(() => {
    if (!detalhe) return null;
    return (
      pessoasDoFiltro.find((p) => p.id === detalhe.pessoaId) ||
      indice.porPessoa.get(detalhe.pessoaId)?.pessoa ||
      null
    );
  }, [detalhe, pessoasDoFiltro, indice]);

  // ==========================================================================
  // TELA
  // ==========================================================================
  const semNinguem = pessoasDoFiltro.length === 0;

  return (
    <>
      <Card className="mb-4">
        <SectionTitle
          titulo="Relatórios do ponto"
          sub="O mesmo dado das outras abas, somado por dia, por mês, por ano e entre períodos. Esta aba não grava nada."
          acao={
            <div className="sem-impressao flex flex-wrap items-center gap-2">
              {/* O PDF É A IMPRESSÃO: no destino da impressão, "Salvar como PDF".
                  Não há segunda geração de documento — se houvesse, a folha e a
                  tela discordariam no dia em que uma das duas mudasse. */}
              <button
                type="button"
                className="btn-outline"
                onClick={() => window.print()}
                title="Imprime esta tela; no destino da impressão escolha Salvar como PDF"
              >
                <Printer size={16} strokeWidth={2.5} /> Baixar PDF
              </button>
              <button type="button" className="btn-outline" onClick={baixar}>
                <Download size={16} strokeWidth={2.5} /> Baixar planilha
              </button>
            </div>
          }
        />

        <div className="sem-impressao mb-3 max-w-full overflow-x-auto pb-1">
          <Segmented opcoes={VISOES} valor={visao} onChange={setVisao} />
        </div>

        {/* OS CONTROLES DO RECORTE. Todos em `sem-impressao`: no papel um
            seletor sairia como se fosse um rótulo afirmando um mês. Quem diz o
            recorte na folha é o bloco RecorteImpresso. */}
        <div className="sem-impressao flex flex-wrap items-end gap-3">
          {visao === "dia" && (
            <div>
              <label className="label" htmlFor="rel-dia">Dia</label>
              <input
                id="rel-dia"
                type="date"
                className="input w-44"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
              />
            </div>
          )}

          {visao === "mes" && (
            <>
              <div>
                <label className="label" htmlFor="rel-mes">Mês</label>
                <select
                  id="rel-mes"
                  className="select w-40"
                  value={competencia.split("-")[1] || ""}
                  onChange={(e) => setCompetencia(`${competencia.split("-")[0]}-${e.target.value}`)}
                >
                  {MESES_LONGOS.map((nome, i) => (
                    <option key={nome} value={String(i + 1).padStart(2, "0")}>{nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="rel-mes-ano">Ano</label>
                <select
                  id="rel-mes-ano"
                  className="select w-28"
                  value={competencia.split("-")[0] || ""}
                  onChange={(e) => setCompetencia(`${e.target.value}-${competencia.split("-")[1]}`)}
                >
                  {anosDisponiveis.map((a) => (
                    <option key={a} value={String(a)}>{a}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {visao === "ano" && (
            <>
              <div>
                <label className="label" htmlFor="rel-ano">Ano</label>
                <select id="rel-ano" className="select w-28" value={ano} onChange={(e) => setAno(e.target.value)}>
                  {anosDisponiveis.map((a) => (
                    <option key={a} value={String(a)}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="rel-medida-ano">Número na tabela</label>
                <select
                  id="rel-medida-ano"
                  className="select w-56"
                  value={medidaAno}
                  onChange={(e) => setMedidaAno(e.target.value)}
                >
                  {MEDIDAS.map((m) => (
                    <option key={m.chave} value={m.chave}>{m.rotulo}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {visao === "comparar" && (
            <>
              <div>
                <label className="label" htmlFor="rel-a-de">Período anterior — de</label>
                <input
                  id="rel-a-de"
                  type="date"
                  className="input w-44"
                  value={periodos.aDe}
                  onChange={(e) => setPeriodos((p) => ({ ...p, aDe: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="rel-a-ate">até</label>
                <input
                  id="rel-a-ate"
                  type="date"
                  className="input w-44"
                  value={periodos.aAte}
                  onChange={(e) => setPeriodos((p) => ({ ...p, aAte: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="rel-b-de">Período novo — de</label>
                <input
                  id="rel-b-de"
                  type="date"
                  className="input w-44"
                  value={periodos.bDe}
                  onChange={(e) => setPeriodos((p) => ({ ...p, bDe: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="rel-b-ate">até</label>
                <input
                  id="rel-b-ate"
                  type="date"
                  className="input w-44"
                  value={periodos.bAte}
                  onChange={(e) => setPeriodos((p) => ({ ...p, bAte: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="rel-medida-comp">Número comparado</label>
                <select
                  id="rel-medida-comp"
                  className="select w-56"
                  value={medidaComp}
                  onChange={(e) => setMedidaComp(e.target.value)}
                >
                  {MEDIDAS.map((m) => (
                    <option key={m.chave} value={m.chave}>{m.rotulo}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="ml-auto">
            <label className="label" htmlFor="rel-pessoa">Pessoa</label>
            <select
              id="rel-pessoa"
              className="select w-60"
              value={filtroPessoa}
              onChange={(e) => setFiltroPessoa(e.target.value)}
            >
              <option value={TODAS}>Todas as pessoas</option>
              {pessoasDoFiltro.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* A RÉGUA À VISTA. Previsto e atraso saem da escala; escala que não se
            lê na tela vira número sem dono na hora da conferência. */}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <Clock size={13} className="text-slate-400" />
          <span className="tnum">Jornada: {jornadaEmPalavras}</span>
          {!cfg.jornadaDefinida && <span className="chip">escala padrão da casa</span>}
          {config === null && !cfgFalhou && <span className="chip">carregando a configuração — vale o padrão</span>}
          {cfgFalhou && <span className="chip-warn">não consegui ler a configuração — usando o padrão da casa</span>}
          {cfg.jornada.ignorados > 0 && (
            <span className="chip-warn">
              {plural(cfg.jornada.ignorados, "turno gravado não foi entendido", "turnos gravados não foram entendidos")}
            </span>
          )}
          {divisorDaJornada(cfg.jornada) !== cfg.divisor && (
            <span className="chip-warn">
              a escala sustenta o divisor {divisorDaJornada(cfg.jornada)}, e o configurado é {cfg.divisor}
            </span>
          )}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <Settings2 size={13} className="text-slate-400" />
          <span>
            Atraso já com a <strong>tolerância da CLT aplicada</strong> ({TOLERANCIA_MARCACAO_MIN} min por marcação,{" "}
            {TOLERANCIA_DIA_MIN} no dia, art. 58 § 1º): dentro do limite não conta nada; passando dele, conta o tempo
            inteiro. Este atraso mede a <strong>chegada</strong> contra a escala — não é o atraso que desconta na
            folha, que fica no Fechamento.
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <CalendarDays size={13} className="text-slate-400" />
          <span>
            Última importação do relógio:{" "}
            {importadoEm ? (
              <strong className="tnum">{importadoEm}</strong>
            ) : (
              <Nada>não sei dizer (nenhum dia com carimbo de importação)</Nada>
            )}
          </span>
        </p>
      </Card>

      <RecorteImpresso
        titulo={tituloDoPapel}
        recorte={recorte}
        jornadaEmPalavras={jornadaEmPalavras}
        emitidoEm={hojeISO}
        importadoEm={importadoEm}
      />

      {semNinguem ? (
        <Card>
          <Empty>
            Não há ninguém no quadro nem dia importado. Cadastre as pessoas no RH e traga as batidas na aba “Pessoas do
            relógio”.
          </Empty>
        </Card>
      ) : (
        <>
          {/* ================================================================
              DIA
              ================================================================ */}
          {visao === "dia" && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  rotulo="Presentes"
                  valor={`${vmDia.kpi.presentes}/${vmDia.kpi.total}`}
                  tom={vmDia.kpi.presentes > 0 ? "ok" : "neutral"}
                  sub={
                    vmDia.kpi.semRegistro > 0
                      ? `${plural(vmDia.kpi.semRegistro, "pessoa sem registro", "pessoas sem registro")}`
                      : "todo mundo com registro no dia"
                  }
                  icone={Users}
                />
                <StatCard
                  rotulo="Atrasados"
                  // Sem dia medido não há "0 atrasados": não houve o que medir.
                  valor={vmDia.kpi.presentes === 0 ? "—" : String(vmDia.kpi.atrasados)}
                  tom={vmDia.kpi.atrasados > 0 ? "bad" : "ok"}
                  sub={
                    vmDia.kpi.presentes === 0
                      ? "ninguém bateu entrada neste dia"
                      : `${vmDia.kpi.pontuais} no horário · tolerância aplicada`
                  }
                  icone={AlarmClock}
                />
                <StatCard
                  rotulo="Faltas"
                  valor={String(vmDia.kpi.faltas)}
                  tom={vmDia.kpi.faltas > 0 ? "bad" : "ok"}
                  sub={
                    vmDia.kpi.abonadas > 0
                      ? `${plural(vmDia.kpi.abonadas, "ausência justificada", "ausências justificadas")} (não descontam)`
                      : "só a falta injustificada desconta"
                  }
                  icone={CalendarOff}
                />
                <StatCard
                  rotulo="Em aberto"
                  valor={String(vmDia.kpi.emAberto)}
                  tom={vmDia.kpi.emAberto > 0 ? "warn" : "ok"}
                  sub={vmDia.kpi.emAberto > 0 ? "entrou e não saiu — dia sem total" : "nenhum dia pendente"}
                  icone={Clock}
                />
              </div>

              <Card>
                <SectionTitle
                  titulo={
                    ehData(dia)
                      ? `${dataLonga(dia)}${vmDia.semana === null ? "" : ` · ${NOMES_DIA_SEMANA[vmDia.semana]}`}`
                      : "Escolha um dia"
                  }
                  sub={
                    !ehData(dia)
                      ? "A data não foi entendida."
                      : /* 31/02 passa no formato e não existe no calendário: a
                           escala devolve null, e null aqui vira frase, nunca
                           "previsto null às null". */
                        vmDia.previsto === null
                        ? "Esta data não existe no calendário — escolha outro dia."
                        : vmDia.previsto === 0
                          ? "A escala da casa não prevê trabalho neste dia — nada aqui é atraso."
                          : `Previsto pela escala: ${vmDia.inicio} às ${vmDia.fim} (${duracaoTexto(vmDia.previsto)}). A lista vem ordenada por atraso: quem chegou depois aparece primeiro, e quem não tem registro fica no fim. Clique no nome para ver a pessoa por dentro.`
                  }
                />
                <Pendencias indice={indice} />
                {vmDia.linhas.length === 0 ? (
                  <Empty>Ninguém no quadro para este dia.</Empty>
                ) : (
                  <div className="max-w-full overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th scope="col" className="px-3 py-2">Pessoa</th>
                          {/* A COLUNA DA BARRA NÃO VAI PARA O PAPEL — `sem-impressao`
                              no cabeçalho E em cada célula, para a tabela impressa não
                              ficar com uma coluna a mais no corpo do que no topo. Em
                              cinza as três cores viram o mesmo traço, e traço que não
                              distingue nada ocupando coluna é pior que coluna nenhuma:
                              quem informa no papel são as colunas escritas. */}
                          <th
                            scope="col"
                            className="sem-impressao px-3 py-2"
                            title="A barra do dia: em cinza a janela prevista pela escala, em cor o que foi batido"
                          >
                            O dia
                          </th>
                          <th scope="col" className="px-3 py-2">Entrada</th>
                          <th scope="col" className="px-3 py-2">Saída</th>
                          <th scope="col" className="px-3 py-2" title="Intervalo não pago (o almoço)">Intervalo</th>
                          <th scope="col" className="px-3 py-2">Horas da folha</th>
                          <th scope="col" className="px-3 py-2">Extra +50%</th>
                          <th scope="col" className="px-3 py-2">Extra +100%</th>
                          <th scope="col" className="px-3 py-2" title="Chegada contra a escala, com a tolerância já aplicada">
                            Atraso
                          </th>
                          <th scope="col" className="px-3 py-2">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vmDia.linhas.map((l) => (
                          <tr key={l.pessoa.id} className="align-top">
                            <td className="px-3 py-2">
                              <NomeDaPessoa pessoa={l.pessoa} aoAbrir={abrirPessoa} />
                            </td>
                            <td className="sem-impressao px-3 py-2">
                              <LinhaDoTempoDoDia
                                dia={l.d}
                                inicioPrevisto={vmDia.inicio}
                                fimPrevisto={vmDia.fim}
                                p={l.p}
                                emAberto={l.emAberto}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <EntradaComparada dia={l.d} p={l.p} />
                            </td>
                            <td className="px-3 py-2 tnum">
                              {l.d?.saida || (l.emAberto ? <Nada>não bateu a saída</Nada> : <Nada />)}
                            </td>
                            <td className="px-3 py-2 tnum">
                              {numOuNulo(l.d?.pausaMin) === null ? <Nada /> : duracaoTexto(l.d.pausaMin)}
                            </td>
                            <td className="px-3 py-2 tnum font-medium">
                              {l.min === null ? <Nada>{l.emAberto ? "dia em aberto" : SEM}</Nada> : duracaoTexto(l.min)}
                            </td>
                            {/* Sem dia nenhum é "sem registro"; dia que existe e
                                o relógio não apurou é "sem apuração" — a
                                palavra diz onde procurar. */}
                            <td className="px-3 py-2 tnum">
                              {!l.d ? <Nada /> : l.apurado ? duracaoTexto(l.apurado.extraMin) : <Nada>{SEM_APURACAO}</Nada>}
                            </td>
                            <td className="px-3 py-2 tnum">
                              {!l.d ? (
                                <Nada />
                              ) : l.apurado ? (
                                duracaoTexto(l.apurado.extraDobroMin)
                              ) : (
                                <Nada>{SEM_APURACAO}</Nada>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!l.p ? (
                                <Nada>{vmDia.previsto === 0 ? "fora da escala" : "sem entrada batida"}</Nada>
                              ) : l.p.pontual ? (
                                <span className="text-ok-700">
                                  no horário
                                  {l.p.atrasoBrutoMin > 0 && (
                                    <span className="block text-xs text-slate-500">
                                      {duracaoTexto(l.p.atrasoBrutoMin)} dentro da tolerância
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-bad-700">
                                  <span className="tnum font-semibold">{duracaoTexto(l.p.atrasoMin)}</span>
                                  {/* SÓ O QUE ENCURTOU O DIA é dito. Quem chegou
                                      ANTES tem atraso de entrada negativo, e
                                      escrever "entrou −0h20 depois das 08:00"
                                      transformaria em acusação o dia de quem
                                      madrugou. */}
                                  <span className="block text-xs text-slate-500 tnum">
                                    {[
                                      l.p.atrasoEntradaMin > 0
                                        ? `entrou ${duracaoTexto(l.p.atrasoEntradaMin)} depois das ${l.p.inicioPrevisto}`
                                        : "",
                                      l.p.saidaAntesMin > 0
                                        ? `saiu ${duracaoTexto(l.p.saidaAntesMin)} antes das ${l.p.fimPrevisto}`
                                        : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={l.chipSituacao}>{l.situacao}</span>
                              {l.ausencia?.motivo && (
                                <span className="block text-xs text-slate-500">{l.ausencia.motivo}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* ================================================================
              MÊS
              ================================================================ */}
          {visao === "mes" && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  rotulo="Horas da folha"
                  valor={horasOuNada(vmMes.totais.porColuna.horas)}
                  tom="brand"
                  sub={`previstas na escala: ${duracaoTexto(vmMes.previstoMin)} por pessoa`}
                  icone={Clock}
                />
                <StatCard
                  rotulo="Horas extras"
                  valor={horasOuSemApuracao(somaOuNulo([vmMes.totais.porColuna.extra, vmMes.totais.porColuna.extraDobro]))}
                  tom="neutral"
                  sub={`+50%: ${horasOuSemApuracao(vmMes.totais.porColuna.extra)} · +100%: ${horasOuSemApuracao(
                    vmMes.totais.porColuna.extraDobro
                  )}`}
                  icone={AlarmClock}
                />
                <StatCard
                  rotulo="Faltas que descontam"
                  valor={vmMes.totais.porColuna.faltas === null ? SEM : String(vmMes.totais.porColuna.faltas)}
                  tom={
                    vmMes.totais.porColuna.faltas === null ? "neutral" : vmMes.totais.porColuna.faltas > 0 ? "bad" : "ok"
                  }
                  sub={
                    vmMes.totais.porColuna.abonadas === null
                      ? "ninguém com dia apurado neste mês"
                      : vmMes.totais.porColuna.abonadas > 0
                        ? `${plural(vmMes.totais.porColuna.abonadas, "ausência justificada", "ausências justificadas")}`
                        : "nenhuma ausência justificada lançada"
                  }
                  icone={CalendarOff}
                />
                <StatCard
                  rotulo="Pontualidade média"
                  // NUNCA 0%: sem dia medido é "sem registro", que é o oposto de
                  // "nunca chega no horário".
                  valor={
                    vmMes.totais.porColuna.pontualidade === null
                      ? SEM
                      : `${Math.round(vmMes.totais.porColuna.pontualidade)}%`
                  }
                  tom={
                    vmMes.totais.porColuna.pontualidade === null
                      ? "neutral"
                      : vmMes.totais.porColuna.pontualidade >= 90
                        ? "ok"
                        : vmMes.totais.porColuna.pontualidade >= 70
                          ? "warn"
                          : "bad"
                  }
                  sub={
                    vmMes.totais.diasMedidos === 0
                      ? "nenhum dia medido neste mês"
                      : `${vmMes.totais.diasPontuais} de ${vmMes.totais.diasMedidos} dias medidos`
                  }
                  icone={Percent}
                />
              </div>

              <Card>
                <SectionTitle
                  titulo={`Mês a mês — ${rotuloCompetencia(competencia)}`}
                  sub="Clique no título da coluna para ordenar. Quem não tem medição fica sempre no fim, nas duas direções."
                />
                <Pendencias indice={indice} />
                {vmMes.totais.emAberto > 0 && (
                  <p className="mb-3 text-xs text-slate-500">
                    <span className="chip-warn">
                      {plural(vmMes.totais.emAberto, "dia em aberto", "dias em aberto")}
                    </span>{" "}
                    ficam fora de toda soma — dia que não terminou não tem total.
                    {vmMes.totais.estranhas > 0 &&
                      ` E há ${plural(vmMes.totais.estranhas, "ausência de tipo desconhecido", "ausências de tipo desconhecido")}: confira na aba Faltas.`}
                  </p>
                )}
                {vmMes.linhas.length === 0 ? (
                  <Empty>Ninguém com registro neste mês.</Empty>
                ) : (
                  <div className="max-w-full overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <ThOrdenavel
                            col={{ chave: "nome", rotulo: "Pessoa" }}
                            ordem={ordem}
                            aoOrdenar={ordenarPor}
                          />
                          {COLUNAS_MES.map((c) => (
                            <ThOrdenavel key={c.chave} col={c} ordem={ordem} aoOrdenar={ordenarPor} />
                          ))}
                          <th scope="col" className="px-3 py-2 align-bottom">Fechamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vmMes.linhas.map((l) => (
                          <tr key={l.pessoa.id} className="align-top">
                            <td className="px-3 py-2">
                              <NomeDaPessoa pessoa={l.pessoa} aoAbrir={abrirPessoa}>
                                {l.ag.diasComRegistro === 0 && (
                                  <span className="block text-xs text-slate-400">sem nenhum dia neste mês</span>
                                )}
                              </NomeDaPessoa>
                            </td>
                            {/* O NÚMERO DO MÊS TAMBÉM É PORTA. O mês não tem um dia
                                para onde levar — ele tem trinta —, e quem clica num
                                total de mês quer ver de onde ele veio. Então a célula
                                abre o painel da pessoa naquele mês, onde o dia a dia
                                está listado e cada dia leva à visão Dia. */}
                            {COLUNAS_MES.map((c) => (
                              <td key={c.chave} className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => abrirPessoa(l.pessoa)}
                                  className="block w-full text-left underline-offset-2 hover:text-brand-700 hover:underline"
                                  title={`${c.rotulo} de ${l.nome} em ${rotuloCompetencia(competencia)} — abrir o dia a dia`}
                                >
                                  {celulaDoMes(c, l)}
                                </button>
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              <span className={l.fechado ? "chip-ok" : l.temLancamento ? "chip" : "text-slate-400"}>
                                {l.fechamento}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-display text-sm font-semibold">
                        <tr>
                          <td className="px-3 py-2">Total ({plural(vmMes.linhas.length, "pessoa", "pessoas")})</td>
                          {COLUNAS_MES.map((c) => {
                            const v = vmMes.totais.porColuna[c.chave];
                            return (
                              <td key={c.chave} className="px-3 py-2 tnum">
                                {v === null || v === undefined ? (
                                  <Nada />
                                ) : c.tipo === "horas" ? (
                                  duracaoTexto(v)
                                ) : c.tipo === "pct" ? (
                                  `${Math.round(v)}%`
                                ) : (
                                  v
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* ================================================================
              ANO
              ================================================================ */}
          {visao === "ano" && (
            <Card>
              <SectionTitle
                titulo={`${vmAno.medida.rotulo} — ${ano}`}
                sub={`${vmAno.medida.ajuda} Esta visão é a TENDÊNCIA: doze colunas, uma por mês.`}
              />
              <Pendencias indice={indice} />
              <p className="mb-3 text-xs text-slate-500">
                Célula com <Nada>—</Nada> é <strong>sem registro</strong>, e não zero: naquele mês não houve o que
                medir (ninguém tinha entrado na casa, ou o relógio não trouxe o dia).
                {vmAno.medida.chave === "pontualidade" &&
                  " A linha de total é a razão dos dias juntados (pontuais ÷ medidos), nunca a média das porcentagens — quem trabalhou 2 dias não pode pesar como quem trabalhou 22."}
              </p>
              {vmAno.linhas.length === 0 ? (
                <Empty>Ninguém com registro neste ano.</Empty>
              ) : (
                <div className="max-w-full overflow-x-auto">
                  <table className="w-full min-w-[1080px] text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="px-3 py-2">Pessoa</th>
                        {MESES.map((m) => (
                          <th key={m} scope="col" className="px-2 py-2 text-right">{m}</th>
                        ))}
                        <th scope="col" className="px-3 py-2 text-right">
                          {vmAno.medida.chave === "pontualidade" ? "Ano" : "Total"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vmAno.linhas.map((l) => (
                        <tr key={l.pessoa.id}>
                          <td className="px-3 py-2">
                            <NomeDaPessoa pessoa={l.pessoa} aoAbrir={abrirPessoa} />
                          </td>
                          {/* CLICAR EM MARÇO ABRE MARÇO. A célula do mês leva à visão
                              Mês já no mês clicado e já com esta pessoa no filtro —
                              sem isso, para ver março a pessoa troca de visão e
                              reencontra o recorte na mão. Célula vazia também abre: o
                              mês sem registro é justamente o que se quer conferir. */}
                          {l.valores.map((v, i) => (
                            <td key={vmAno.meses[i]} className="px-2 py-2 text-right tnum">
                              <button
                                type="button"
                                onClick={() => irParaMes(vmAno.meses[i], l.pessoa)}
                                className="w-full text-right underline-offset-2 hover:text-brand-700 hover:underline"
                                title={
                                  v === null || v === undefined
                                    ? `${MESES_LONGOS[i]}: sem registro — abrir o mês de ${l.nome}`
                                    : `${MESES_LONGOS[i]}: ${textoDaMedida(v, vmAno.medida.unidade)} — abrir o mês de ${l.nome}`
                                }
                              >
                                {v === null || v === undefined ? <Nada>—</Nada> : textoDaMedida(v, vmAno.medida.unidade)}
                              </button>
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right tnum font-semibold">
                            {l.total === null ? <Nada>—</Nada> : textoDaMedida(l.total, vmAno.medida.unidade)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-display text-sm font-semibold">
                      <tr>
                        <td className="px-3 py-2">
                          {vmAno.medida.chave === "pontualidade" ? "Da casa" : "Total do mês"}
                        </td>
                        {vmAno.totalPorMes.map((v, i) => (
                          <td key={vmAno.meses[i]} className="px-2 py-2 text-right tnum">
                            {/* O rodapé é o total da casa: abre o mês SEM mexer no
                                filtro de pessoa, que é o recorte que ele soma. */}
                            <button
                              type="button"
                              onClick={() => irParaMes(vmAno.meses[i], null)}
                              className="w-full text-right underline-offset-2 hover:text-brand-700 hover:underline"
                              title={`Abrir ${MESES_LONGOS[i]} de ${ano} na visão Mês`}
                            >
                              {v === null ? <Nada>—</Nada> : textoDaMedida(v, vmAno.medida.unidade)}
                            </button>
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right tnum">
                          {vmAno.totalGeral === null ? <Nada>—</Nada> : textoDaMedida(vmAno.totalGeral, vmAno.medida.unidade)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* ================================================================
              COMPARAR
              ================================================================ */}
          {visao === "comparar" && (
            <Card>
              <SectionTitle
                titulo={`Comparação — ${vmComp.medida.rotulo}`}
                sub={vmComp.medida.ajuda}
              />
              {!vmComp.valido ? (
                <Empty>
                  Período inválido: {vmComp.erroA ? `período anterior com ${vmComp.erroA}` : ""}
                  {vmComp.erroA && vmComp.erroB ? " e " : ""}
                  {vmComp.erroB ? `período novo com ${vmComp.erroB}` : ""}. Corrija as datas para a tela poder comparar.
                </Empty>
              ) : (
                <>
                  <Pendencias indice={indice} />
                  <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <CalendarDays size={13} className="text-slate-400" />
                    <span className="tnum">
                      Anterior: {dataLonga(periodos.aDe)} a {dataLonga(periodos.aAte)} ({vmComp.corridosA} dias corridos,{" "}
                      {vmComp.escalaA === null ? "período longo demais para contar os dias de escala" : `${vmComp.escalaA} de escala`})
                    </span>
                    <span className="tnum">
                      · Novo: {dataLonga(periodos.bDe)} a {dataLonga(periodos.bAte)} ({vmComp.corridosB} dias corridos,{" "}
                      {vmComp.escalaB === null ? "período longo demais para contar os dias de escala" : `${vmComp.escalaB} de escala`})
                    </span>
                    {vmComp.tamanhosDiferentes && (
                      <span className="chip-warn">
                        os períodos têm tamanhos diferentes ({vmComp.escalaA ?? "?"} × {vmComp.escalaB ?? "?"} dias de
                        escala) — o total não se compara; olhe a coluna “por dia”
                      </span>
                    )}
                  </p>
                  {vmComp.linhas.length === 0 ? (
                    <Empty>Ninguém com registro em nenhum dos dois períodos.</Empty>
                  ) : (
                    <div className="max-w-full overflow-x-auto">
                      <table className="w-full min-w-[1040px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th scope="col" className="px-3 py-2">Pessoa</th>
                            <th scope="col" className="px-3 py-2 text-right">Anterior</th>
                            <th scope="col" className="px-3 py-2 text-right" title="Total ÷ dias que a escala prevê no período">
                              por dia
                            </th>
                            <th scope="col" className="px-3 py-2 text-right">Novo</th>
                            <th scope="col" className="px-3 py-2 text-right" title="Total ÷ dias que a escala prevê no período">
                              por dia
                            </th>
                            <th scope="col" className="px-3 py-2">Diferença</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {vmComp.linhas.map((l) => {
                            // A MÉDIA DIÁRIA não existe para porcentagem: 92% ÷
                            // 21 dias não é número nenhum. A coluna escreve "—"
                            // em vez de inventar uma divisão.
                            const porDia = (v, dias) =>
                              vmComp.medida.somavel === false ? null : textoPorDia(v, dias, vmComp.medida.unidade);
                            const pdA = porDia(l.valorA, vmComp.escalaA);
                            const pdB = porDia(l.valorB, vmComp.escalaB);
                            return (
                              <tr key={l.pessoa.id} className="align-top">
                                <td className="px-3 py-2">
                                  <NomeDaPessoa pessoa={l.pessoa} aoAbrir={abrirPessoa} />
                                </td>
                                <td className="px-3 py-2 text-right tnum">
                                  {l.valorA === null ? <Nada /> : textoDaMedida(l.valorA, vmComp.medida.unidade)}
                                </td>
                                <td className="px-3 py-2 text-right tnum text-slate-500">
                                  {pdA === null ? <Nada>—</Nada> : pdA}
                                </td>
                                <td className="px-3 py-2 text-right tnum">
                                  {l.valorB === null ? <Nada /> : textoDaMedida(l.valorB, vmComp.medida.unidade)}
                                </td>
                                <td className="px-3 py-2 text-right tnum text-slate-500">
                                  {pdB === null ? <Nada>—</Nada> : pdB}
                                </td>
                                <td className="px-3 py-2">
                                  <Variacao medida={vmComp.medida} valorA={l.valorA} valorB={l.valorB} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-display text-sm font-semibold">
                          <tr>
                            <td className="px-3 py-2">Total ({plural(vmComp.linhas.length, "pessoa", "pessoas")})</td>
                            <td className="px-3 py-2 text-right tnum">
                              {vmComp.totalA === null ? <Nada /> : textoDaMedida(vmComp.totalA, vmComp.medida.unidade)}
                            </td>
                            <td className="px-3 py-2 text-right tnum text-slate-500">
                              {vmComp.medida.somavel === false ? (
                                <Nada>—</Nada>
                              ) : (
                                textoPorDia(vmComp.totalA, vmComp.escalaA, vmComp.medida.unidade) || <Nada>—</Nada>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tnum">
                              {vmComp.totalB === null ? <Nada /> : textoDaMedida(vmComp.totalB, vmComp.medida.unidade)}
                            </td>
                            <td className="px-3 py-2 text-right tnum text-slate-500">
                              {vmComp.medida.somavel === false ? (
                                <Nada>—</Nada>
                              ) : (
                                textoPorDia(vmComp.totalB, vmComp.escalaB, vmComp.medida.unidade) || <Nada>—</Nada>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Variacao medida={vmComp.medida} valorA={vmComp.totalA} valorB={vmComp.totalB} />
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}

      {/* O PAINEL DA PESSOA — fora da folha impressa (`sem-impressao`): a
          janela cobre a tela inteira, e um relatório impresso com ela aberta
          sairia com o detalhe de uma pessoa por cima da tabela de todas. */}
      {pessoaDoDetalhe && detalhe && (
        <div className="sem-impressao">
          <PessoaDetalhe
            pessoa={pessoaDoDetalhe}
            diaFoco={detalhe.dia}
            grupo={indice.porPessoa.get(pessoaDoDetalhe.id) || null}
            jornada={cfg.jornada}
            aoFechar={() => setDetalhe(null)}
            aoEscolherDia={(d) => setDetalhe((v) => (v ? { ...v, dia: d } : v))}
            aoVerNoDia={irParaDia}
            aoVerNoMes={(c) => irParaMes(c, pessoaDoDetalhe)}
          />
        </div>
      )}
    </>
  );
}
