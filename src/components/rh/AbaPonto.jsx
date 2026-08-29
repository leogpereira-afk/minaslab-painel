// Aba Ponto do RH — o relógio da MinasLab, que é o JIBBLE, e o fechamento do
// mês que sai dele.
//
// A tela funciona nos DOIS MUNDOS, de propósito: com as batidas importadas pela
// ponte (Edge Function ml-ponto → coleção "rh_ponto_dia") e sem nenhuma batida,
// lançando as horas à mão no fechamento. Sem isso, o mês em que o relógio ficar
// fora do ar viraria um mês sem folha.
//
// ============================================================================
// CONTRATO — props que esta aba recebe da casca (pages/RH.jsx)
// ----------------------------------------------------------------------------
//   pessoas    Object[]  todas as fichas (rh_pessoas), ativas e desligadas.
//   ativos     Object[]  só quem está no quadro, já ordenado por nome.
//   ponto      Object[]  coleção "rh_ponto" — o FECHAMENTO por pessoa/mês.
//   pontoDia   Object[]  coleção "rh_ponto_dia" — o dia, batida a batida.
//   hojeISO    string    "AAAA-MM-DD" LOCAL, vindo de ymdLocal(new Date()).
//   editavel   boolean   podeEditar(getSessao()): esconde os botões de escrita.
//   gravar     (colecao, registro, fraseOk, fechar?) => Promise<void>
//   apagarReg  (colecao, id, fraseOk) => Promise<void>
//   setAviso   (aviso|null) => void   { tipo: "ok" | "erro", texto }.
//
// ----------------------------------------------------------------------------
// CONTRATO DAS COLEÇÕES (o que esta aba lê e grava)
//
// "rh_ponto_dia" — o dia. Desde 27/08/2026 a ponte grava em produção o que o
//   RELÓGIO JÁ APUROU, respeitando a escala de cada pessoa:
//   { id: "pd_<jibbleId>_<AAAA-MM-DD>", jibbleId, pessoaId (se a tela vinculou),
//     pessoaNome, data, entrada, saida ("HH:MM"),
//     pausaMin       — intervalo NÃO pago (o almoço)
//     pausaPagaMin   — intervalo pago
//     trabalhadoMin  — o payrollHours: O QUE VAI PARA A FOLHA (null = EM ABERTO)
//     trackedMin     — tempo de crachá aberto (entrada até saída, pausa dentro)
//     extraMin       — hora extra de DIA NORMAL, já apurada (+50%)
//     extraDobroMin  — extra de descanso/feriado/dobra, já apurada (+100%)
//     emAberto       — entrou e não saiu
//     origem: "jibble", corrigido: false }
//   E o dia de AUSÊNCIA, que nasce SEMPRE aqui (o relógio não sabe por que
//   alguém não veio), com origem "manual" e corrigido: true:
//     ausencia: { tipo, motivo, documento }
//       tipo         — "falta" | "atestado" | "justificada" | "ferias" | "folga"
//       motivo       — texto livre; a palavra de quem estava lá vale mais que
//                      uma etiqueta
//       documento    — a referência do atestado, quando houver
//     Só "falta" desconta (1/30 do salário). Ver TIPOS_AUSENCIA em lib/rh/ponto.js.
//     Remover a ausência é gravar `ausencia: null` — lançamento errado tem de
//     ter volta, senão o RH aprende a não lançar.
//   OS TRÊS NÚMEROS DO DIA NÃO FECHAM POR SUBTRAÇÃO, e a tela nunca os escreve
//   como se fechassem: 17/08 teve 10h16 de crachá, 1h04 de intervalo e 8h12
//   para a folha. Quem concilia é a escala, e quem apura a escala é o relógio.
//   Esta tela ACRESCENTA, ao corrigir ou lançar à mão:
//     pessoaId          — o id da ficha (a ponte só conhece o jibbleId)
//     origem: "manual"  — dia que nasceu aqui, não no relógio
//     corrigido: true   — PROTEGE o dia: a importação seguinte não sobrescreve
//     relogioEntrada / relogioSaida / relogioPausaMin /
//     relogioTrabalhadoMin / relogioExtraMin / relogioExtraDobroMin
//                       — o que o relógio tinha trazido E APURADO, carimbado na
//                         PRIMEIRA correção; é o que deixa saber depois o que é
//                         da máquina e o que é do RH.
//   E LIMPA `extraMin`/`extraDobroMin` quando a correção mexe nas batidas: a
//   apuração do relógio descreve as batidas do relógio. Mudou a batida, aquele
//   número deixou de descrever o dia — fica guardado no carimbo, e o dia passa
//   a valer pela conta desta casa.
//
// "rh_ponto" — o fechamento de uma pessoa num mês:
//   { id: "pt_<pessoaId>_<AAAA-MM>", pessoaId, pessoaNome (carimbo),
//     competencia, horasExtrasMin, horasExtrasDobroMin, faltas (dias),
//     atrasosMin, adicionalNoturnoMin, valorHoraExtra, valorFaltas,
//     valorCalculado, valorLancado, obs, fechado, fechadoEm }
//   AS DUAS FAIXAS DE EXTRA MORAM EM CAMPOS SEPARADOS: `horasExtrasMin` no
//   fator escolhido (+50% de dia útil, por padrão) e `horasExtrasDobroMin`
//   sempre em +100%. Somadas num campo só, a tela teria de adivinhar o fator na
//   hora de refazer a conta — e adivinhar erra em dinheiro.
//   Registro ANTIGO não tem `horasExtrasDobroMin`, e continua valendo: entra
//   como 0, porque a faixa não existia quando ele foi gravado (a dobra daquela
//   época foi lançada em `horasExtrasMin` com `fatorHoraExtra` 2).
//   Acrescentados aqui, e todos CARIMBO DOS PARÂMETROS DA CONTA:
//     salarioBase, divisor, fatorHoraExtra, fatorHoraExtraDobro,
//     percentualNoturno, valorNoturno
//   Mais o carimbo da PROCEDÊNCIA, que a conta escrita repete para quem lê:
//     origemExtras / origemExtrasDobro — "relogio" quando o que foi lançado é
//     exatamente o que o relógio apurou, "manual" quando saiu do dedo de
//     alguém. É carimbo, e não comparação refeita na leitura: batida corrigida
//     amanhã mudaria a apuração e a linha de um mês já conferido passaria a
//     dizer outra coisa.
//   Por quê: sem eles, reabrir janeiro depois de um aumento (ou depois de o
//   acordo coletivo mudar o divisor) reescreveria a conta de janeiro com os
//   números de hoje. O que foi conferido e fechado tem de continuar dizendo a
//   mesma coisa daqui a dois anos.
//   ATENÇÃO ao nome herdado: `valorHoraExtra` é o TOTAL em R$ das horas extras
//   (irmão de `valorFaltas`), não o preço da hora — o preço da hora se refaz do
//   carimbo e aparece na conta escrita.
//
// "rh_pessoas" ganha um campo: `jibbleId` — o de-para entre a ficha e o
//   relógio. Mora na FICHA (e não numa coleção de-para) porque é atributo da
//   pessoa, como a matrícula: uma pessoa, um crachá no relógio.
//
// ----------------------------------------------------------------------------
// DECISÕES QUE NÃO SE DISCUTEM (as regras de dinheiro estão em lib/rh/ponto.js,
// com o porquê de cada uma; aqui ficam as da TELA)
//
// - QUEM NÃO BATE PONTO SOME (decisão do Léo, 28/08/2026). `batePonto === false`
//   na ficha (campo editado em rh/AbaPessoas.jsx) tira a pessoa desta aba
//   inteira: da lista, dos cartões, dos totais, da planilha e dos seletores de
//   lançamento. Quem não é medido pelo relógio não tem fechamento de ponto para
//   conferir. AUSENTE OU true = BATE — ficha antiga não tem o campo, e ler
//   undefined como "não bate" esvaziaria a aba de uma vez, em silêncio.
// - O RECORTE Ativos | Todos | Desligados nasce em "Ativos" e fica guardado em
//   localStorage. Cartões, totais, planilha e o botão "Fechar competência"
//   valem SÓ para o recorte à mostra — e todos dizem em qual recorte estão.
//   Quem ficou de fora é contado numa linha embaixo dos cartões: esconder gente
//   sem dizer quanta faz o total do mês parecer o total da casa.
// - ID MANDA, NOME SÓ EXIBE: a batida casa com a ficha por `pessoaId` ou por
//   `jibbleId`, nunca por nome. Casar por nome cria sósia e some com gente.
// - Batida sem vínculo NÃO SOME da tela: aparece como "pessoa não vinculada",
//   com o nome que o relógio mandou, e entra na conta de pendências. Sumir
//   esconderia trabalho de gente real. É a única linha que o recorte não filtra
//   — ela ainda não é de ninguém.
// - O PAINEL "Vincular ao relógio" SÓ APARECE QUANDO HÁ ID SEM FICHA. O vínculo
//   nasce pronto na sincronização; painel sempre aberto oferecia uma tarefa que
//   não existe, e tarefa que não existe confunde quem abre a tela procurando o
//   que fazer.
// - O QUE O RELÓGIO APUROU MANDA: a sugestão do mês é a SOMA de `extraMin` e
//   `extraDobroMin` dos dias, e não trabalhado-contra-previsto. Refazer a conta
//   de um dia que o relógio já apurou (respeitando a escala) cria um segundo
//   resultado, e o painel passa a divergir do que a própria pessoa vê no
//   aplicativo do Jibble. A conta derivada só vale para o dia lançado à mão.
// - Dia sem batida NÃO é falta e NÃO é zero hora: é "sem registro". Falta é
//   afirmação trabalhista (pode ser feriado, folga ou atestado) e quem afirma é
//   o RH, LANÇANDO a ausência no dia. O campo Faltas do fechamento só é
//   sugerido a partir do que foi lançado como "falta" — nunca deduzido da
//   ausência de linha, que numa empresa que acabou de ligar o relógio
//   inventaria desconto na folha de quem estava trabalhando.
// - O PREVISTO DO DIA SAI DA ESCALA DA CASA, não de uma média. Segunda a
//   quinta 9h, sexta 8h, fim de semana nenhuma — 44h na semana, que é o mesmo
//   fato que o divisor 220. A média de 44h ÷ 5 = 8h48 que havia aqui antes
//   inventava 48 min de atraso toda sexta e cobrava jornada inteira de quem foi
//   trabalhar no sábado. A escala é configurável (parâmetros do ponto).
// - Sem salário na ficha não há conta: a linha vira pendência escrita, nunca
//   R$ 0,00 mudo.
// - A diferença entre o valor lançado e o calculado é DERIVADA dos dois valores
//   gravados e aparece na linha, no modal e na planilha. Não é escrita dentro
//   de `obs`: texto copiado para dentro de um campo envelhece no primeiro
//   reajuste e passa a mentir; derivada, ela nunca desmente os números.

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  AlarmClock, CalendarClock, CalendarOff, CircleAlert, Clock, Download, Link2, Lock, LockOpen,
  Pencil, Plus, RefreshCw, Settings2, Trash2, Unlink, Wallet,
} from "lucide-react";
import { lerCfg, listar, salvarCfg } from "../../services/dados.js";
import { importarPeriodo } from "../../services/ponto.js";
import { dataLonga, moedaCheia, paraNumero, MESES_LONGOS } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import {
  ADICIONAIS_HE, apuracaoDoRelogio, apurarCompetencia, atrasoDoDia, ausenciaDoDia,
  calcularFechamento, cfgDoPonto, competenciaDe, descreverJornada, diferencaDoCalculo,
  divisorDaJornada, duracaoCampo, duracaoTexto, horasDecimais, jornadaParaCfg,
  minutosDaDuracao, minutosDoDia, minutosEntre, minutosPrevistosDoMes,
  minutosTrabalhados, normalizarJornada, origemDoLancamento,
  FATOR_HE_DOBRA, NOMES_DIA_SEMANA, TIPOS_AUSENCIA, TOLERANCIA_DIA_MIN, TOLERANCIA_MARCACAO_MIN,
} from "../../lib/rh/ponto.js";
import { SectionTitle, Empty, Modal, Card, StatCard, Segmented } from "../ui.jsx";
import PessoaDetalhe from "../ponto/PessoaDetalhe.jsx";
import { anoRuim } from "./uteis.js";

const COL_DIA = "rh_ponto_dia";
const COL_FECHAMENTO = "rh_ponto";

// O grupo das batidas que não casaram com ficha nenhuma.
const SEM_VINCULO = "__sem_vinculo__";

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const txt = (v) => String(v ?? "").trim();

/* QUEM BATE PONTO — a leitura, num lugar só, e ela NÃO PODE SER INVERTIDA.
   Quem decide é a FICHA (campo `batePonto`, editado em rh/AbaPessoas.jsx):
   ausente ou true = bate; só o `false` gravado por alguém tira a pessoa desta
   aba. Ficha antiga não tem o campo, e ler undefined como "não bate" tiraria o
   quadro inteiro da cobrança de uma vez, sem erro nenhum. */
const batePontoDe = (p) => p?.batePonto !== false;

/* O RECORTE DA LISTA. "Ativos" é o padrão: com 13 fichas desligadas de 20, a
   lista sem recorte é a lista em que ninguém acha ninguém. A escolha FICA
   GUARDADA, como nas outras telas. */
const RECORTES = [
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "todos", rotulo: "Todos" },
  { valor: "desligados", rotulo: "Desligados" },
];
const K_RECORTE = "minaslab.rh.ponto.recorte";
const rotuloDoRecorte = (v) => RECORTES.find((r) => r.valor === v)?.rotulo || "Ativos";

function lerRecorte() {
  try {
    const salvo = localStorage.getItem(K_RECORTE);
    return RECORTES.some((r) => r.valor === salvo) ? salvo : "ativos";
  } catch {
    // Sem localStorage a escolha só não persiste.
    return "ativos";
  }
}

/** Desligada é `ativo === false`; ficha antiga sem o campo conta como do quadro. */
function noRecorte(p, recorte) {
  if (recorte === "todos") return true;
  if (recorte === "desligados") return p?.ativo === false;
  return p?.ativo !== false;
}

/**
 * A linha que diz quem a aba deixou de fora, e por quê.
 *
 * Cartão e total que contam menos gente do que a casa tem, sem dizer quanto,
 * é número que ninguém confere — e aqui os números viram folha de pagamento.
 */
function frasesDoFora(fora, recorte) {
  const out = [];
  if (fora.semPonto > 0) {
    out.push(
      `${plural(fora.semPonto, "pessoa não bate ponto", "pessoas não batem ponto")} (quem diz é a ficha, no RH)` +
        (fora.semPontoComRegistro > 0
          ? ` — ${plural(fora.semPontoComRegistro, "delas tem movimento neste mês", "delas têm movimento neste mês")}, confira a ficha`
          : "")
    );
  }
  if (fora.recorte > 0) {
    out.push(
      recorte === "desligados"
        ? `${plural(fora.recorte, "pessoa está no quadro", "pessoas estão no quadro")} — veja em “Ativos” ou “Todos”`
        : `${plural(fora.recorte, "pessoa desligada", "pessoas desligadas")} — veja em “Todos”`
    );
  }
  if (fora.batidas > 0) {
    out.push(`${plural(fora.batidas, "dia de batida", "dias de batida")} delas fora da lista`);
  }
  return out;
}

// Número que pode não existir — a mesma régua da lib: "" e null NÃO são 0.
// Number("") devolve 0, e é assim que "não veio" vira "foi zero" na tela.
const numOuNulo = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Dinheiro que pode não existir. null é "não dá para calcular", e a frase diz
// isso — R$ 0,00 aqui seria uma afirmação falsa sobre a folha de alguém.
const dinheiro = (v) => (v === null || v === undefined || v === "" ? "sem valor" : moedaCheia(v));
const horasOuNada = (min) => duracaoTexto(min) || "sem registro";
// Na SUGESTÃO, null quer dizer outra coisa: ninguém mediu aquela faixa. Dizer
// "0h00" ali afirmaria "não houve hora extra" sem ter havido apuração.
const horasOuSemApuracao = (min) => duracaoTexto(min) || "sem apuração";

function rotuloCompetencia(c) {
  const [ano, mes] = String(c || "").split("-");
  const nome = MESES_LONGOS[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : String(c || "");
}

function rotuloFator(f) {
  const achado = ADICIONAIS_HE.find((a) => a.fator === Number(f));
  if (achado) return achado.curto;
  return `+${Math.round((Number(f) - 1) * 100)}%`;
}

/**
 * A ausência do dia em uma frase, para a linha e para a planilha.
 *
 * O motivo entra porque é ele que explica: "atestado" diz o que a empresa faz
 * com o dia, "consulta no ortopedista" diz o que aconteceu com a pessoa. O
 * documento entra porque é o que se procura na gaveta seis meses depois.
 */
function textoDaAusencia(a) {
  if (!a) return "";
  return [a.rotulo, a.motivo, a.documento ? `doc. ${a.documento}` : ""].filter(Boolean).join(" · ");
}

/**
 * A PONTUALIDADE do dia em uma frase, ou "" quando não há nada a dizer.
 *
 * Só fala quando a batida ENCURTOU o dia. Escrever "na hora prevista" em toda
 * linha encheria o extrato de ruído, e ruído é o que faz parar de ler
 * justamente a linha que importava.
 *
 * Quando fala, diz os DOIS números que a lib separou: o atraso cru e o que a
 * tolerância do art. 58 § 1º deixa cobrar. Escrever só um esconde metade do
 * fato — ou a pessoa parece pontual tendo chegado tarde, ou parece devedora de
 * minutos que a lei manda ignorar.
 */
function textoDaPontualidade(p) {
  if (!p || p.atrasoBrutoMin === 0) return "";
  const partes = [];
  if (p.atrasoEntradaMin > 0) partes.push(`entrou ${duracaoTexto(p.atrasoEntradaMin)} depois das ${p.inicioPrevisto}`);
  if (p.saidaAntesMin > 0) partes.push(`saiu ${duracaoTexto(p.saidaAntesMin)} antes das ${p.fimPrevisto}`);
  return `${partes.join(" · ")} — ${
    p.tolerado
      ? `dentro da tolerância da CLT (${TOLERANCIA_MARCACAO_MIN} min por marcação, ${TOLERANCIA_DIA_MIN} no dia): não desconta`
      : `${duracaoTexto(p.atrasoMin)} de atraso fora da tolerância`
  }`;
}

// Número de dias/minutos que veio de campo de texto. Campo em branco no
// formulário de lançamento é "não houve" — 0 — e não "não sei": quem preenche
// está olhando o mês inteiro e decidindo.
function inteiroDoCampo(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * O previsto de UMA linha do editor de escala (dois turnos: manhã e tarde).
 *
 * Devolve null quando um par ficou pela metade — entrada sem saída, ou saída
 * sem entrada. Null é o que TRAVA o Gravar. Zero seria "não se trabalha neste
 * dia", e gravar isso por causa de um campo esquecido apagaria uma jornada
 * inteira em silêncio: no mês seguinte a segunda-feira valeria hora extra do
 * primeiro minuto.
 */
function previstoDaLinha(l) {
  let total = 0;
  for (const par of [[l?.i1, l?.f1], [l?.i2, l?.f2]]) {
    const inicio = txt(par[0]);
    const fim = txt(par[1]);
    if (!inicio && !fim) continue;
    const min = minutosEntre(inicio, fim);
    if (min === null || min <= 0) return null;
    total += min;
  }
  return total;
}

/** A escala normalizada → as linhas do editor. */
function linhasDaJornada(jornada) {
  return normalizarJornada(jornada).dias.map((d) => ({
    dia: d.dia,
    i1: d.turnos[0]?.inicio || "",
    f1: d.turnos[0]?.fim || "",
    i2: d.turnos[1]?.inicio || "",
    f2: d.turnos[1]?.fim || "",
  }));
}

/** As linhas do editor → a escala do jeito que se grava na configuração. */
function jornadaDasLinhas(linhas) {
  return (linhas || []).map((l) => ({
    dia: l.dia,
    turnos: [
      { inicio: txt(l.i1), fim: txt(l.f1) },
      { inicio: txt(l.i2), fim: txt(l.f2) },
    ].filter((t) => t.inicio && t.fim),
  }));
}

/* O editor da tela faz DOIS turnos por dia, que é a escala da casa. Escala
   gravada com três (jornada partida em três pedaços, plantão) não cabe aqui — e
   abrir o editor mesmo assim apagaria o terceiro turno no primeiro Gravar, em
   silêncio. Quando isso acontece, a tela mostra a escala e não deixa editar. */
const jornadaCabeNoEditor = (jornada) => normalizarJornada(jornada).dias.every((d) => d.turnos.length <= 2);

/**
 * Um dia, uma apuração.
 *
 * O mesmo dia pode aparecer duas vezes quando alguém lançou à mão ANTES de a
 * pessoa ser vinculada ao relógio e a importação trouxe o mesmo dia depois — os
 * ids são diferentes (pdm_… e pd_…), então nenhum sobrescreve o outro. Vale a
 * batida corrigida/lançada à mão, que é a que alguém conferiu.
 *
 * Nada some: as duas linhas continuam no extrato e a linha do fechamento diz
 * que há dia repetido. Somar as duas inflaria hora extra — e isso é dinheiro.
 */
function porDiaUnico(dias) {
  const mapa = new Map();
  for (const d of dias) {
    const atual = mapa.get(d.data);
    if (!atual || (d.corrigido === true && atual.corrigido !== true)) mapa.set(d.data, d);
  }
  return { unicos: [...mapa.values()], repetidos: dias.length - mapa.size };
}

/**
 * De onde veio o número da hora extra, em palavras.
 *
 * Quem lê a conta precisa saber se aquilo é do Jibble ou do dedo de alguém —
 * são duas responsabilidades diferentes, e só uma delas se confere no
 * aplicativo do funcionário.
 *
 * Registro gravado ANTES desta versão não tem o carimbo, e nesse caso "lançado
 * à mão" é a leitura correta e não um chute: antes de 27/08/2026 não existia
 * apuração do relógio para copiar — tudo que está gravado ali foi digitado.
 */
const MARCA_FONTE = {
  relogio: "apurado pelo relógio",
  manual: "lançado à mão",
  misto: "parte do relógio, parte à mão",
};
const marcaDaFonte = (origem) => ` (${MARCA_FONTE[origem] || MARCA_FONTE.manual})`;

/**
 * A CONTA ESCRITA PASSO A PASSO.
 *
 * Cada passo é composto dos MESMOS números que a lib devolveu — é isso que faz
 * a conta da tela ser a conta do sistema. Quem conferir na calculadora tem que
 * chegar no mesmo lugar, senão o RH volta para a planilha.
 *
 * As duas faixas de hora extra saem em DUAS LINHAS quando as duas existem: são
 * dois valores-hora diferentes (+50% e +100%) e uma linha só esconderia qual
 * fator gerou qual parcela.
 */
function passosDaConta(c, fonte = {}) {
  if (!c || c.semSalario) return [];
  const passos = [];
  if (c.horasExtrasMin > 0) {
    passos.push(
      `Hora extra ${rotuloFator(c.fator)}${marcaDaFonte(fonte.extras)}: ${moedaCheia(c.salarioBase)} ÷ ${c.divisor} = ${moedaCheia(c.valorHora)}/h` +
        ` · com ${rotuloFator(c.fator)} = ${moedaCheia(c.valorHoraExtra)}/h` +
        ` · × ${duracaoTexto(c.horasExtrasMin)} = ${moedaCheia(c.valorExtras)}`
    );
  }
  if (c.horasExtrasDobroMin > 0) {
    passos.push(
      `Hora extra ${rotuloFator(c.fatorDobro)}${marcaDaFonte(fonte.extrasDobro)}: ${moedaCheia(c.salarioBase)} ÷ ${c.divisor} = ${moedaCheia(c.valorHora)}/h` +
        ` · com ${rotuloFator(c.fatorDobro)} = ${moedaCheia(c.valorHoraExtraDobro)}/h` +
        ` · × ${duracaoTexto(c.horasExtrasDobroMin)} = ${moedaCheia(c.valorExtrasDobro)}`
    );
  }
  if (c.adicionalNoturnoMin > 0) {
    passos.push(
      `Adicional noturno: ${c.percentualNoturno}% de ${moedaCheia(c.valorHora)}/h = ${moedaCheia(c.valorAdicionalNoturnoHora)}/h` +
        ` · × ${duracaoTexto(c.adicionalNoturnoMin)} = ${moedaCheia(c.valorNoturno)}`
    );
  }
  if (c.faltas > 0) {
    passos.push(
      `Falta: ${moedaCheia(c.salarioBase)} ÷ ${c.divisorDiario} = ${moedaCheia(c.valorDia)}/dia` +
        ` · × ${plural(c.faltas, "dia", "dias")} = −${moedaCheia(c.valorFaltasDias)}`
    );
  }
  if (c.atrasosMin > 0) {
    passos.push(
      `Atraso: ${moedaCheia(c.valorHora)}/h × ${duracaoTexto(c.atrasosMin)} = −${moedaCheia(c.valorAtrasos)}`
    );
  }
  if (passos.length > 1) passos.push(`Total: ${moedaCheia(c.valorCalculado)}`);
  return passos;
}

/**
 * Qual salário vale para a conta deste mês.
 *
 * Registro gravado manda pelo CARIMBO: é o que faz março continuar dizendo o
 * que dizia depois do aumento de abril. Mas carimbo VAZIO não é salário — é a
 * marca de que a ficha estava sem salário na hora da gravação; se hoje tem, a
 * conta volta a existir e a tela pede que se grave de novo.
 */
function salarioDaConta(reg, pessoa) {
  if (!reg) return pessoa.salario;
  const carimbo = Object.prototype.hasOwnProperty.call(reg, "salarioBase") ? reg.salarioBase : undefined;
  if (carimbo === undefined || carimbo === null || carimbo === "") return pessoa.salario;
  return carimbo;
}

/**
 * A PROCEDÊNCIA de cada faixa, do jeito que vai ser carimbada no registro.
 *
 * Uma função só, usada pela caixa da conta (enquanto se digita) e pelo Gravar:
 * se a tela dissesse "apurado pelo relógio" por uma regra e o registro
 * carimbasse por outra, a conta escrita passaria a mentir sobre si mesma.
 *
 * A comparação é contra a parcela que o RELÓGIO apurou — não contra a sugestão
 * inteira. Num mês misto, o total que o RH lança inclui dias derivados por esta
 * casa, e chamar isso de "apurado pelo relógio" seria emprestar ao Jibble um
 * número que não é dele.
 */
function fonteDoLancamento(sugestao, extrasMin, extrasDobroMin) {
  return {
    extras: origemDoLancamento(extrasMin, sugestao?.extrasRelogioMin ?? null),
    extrasDobro: origemDoLancamento(extrasDobroMin, sugestao?.extrasDobroMin ?? null),
  };
}

/**
 * O rodapé do cartão de horas extras.
 *
 * O número grande é a soma das duas faixas — quantidade de hora, não dinheiro.
 * O rodapé diz quanto é de cada uma: sem isso o total esconderia qual fator vai
 * pagar aquelas horas, que é justamente o que este projeto separou.
 */
function subDasExtras(kpi) {
  if (kpi.extrasLancadasMin === null) {
    if (!kpi.extrasApuradasMin && !kpi.extrasApuradasDobroMin) return "nada lançado ainda";
    return `batidas apontam ${duracaoTexto(kpi.extrasApuradasMin)} em +50% e ${duracaoTexto(kpi.extrasApuradasDobroMin)} em +100%`;
  }
  if (kpi.extrasLancadasDobroMin) {
    return `${duracaoTexto(kpi.extrasLancadasMin - kpi.extrasLancadasDobroMin)} em +50% · ${duracaoTexto(kpi.extrasLancadasDobroMin)} em +100%`;
  }
  return kpi.extrasApuradasMin ? `batidas apontam ${duracaoTexto(kpi.extrasApuradasMin)}` : undefined;
}

// A frase da diferença (regra 8): valor alterado que se parece com valor
// calculado é armadilha seis meses depois.
function fraseDaDiferenca(dif) {
  if (!dif) return "";
  return `${moedaCheia(Math.abs(dif))} ${dif > 0 ? "acima" : "abaixo"} do calculado`;
}

/**
 * OS TRÊS NÚMEROS DO DIA, um ao lado do outro e SEM sinal de conta entre eles:
 * "10h16 no crachá · 1h04 de intervalo · 8h12 para a folha".
 *
 * Eles não fecham por subtração (10h16 − 1h04 dá 9h12, e para a folha foram
 * 8h12): quem concilia é a ESCALA da pessoa, e quem apura a escala é o
 * relógio. Escrever "−" entre eles seria mostrar uma conta que o sistema não
 * faz — e conta que não fecha na calculadora de quem lê é o começo da volta
 * para a planilha.
 */
function fatosDoDia(d, min) {
  const partes = [];
  // O crachá: o que o relógio mediu de porta aberta. Para o dia lançado à mão,
  // o intervalo entre as duas batidas. Sem os dois lados, não se afirma nada.
  const cracha = numOuNulo(d?.trackedMin) ?? minutosEntre(d?.entrada, d?.saida);
  if (cracha !== null) partes.push(`${duracaoTexto(cracha)} no crachá`);
  const pausa = numOuNulo(d?.pausaMin);
  // Intervalo zero é "sem intervalo", nunca "0h00": 0h00 parece medida.
  if (pausa !== null) partes.push(pausa > 0 ? `${duracaoTexto(pausa)} de intervalo` : "sem intervalo");
  const pausaPaga = numOuNulo(d?.pausaPagaMin);
  if (pausaPaga) partes.push(`${duracaoTexto(pausaPaga)} de intervalo pago`);
  // Dia sem total é SEM TOTAL. Zero aqui vira desconto na folha de alguém.
  partes.push(min === null ? "sem total para a folha" : `${duracaoTexto(min)} para a folha`);
  return partes;
}

/** A hora extra que o relógio já apurou no dia, em palavras (ou ""). */
function textoDaExtraApurada(apurado) {
  if (!apurado) return "";
  const p = [];
  if (apurado.extraMin > 0) p.push(`${duracaoTexto(apurado.extraMin)} de extra +50%`);
  if (apurado.extraDobroMin > 0) p.push(`${duracaoTexto(apurado.extraDobroMin)} de extra +100%`);
  return p.join(" · ");
}

/**
 * O QUE A CORREÇÃO FAZ COM A APURAÇÃO DO RELÓGIO.
 *
 * Mora fora dos formulários e é usada pelos DOIS lados — a caixa que a tela
 * mostra e o registro que o Gravar escreve — porque a conta que a tela mostra
 * tem de ser a conta que o sistema faz. Duplicar a regra aqui seria a maneira
 * mais rápida de as duas se separarem no próximo conserto.
 *
 * A regra: a apuração do relógio (`trabalhadoMin`, `extraMin`, `extraDobroMin`)
 * descreve as batidas do relógio. Enquanto a correção não mexer em entrada,
 * saída ou pausa, ela CONTINUA VALENDO — e continuar valendo importa: o
 * trabalhado do relógio não é (saída − entrada) − pausa, então recalcular um
 * dia só porque alguém arrumou a observação trocaria 8h12 por 9h12 em silêncio.
 * Mexeu na batida, aquele número deixou de descrever o dia: sai do registro
 * (fica no carimbo `relogio*`) e o dia passa a valer pela conta desta casa.
 */
function efeitoDaCorrecao(base, { entrada, saida, pausaMin }) {
  const apurado = base ? apuracaoDoRelogio(base) : null;
  const mexeuNasBatidas =
    !base ||
    txt(entrada) !== txt(base.entrada) ||
    txt(saida) !== txt(base.saida) ||
    pausaMin !== inteiroDoCampo(base.pausaMin);
  const derivado = minutosDoDia({ entrada, saida, pausaMin });
  return {
    apurado,
    mexeuNasBatidas,
    mantemApuracao: !!apurado && !mexeuNasBatidas,
    // O total que VAI SER GRAVADO — o mesmo número que a caixa da tela mostra.
    trabalhadoMin: base && !mexeuNasBatidas ? numOuNulo(base.trabalhadoMin) : derivado,
  };
}

// ---- linhas ----------------------------------------------------------------

/**
 * O NOME DA PESSOA COMO PORTA.
 *
 * Diagnóstico do Leonardo (28/08/2026): nas três telas do Ponto o nome aparecia
 * 72 vezes e NENHUMA era clicável — lia-se "ANA CLAUDIA · 08:03" e a linha
 * acabava ali. Aqui o nome vira botão e abre o detalhe da pessoa; na linha de
 * BATIDA o dia daquela linha vai em foco, porque o motivo de clicar num nome na
 * lista de batidas é quase sempre "o que houve NESTE dia".
 *
 * É um <button> DE VERDADE, e não uma <span onClick>: o teclado chega nele, o
 * leitor de tela o anuncia como botão e o foco fica visível.
 */
function BotaoPessoa({ nome, aoAbrir, className }) {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      title={`Ver o ponto de ${nome}`}
      className={clsx(
        "max-w-full truncate rounded text-left underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        className
      )}
    >
      {nome}
    </button>
  );
}

function LinhaFechamento({ l, editavel, acoes }) {
  const { pessoa, reg, conta, apuracao, repetidos, dif, valorFinal, divergente, semSalarioPendente, fonte, temSugestao, jornadaEmPalavras } = l;
  /* A CONTA ESCRITA SÓ EXISTE ONDE EXISTE LANÇAMENTO.
     Sem registro gravado, `conta` é a projeção das sugestões das batidas — e
     imprimi-la aqui punha um "Total: R$ 84,00" em dinheiro na MESMA linha que
     diz "nada lançado neste mês" e "sem valor". Quem lê a tela para montar a
     folha toma aquele total como devido, e ninguém escreveu aquilo. A sugestão
     continua logo abaixo, no parágrafo que se chama Sugestão do mês e que diz,
     em horas, de onde veio. */
  const passos = reg ? passosDaConta(conta, fonte) : [];
  const travado = !!reg?.fechado;
  const porTipoAusencia = apuracao.ausencias;

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 basis-52">
          <span className="block truncate font-display text-sm font-medium text-slate-900">
            <BotaoPessoa nome={pessoa.nome} aoAbrir={() => acoes.detalhar(pessoa, null)} />
            {pessoa.ativo === false && <span className="ml-2 chip">desligado</span>}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {[pessoa.cargo || "cargo sem registro", pessoa.setor].filter(Boolean).join(" · ")}
          </span>
          <span className="block truncate text-xs text-slate-400">
            {apuracao.diasComBatida > 0
              ? `${plural(apuracao.diasComBatida, "dia com batida", "dias com batida")} · ${horasOuNada(apuracao.trabalhadoMin)} no mês` +
                (apuracao.diasEmAberto ? ` · ${plural(apuracao.diasEmAberto, "dia sem total", "dias sem total")}` : "")
              : apuracao.ausenciasTotal > 0
                ? `sem batida — ${plural(apuracao.ausenciasTotal, "dia explicado", "dias explicados")} por ausência`
                : "sem batida importada neste mês"}
          </span>
        </span>

        {/* As quantidades do que está LANÇADO. Sem lançamento, a linha diz que
            não há lançamento — não mostra as sugestões como se fossem apuração. */}
        <span className="shrink-0 text-xs text-slate-600">
          {reg ? (
            <>
              <span className="block tnum">
                extras {horasOuNada(reg.horasExtrasMin)} ({rotuloFator(conta.fator)})
              </span>
              {/* A dobra tem linha própria: faixa somada com a outra esconderia
                  qual fator pagou qual hora. */}
              {conta.horasExtrasDobroMin > 0 && (
                <span className="block tnum">
                  extras {duracaoTexto(conta.horasExtrasDobroMin)} ({rotuloFator(conta.fatorDobro)})
                </span>
              )}
              <span className="block tnum">
                faltas {reg.faltas ? plural(reg.faltas, "dia", "dias") : "nenhuma"} · atrasos {horasOuNada(reg.atrasosMin)}
              </span>
              {conta.adicionalNoturnoMin > 0 && (
                <span className="block tnum">noturno {duracaoTexto(conta.adicionalNoturnoMin)}</span>
              )}
            </>
          ) : (
            <span className="block text-slate-400">nada lançado neste mês</span>
          )}
        </span>

        <span className="shrink-0 text-right">
          <span className="block font-display text-sm font-semibold tnum text-slate-900">
            {dinheiro(valorFinal)}
          </span>
          {semSalarioPendente ? (
            <span className="chip-bad mt-0.5 whitespace-nowrap">sem salário na ficha</span>
          ) : (
            dif !== 0 && <span className="chip-warn mt-0.5 whitespace-nowrap">{fraseDaDiferenca(dif)}</span>
          )}
          {travado && (
            <span className="mt-0.5 block text-xs text-slate-400">
              fechado em {dataLonga(reg.fechadoEm)}
            </span>
          )}
        </span>

        {editavel && (
          <span className="flex shrink-0 flex-wrap items-center gap-1.5">
            {!travado && (
              <button type="button" className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => acoes.lancar(l)}>
                <Pencil size={13} /> {reg ? "Editar" : "Lançar"}
              </button>
            )}
            {reg && !travado && (
              <button type="button" className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => acoes.fechar(l)}>
                <Lock size={13} /> Fechar
              </button>
            )}
            {travado && (
              <button type="button" className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => acoes.reabrir(l)}>
                <LockOpen size={13} /> Reabrir
              </button>
            )}
          </span>
        )}
      </div>

      {/* AS AUSÊNCIAS, SEPARADAS PELO QUE FAZEM COM O DINHEIRO. Quem soma
          quatro atestados não pode aparecer na tela como quem teve quatro
          faltas: a única que desconta é a falta, e é a única em vermelho. */}
      {apuracao.ausenciasTotal > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <CalendarOff size={12} className="text-slate-400" />
          {TIPOS_AUSENCIA.filter((t) => porTipoAusencia[t.tipo] > 0).map((t) => (
            <span key={t.tipo} className={clsx(t.chip, "whitespace-nowrap")}>
              {plural(porTipoAusencia[t.tipo], `dia de ${t.curto}`, `dias de ${t.curto}`)}
            </span>
          ))}
          {apuracao.faltasQueDescontam > 0 ? (
            <span>
              {plural(apuracao.faltasQueDescontam, "dia desconta", "dias descontam")} 1/30 · o resto não desconta
            </span>
          ) : (
            <span>nenhuma desconta</span>
          )}
        </p>
      )}
      {apuracao.ausenciasDesconhecidas > 0 && (
        <p className="mt-2 text-xs text-warn-700">
          {plural(apuracao.ausenciasDesconhecidas, "ausência lançada com tipo que esta tela não conhece",
            "ausências lançadas com tipo que esta tela não conhece")}. Não descontam nada e ficam à vista de
          propósito — confira em Batidas antes de fechar o mês.
        </p>
      )}
      {apuracao.ausenciasComTrabalho > 0 && (
        <p className="mt-2 text-xs text-warn-700">
          {plural(apuracao.ausenciasComTrabalho, "dia tem ausência lançada E hora trabalhada",
            "dias têm ausência lançada E hora trabalhada")} (atestado da tarde, por exemplo). A hora conta; o dia
          NÃO entra como falta — descontar 1/30 de quem trabalhou metade do dia cobraria duas vezes.
        </p>
      )}

      {/* A conta escrita: é ela que faz o número ser conferível na calculadora. */}
      {passos.length > 0 && (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {passos.map((p) => (
            <p key={p} className="tnum">{p}</p>
          ))}
        </div>
      )}

      {semSalarioPendente && (
        <p className="mt-2 text-xs text-bad-700">
          Sem salário na ficha — não dá para calcular. As horas ficam registradas; o valor entra quando a ficha
          de {pessoa.nome} tiver salário.
        </p>
      )}

      {divergente && (
        <p className="mt-2 text-xs text-warn-700">
          O valor gravado ({dinheiro(reg.valorCalculado)}) não bate com a conta acima. Abra e grave de novo para acertar.
        </p>
      )}

      {!reg && temSugestao && (
        <p className="mt-2 text-xs text-slate-500">
          Sugestão do mês{marcaDaFonte(apuracao.fonteExtras)}: extras +50% {horasOuSemApuracao(apuracao.extrasMin)}
          {" · "}extras +100% {horasOuSemApuracao(apuracao.extrasDobroMin)} · atrasos{" "}
          {horasOuSemApuracao(apuracao.atrasosMin)} · faltas{" "}
          {apuracao.faltasQueDescontam > 0 ? plural(apuracao.faltasQueDescontam, "dia", "dias") : "nenhuma"}
          {apuracao.diasDerivados > 0 ? ` (previsto pela escala da casa — ${jornadaEmPalavras})` : ""}
          {". "}
          Falta só sai do que foi LANÇADO como falta: dia sem batida e sem ausência lançada é sem registro, não
          falta.
          {apuracao.diasDerivados === 0 &&
            " O relógio não devolve atraso: a jornada dele já é a da escala de cada pessoa."}
        </p>
      )}
      {/* Dia lançado à mão sem data legível: a sugestão existe, mas incompleta
          — e isso se diz, em vez de o número parecer completo. */}
      {!reg && apuracao.diasSemSaldo > 0 && (
        <p className="mt-2 text-xs text-warn-700">
          {plural(apuracao.diasSemSaldo, "dia lançado à mão ficou", "dias lançados à mão ficaram")} fora da sugestão:
          sem uma data que a tela consiga ler não dá para saber o dia da semana, e sem o dia da semana não há
          previsto — o que é hora extra e o que é atraso ficaria no chute. Corrija a data em Batidas.
        </p>
      )}
      {/* Trabalho em dia que a escala não prevê entra como +50% porque é onde a
          conta derivada sabe pôr. Descanso e feriado se pagam em dobro, e quem
          decide isso é o RH — a tela lembra em vez de escolher sozinha. */}
      {!reg && apuracao.diasForaDaEscala > 0 && (
        <p className="mt-2 text-xs text-warn-700">
          {plural(apuracao.diasForaDaEscala, "dia lançado à mão caiu", "dias lançados à mão caíram")} em data que a
          escala não prevê (fim de semana). A hora inteira entrou na faixa de +50%; se for descanso ou feriado, mova
          para a faixa de +100% no lançamento.
        </p>
      )}
      {repetidos > 0 && (
        <p className="mt-2 text-xs text-warn-700">
          {plural(repetidos, "dia aparece", "dias aparecem")} mais de uma vez no extrato (lançamento à mão e
          importação do mesmo dia). Vale a batida corrigida — confira em Batidas.
        </p>
      )}
      {reg?.obs && <p className="mt-2 text-xs text-slate-500">{reg.obs}</p>}
    </div>
  );
}

function LinhaBatida({ b, editavel, acoes }) {
  const { d, pessoa, min, ausencia, pontualidade } = b;
  const veioDoRelogio = d.origem === "jibble";
  const corrigido = d.corrigido === true;
  // "Em aberto" é o que o RELÓGIO diz (entrou e não saiu); "sem total" é o que
  // a tela sabe (não dá para totalizar). São duas coisas, e um dia pode estar
  // sem total sem estar em aberto — o relógio mudo, por exemplo.
  const emAberto = d.emAberto === true;
  const extraApurada = textoDaExtraApurada(apuracaoDoRelogio(d));
  // O que o relógio tinha trazido E APURADO antes de alguém corrigir.
  const carimbo = [];
  if (d.relogioEntrada || d.relogioSaida) carimbo.push(`${d.relogioEntrada || "—"} → ${d.relogioSaida || "—"}`);
  if (numOuNulo(d.relogioPausaMin)) carimbo.push(`intervalo ${duracaoTexto(d.relogioPausaMin)}`);
  if (numOuNulo(d.relogioTrabalhadoMin) !== null) {
    carimbo.push(`${duracaoTexto(d.relogioTrabalhadoMin)} para a folha`);
  }
  const extraCarimbada = textoDaExtraApurada(
    apuracaoDoRelogio({ extraMin: d.relogioExtraMin, extraDobroMin: d.relogioExtraDobroMin })
  );
  if (extraCarimbada) carimbo.push(extraCarimbada);
  const original = corrigido && carimbo.length > 0 ? `relógio: ${carimbo.join(" · ")}` : "";

  /* QUEM ESTA LINHA MOSTRA, para o botão do nome. Batida SEM FICHA ainda tem
     como ser detalhada — pelo relógio (jibbleId) ou, na falta dele, pelo nome
     que o relógio mandou. Só fica sem porta a linha que não tem nem uma coisa
     nem outra: abrir um painel que não sabe de quem é mostraria um mês vazio e
     faria parecer que a pessoa não bateu ponto nenhum, que é pior do que não
     ter link. */
  const nomeNaLinha = pessoa ? pessoa.nome : txt(d.pessoaNome);
  const alvoDetalhe =
    pessoa ||
    (txt(d.jibbleId) || nomeNaLinha
      ? { id: "", nome: nomeNaLinha || `relógio ${txt(d.jibbleId)}`, jibbleId: txt(d.jibbleId) }
      : null);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
      <span className="w-24 shrink-0 font-display text-xs font-semibold tnum text-slate-700">
        {dataLonga(d.data)}
      </span>

      <span className="min-w-0 flex-1 basis-44">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {alvoDetalhe ? (
            <BotaoPessoa nome={alvoDetalhe.nome} aoAbrir={() => acoes.detalhar(alvoDetalhe, d.data)} />
          ) : (
            "pessoa não identificada"
          )}
        </span>
        {!pessoa && (
          <span className="block truncate text-xs text-bad-700">
            pessoa não vinculada{d.jibbleId ? ` — relógio ${d.jibbleId}` : " — a batida veio sem id do relógio"}
          </span>
        )}
        {d.obs && <span className="block truncate text-xs text-slate-500">{d.obs}</span>}
      </span>

      <span className="min-w-0 shrink-0 basis-72 text-xs tabular-nums text-slate-600">
        <span className="block">
          {d.entrada || "—"} → {d.saida || "—"}
        </span>
        {/* Os três números do dia, sem sinal de conta entre eles: eles não
            fecham por subtração, quem concilia é a escala. */}
        <span className="block text-slate-500">{fatosDoDia(d, min).join(" · ")}</span>
        {extraApurada && <span className="block text-slate-500">{extraApurada}</span>}
        {/* A pontualidade sai SEPARADA do total do dia: são duas réguas (a
            marcação contra a escala, e o trabalhado contra o previsto), e
            somá-las cobraria o mesmo atraso duas vezes. */}
        {textoDaPontualidade(pontualidade) && (
          <span className={clsx("block", pontualidade.atrasoMin > 0 ? "text-warn-700" : "text-slate-500")}>
            {textoDaPontualidade(pontualidade)}
          </span>
        )}
        {ausencia && <span className="block text-slate-500">{textoDaAusencia(ausencia)}</span>}
        {original && <span className="block text-slate-400">{original}</span>}
      </span>

      <span className="w-24 shrink-0 text-right font-display text-sm font-semibold tnum text-slate-900">
        {/* Sem total NÃO é zero hora: zero aqui vira desconto na folha. E o dia
            de ausência tem explicação, não lacuna — mostra a explicação. */}
        {min !== null ? (
          duracaoTexto(min)
        ) : ausencia ? (
          <span className="text-xs font-medium text-slate-500">{ausencia.curto}</span>
        ) : (
          <span className="text-xs font-medium text-warn-700">sem total</span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <span className={clsx("chip whitespace-nowrap", veioDoRelogio && "chip-brand")}>
          {veioDoRelogio ? "relógio" : "à mão"}
        </span>
        {/* Chip próprio por tipo, e a COR diz se custa dinheiro: só a falta
            desconta, e só ela é vermelha. */}
        {ausencia && <span className={clsx(ausencia.chip, "whitespace-nowrap")}>{ausencia.curto}</span>}
        {emAberto && <span className="chip-warn whitespace-nowrap">em aberto</span>}
        {corrigido && veioDoRelogio && <span className="chip-warn whitespace-nowrap">corrigido</span>}
        {editavel && (
          <>
            {/* O caminho curto para explicar o dia vazio, ali onde ele está. */}
            <button
              type="button"
              onClick={() => acoes.ausentar(b)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title={ausencia ? "Mudar ou remover a ausência deste dia" : "Lançar falta, atestado ou outra ausência neste dia"}
            >
              <CalendarOff size={14} />
            </button>
            <button
              type="button"
              onClick={() => acoes.corrigir(b)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Corrigir esta batida"
            >
              <Pencil size={14} />
            </button>
            {/* Só o que nasceu aqui pode ser apagado: apagar um dia do relógio
                não apaga o dia — a próxima importação o traz de volta. */}
            {d.origem !== "jibble" && (
              <button
                type="button"
                onClick={() => acoes.apagar(b)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
                title="Apagar esta batida"
              >
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      </span>
    </div>
  );
}

// ---- vínculo pessoa ↔ relógio ---------------------------------------------

function PainelVinculo({ semVinculo, vinculados, ativos, editavel, escolhas, setEscolhas, acoes }) {
  /* SÓ APARECE QUANDO HÁ TRABALHO A FAZER. O vínculo nasce pronto na
     sincronização com o Jibble: sem ninguém sem ficha, este painel era uma
     tarefa oferecida que não existe — e tarefa que não existe confunde quem
     abre a tela procurando o que fazer. A lista de "já vinculados" (com o
     desvincular) vem junto com a pendência, que é quando ela serve. */
  if (semVinculo.length === 0) return null;
  return (
    <Card className="mb-4">
      <SectionTitle
        titulo="Vincular ao relógio"
        sub="A batida chega com o id do Jibble; a ficha é escolhida por id, nunca por nome. Sem vínculo, o dia aparece como 'pessoa não vinculada' — e continua aparecendo."
      />

      {/* Sem o ramo "já está tudo vinculado": ele não tem mais como aparecer —
          o painel inteiro só existe quando há id sem ficha. */}
      <div className="mb-3 space-y-2">
        {semVinculo.map((s) => (
          <div
            key={s.jibbleId || "sem-id"}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3"
            style={{ borderColor: "var(--hairline)" }}
          >
            <span className="min-w-0 flex-1 basis-52">
              <span className="block truncate font-display text-sm font-medium text-slate-900">
                {s.nomeNoRelogio || "sem nome no relógio"}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {s.jibbleId ? `relógio ${s.jibbleId}` : "a batida veio sem id do relógio — não dá para vincular"}
                {" · "}
                {plural(s.dias, "dia", "dias")} neste mês
              </span>
            </span>
            {editavel && s.jibbleId && (
              <span className="flex shrink-0 flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`vinc-${s.jibbleId}`}>
                  Ficha de {s.nomeNoRelogio || s.jibbleId}
                </label>
                <select
                  id={`vinc-${s.jibbleId}`}
                  className="select h-9 w-56 py-0 text-xs"
                  value={escolhas[s.jibbleId] || ""}
                  onChange={(e) => setEscolhas({ ...escolhas, [s.jibbleId]: e.target.value })}
                >
                  <option value="">— escolher a pessoa —</option>
                  {ativos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-primary px-3 py-1.5 text-xs"
                  disabled={!escolhas[s.jibbleId]}
                  onClick={() => acoes.vincular(s.jibbleId, escolhas[s.jibbleId])}
                >
                  <Link2 size={13} /> Vincular
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      {vinculados.length > 0 && (
        <p className="text-xs text-slate-500">
          Já vinculados:{" "}
          {vinculados.map((p, i) => (
            <span key={p.id}>
              {i > 0 && " · "}
              {p.nome} <span className="text-slate-400">({p.jibbleId})</span>
              {editavel && (
                <button
                  type="button"
                  onClick={() => acoes.desvincular(p)}
                  className="ml-1 align-middle text-slate-400 hover:text-bad-700"
                  title={`Desvincular ${p.nome} do relógio`}
                >
                  <Unlink size={12} />
                </button>
              )}
            </span>
          ))}
        </p>
      )}
    </Card>
  );
}

// ---- formulários (FORA da aba: componente dentro de componente remonta a
//      subárvore a cada render e o campo perde o foco a cada letra) ----------

function FormFechamento({ form, setForm, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  // A conta refeita a CADA tecla, com os mesmos números que serão gravados: o
  // RH decide olhando o resultado, não depois de gravar.
  const extrasMin = minutosDaDuracao(form.horasExtras) ?? 0;
  const extrasDobroMin = minutosDaDuracao(form.horasExtrasDobro) ?? 0;
  const conta = calcularFechamento({
    salario: form.salario,
    divisor: form.divisor,
    fator: Number(form.fator),
    fatorDobro: form.fatorDobro,
    percentualNoturno: form.percentualNoturno,
    horasExtrasMin: extrasMin,
    horasExtrasDobroMin: extrasDobroMin,
    faltas: inteiroDoCampo(form.faltas),
    atrasosMin: minutosDaDuracao(form.atrasos) ?? 0,
    adicionalNoturnoMin: minutosDaDuracao(form.noturno) ?? 0,
  });
  // A mesma procedência que o Gravar vai carimbar — a conta escrita aqui é a
  // que fica no registro.
  const passos = passosDaConta(conta, fonteDoLancamento(form.sugestao, extrasMin, extrasDobroMin));
  const lancado = txt(form.valorLancado) ? paraNumero(form.valorLancado) : null;
  const dif = lancado === null ? 0 : diferencaDoCalculo(lancado, conta.valorCalculado);

  // Duração que não foi entendida trava o Gravar: 0 minuto viraria R$ 0,00 e o
  // lançamento sairia zerado sem ninguém ver o erro de digitação.
  const ruins = [
    ["horas extras", form.horasExtras],
    ["horas extras em dobra", form.horasExtrasDobro],
    ["atrasos", form.atrasos],
    ["adicional noturno", form.noturno],
  ].filter(([, v]) => txt(v) && minutosDaDuracao(v) === null);

  return (
    <Modal
      titulo={`Fechamento de ${form.pessoaNome} — ${rotuloCompetencia(form.competencia)}`}
      aberto={!!form}
      aoFechar={aoFechar}
      largura="max-w-2xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        {form.sugestao && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-slate-700">
            <span>
              Batidas do mês{marcaDaFonte(form.sugestao.fonteExtras)}: extras +50%{" "}
              {horasOuSemApuracao(form.sugestao.extrasMin)} · extras +100%{" "}
              {horasOuSemApuracao(form.sugestao.extrasDobroMin)} · atrasos{" "}
              {horasOuSemApuracao(form.sugestao.atrasosMin)} · faltas lançadas{" "}
              {form.sugestao.faltasQueDescontam > 0
                ? plural(form.sugestao.faltasQueDescontam, "dia", "dias")
                : "nenhuma"}{" "}
              ({plural(form.sugestao.diasComBatida, "dia com batida", "dias com batida")}
              {form.sugestao.diasDerivados > 0 && form.jornadaEmPalavras
                ? `, previsto pela escala: ${form.jornadaEmPalavras}`
                : ""}
              )
              {form.sugestao.ausenciasSemDesconto > 0 &&
                ` · ${plural(form.sugestao.ausenciasSemDesconto, "dia abonado", "dias abonados")} (atestado, justificada, férias ou folga) que NÃO descontam e não entram no campo Faltas.`}
            </span>
            <button
              type="button"
              className="btn-outline px-3 py-1.5 text-xs"
              onClick={() =>
                setForm({
                  ...form,
                  // Faixa SEM APURAÇÃO não entra: preencher "00:00" apagaria o
                  // que o RH digitou e ainda afirmaria "não houve" no lugar de
                  // "ninguém mediu".
                  ...(form.sugestao.extrasMin !== null
                    ? { horasExtras: duracaoCampo(form.sugestao.extrasMin) }
                    : {}),
                  ...(form.sugestao.extrasDobroMin !== null
                    ? { horasExtrasDobro: duracaoCampo(form.sugestao.extrasDobroMin) }
                    : {}),
                  ...(form.sugestao.atrasosMin !== null ? { atrasos: duracaoCampo(form.sugestao.atrasosMin) } : {}),
                  // Falta entra porque agora ela é LANÇAMENTO, não dedução:
                  // copiar aqui é repetir o que o RH já escreveu no dia, e não
                  // concluir falta da ausência de batida. Só o tipo "falta"
                  // conta — atestado e companhia ficam de fora, de propósito.
                  faltas: String(form.sugestao.faltasQueDescontam),
                })
              }
            >
              Usar o apurado
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pt-extras">Horas extras</label>
            <input
              id="pt-extras"
              type="text"
              className="input"
              placeholder="02:30"
              autoFocus
              value={form.horasExtras}
              onChange={setCampo("horasExtras")}
            />
          </div>
          <div>
            <label className="label" htmlFor="pt-fator">Adicional</label>
            <select id="pt-fator" className="select" value={String(form.fator)} onChange={setCampo("fator")}>
              {ADICIONAIS_HE.map((a) => (
                <option key={a.fator} value={String(a.fator)}>{a.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Vale para o campo ao lado. A dobra tem campo próprio, sempre +100%.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="pt-extras-dobra">Horas extras em dobra</label>
            <input
              id="pt-extras-dobra"
              type="text"
              className="input"
              placeholder="00:00"
              value={form.horasExtrasDobro}
              onChange={setCampo("horasExtrasDobro")}
            />
            <p className="mt-1 text-xs text-slate-500">
              Descanso, feriado e dobra — sempre +100%. Faixa separada porque o fator é outro.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="pt-faltas">Faltas (dias)</label>
            <input
              id="pt-faltas"
              type="number"
              min="0"
              step="1"
              className="input"
              value={form.faltas}
              onChange={setCampo("faltas")}
            />
            <p className="mt-1 text-xs text-slate-500">
              Só falta INJUSTIFICADA, que desconta 1/30. Atestado, justificada, férias e folga se lançam no dia, em
              Batidas, e não entram aqui.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="pt-atrasos">Atrasos</label>
            <input
              id="pt-atrasos"
              type="text"
              className="input"
              placeholder="00:45"
              value={form.atrasos}
              onChange={setCampo("atrasos")}
            />
          </div>
          <div>
            <label className="label" htmlFor="pt-noturno">Adicional noturno (horas)</label>
            <input
              id="pt-noturno"
              type="text"
              className="input"
              placeholder="02:00"
              value={form.noturno}
              onChange={setCampo("noturno")}
            />
          </div>
          <div>
            <label className="label" htmlFor="pt-lancado">Valor lançado</label>
            <input
              id="pt-lancado"
              type="text"
              inputMode="decimal"
              className="input"
              placeholder={conta.semSalario ? "R$" : moedaCheia(conta.valorCalculado)}
              value={form.valorLancado}
              onChange={setCampo("valorLancado")}
            />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Duração como <strong>02:30</strong> (ou 2,5 para duas horas e meia). Campo em branco é
          &quot;não houve&quot;. Deixe o valor lançado em branco para usar o calculado.
        </p>

        {ruins.length > 0 && (
          <p className="text-sm font-medium text-bad-700">
            Não entendi a duração de {ruins.map(([nome]) => nome).join(", ")}. Escreva como 02:30 — &quot;2.50&quot; com
            ponto seria 2h30 ou 2,5h, e adivinhar aqui erra em dinheiro.
          </p>
        )}

        {/* Aviso, não trava: pode ser proposital (mês inteiro em domingo, com o
            campo de cima em +100% por herança). Mas o mesmo domingo entrando
            nas duas faixas paga em dobro o que já era dobra. */}
        {Number(form.fator) === FATOR_HE_DOBRA && extrasDobroMin > 0 && (
          <p className="text-sm font-medium text-warn-700">
            As duas faixas estão em +100%. Se as horas de descanso já estão no campo da dobra, o de cima deveria
            estar em +50% — do jeito que está, o mesmo domingo pode ser pago duas vezes.
          </p>
        )}

        <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
          {conta.semSalario ? (
            <p className="font-medium text-bad-700">
              {form.pessoaNome} está sem salário na ficha — não dá para calcular. As horas ficam registradas do
              mesmo jeito, e o valor entra quando a ficha tiver salário.
            </p>
          ) : (
            <>
              {passos.length === 0 ? (
                <p className="text-slate-500">Nada lançado ainda — a conta aparece quando houver hora, falta ou atraso.</p>
              ) : (
                passos.map((p) => (
                  <p key={p} className="tnum text-slate-600">{p}</p>
                ))
              )}
              <p className="mt-1.5 font-display font-semibold tnum text-slate-900">
                Calculado: {moedaCheia(conta.valorCalculado)}
              </p>
              {dif !== 0 && (
                <p className="mt-0.5 font-medium tnum text-warn-700">
                  Lançado {moedaCheia(lancado)} — {fraseDaDiferenca(dif)}.
                </p>
              )}
            </>
          )}
          <p className="mt-1.5 text-xs text-slate-400">
            Base: {conta.semSalario ? "sem salário" : moedaCheia(conta.salarioBase)} ÷ {conta.divisor} h/mês · falta = 1/{conta.divisorDiario}.
            Sem reflexo de DSR — esse cálculo é do escritório contábil.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="pt-obs">Observação</label>
          <textarea id="pt-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || ruins.length > 0}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormBatida({ form, setForm, ativos, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const corrigindo = !!form.id;

  const bruto = minutosEntre(form.entrada, form.saida);
  const pausa = inteiroDoCampo(form.pausa);
  const pausaDemais = bruto !== null && pausa > bruto;
  // A MESMA função que o Gravar usa: o que esta caixa promete é o que vai ser
  // gravado, inclusive quando a promessa é "não mexo no que o relógio apurou".
  const efeito = efeitoDaCorrecao(form.base || null, {
    entrada: form.entrada,
    saida: form.saida,
    pausaMin: pausa,
  });
  const trabalhado = efeito.trabalhadoMin;
  const extraDoRelogio = textoDaExtraApurada(efeito.apurado);

  /* Duas leituras diferentes, e trocá-las mostraria o número errado:
     - o ORIGINAL do relógio (o carimbo, quando o dia já foi corrigido; os
       valores de agora, na primeira correção — que é o que o carimbo vai
       guardar). É o que aparece em "Veio do relógio".
     - o que AINDA ESTÁ VIVO no registro, que é o que sai dele se esta correção
       mexer nas batidas. */
  const jaCarimbado = !!form.base && Object.prototype.hasOwnProperty.call(form.base, "relogioEntrada");
  const original = jaCarimbado
    ? {
        trabalhadoMin: form.base.relogioTrabalhadoMin,
        extraMin: form.base.relogioExtraMin,
        extraDobroMin: form.base.relogioExtraDobroMin,
      }
    : {
        trabalhadoMin: form.base?.trabalhadoMin,
        extraMin: form.base?.extraMin,
        extraDobroMin: form.base?.extraDobroMin,
      };
  const apuradoOriginal = [
    numOuNulo(original.trabalhadoMin) !== null ? `${duracaoTexto(original.trabalhadoMin)} para a folha` : "",
    textoDaExtraApurada(apuracaoDoRelogio(original)),
  ]
    .filter(Boolean)
    .join(" · ");
  const apuracaoQueSai = [
    numOuNulo(form.base?.trabalhadoMin) !== null ? `${duracaoTexto(form.base.trabalhadoMin)} para a folha` : "",
    extraDoRelogio,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal
      titulo={corrigindo ? "Corrigir batida" : "Lançar batida à mão"}
      aberto={!!form}
      aoFechar={aoFechar}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        {corrigindo ? (
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
            <span className="label mb-0.5">Pessoa e dia</span>
            <p className="font-medium text-slate-900">
              {form.pessoaNome || "pessoa não vinculada"} — {dataLonga(form.data)}
            </p>
            {form.origem === "jibble" && (
              <p className="mt-0.5 text-xs">
                Veio do relógio:{" "}
                {[
                  `${form.relogioEntrada || "—"} → ${form.relogioSaida || "—"}`,
                  numOuNulo(form.relogioPausaMin) ? `intervalo ${duracaoTexto(form.relogioPausaMin)}` : "",
                  apuradoOriginal,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                . A correção fica marcada e a próxima importação não a desfaz.
              </p>
            )}
            {/* A data identifica o dia no relógio (o id da ponte é
                pd_<jibbleId>_<dia>): mudar a data aqui deixaria um dia órfão e a
                importação seguinte recriaria o antigo. */}
            <p className="mt-0.5 text-xs text-slate-400">
              O dia não se muda por aqui — se a data está errada, lance o dia certo e apague o errado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="bt-pessoa">Pessoa</label>
              <select id="bt-pessoa" className="select" value={form.pessoaId} onChange={setCampo("pessoaId")} required>
                <option value="">— escolher —</option>
                {ativos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="bt-data">Dia</label>
              <input id="bt-data" type="date" className="input" value={form.data} onChange={setCampo("data")} required />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="bt-entrada">Entrada</label>
            <input id="bt-entrada" type="time" className="input" value={form.entrada} onChange={setCampo("entrada")} />
          </div>
          <div>
            <label className="label" htmlFor="bt-saida">Saída</label>
            <input id="bt-saida" type="time" className="input" value={form.saida} onChange={setCampo("saida")} />
          </div>
          <div>
            <label className="label" htmlFor="bt-pausa">Pausa (min)</label>
            <input id="bt-pausa" type="number" min="0" step="5" className="input" value={form.pausa} onChange={setCampo("pausa")} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="bt-obs">Observação</label>
          <input id="bt-obs" type="text" className="input" placeholder="Esqueceu de bater a saída, atestado da tarde..." value={form.obs} onChange={setCampo("obs")} />
        </div>

        <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
          {pausaDemais ? (
            <p className="font-medium text-bad-700">
              A pausa ({pausa} min) é maior que o intervalo entre a entrada e a saída ({duracaoTexto(bruto)}). Confira
              os três campos.
            </p>
          ) : efeito.mantemApuracao ? (
            /* Não mexeu na batida: o apurado do relógio CONTINUA VALENDO. Refazer
               a conta aqui trocaria 8h12 por 9h12 em silêncio — o total do
               relógio não é (saída − entrada) − intervalo, é a escala apurada. */
            <p className="tnum text-slate-700">
              As batidas não mudaram, então continua valendo o apurado do relógio:{" "}
              <strong>{trabalhado === null ? "sem total" : `${duracaoTexto(trabalhado)} para a folha`}</strong>
              {extraDoRelogio ? ` · ${extraDoRelogio}` : ""}.
            </p>
          ) : trabalhado === null ? (
            <p className="text-warn-700">
              Dia <strong>em aberto</strong>: falta a batida de {form.entrada ? "saída" : "entrada"}. Fica registrado
              assim — em aberto não é dia de zero hora.
            </p>
          ) : (
            <p className="tnum text-slate-700">
              Trabalhado: <strong>{duracaoTexto(trabalhado)}</strong>
              {bruto !== null && ` (${duracaoTexto(bruto)} entre as batidas − ${pausa} min de intervalo)`}
            </p>
          )}
          {efeito.apurado && efeito.mexeuNasBatidas && (
            <p className="mt-1.5 text-xs text-warn-700">
              As batidas mudaram, então a apuração do relógio ({apuracaoQueSai || "sem total"}) deixa de descrever
              este dia: ela fica guardada na linha, e daqui em diante vale a conta desta tela.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button
            type="submit"
            className="btn-primary"
            disabled={salvando || pausaDemais || (!corrigindo && (!form.pessoaId || !form.data))}
          >
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * POR QUE A PESSOA NÃO ESTAVA AQUI.
 *
 * Pedido do Leonardo: "quando falta eu posso colocar falta ou então justificada
 * por atestado ou outra coisa". O tipo é escolha de lista porque é ele que
 * decide o dinheiro; o motivo é texto livre porque a palavra de quem estava lá
 * explica o que etiqueta nenhuma explica.
 *
 * A tela DIZ, antes de gravar, o que aquele tipo faz com a folha — só "falta"
 * desconta 1/30. Lançar um atestado achando que é neutro e descobrir o desconto
 * no holerite é o erro que faz o RH parar de lançar.
 */
function FormAusencia({ form, setForm, ativos, salvando, aoSalvar, aoRemover, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const escolhido = TIPOS_AUSENCIA.find((t) => t.tipo === form.tipo) || null;
  const temBatida = !!txt(form.entrada) || !!txt(form.saida);

  return (
    <Modal
      titulo={form.jaTinha ? "Ausência do dia" : "Lançar ausência"}
      aberto={!!form}
      aoFechar={aoFechar}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        {form.travado ? (
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
            <span className="label mb-0.5">Pessoa e dia</span>
            <p className="font-medium text-slate-900">
              {form.pessoaNome || "pessoa não vinculada"} — {dataLonga(form.data)}
            </p>
            {temBatida && (
              <p className="mt-0.5 text-xs">
                Este dia tem batida: {form.entrada || "—"} → {form.saida || "—"}. A batida NÃO é apagada — a hora
                trabalhada continua contando, e a ausência fica ao lado dela.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="au-pessoa">Pessoa</label>
              <select id="au-pessoa" className="select" value={form.pessoaId} onChange={setCampo("pessoaId")} required>
                <option value="">— escolher —</option>
                {ativos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="au-data">Dia</label>
              <input id="au-data" type="date" className="input" value={form.data} onChange={setCampo("data")} required />
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="au-tipo">O que houve</label>
          <select id="au-tipo" className="select" value={form.tipo} onChange={setCampo("tipo")} autoFocus>
            {TIPOS_AUSENCIA.map((t) => (
              <option key={t.tipo} value={t.tipo}>{t.rotulo}</option>
            ))}
          </select>
          {escolhido && <p className="mt-1 text-xs text-slate-500">{escolhido.ajuda}</p>}
        </div>

        <div>
          <label className="label" htmlFor="au-motivo">Motivo</label>
          <input
            id="au-motivo"
            type="text"
            className="input"
            placeholder="Consulta no ortopedista, falecimento do avô, não avisou..."
            value={form.motivo}
            onChange={setCampo("motivo")}
          />
          <p className="mt-1 text-xs text-slate-500">
            Texto livre, e de propósito: seis meses depois é esta frase que explica o dia, não a etiqueta.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="au-documento">Documento</label>
          <input
            id="au-documento"
            type="text"
            className="input"
            placeholder="Atestado 4471, CID, protocolo..."
            value={form.documento}
            onChange={setCampo("documento")}
          />
        </div>

        <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
          {escolhido?.desconta ? (
            <p className="font-medium text-bad-700">
              Este dia vai contar como FALTA e sugerir desconto de 1/30 do salário no fechamento. O desconto só
              acontece quando o RH gravar o fechamento — a sugestão não paga nem desconta sozinha.
            </p>
          ) : (
            <p className="text-slate-600">
              Não desconta. O dia sai do &quot;sem registro&quot; e passa a ter explicação, contado à parte das
              faltas na linha do fechamento.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {form.jaTinha && (
            <button
              type="button"
              className="btn-outline mr-auto text-bad-700"
              onClick={aoRemover}
              disabled={salvando}
            >
              <Trash2 size={14} /> Remover a ausência
            </button>
          )}
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button
            type="submit"
            className="btn-primary"
            disabled={salvando || !form.tipo || (!form.travado && (!form.pessoaId || !form.data))}
          >
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* A escala do dia dentro do formulário de parâmetros: dois turnos, que é o que
   a casa usa (manhã e tarde). Fica FORA do componente da página como todo o
   resto — componente declarado dentro remonta a subárvore a cada tecla e o
   campo perde o foco. */
const CAMPOS_JORNADA = [
  { chave: "i1", rotulo: "Entrada da manhã" },
  { chave: "f1", rotulo: "Saída da manhã" },
  { chave: "i2", rotulo: "Entrada da tarde" },
  { chave: "f2", rotulo: "Saída da tarde" },
];

function LinhaJornada({ linha, onMudar }) {
  const previsto = previstoDaLinha(linha);
  const nome = NOMES_DIA_SEMANA[linha.dia];
  return (
    <div className="grid grid-cols-[5.5rem_repeat(4,1fr)_4.5rem] items-center gap-1.5">
      <span className="font-display text-xs font-semibold capitalize text-slate-600">{nome}</span>
      {CAMPOS_JORNADA.map((c) => (
        <div key={c.chave}>
          <label className="sr-only" htmlFor={`jr-${linha.dia}-${c.chave}`}>
            {c.rotulo} de {nome}
          </label>
          <input
            id={`jr-${linha.dia}-${c.chave}`}
            type="time"
            className="input h-9 py-0 text-xs"
            value={linha[c.chave]}
            onChange={(e) => onMudar({ ...linha, [c.chave]: e.target.value })}
          />
        </div>
      ))}
      <span className="text-right text-xs tnum text-slate-500">
        {/* Par pela metade não vira 0h00: 0h00 pareceria "não se trabalha". */}
        {previsto === null ? <span className="text-bad-700">?</span> : previsto > 0 ? duracaoTexto(previsto) : "—"}
      </span>
    </div>
  );
}

function FormParametros({ form, setForm, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const divisor = inteiroDoCampo(form.divisor);
  const incompletas = (form.jornada || []).filter((l) => previstoDaLinha(l) === null);
  const semanaMin = (form.jornada || []).reduce((s, l) => s + (previstoDaLinha(l) || 0), 0);
  const divisorDaEscala = semanaMin > 0 ? Math.round((semanaMin / 60) * 5) : null;
  return (
    <Modal titulo="Parâmetros do ponto" aberto={!!form} aoFechar={aoFechar} largura="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        {/* A ESCALA DA CASA. Fica aqui, e não no código, porque acordo coletivo
            muda — e jornada cravada no código vira mentira silenciosa no dia em
            que mudar: o número continua saindo, só que errado, e ninguém tem
            onde olhar para descobrir. */}
        <div>
          <span className="label">Jornada da casa</span>
          {form.jornadaEditavel ? (
            <>
              <div className="grid grid-cols-[5.5rem_repeat(4,1fr)_4.5rem] gap-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span>Dia</span>
                <span>Entra</span>
                <span>Sai</span>
                <span>Entra</span>
                <span>Sai</span>
                <span className="text-right">No dia</span>
              </div>
              <div className="space-y-1.5">
                {form.jornada.map((linha) => (
                  <LinhaJornada
                    key={linha.dia}
                    linha={linha}
                    onMudar={(nova) =>
                      setForm({
                        ...form,
                        jornada: form.jornada.map((x) => (x.dia === nova.dia ? nova : x)),
                      })
                    }
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Dia com os quatro campos em branco é dia que não se trabalha. O previsto de cada dia sai daqui — é
                ele que diz o que é hora extra e o que é atraso no dia lançado à mão.
              </p>
            </>
          ) : (
            <p className="text-xs text-warn-700">
              A escala gravada tem dia com mais de dois turnos, e este editor só faz dois (manhã e tarde). Abrir
              mesmo assim apagaria o terceiro turno no primeiro Gravar, em silêncio — então a escala fica como
              está: {descreverJornada(form.jornadaAtual)}.
            </p>
          )}
          {form.jornadaEditavel && incompletas.length > 0 && (
            <p className="mt-1.5 text-sm font-medium text-bad-700">
              {plural(incompletas.length, "dia está", "dias estão")} com um turno pela metade (entrada sem saída, ou
              o contrário): {incompletas.map((l) => NOMES_DIA_SEMANA[l.dia]).join(", ")}. Preencha os dois lados ou
              apague os dois — gravar assim apagaria a jornada do dia sem ninguém ver.
            </p>
          )}
          {form.jornadaEditavel && incompletas.length === 0 && (
            <p className="mt-1.5 text-xs tnum text-slate-500">
              Semana: <strong>{duracaoTexto(semanaMin)}</strong>
              {divisorDaEscala !== null && ` · sustenta o divisor ${divisorDaEscala}`}
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="cf-divisor">Divisor mensal (horas)</label>
          <input id="cf-divisor" type="number" min="1" step="1" className="input" value={form.divisor} onChange={setCampo("divisor")} />
          <p className="mt-1 text-xs text-slate-500">
            220 é o divisor da jornada de 44h por semana (44 × 5). Fica aqui porque acordo coletivo muda.
          </p>
          {/* Escala e divisor são o MESMO fato dito de dois jeitos. Vê-los
              divergir é o único jeito de descobrir que alguém mexeu num e
              esqueceu o outro — e o divisor é o preço da hora extra. */}
          {divisorDaEscala !== null && divisor > 0 && divisorDaEscala !== divisor && (
            <p className="mt-1 text-sm font-medium text-warn-700">
              A escala acima fecha {duracaoTexto(semanaMin)} por semana, que sustenta o divisor {divisorDaEscala} —
              e o divisor aqui está {divisor}. Um dos dois está desatualizado, e é o divisor que define o preço da
              hora extra. Isto é aviso, não trava: pode ser acordo coletivo que separou os dois de propósito.
            </p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="cf-fator">Adicional padrão de hora extra</label>
          <select id="cf-fator" className="select" value={String(form.fatorHoraExtra)} onChange={setCampo("fatorHoraExtra")}>
            {ADICIONAIS_HE.map((a) => (
              <option key={a.fator} value={String(a.fator)}>{a.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            +50% é o piso da CF (art. 7º XVI). Cada lançamento ainda escolhe o dele.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="cf-noturno">Adicional noturno (%)</label>
          <input id="cf-noturno" type="number" min="0" step="1" className="input" value={form.percentualNoturno} onChange={setCampo("percentualNoturno")} />
          <p className="mt-1 text-xs text-slate-500">
            20% é o piso urbano (CLT art. 73). A redução da hora noturna é conversão do escritório contábil — aqui o
            adicional incide sobre os minutos lançados.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Isto muda a conta dos meses AINDA ABERTOS. O que já foi fechado guarda os parâmetros com que foi calculado
          e continua dizendo a mesma coisa.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button
            type="submit"
            className="btn-primary"
            disabled={salvando || divisor <= 0 || (form.jornadaEditavel && incompletas.length > 0)}
          >
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---- planilhas -------------------------------------------------------------

const COLUNAS_FECHAMENTO = [
  { chave: "pessoa", rotulo: "Pessoa" },
  { chave: "cargo", rotulo: "Cargo" },
  { chave: "competencia", rotulo: "Competência" },
  { chave: "situacao", rotulo: "Situação" },
  { chave: "horasExtras", rotulo: "Horas extras (h)", tipo: "numero" },
  { chave: "adicional", rotulo: "Adicional" },
  { chave: "horasExtrasDobro", rotulo: "Horas extras +100% (h)", tipo: "numero" },
  { chave: "origemExtras", rotulo: "De onde veio" },
  { chave: "faltas", rotulo: "Faltas (dias)", tipo: "numero" },
  // As duas contagens saem SEPARADAS na planilha pelo mesmo motivo que na tela:
  // uma coluna só faria quem ficou doente somar junto com quem faltou.
  { chave: "faltasLancadas", rotulo: "Faltas lançadas (dias)", tipo: "numero" },
  { chave: "ausenciasAbonadas", rotulo: "Ausências abonadas (dias)", tipo: "numero" },
  { chave: "atrasos", rotulo: "Atrasos (h)", tipo: "numero" },
  { chave: "noturno", rotulo: "Ad. noturno (h)", tipo: "numero" },
  { chave: "salarioBase", rotulo: "Salário base", tipo: "dinheiro" },
  { chave: "divisor", rotulo: "Divisor", tipo: "numero" },
  { chave: "valorHora", rotulo: "Valor hora", tipo: "dinheiro" },
  { chave: "valorHoraExtra", rotulo: "Valor hora extra", tipo: "dinheiro" },
  { chave: "valorExtras", rotulo: "Horas extras (R$)", tipo: "dinheiro" },
  { chave: "valorExtrasDobro", rotulo: "Horas extras +100% (R$)", tipo: "dinheiro" },
  { chave: "valorNoturno", rotulo: "Ad. noturno (R$)", tipo: "dinheiro" },
  { chave: "valorFaltas", rotulo: "Descontos (R$)", tipo: "dinheiro" },
  { chave: "valorCalculado", rotulo: "Calculado (R$)", tipo: "dinheiro" },
  { chave: "valorLancado", rotulo: "Lançado (R$)", tipo: "dinheiro" },
  { chave: "diferenca", rotulo: "Diferença (R$)", tipo: "dinheiro" },
  { chave: "diasComBatida", rotulo: "Dias com batida", tipo: "numero" },
  { chave: "diasEmAberto", rotulo: "Dias em aberto", tipo: "numero" },
  { chave: "obs", rotulo: "Observação" },
];

const COLUNAS_BATIDAS = [
  { chave: "data", rotulo: "Dia", tipo: "data" },
  { chave: "pessoa", rotulo: "Pessoa" },
  { chave: "entrada", rotulo: "Entrada" },
  { chave: "saida", rotulo: "Saída" },
  { chave: "pausaMin", rotulo: "Pausa (min)", tipo: "numero" },
  { chave: "cracha", rotulo: "No crachá (h)", tipo: "numero" },
  { chave: "trabalhado", rotulo: "Para a folha (h)", tipo: "numero" },
  { chave: "extra", rotulo: "Extra +50% (h)", tipo: "numero" },
  { chave: "extraDobro", rotulo: "Extra +100% (h)", tipo: "numero" },
  { chave: "atrasoEntrada", rotulo: "Atraso na entrada (min)", tipo: "numero" },
  { chave: "atrasoCobravel", rotulo: "Atraso fora da tolerância (min)", tipo: "numero" },
  { chave: "ausencia", rotulo: "Ausência" },
  { chave: "ausenciaMotivo", rotulo: "Motivo" },
  { chave: "ausenciaDocumento", rotulo: "Documento" },
  { chave: "emAberto", rotulo: "Em aberto" },
  { chave: "origem", rotulo: "Origem" },
  { chave: "corrigido", rotulo: "Corrigido" },
  { chave: "relogio", rotulo: "Veio do relógio" },
  { chave: "jibbleId", rotulo: "Id no relógio" },
  { chave: "obs", rotulo: "Observação" },
];

// ============================================================================

export default function AbaPonto({
  pessoas, ativos, ponto, pontoDia, hojeISO, editavel, gravar, apagarReg, setAviso, recarregar,
}) {
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO));
  const [visao, setVisao] = useState("fechamento");
  // Ativos | Todos | Desligados — a escolha nasce do que ficou guardado.
  const [recorte, setRecorte] = useState(lerRecorte);
  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [formFechamento, setFormFechamento] = useState(null);
  const [formBatida, setFormBatida] = useState(null);
  const [formAusencia, setFormAusencia] = useState(null);
  const [formParametros, setFormParametros] = useState(null);
  /* QUEM ESTÁ ABERTO NO DETALHE, e qual dia está em foco lá dentro.
     { pessoa, diaFoco } — diaFoco null quando o clique veio da linha de
     FECHAMENTO, que é do mês inteiro e não de um dia; na linha de BATIDA vai o
     dia daquela linha. */
  const [detalhe, setDetalhe] = useState(null);
  const detalhar = useCallback((pessoa, diaFoco) => setDetalhe({ pessoa, diaFoco: diaFoco || null }), []);
  const [salvando, setSalvando] = useState(false);
  const [escolhasVinculo, setEscolhasVinculo] = useState({});
  // A configuração global. null = AINDA NÃO CARREGOU (ou falhou), que não é o
  // mesmo que "não existe": enquanto isso a conta usa o padrão da casa e a tela
  // diz que está usando o padrão.
  const [config, setConfig] = useState(null);
  const [cfgFalhou, setCfgFalhou] = useState(false);

  /* PUXAR DO RELÓGIO — o texto do botão é o próprio progresso, porque a
     importação de um mês leva janelas e um botão parado parece travado.
     A ponte preserva o dia corrigido à mão; o número de preservados é dito em
     voz alta, senão o RH acharia que a correção dele se perdeu. */
  const [importando, setImportando] = useState("");

  const puxarDoRelogio = async () => {
    if (importando) return;
    const [a, m] = competencia.split("-").map(Number);
    const de = `${competencia}-01`;
    const ate = `${competencia}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
    setImportando("Puxando...");
    try {
      const r = await importarPeriodo(de, ate, ({ lidos }) => setImportando(`${lidos} batidas...`));
      setAviso({
        tipo: "ok",
        texto: r.lidos === 0
          // Zero não é resultado: pode ser mês sem batida ou fonte sem resposta.
          ? "O relógio não devolveu batida nenhuma neste mês. Confira o período no Jibble."
          : `${r.gravados} dia(s) atualizados do relógio.` +
            (r.preservados ? ` ${r.preservados} corrigido(s) à mão foram preservados.` : ""),
      });
      recarregar?.();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setImportando("");
    }
  };

  const carregarCfg = useCallback(() => {
    lerCfg()
      .then((c) => {
        setConfig(c || {});
        setCfgFalhou(false);
      })
      .catch(() => setCfgFalhou(true));
  }, []);

  useEffect(() => {
    carregarCfg();
  }, [carregarCfg]);

  const cfg = useMemo(() => cfgDoPonto(config), [config]);

  const mudarRecorte = (valor) => {
    setRecorte(valor);
    /* O filtro por pessoa some junto: trocar o recorte pode tirar da lista
       justamente quem estava filtrado, e um filtro apontando para quem não está
       mais à vista deixa a tela vazia sem dizer por quê. */
    setFiltroPessoa("");
    try {
      localStorage.setItem(K_RECORTE, valor);
    } catch {
      // Sem localStorage a escolha só não persiste.
    }
  };

  /* QUEM O PONTO ALCANÇA. Sai do quadro de hoje menos quem a ficha diz que não
     bate ponto — é esta lista que os seletores de pessoa oferecem, aqui e nos
     lançamentos: oferecer para lançar batida de quem não é medido pelo relógio
     é convidar o erro a entrar pela porta da frente. */
  const ativosDoPonto = useMemo(() => ativos.filter(batePontoDe), [ativos]);

  const vm = useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    const porId = new Map(pessoas.map((p) => [p.id, p]));
    const porJibble = new Map();
    for (const p of pessoas) {
      const j = txt(p.jibbleId);
      if (j) porJibble.set(j, p);
    }

    // ID MANDA: a batida casa por pessoaId ou por jibbleId. Nome nunca — nome
    // igual entre duas pessoas cria sósia, e nome que mudou some com o dia.
    const doMes = (pontoDia || []).filter((d) => competenciaDe(d.data) === competencia);
    const batidas = doMes
      .map((d) => {
        const pessoa =
          (d.pessoaId && porId.get(d.pessoaId)) ||
          (txt(d.jibbleId) && porJibble.get(txt(d.jibbleId))) ||
          null;
        return {
          d,
          pessoa,
          min: minutosTrabalhados(d),
          ausencia: ausenciaDoDia(d),
          // Pontualidade: a batida de entrada contra o começo previsto pela
          // ESCALA. Null quando não há o que medir (fim de semana, dia sem
          // entrada) — e null é o que faz a linha não escrever nada, em vez de
          // dizer "chegou na hora" sem ter medido.
          pontualidade: atrasoDoDia(d, cfg.jornada),
        };
      })
      .sort(
        (a, b) =>
          String(b.d.data).localeCompare(String(a.d.data)) ||
          norm(a.pessoa?.nome || a.d.pessoaNome).localeCompare(norm(b.pessoa?.nome || b.d.pessoaNome))
      );

    const diasPorPessoa = new Map();
    const semVinculoMap = new Map();
    for (const b of batidas) {
      if (b.pessoa) {
        if (!diasPorPessoa.has(b.pessoa.id)) diasPorPessoa.set(b.pessoa.id, []);
        diasPorPessoa.get(b.pessoa.id).push(b.d);
        continue;
      }
      // Batida órfã NÃO some: vira pendência com o nome que o relógio mandou.
      const chave = txt(b.d.jibbleId);
      const g = semVinculoMap.get(chave) || { jibbleId: chave, nomeNoRelogio: "", dias: 0 };
      g.dias += 1;
      if (!g.nomeNoRelogio && b.d.pessoaNome) g.nomeNoRelogio = b.d.pessoaNome;
      semVinculoMap.set(chave, g);
    }
    const semVinculo = [...semVinculoMap.values()].sort((a, b) =>
      norm(a.nomeNoRelogio).localeCompare(norm(b.nomeNoRelogio))
    );

    const regsMes = (ponto || []).filter((r) => r.competencia === competencia);
    const regPorPessoa = new Map();
    for (const r of regsMes) {
      if (!regPorPessoa.has(r.pessoaId)) regPorPessoa.set(r.pessoaId, r);
    }

    // Quem entra no fechamento: o quadro de hoje MAIS quem tem batida ou
    // lançamento no mês. Desligada no dia 15 ainda recebe pela primeira
    // quinzena — some da lista e some da folha.
    const daLinha = [...ativos];
    const jaTem = new Set(daLinha.map((p) => p.id));
    for (const id of new Set([...diasPorPessoa.keys(), ...regsMes.map((r) => r.pessoaId)])) {
      if (!id || jaTem.has(id)) continue;
      jaTem.add(id);
      const p = porId.get(id);
      // Ficha que não resolve não é descartada em silêncio: entra com o nome
      // carimbado no lançamento, para o RH ver que existe e ir atrás.
      daLinha.push(p || { id, nome: regPorPessoa.get(id)?.pessoaNome || "(ficha não encontrada)", ausente: true });
    }
    daLinha.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));

    /* O RECORTE À VISTA — e o que ele deixou de fora, contado, nunca calado.
       QUEM NÃO BATE PONTO SOME (decisão do Léo, 28/08/2026): quem não é medido
       pelo relógio não tem fechamento de ponto para conferir, e a linha dela
       só sujava a lista. O motivo vem antes do recorte porque é o permanente:
       quem não bate ponto não aparece aqui em recorte nenhum. */
    const foraDoRecorte = [];
    const semPonto = [];
    const visiveis = [];
    for (const p of daLinha) {
      if (!batePontoDe(p)) semPonto.push(p);
      else if (!noRecorte(p, recorte)) foraDoRecorte.push(p);
      else visiveis.push(p);
    }
    const idsVisiveis = new Set(visiveis.map((p) => p.id));
    // Movimento no mês = batida importada ou fechamento lançado. Ficha que diz
    // "não bate ponto" e mês que tem movimento dela é contradição, e o RH tem
    // de ver que ela existe para ir consertar a ficha.
    const temMovimento = (p) => (diasPorPessoa.get(p.id)?.length || 0) > 0 || regPorPessoa.has(p.id);

    /* AS BATIDAS SEGUEM AS PESSOAS. Some quem some: a batida de quem saiu do
       recorte sai da lista junto. A SEM VÍNCULO FICA — ela não é de ninguém
       ainda, é pendência, e sumir com ela esconderia trabalho de gente real. */
    const batidasNoRecorte = batidas.filter((b) => !b.pessoa || idsVisiveis.has(b.pessoa.id));

    const fora = {
      semPonto: semPonto.length,
      semPontoComRegistro: semPonto.filter(temMovimento).length,
      recorte: foraDoRecorte.length,
      batidas: batidas.length - batidasNoRecorte.length,
    };

    const jornadaEmPalavras = descreverJornada(cfg.jornada);

    const linhas = visiveis.map((pessoa) => {
      const dias = diasPorPessoa.get(pessoa.id) || [];
      const { unicos, repetidos } = porDiaUnico(dias);
      // O previsto do dia sai da ESCALA DA CASA, pelo dia da semana da data —
      // não mais de 44h ÷ 5. A média inventava 48 min de atraso toda sexta e
      // cobrava jornada inteira de quem foi trabalhar no sábado.
      const apuracao = apurarCompetencia(unicos, cfg.jornada);
      const reg = regPorPessoa.get(pessoa.id) || null;

      // Registro gravado: manda o CARIMBO dos parâmetros. Sem carimbo (registro
      // antigo), cai no que a ficha e a configuração dizem hoje.
      const conta = reg
        ? calcularFechamento({
            salario: salarioDaConta(reg, pessoa),
            divisor: reg.divisor || cfg.divisor,
            fator: reg.fatorHoraExtra || cfg.fatorHoraExtra,
            // Registro antigo não carimbou o fator da dobra, e não precisa: a
            // dobra é a dobra (+100%), não é escolha de acordo coletivo.
            fatorDobro: reg.fatorHoraExtraDobro || FATOR_HE_DOBRA,
            percentualNoturno:
              reg.percentualNoturno === undefined || reg.percentualNoturno === null
                ? cfg.percentualNoturno
                : reg.percentualNoturno,
            horasExtrasMin: reg.horasExtrasMin,
            // Ausente no registro antigo entra como 0 — a faixa não existia
            // quando ele foi gravado, e a dobra daquela época está em
            // horasExtrasMin com o fator carimbado no próprio registro.
            horasExtrasDobroMin: reg.horasExtrasDobroMin,
            faltas: reg.faltas,
            atrasosMin: reg.atrasosMin,
            adicionalNoturnoMin: reg.adicionalNoturnoMin,
          })
        : calcularFechamento({
            salario: pessoa.salario,
            divisor: cfg.divisor,
            fator: cfg.fatorHoraExtra,
            percentualNoturno: cfg.percentualNoturno,
            horasExtrasMin: apuracao.extrasMin || 0,
            horasExtrasDobroMin: apuracao.extrasDobroMin || 0,
            atrasosMin: apuracao.atrasosMin || 0,
          });

      // Há o que sugerir quando o relógio apurou alguma faixa, quando dá para
      // derivar o saldo do dia lançado à mão, ou quando alguém LANÇOU ausência
      // no mês. Sem nada disso, a linha não mostra sugestão nenhuma — em vez de
      // mostrar zeros.
      const temSugestao =
        apuracao.extrasMin !== null || apuracao.extrasDobroMin !== null || apuracao.ausenciasTotal > 0;
      // De onde veio o número que a conta escrita repete: do CARIMBO, quando há
      // registro gravado; da própria apuração, quando a linha ainda é sugestão.
      const fonte = reg
        ? { extras: reg.origemExtras, extrasDobro: reg.origemExtrasDobro }
        : {
            extras: apuracao.fonteExtras,
            extrasDobro: apuracao.extrasDobroMin === null ? "manual" : "relogio",
          };

      // Texto ilegível no campo de dinheiro não vira R$ 0,00: sem número válido,
      // vale o calculado, e a divergência aparece na conferência.
      const bruto =
        reg && reg.valorLancado !== "" && reg.valorLancado !== null && reg.valorLancado !== undefined
          ? Number(reg.valorLancado)
          : null;
      const temLancado = bruto !== null && Number.isFinite(bruto);
      const valorFinal = temLancado ? bruto : reg ? conta.valorCalculado : null;
      const dif = temLancado ? diferencaDoCalculo(bruto, conta.valorCalculado) : 0;
      // Controle: o valor gravado tem que ser o que esta conta produz. Se não
      // for (registro de outra versão, gravado por outro cliente, ou gravado
      // quando a ficha ainda não tinha salário), a tela avisa em vez de mostrar
      // dois números como se fossem um.
      const gravadoSemValor =
        !!reg && (reg.valorCalculado === "" || reg.valorCalculado === null || reg.valorCalculado === undefined);
      const divergente =
        !!reg &&
        !conta.semSalario &&
        (gravadoSemValor || diferencaDoCalculo(reg.valorCalculado, conta.valorCalculado) !== 0);
      // Falta de salário só é PENDÊNCIA de quem tem mês para fechar: cobrar a
      // ficha de quem não trabalhou nem lançou nada faria o número nunca zerar,
      // e número que nunca zera deixa de ser lido.
      const semSalarioPendente = conta.semSalario && (!!reg || apuracao.diasComBatida > 0);

      return {
        pessoa, dias, repetidos, apuracao, reg, conta, dif, valorFinal, divergente, semSalarioPendente,
        fonte, temSugestao, jornadaEmPalavras,
      };
    });

    const lancadas = linhas.filter((l) => l.reg);
    // As duas faixas somadas SÓ para o cartão de horas — quantidade de hora,
    // não dinheiro. Onde vira R$, elas continuam separadas, cada uma no seu
    // fator: a soma aqui é leitura, lá seria a conta errada.
    const extrasLancadasMin = lancadas.reduce(
      (s, l) => s + (Number(l.reg.horasExtrasMin) || 0) + (Number(l.reg.horasExtrasDobroMin) || 0),
      0
    );
    const extrasLancadasDobroMin = lancadas.reduce((s, l) => s + (Number(l.reg.horasExtrasDobroMin) || 0), 0);
    const extrasApuradasMin = linhas.reduce((s, l) => s + (l.apuracao.extrasMin || 0), 0);
    const extrasApuradasDobroMin = linhas.reduce((s, l) => s + (l.apuracao.extrasDobroMin || 0), 0);
    const comValor = lancadas.filter((l) => l.valorFinal !== null && l.valorFinal !== undefined);
    const semSalario = linhas.filter((l) => l.semSalarioPendente);
    // As ausências do mês, somadas com a MESMA separação da linha: o que
    // desconta de um lado, o que não desconta do outro. Um total só faria a
    // equipe que ficou doente parecer a equipe que faltou.
    const faltasMes = linhas.reduce((s, l) => s + l.apuracao.faltasQueDescontam, 0);
    const abonadasMes = linhas.reduce((s, l) => s + l.apuracao.ausenciasSemDesconto, 0);
    const ausenciasEstranhas = linhas.reduce((s, l) => s + l.apuracao.ausenciasDesconhecidas, 0);

    const anos = new Set([Number(String(hojeISO).slice(0, 4)), Number(String(hojeISO).slice(0, 4)) - 1]);
    for (const d of pontoDia || []) {
      const a = Number(String(d.data || "").slice(0, 4));
      if (a) anos.add(a);
    }
    for (const r of ponto || []) {
      const a = Number(String(r.competencia || "").slice(0, 4));
      if (a) anos.add(a);
    }

    return {
      batidas: batidasNoRecorte,
      // O mês INTEIRO, para "nenhuma batida importada" continuar querendo dizer
      // isso. Contado no recorte, ele viraria "ninguém bateu ponto em agosto"
      // por causa de um filtro de tela — e isso é afirmação falsa.
      batidasNoMes: batidas.length,
      linhas,
      fora,
      // As fichas de verdade que estão à mostra (sem os "ficha não encontrada"),
      // para os seletores de pessoa oferecerem o mesmo recorte da lista.
      pessoasVisiveis: visiveis.filter((p) => !p.ausente),
      semVinculo,
      jornadaEmPalavras,
      // Aqui entra TODO MUNDO que tem crachá no relógio, inclusive quem a ficha
      // diz que não bate ponto: este é o único lugar de DESVINCULAR, e esconder
      // o vínculo errado seria esconder justamente o que precisa de conserto.
      vinculados: pessoas.filter((p) => txt(p.jibbleId)).sort((a, b) => norm(a.nome).localeCompare(norm(b.nome))),
      anos: [...anos].filter(Boolean).sort((a, b) => b - a),
      kpi: {
        faltasMes,
        abonadasMes,
        ausenciasEstranhas,
        lancadas: lancadas.length,
        total: linhas.length,
        semLancamento: linhas.length - lancadas.length,
        extrasLancadasMin: lancadas.length ? extrasLancadasMin : null,
        extrasLancadasDobroMin: lancadas.length ? extrasLancadasDobroMin : null,
        extrasApuradasMin,
        extrasApuradasDobroMin,
        totalRS: comValor.length ? comValor.reduce((s, l) => s + l.valorFinal, 0) : null,
        semSalario: semSalario.length,
        pendencias: semSalario.length + semVinculo.length,
        fechadas: lancadas.filter((l) => l.reg.fechado).length,
      },
    };
  }, [pessoas, ativos, ponto, pontoDia, competencia, cfg, hojeISO, recorte]);

  // O recorte visível da aba Batidas — é ele que a planilha leva.
  const batidasVisiveis = useMemo(() => {
    if (!filtroPessoa) return vm.batidas;
    if (filtroPessoa === SEM_VINCULO) return vm.batidas.filter((b) => !b.pessoa);
    return vm.batidas.filter((b) => b.pessoa?.id === filtroPessoa);
  }, [vm.batidas, filtroPessoa]);

  const disparar = async (colecao, registro, fraseOk, fechar) => {
    setSalvando(true);
    try {
      await gravar(colecao, registro, fraseOk, fechar);
    } finally {
      setSalvando(false);
    }
  };

  // ---- vínculo -------------------------------------------------------------

  const vincular = (jibbleId, pessoaId) => {
    const p = pessoas.find((x) => x.id === pessoaId);
    if (!p) return setAviso({ tipo: "erro", texto: "Não encontrei essa ficha. Recarregue a tela." });
    // Um crachá, uma pessoa: dois vínculos no mesmo id fariam o mesmo dia
    // aparecer para duas pessoas, e a folha pagaria duas vezes.
    const outro = pessoas.find((x) => x.id !== pessoaId && txt(x.jibbleId) === txt(jibbleId));
    if (outro) {
      return setAviso({
        tipo: "erro",
        texto: `O relógio ${jibbleId} já está vinculado a ${outro.nome}. Desvincule antes de trocar.`,
      });
    }
    return disparar("rh_pessoas", { ...p, jibbleId: txt(jibbleId) }, `${p.nome} vinculado ao relógio ${jibbleId}.`, () =>
      setEscolhasVinculo({})
    );
  };

  const desvincular = (p) => {
    if (!window.confirm(`Desvincular ${p.nome} do relógio ${p.jibbleId}? As batidas dela voltam a aparecer como "pessoa não vinculada".`)) return;
    disparar("rh_pessoas", { ...p, jibbleId: "" }, `${p.nome} desvinculado do relógio.`);
  };

  // ---- fechamento ----------------------------------------------------------

  const abrirFechamento = (l) => {
    const reg = l.reg;
    setFormFechamento({
      id: reg?.id || "",
      pessoaId: l.pessoa.id,
      pessoaNome: l.pessoa.nome,
      competencia,
      // O salário do MOMENTO da conta: registro gravado mantém o que foi
      // carimbado; lançamento novo pega o da ficha.
      salario: salarioDaConta(reg, l.pessoa),
      divisor: reg?.divisor || cfg.divisor,
      percentualNoturno:
        reg?.percentualNoturno === undefined || reg?.percentualNoturno === null
          ? cfg.percentualNoturno
          : reg.percentualNoturno,
      fator: reg?.fatorHoraExtra || cfg.fatorHoraExtra,
      fatorDobro: reg?.fatorHoraExtraDobro || FATOR_HE_DOBRA,
      // duracaoCampo(0) devolve "00:00": zero gravado tem que voltar como zero,
      // senão o próximo Gravar apaga o zero em silêncio.
      horasExtras: reg ? duracaoCampo(reg.horasExtrasMin) : "",
      // Registro antigo não tem a faixa de dobra: duracaoCampo(undefined) dá ""
      // e o campo abre vazio, que é "não houve" — e não um zero inventado.
      horasExtrasDobro: reg ? duracaoCampo(reg.horasExtrasDobroMin) : "",
      faltas: reg && reg.faltas !== "" && reg.faltas !== null && reg.faltas !== undefined ? String(reg.faltas) : "",
      atrasos: reg ? duracaoCampo(reg.atrasosMin) : "",
      noturno: reg ? duracaoCampo(reg.adicionalNoturnoMin) : "",
      // Mesmo desenho para o dinheiro: paraCampo(0) devolveria "" e apagaria o
      // zero lançado de propósito ("este mês não tem nada a receber").
      valorLancado:
        reg && reg.valorLancado !== "" && reg.valorLancado !== null && reg.valorLancado !== undefined
          ? String(reg.valorLancado).replace(".", ",")
          : "",
      obs: reg?.obs || "",
      /* `fechado`/`fechadoEm` NÃO entram no formulário de propósito. Eram
         copiados para cá quando o modal abria e regravados no Gravar — e um
         retrato de dez minutos atrás REABRIA em silêncio a competência que
         outra pessoa tinha acabado de fechar, por cima de números já
         conferidos. Quem fecha e quem reabre são os botões da linha; o Gravar
         relê o estado de agora e não mexe nesses dois campos. */
      // A sugestão existe quando o relógio apurou alguma faixa, quando dá para
      // derivar o dia lançado à mão, ou quando há ausência lançada no mês.
      sugestao: l.temSugestao ? l.apuracao : null,
      // A régua da parte derivada, em palavras: previsto sem dono é número que
      // ninguém confere.
      jornadaEmPalavras: l.jornadaEmPalavras,
    });
  };

  const gravarFechamento = async () => {
    const f = formFechamento;
    if (!f) return;
    const extras = txt(f.horasExtras) ? minutosDaDuracao(f.horasExtras) : 0;
    const extrasDobro = txt(f.horasExtrasDobro) ? minutosDaDuracao(f.horasExtrasDobro) : 0;
    const atrasos = txt(f.atrasos) ? minutosDaDuracao(f.atrasos) : 0;
    const noturno = txt(f.noturno) ? minutosDaDuracao(f.noturno) : 0;
    if (extras === null || extrasDobro === null || atrasos === null || noturno === null) {
      // Nunca gravar 0 no lugar do que não foi entendido: o mês sairia zerado e
      // ninguém veria o erro de digitação.
      return setAviso({
        tipo: "erro",
        texto: "Não entendi uma das durações. Escreva como 02:30 (ou 2,5 para duas horas e meia).",
      });
    }
    const faltas = inteiroDoCampo(f.faltas);
    // Id determinístico: um fechamento por pessoa e mês. Sem isso, dois cliques
    // criavam dois fechamentos do mesmo mês e a folha somava dobrado.
    const id = f.id || `pt_${f.pessoaId}_${f.competencia}`;

    /* RELER ANTES DE ESCREVER.
       O modal abriu com um retrato do registro. Se, nesse meio-tempo, outra
       pessoa fechou a competência, gravar por cima com aquele retrato a
       REABRIRIA em silêncio — e ainda sobrescreveria números que alguém já
       tinha conferido e assinado. A porta de gravação substitui o registro
       inteiro, então `fechado`/`fechadoEm` têm de vir da leitura de AGORA, não
       do retrato: gravar fechamento não é abrir nem fechar competência.
       Continua sendo ler-calcular-gravar (duas pessoas no mesmo segundo, a
       última vence), mas fecha a janela que importa, que é a de minutos. */
    setSalvando(true);
    let atual = null;
    try {
      atual = (await listar(COL_FECHAMENTO)).find((r) => r.id === id) || null;
    } catch (e) {
      return setAviso({
        tipo: "erro",
        texto: `Não consegui conferir como está o fechamento antes de gravar (${e.message}). Nada foi alterado — tente de novo.`,
      });
    } finally {
      setSalvando(false);
    }
    if (atual?.fechado) {
      return setAviso({
        tipo: "erro",
        texto:
          `${f.pessoaNome} já foi FECHADO em ${rotuloCompetencia(f.competencia)}` +
          `${atual.fechadoEm ? ` (em ${dataLonga(atual.fechadoEm)})` : ""} enquanto esta janela estava aberta. ` +
          "Nada foi gravado. Reabra o fechamento na lista se precisar mudar os números.",
      });
    }

    const conta = calcularFechamento({
      salario: f.salario,
      divisor: f.divisor,
      fator: Number(f.fator),
      fatorDobro: f.fatorDobro,
      percentualNoturno: f.percentualNoturno,
      horasExtrasMin: extras,
      horasExtrasDobroMin: extrasDobro,
      faltas,
      atrasosMin: atrasos,
      adicionalNoturnoMin: noturno,
    });
    // A MESMA regra que a caixa da conta mostrou enquanto se digitava.
    const fonte = fonteDoLancamento(f.sugestao, extras, extrasDobro);

    return disparar(
      COL_FECHAMENTO,
      {
        id,
        pessoaId: f.pessoaId,
        pessoaNome: f.pessoaNome, // carimbo: a linha continua legível depois do desligamento
        competencia: f.competencia,
        horasExtrasMin: extras,
        // As duas faixas em campos separados: somadas num só, quem for refazer
        // a conta teria de adivinhar o fator — e adivinhar erra em dinheiro.
        horasExtrasDobroMin: extrasDobro,
        faltas,
        atrasosMin: atrasos,
        adicionalNoturnoMin: noturno,
        // Carimbo dos parâmetros: é o que faz este mês continuar dizendo a mesma
        // coisa depois de um aumento ou de o acordo coletivo mudar o divisor.
        salarioBase: conta.semSalario ? "" : conta.salarioBase,
        divisor: conta.divisor,
        fatorHoraExtra: conta.fator,
        fatorHoraExtraDobro: conta.fatorDobro,
        percentualNoturno: conta.percentualNoturno,
        // Carimbo da PROCEDÊNCIA: se veio do relógio ou do dedo de alguém. Vai
        // gravado, e não recalculado na leitura, porque batida corrigida amanhã
        // mudaria a apuração e a linha de um mês conferido passaria a dizer
        // outra coisa sobre o que já foi conferido.
        origemExtras: fonte.extras,
        origemExtrasDobro: fonte.extrasDobro,
        // Nome herdado: é o TOTAL em R$ das horas extras — agora as DUAS faixas
        // somadas, cada uma já multiplicada pelo seu fator.
        // Sem salário, dinheiro vai VAZIO — nunca 0, que afirmaria "nada a receber".
        valorHoraExtra: conta.valorExtrasTotal === null ? "" : conta.valorExtrasTotal,
        valorNoturno: conta.valorNoturno === null ? "" : conta.valorNoturno,
        valorFaltas: conta.valorFaltas === null ? "" : conta.valorFaltas,
        valorCalculado: conta.valorCalculado === null ? "" : conta.valorCalculado,
        valorLancado: txt(f.valorLancado) ? paraNumero(f.valorLancado) : "",
        obs: txt(f.obs),
        // Da LEITURA DE AGORA, nunca do retrato do modal. Chegar aqui já quer
        // dizer que a competência não está fechada; escrever o que se acabou de
        // ler, em vez de `false` cravado, é o que mantém a regra escrita onde
        // ela vale — não é este Gravar que decide abrir ou fechar mês.
        fechado: !!atual?.fechado,
        fechadoEm: atual?.fechadoEm || "",
      },
      conta.semSalario
        ? `Horas de ${f.pessoaNome} registradas. Sem salário na ficha, o valor fica pendente.`
        : `Fechamento de ${f.pessoaNome} gravado: ${moedaCheia(
            txt(f.valorLancado) ? paraNumero(f.valorLancado) : conta.valorCalculado
          )}.`,
      () => setFormFechamento(null)
    );
  };

  const fecharLinha = (l) => {
    if (!l.reg) return;
    disparar(
      COL_FECHAMENTO,
      { ...l.reg, fechado: true, fechadoEm: new Date().toISOString() },
      `${l.pessoa.nome} fechado em ${rotuloCompetencia(competencia)}.`
    );
  };

  const reabrirLinha = (l) => {
    if (!l.reg) return;
    // Reabrir exige confirmação: mês fechado é mês conferido, e reabrir sem
    // querer deixaria a folha mudar debaixo de quem já assinou.
    if (!window.confirm(`Reabrir o fechamento de ${l.pessoa.nome} em ${rotuloCompetencia(competencia)}? A edição volta a ser permitida.`)) return;
    disparar(COL_FECHAMENTO, { ...l.reg, fechado: false, fechadoEm: "" }, `${l.pessoa.nome} reaberto.`);
  };

  const fecharCompetencia = async () => {
    /* FECHA O QUE ESTÁ À VISTA, e diz isso. A lista é um recorte (Ativos, por
       padrão), então "fechar a competência" fecha os lançamentos DESTA lista —
       botão que parece fechar o mês inteiro e fecha metade dele é o tipo de
       coisa que só se descobre na folha. */
    const abertos = vm.linhas.filter((l) => l.reg && !l.reg.fechado);
    if (abertos.length === 0) {
      return setAviso({
        tipo: "erro",
        texto: `Não há lançamento aberto nesta lista (${rotuloDoRecorte(recorte)}) para fechar. Lance as horas primeiro.`,
      });
    }
    if (
      !window.confirm(
        `Fechar ${plural(abertos.length, "lançamento", "lançamentos")} de ${rotuloCompetencia(competencia)}? São os desta lista (${rotuloDoRecorte(recorte)}). A edição fica travada até alguém reabrir.`
      )
    ) {
      return;
    }
    const agora = new Date().toISOString();
    setSalvando(true);
    try {
      // Um pedido por registro (ids diferentes, sem corrida entre eles). A porta
      // de gravação da casca não devolve o resultado, então a frase final não
      // afirma quantos deram certo: quem diz isso é a coluna "fechado" da lista,
      // que vem recarregada do servidor.
      for (const l of abertos) {
        await gravar(COL_FECHAMENTO, { ...l.reg, fechado: true, fechadoEm: agora }, `${l.pessoa.nome} fechado.`);
      }
      setAviso({
        tipo: "ok",
        texto: `Terminei de fechar ${rotuloCompetencia(competencia)}. Confira na lista quem ficou fechado — o que falhar continua aberto.`,
      });
    } finally {
      setSalvando(false);
    }
  };

  // ---- batidas -------------------------------------------------------------

  const abrirBatidaNova = () =>
    setFormBatida({
      id: "",
      pessoaId: "",
      pessoaNome: "",
      // Nasce no mês que está na tela, não em "hoje": quem está lançando
      // fevereiro não quer um dia de março.
      data: competenciaDe(hojeISO) === competencia ? hojeISO : `${competencia}-01`,
      entrada: "",
      saida: "",
      pausa: "",
      obs: "",
      origem: "manual",
    });

  const abrirCorrecao = (b) =>
    setFormBatida({
      id: b.d.id,
      pessoaId: b.pessoa?.id || b.d.pessoaId || "",
      pessoaNome: b.pessoa?.nome || b.d.pessoaNome || "",
      data: b.d.data,
      entrada: b.d.entrada || "",
      saida: b.d.saida || "",
      pausa:
        b.d.pausaMin === "" || b.d.pausaMin === null || b.d.pausaMin === undefined ? "" : String(b.d.pausaMin),
      obs: b.d.obs || "",
      origem: b.d.origem || "manual",
      base: b.d,
      relogioEntrada: b.d.relogioEntrada ?? b.d.entrada ?? "",
      relogioSaida: b.d.relogioSaida ?? b.d.saida ?? "",
      relogioPausaMin: b.d.relogioPausaMin ?? b.d.pausaMin ?? "",
    });

  const gravarBatida = () => {
    const f = formBatida;
    if (!f) return;
    const ano = anoRuim(f.data);
    if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano do dia: ${ano}` });

    const pausa = inteiroDoCampo(f.pausa);
    const bruto = minutosEntre(f.entrada, f.saida);
    if (bruto !== null && pausa > bruto) {
      return setAviso({ tipo: "erro", texto: "A pausa é maior que o intervalo entre a entrada e a saída." });
    }

    const base = f.base || null;
    const pessoa = pessoas.find((x) => x.id === f.pessoaId) || null;
    if (!base && !pessoa) return setAviso({ tipo: "erro", texto: "Escolha a pessoa." });

    if (!base) {
      // Um dia, um registro: se já existe batida dessa pessoa nesse dia, o
      // caminho é corrigir a que está lá — gravar por cima criaria dois dias.
      const jaTem = (pontoDia || []).find((d) => {
        if (d.data !== f.data) return false;
        if (d.pessoaId && d.pessoaId === pessoa.id) return true;
        return txt(d.jibbleId) && txt(d.jibbleId) === txt(pessoa.jibbleId);
      });
      if (jaTem) {
        return setAviso({
          tipo: "erro",
          texto: `Já existe batida de ${pessoa.nome} em ${dataLonga(f.data)}. Corrija a que está na lista.`,
        });
      }
    }

    const jibbleId = txt(pessoa?.jibbleId) || txt(base?.jibbleId);
    // Id determinístico e IGUAL ao da ponte (pd_<jibbleId>_<dia>) quando a
    // pessoa tem relógio: assim o lançamento à mão ocupa o mesmo dia em vez de
    // virar um segundo registro do mesmo dia. Sem relógio, id próprio.
    const id =
      base?.id ||
      (jibbleId ? `pd_${jibbleId}_${f.data}` : `pdm_${pessoa.id}_${f.data}`);

    // O que o relógio trouxe, carimbado na PRIMEIRA correção — depois disso ele
    // não se mexe, senão a "origem" viraria a correção anterior.
    const primeira =
      base &&
      base.origem === "jibble" &&
      base.corrigido !== true &&
      !Object.prototype.hasOwnProperty.call(base, "relogioEntrada");
    const carimboRelogio = primeira
      ? {
          relogioEntrada: base.entrada || "",
          relogioSaida: base.saida || "",
          relogioPausaMin: base.pausaMin ?? "",
          // O que o relógio APUROU, não só o que ele mediu: é o número que ia
          // para a folha antes de alguém mexer. Sem ele, daqui a seis meses
          // ninguém sabe o que é da máquina e o que é do RH.
          relogioTrabalhadoMin: base.trabalhadoMin ?? null,
          relogioExtraMin: base.extraMin ?? null,
          relogioExtraDobroMin: base.extraDobroMin ?? null,
        }
      : {};

    const efeito = efeitoDaCorrecao(base, { entrada: f.entrada, saida: f.saida, pausaMin: pausa });
    /* A apuração do relógio descreve as batidas DO RELÓGIO. Enquanto elas não
       mudarem, ela continua no registro — recalcular um dia só porque alguém
       arrumou a observação trocaria 8h12 por 9h12 em silêncio, já que o
       trabalhado do relógio não é (saída − entrada) − intervalo.
       Mexeu na batida, aquele número deixou de descrever o dia: sai daqui (fica
       no carimbo `relogio*`) e o dia passa a valer pela conta desta casa, sem
       misturar as duas réguas na soma do mês. */
    const semApuracaoDoRelogio = {
      extraMin: null,
      extraDobroMin: null,
      pausaPagaMin: null,
      trackedMin: minutosEntre(f.entrada, f.saida),
      // "Entrou e não saiu", refeito: a marca do relógio não pode ficar presa
      // num dia que o RH acabou de fechar.
      emAberto: !!txt(f.entrada) && !txt(f.saida),
    };

    return disparar(
      COL_DIA,
      {
        ...(base || {}),
        ...carimboRelogio,
        id,
        pessoaId: pessoa?.id || base?.pessoaId || "",
        // Nome é carimbo: se o id não resolver, fica o que já estava gravado.
        pessoaNome: pessoa?.nome || base?.pessoaNome || "",
        jibbleId,
        data: f.data,
        entrada: txt(f.entrada),
        saida: txt(f.saida),
        pausaMin: pausa,
        // null é DIA SEM TOTAL, e não zero hora — a apuração conta à parte.
        trabalhadoMin: efeito.trabalhadoMin,
        ...(efeito.mantemApuracao ? {} : semApuracaoDoRelogio),
        origem: base?.origem || "manual",
        // Marca a correção E protege o dia: sem isso, a importação de amanhã
        // apagaria o ajuste de hoje, em silêncio.
        corrigido: true,
        obs: txt(f.obs),
      },
      base
        ? `Batida de ${dataLonga(f.data)} corrigida.`
        : `Batida de ${pessoa.nome} em ${dataLonga(f.data)} lançada.`,
      () => setFormBatida(null)
    );
  };

  const apagarBatida = (b) => {
    const quem = b.pessoa?.nome || b.d.pessoaNome || "pessoa não vinculada";
    if (!window.confirm(`Apagar a batida de ${quem} em ${dataLonga(b.d.data)}?`)) return;
    apagarReg(COL_DIA, b.d.id, "Batida apagada.");
  };

  // ---- ausências -----------------------------------------------------------

  /* Lançar a ausência do zero: quando NÃO existe linha nenhuma para aquele dia,
     que é o caso comum — o relógio não grava dia sem movimento, então o dia da
     falta simplesmente não existe na coleção. */
  const abrirAusenciaNova = () =>
    setFormAusencia({
      base: null,
      travado: false,
      jaTinha: false,
      pessoaId: "",
      pessoaNome: "",
      // Nasce no mês que está na tela, não em "hoje": quem está lançando
      // fevereiro não quer um dia de março.
      data: competenciaDe(hojeISO) === competencia ? hojeISO : `${competencia}-01`,
      entrada: "",
      saida: "",
      tipo: TIPOS_AUSENCIA[0].tipo,
      motivo: "",
      documento: "",
    });

  /* E o caminho curto, a partir da linha do dia — inclusive do dia que tem
     batida (atestado da tarde). A pessoa e o dia ficam travados: mudar a data
     aqui deixaria um dia órfão, do mesmo jeito que na correção da batida. */
  const abrirAusenciaDoDia = (b) =>
    setFormAusencia({
      base: b.d,
      travado: true,
      jaTinha: !!b.ausencia,
      pessoaId: b.pessoa?.id || b.d.pessoaId || "",
      pessoaNome: b.pessoa?.nome || b.d.pessoaNome || "",
      data: b.d.data,
      entrada: b.d.entrada || "",
      saida: b.d.saida || "",
      tipo: b.ausencia?.tipo || TIPOS_AUSENCIA[0].tipo,
      motivo: b.ausencia?.motivo || "",
      documento: b.ausencia?.documento || "",
    });

  const gravarAusencia = () => {
    const f = formAusencia;
    if (!f) return;
    const ano = anoRuim(f.data);
    if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano do dia: ${ano}` });
    if (!TIPOS_AUSENCIA.some((t) => t.tipo === f.tipo)) {
      return setAviso({ tipo: "erro", texto: "Escolha o que houve neste dia." });
    }

    const base = f.base || null;
    const pessoa = pessoas.find((x) => x.id === f.pessoaId) || null;
    if (!base && !pessoa) return setAviso({ tipo: "erro", texto: "Escolha a pessoa." });

    if (!base) {
      // Um dia, um registro. Se já existe linha desse dia, o caminho é lançar a
      // ausência a partir dela — gravar por cima criaria dois dias.
      const jaTem = (pontoDia || []).find((d) => {
        if (d.data !== f.data) return false;
        if (d.pessoaId && d.pessoaId === pessoa.id) return true;
        return txt(d.jibbleId) && txt(d.jibbleId) === txt(pessoa.jibbleId);
      });
      if (jaTem) {
        return setAviso({
          tipo: "erro",
          texto: `Já existe registro de ${pessoa.nome} em ${dataLonga(f.data)}. Lance a ausência pela linha desse dia, em Batidas.`,
        });
      }
    }

    const jibbleId = txt(pessoa?.jibbleId) || txt(base?.jibbleId);
    const id = base?.id || (jibbleId ? `pd_${jibbleId}_${f.data}` : `pdm_${pessoa.id}_${f.data}`);
    const escolhido = TIPOS_AUSENCIA.find((t) => t.tipo === f.tipo);

    /* PRESERVA o que já estava no dia. Zerar entrada/saída aqui apagaria a
       batida do relógio de quem trabalhou meio dia e depois trouxe atestado —
       e o que a ausência acrescenta é uma EXPLICAÇÃO, não um apagador. Dia que
       nasce aqui já vem sem batida nenhuma, e o `...(base || {})` não inventa
       campo que não existe. */
    return disparar(
      COL_DIA,
      {
        ...(base || {}),
        id,
        pessoaId: pessoa?.id || base?.pessoaId || "",
        pessoaNome: pessoa?.nome || base?.pessoaNome || "",
        jibbleId,
        data: f.data,
        ausencia: { tipo: f.tipo, motivo: txt(f.motivo), documento: txt(f.documento) },
        origem: base?.origem || "manual",
        // PROTEGE o dia: sem isto, a importação de amanhã apagaria a ausência
        // lançada hoje, em silêncio.
        corrigido: true,
      },
      `${escolhido.rotulo} de ${pessoa?.nome || base?.pessoaNome || "pessoa não vinculada"} em ${dataLonga(f.data)}: ${
        escolhido.desconta ? "vai contar como falta e sugerir desconto de 1/30." : "não desconta."
      }`,
      () => setFormAusencia(null)
    );
  };

  const removerAusencia = () => {
    const f = formAusencia;
    if (!f?.base) return;
    if (!window.confirm(`Remover a ausência de ${dataLonga(f.data)}? O dia volta a ser o que as batidas disserem.`)) return;
    /* O dia volta a ser do RELÓGIO se a única coisa manual nele era a ausência.
       O sinal de que alguém mexeu nas batidas é o carimbo `relogioEntrada`, que
       a correção grava na primeira vez. Sem ele, manter `corrigido: true`
       congelaria o dia contra toda importação futura por causa de um lançamento
       que acabou de deixar de existir — e congelado em silêncio, que é o pior
       jeito de congelar. Dia que nasceu à mão continua protegido: não há relógio
       para onde ele voltar. */
    const houveCorrecaoDeBatida = Object.prototype.hasOwnProperty.call(f.base, "relogioEntrada");
    return disparar(
      COL_DIA,
      {
        ...f.base,
        // `null`, e não a chave removida: a porta grava o registro INTEIRO, e é
        // o null que faz `ausenciaDoDia` voltar a dizer "não há ausência aqui".
        ausencia: null,
        corrigido: f.base.origem === "jibble" ? houveCorrecaoDeBatida : true,
      },
      `Ausência de ${dataLonga(f.data)} removida.`,
      () => setFormAusencia(null)
    );
  };

  // ---- parâmetros ----------------------------------------------------------

  const abrirParametros = () =>
    setFormParametros({
      divisor: String(cfg.divisor),
      fatorHoraExtra: cfg.fatorHoraExtra,
      percentualNoturno: String(cfg.percentualNoturno),
      // A escala vira linhas de dois turnos. Quando a gravada não cabe nisso, o
      // editor não abre — e o formulário guarda a escala atual para mostrá-la e
      // regravá-la exatamente como está.
      jornadaEditavel: jornadaCabeNoEditor(cfg.jornada),
      jornada: linhasDaJornada(cfg.jornada),
      jornadaAtual: cfg.jornada,
    });

  const gravarParametros = async () => {
    const f = formParametros;
    if (!f) return;
    const divisor = inteiroDoCampo(f.divisor);
    if (divisor <= 0) return setAviso({ tipo: "erro", texto: "O divisor mensal precisa ser maior que zero." });
    // Turno pela metade não vira 0h00: gravar assim apagaria a jornada de um dia
    // inteiro em silêncio, e no mês seguinte aquele dia pagaria hora extra do
    // primeiro minuto.
    if (f.jornadaEditavel && f.jornada.some((l) => previstoDaLinha(l) === null)) {
      return setAviso({
        tipo: "erro",
        texto: "Há dia com um turno pela metade (entrada sem saída, ou o contrário). Preencha os dois lados ou apague os dois.",
      });
    }
    const jornada = f.jornadaEditavel ? jornadaDasLinhas(f.jornada) : jornadaParaCfg(f.jornadaAtual);
    setSalvando(true);
    try {
      // A porta de configuração grava o documento INTEIRO. Releio agora, na
      // hora de gravar, para não apagar a chave de outra tela com o que li
      // quando esta aba abriu. Continua sendo ler-calcular-gravar: duas pessoas
      // mexendo no mesmo minuto, a última vence.
      const atual = await lerCfg();
      const ponto = {
        divisor,
        fatorHoraExtra: Number(f.fatorHoraExtra) || 1.5,
        percentualNoturno: inteiroDoCampo(f.percentualNoturno),
        jornada,
      };
      await salvarCfg({ ...(atual || {}), ponto });
      setConfig({ ...(atual || {}), ponto });
      setCfgFalhou(false);
      setFormParametros(null);
      setAviso({
        tipo: "ok",
        texto:
          `Parâmetros gravados: ${ponto.divisor} h/mês, hora extra ${rotuloFator(ponto.fatorHoraExtra)}, ` +
          `noturno ${ponto.percentualNoturno}%. Jornada: ${descreverJornada(jornada)}.`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  // ---- planilha ------------------------------------------------------------

  const baixar = () => {
    const ehFechamento = visao === "fechamento";
    const linhas = ehFechamento
      ? vm.linhas.map((l) => ({
          pessoa: l.pessoa.nome,
          cargo: l.pessoa.cargo || "",
          competencia: rotuloCompetencia(competencia),
          situacao: !l.reg ? "sem lançamento" : l.reg.fechado ? "fechado" : "aberto",
          // Hora vai em DECIMAL: coluna de texto não soma, e somar é a primeira
          // coisa que se faz com a planilha baixada.
          horasExtras: l.reg ? horasDecimais(l.reg.horasExtrasMin) : "",
          adicional: l.reg ? rotuloFator(l.conta.fator) : "",
          horasExtrasDobro: l.reg ? horasDecimais(l.conta.horasExtrasDobroMin) : "",
          // A procedência vai junto: planilha sem ela deixa a coluna de horas
          // extras sem dono, e depois ninguém sabe o que conferir no Jibble.
          origemExtras: l.reg ? MARCA_FONTE[l.fonte.extras] || MARCA_FONTE.manual : "",
          faltas: l.reg ? l.conta.faltas : "",
          // Estas duas NÃO dependem de haver lançamento: são a contagem dos
          // dias que alguém explicou, e valem por si.
          faltasLancadas: l.apuracao.faltasQueDescontam,
          ausenciasAbonadas: l.apuracao.ausenciasSemDesconto,
          atrasos: l.reg ? horasDecimais(l.reg.atrasosMin) : "",
          noturno: l.reg ? horasDecimais(l.reg.adicionalNoturnoMin) : "",
          // Dinheiro em NÚMERO, e vazio quando não há conta — a planilha não
          // inventa R$ 0,00 para quem está sem salário na ficha.
          // Sem LANÇAMENTO não há conta nenhuma: para essas linhas a `conta` é
          // só a SUGESTÃO das batidas (ou zero, para quem não tem nada). Levá-la
          // para a planilha punha "Calculado (R$) 84" numa linha que a tela diz
          // "sem valor" — e somar a coluna inflava a folha com o que ninguém
          // lançou. Por isso a mesma condição das colunas de hora: `l.reg`.
          salarioBase: l.reg && !l.conta.semSalario ? l.conta.salarioBase : "",
          divisor: l.reg ? l.conta.divisor : "",
          valorHora: l.reg ? (l.conta.valorHora ?? "") : "",
          valorHoraExtra: l.reg ? (l.conta.valorHoraExtra ?? "") : "",
          valorExtras: l.reg ? (l.conta.valorExtras ?? "") : "",
          valorExtrasDobro: l.reg ? (l.conta.valorExtrasDobro ?? "") : "",
          valorNoturno: l.reg ? (l.conta.valorNoturno ?? "") : "",
          valorFaltas: l.reg ? (l.conta.valorFaltas ?? "") : "",
          valorCalculado: l.reg ? (l.conta.valorCalculado ?? "") : "",
          valorLancado: l.reg && l.reg.valorLancado !== "" ? l.reg.valorLancado : "",
          diferenca: l.dif || "",
          diasComBatida: l.apuracao.diasComBatida,
          diasEmAberto: l.apuracao.diasEmAberto,
          obs: l.reg?.obs || "",
        }))
      : batidasVisiveis.map((b) => {
          const apurado = apuracaoDoRelogio(b.d);
          const cracha = numOuNulo(b.d.trackedMin) ?? minutosEntre(b.d.entrada, b.d.saida);
          return {
            data: b.d.data,
            pessoa: b.pessoa?.nome || `${b.d.pessoaNome || "sem nome"} (não vinculada)`,
            entrada: b.d.entrada || "",
            saida: b.d.saida || "",
            pausaMin: numOuNulo(b.d.pausaMin) === null ? "" : Number(b.d.pausaMin),
            cracha: cracha === null ? "" : horasDecimais(cracha),
            // Dia sem total sai VAZIO, nunca 0: zero na planilha vira desconto.
            trabalhado: b.min === null ? "" : horasDecimais(b.min),
            // Sem apuração do relógio a coluna fica vazia — 0 diria "não houve
            // hora extra", e o que houve foi ninguém ter apurado.
            extra: apurado ? horasDecimais(apurado.extraMin) : "",
            extraDobro: apurado ? horasDecimais(apurado.extraDobroMin) : "",
            // Sem pontualidade medida a coluna fica VAZIA — 0 diria "chegou na
            // hora", e o que houve foi não haver o que medir (fim de semana,
            // dia sem entrada batida).
            atrasoEntrada: b.pontualidade ? b.pontualidade.atrasoEntradaMin : "",
            atrasoCobravel: b.pontualidade ? b.pontualidade.atrasoMin : "",
            ausencia: b.ausencia ? b.ausencia.curto : "",
            ausenciaMotivo: b.ausencia?.motivo || "",
            ausenciaDocumento: b.ausencia?.documento || "",
            emAberto: b.d.emAberto === true ? "sim" : "",
            origem: b.d.origem === "jibble" ? "relógio" : "à mão",
            corrigido: b.d.corrigido ? "sim" : "não",
            relogio:
              b.d.relogioEntrada || b.d.relogioSaida
                ? `${b.d.relogioEntrada || "—"} → ${b.d.relogioSaida || "—"}`
                : "",
            jibbleId: b.d.jibbleId || "",
            obs: b.d.obs || "",
          };
        });

    if (linhas.length === 0) {
      return setAviso({ tipo: "erro", texto: "Não há nada neste recorte para baixar." });
    }
    try {
      const arquivo = baixarPlanilha({
        nome: ehFechamento ? `ponto-fechamento-${competencia}` : `ponto-batidas-${competencia}`,
        // O RECORTE VAI NO TÍTULO: a planilha sai da tela e vira anexo de
        // e-mail — sem ele, quem abrir amanhã lê a lista dos ativos como se
        // fosse a casa inteira.
        titulo: `${ehFechamento ? "Fechamento do ponto" : "Batidas"} — ${rotuloCompetencia(competencia)} (${rotuloDoRecorte(recorte)})`,
        colunas: ehFechamento ? COLUNAS_FECHAMENTO : COLUNAS_BATIDAS,
        linhas,
      });
      setAviso({ tipo: "ok", texto: `Planilha baixada: ${arquivo} (${plural(linhas.length, "linha", "linhas")}).` });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  // ---- render --------------------------------------------------------------

  const [ano, mes] = competencia.split("-");
  // "Nenhuma batida importada" é afirmação sobre o MÊS, não sobre o recorte.
  const semBatidaNoMes = vm.batidasNoMes === 0;
  // Quem ficou de fora desta aba, em palavras. Vai embaixo dos cartões.
  const frasesFora = frasesDoFora(vm.fora, recorte);

  return (
    <>
      <Card className="mb-4">
        <SectionTitle
          titulo={`Relógio de ponto — ${rotuloCompetencia(competencia)}`}
          sub="As batidas do Jibble e o fechamento por pessoa. Sem batida importada, as horas se lançam à mão."
          acao={
            <div className="flex flex-wrap items-center gap-2">
              {/* Baixar não é escrita: quem só consulta também precisa da planilha. */}
              <button type="button" className="btn-outline" onClick={baixar}>
                <Download size={16} strokeWidth={2.5} /> Baixar planilha
              </button>
              {editavel && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={puxarDoRelogio}
                  disabled={!!importando}
                  title="Busca no Jibble as batidas desta competência"
                >
                  <RefreshCw size={16} strokeWidth={2.5} className={importando ? "animate-spin" : undefined} />
                  {importando || "Puxar do relógio"}
                </button>
              )}
              {editavel && visao === "batidas" && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={abrirAusenciaNova}
                  title="Falta, atestado, justificada, férias ou folga num dia sem batida"
                >
                  <CalendarOff size={16} strokeWidth={2.5} /> Lançar ausência
                </button>
              )}
              {editavel && visao === "batidas" && (
                <button type="button" className="btn-primary" onClick={abrirBatidaNova}>
                  <Plus size={16} strokeWidth={2.5} /> Lançar batida
                </button>
              )}
              {editavel && visao === "fechamento" && (
                <button type="button" className="btn-primary" onClick={fecharCompetencia} disabled={salvando}>
                  <Lock size={16} strokeWidth={2.5} /> Fechar competência
                </button>
              )}
            </div>
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="pt-mes">Mês</label>
            <select
              id="pt-mes"
              className="select w-40"
              value={mes}
              onChange={(e) => setCompetencia(`${ano}-${e.target.value}`)}
            >
              {MESES_LONGOS.map((nome, i) => (
                <option key={nome} value={String(i + 1).padStart(2, "0")}>{nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pt-ano">Ano</label>
            <select
              id="pt-ano"
              className="select w-28"
              value={ano}
              onChange={(e) => setCompetencia(`${e.target.value}-${mes}`)}
            >
              {vm.anos.map((a) => (
                <option key={a} value={String(a)}>{a}</option>
              ))}
            </select>
          </div>
          {/* O recorte do quadro. Nasce em "Ativos" e a escolha fica guardada:
              é o filtro que mais muda esta aba — 13 das 20 fichas estão
              desligadas. Quem não bate ponto não entra em recorte nenhum. */}
          <div>
            <span className="label">Quadro</span>
            <Segmented opcoes={RECORTES} valor={recorte} onChange={mudarRecorte} />
          </div>
          <div className="ml-auto">
            <span className="label">Visão</span>
            <Segmented
              opcoes={[
                { valor: "fechamento", rotulo: "Fechamento" },
                { valor: "batidas", rotulo: "Batidas" },
              ]}
              valor={visao}
              onChange={setVisao}
            />
          </div>
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <Settings2 size={13} className="text-slate-400" />
          <span className="tnum">
            {cfg.divisor} h/mês · hora extra {rotuloFator(cfg.fatorHoraExtra)} · adicional noturno {cfg.percentualNoturno}%
            {" · "}falta = 1/30 do salário
          </span>
          {/* Zero não é resultado, e padrão não é escolha: enquanto ninguém
              tiver configurado, a tela diz que está usando o padrão da casa. */}
          {!cfg.definida && <span className="chip">padrão da casa</span>}
          {cfgFalhou && <span className="chip-warn">não consegui ler a configuração — usando o padrão</span>}
          {editavel && (
            <button type="button" className="font-medium text-brand-700 underline hover:opacity-75" onClick={abrirParametros}>
              Ajustar
            </button>
          )}
        </p>
        {/* A ESCALA À VISTA. É dela que sai o previsto de cada dia, e previsto
            que não se lê na tela vira número sem dono na hora da conferência. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <Clock size={13} className="text-slate-400" />
          <span className="tnum">Jornada: {vm.jornadaEmPalavras}</span>
          {!cfg.jornadaDefinida && <span className="chip">escala padrão da casa</span>}
          {cfg.jornada.ignorados > 0 && (
            <span className="chip-warn">
              {plural(cfg.jornada.ignorados, "turno gravado não foi entendido", "turnos gravados não foram entendidos")}
            </span>
          )}
          {/* O mês inteiro previsto pela escala: a régua do fechamento, dita em
              horas antes de alguém somar hora extra em cima dela. */}
          <span className="tnum text-slate-400">
            {rotuloCompetencia(competencia)}: {duracaoTexto(minutosPrevistosDoMes(competencia, cfg.jornada))} previstas
          </span>
          {divisorDaJornada(cfg.jornada) !== cfg.divisor && (
            <span className="chip-warn">
              a escala sustenta o divisor {divisorDaJornada(cfg.jornada)}, e o configurado é {cfg.divisor}
            </span>
          )}
        </p>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Fechamentos lançados"
          valor={`${vm.kpi.lancadas}/${vm.kpi.total}`}
          tom={vm.kpi.total === 0 ? "neutral" : vm.kpi.lancadas === vm.kpi.total ? "ok" : "warn"}
          sub={
            vm.kpi.semLancamento
              ? `${plural(vm.kpi.semLancamento, "pessoa", "pessoas")} sem lançamento`
              : vm.kpi.fechadas
                ? `${plural(vm.kpi.fechadas, "fechado", "fechados")}`
                : undefined
          }
          icone={CalendarClock}
          onClick={() => setVisao("fechamento")}
          ativo={visao === "fechamento"}
        />
        <StatCard
          rotulo="Horas extras do mês"
          // Nada lançado não é "zero hora extra": é ninguém ter apurado ainda.
          valor={vm.kpi.extrasLancadasMin === null ? "—" : duracaoTexto(vm.kpi.extrasLancadasMin)}
          tom="neutral"
          sub={subDasExtras(vm.kpi)}
          icone={AlarmClock}
        />
        <StatCard
          rotulo="Total em R$"
          valor={vm.kpi.totalRS === null ? "—" : moedaCheia(vm.kpi.totalRS)}
          tom={vm.kpi.totalRS === null ? "neutral" : vm.kpi.totalRS < 0 ? "bad" : "brand"}
          sub={
            vm.kpi.totalRS === null
              ? "nada lançado ainda"
              : vm.kpi.semSalario
                ? `${plural(vm.kpi.semSalario, "pessoa fora da conta", "pessoas fora da conta")} (sem salário)`
                : undefined
          }
          icone={Wallet}
        />
        <StatCard
          rotulo="Pendências"
          valor={String(vm.kpi.pendencias)}
          tom={vm.kpi.pendencias > 0 ? "bad" : "ok"}
          sub={
            vm.kpi.pendencias
              ? [
                  vm.kpi.semSalario ? `${vm.kpi.semSalario} sem salário` : "",
                  vm.semVinculo.length ? `${vm.semVinculo.length} sem vínculo no relógio` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "nada pendente"
          }
          icone={CircleAlert}
        />
      </div>

      {/* QUEM FICOU DE FORA, dito em voz baixa mas dito. Os cartões acima
          contam só o recorte à mostra, e cartão que conta menos gente do que a
          casa tem, sem dizer quanto, é cartão em que ninguém confere nada. */}
      {frasesFora.length > 0 && (
        <p className="-mt-2 mb-4 text-xs text-slate-400">
          Fora desta lista ({rotuloDoRecorte(recorte)}): {frasesFora.join(" · ")}.
        </p>
      )}

      <PainelVinculo
        semVinculo={vm.semVinculo}
        vinculados={vm.vinculados}
        ativos={ativosDoPonto}
        editavel={editavel}
        escolhas={escolhasVinculo}
        setEscolhas={setEscolhasVinculo}
        acoes={{ vincular, desvincular }}
      />

      {visao === "fechamento" ? (
        <Card>
          <SectionTitle
            titulo="Fechamento por pessoa"
            sub="A conta escrita ao lado é a mesma que o sistema faz — dá para conferir na calculadora."
          />
          {/* AS AUSÊNCIAS DO MÊS, com a mesma separação da linha: um total só
              faria a equipe que ficou doente somar junto com a que faltou. */}
          {(vm.kpi.faltasMes > 0 || vm.kpi.abonadasMes > 0 || vm.kpi.ausenciasEstranhas > 0) && (
            <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <CalendarOff size={13} className="text-slate-400" />
              {vm.kpi.faltasMes > 0 && (
                <span className="chip-bad">{plural(vm.kpi.faltasMes, "dia de falta", "dias de falta")}</span>
              )}
              {vm.kpi.abonadasMes > 0 && (
                <span className="chip">{plural(vm.kpi.abonadasMes, "dia abonado", "dias abonados")}</span>
              )}
              {vm.kpi.ausenciasEstranhas > 0 && (
                <span className="chip-warn">
                  {plural(vm.kpi.ausenciasEstranhas, "ausência de tipo desconhecido", "ausências de tipo desconhecido")}
                </span>
              )}
              <span>
                Só o dia de falta desconta (1/30 do salário), e só quando o RH gravar o fechamento. Dia sem batida e
                sem ausência lançada é <strong>sem registro</strong> — não é falta.
              </span>
            </p>
          )}
          {/* Nunca mostrar zeros como se fossem apuração. */}
          {semBatidaNoMes && (
            <div className="mb-3 rounded-xl bg-warn-50 px-3.5 py-2.5 text-sm text-warn-700">
              Nenhuma batida importada para este mês. Você pode puxar do relógio aqui em cima, lançar as horas à
              mão no Fechamento, ou lançar a ausência de quem não veio.
            </div>
          )}
          {vm.linhas.length === 0 ? (
            <Empty>
              {recorte === "desligados"
                ? "Nenhuma pessoa desligada com batida ou lançamento neste mês."
                : "Ninguém no quadro ainda — o fechamento do ponto nasce das pessoas que batem ponto."}
            </Empty>
          ) : (
            <div className="space-y-2">
              {vm.linhas.map((l) => (
                <LinhaFechamento
                  key={l.pessoa.id}
                  l={l}
                  editavel={editavel}
                  acoes={{ lancar: abrirFechamento, fechar: fecharLinha, reabrir: reabrirLinha, detalhar }}
                />
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <SectionTitle
            titulo="Batidas do mês"
            sub="O extrato dia a dia: o crachá, o intervalo e o que vai para a folha — três números que não fecham por subtração, porque quem apura a escala é o relógio. Correção fica marcada e o que veio dele continua à vista."
            acao={
              <div>
                <label className="sr-only" htmlFor="pt-filtro">Pessoa</label>
                <select
                  id="pt-filtro"
                  className="select w-56"
                  value={filtroPessoa}
                  onChange={(e) => setFiltroPessoa(e.target.value)}
                >
                  {/* "Todas" é todas as DESTA LISTA, e o filtro só oferece
                      quem está nela: nome que filtra para uma lista vazia é
                      pergunta sem resposta possível. */}
                  <option value="">Todas as pessoas da lista</option>
                  {vm.semVinculo.length > 0 && <option value={SEM_VINCULO}>Pessoa não vinculada</option>}
                  {vm.pessoasVisiveis.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
            }
          />
          {semBatidaNoMes ? (
            <Empty>
              Nenhuma batida importada para este mês. Você pode puxar do relógio aqui em cima, lançar as horas à
              mão no Fechamento, ou lançar a ausência de quem não veio.
            </Empty>
          ) : batidasVisiveis.length === 0 ? (
            <Empty>
              O mês tem batida, mas nenhuma neste recorte ({rotuloDoRecorte(recorte)}). Troque o quadro lá em cima ou
              escolha outra pessoa no filtro.
            </Empty>
          ) : (
            <div className="space-y-2">
              {batidasVisiveis.map((b) => (
                <LinhaBatida
                  key={b.d.id}
                  b={b}
                  editavel={editavel}
                  acoes={{ corrigir: abrirCorrecao, apagar: apagarBatida, ausentar: abrirAusenciaDoDia, detalhar }}
                />
              ))}
            </div>
          )}
          {batidasVisiveis.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock size={12} />
              {plural(batidasVisiveis.length, "dia", "dias")} nesta lista. Dia sem total não é dia de zero hora — pode
              ser esquecimento de bater, folga ou o relógio fora do ar. &quot;Em aberto&quot; é o dia que o relógio diz
              que ainda não terminou. Para explicar um dia — falta, atestado, justificada, férias ou folga — use o
              lançamento de ausência: só a falta desconta.
            </p>
          )}
        </Card>
      )}

      <FormFechamento
        form={formFechamento}
        setForm={setFormFechamento}
        salvando={salvando}
        aoSalvar={gravarFechamento}
        aoFechar={() => setFormFechamento(null)}
      />
      {/* Os seletores dos lançamentos oferecem quem o ponto alcança — nunca
          quem a ficha diz que não bate ponto. */}
      <FormBatida
        form={formBatida}
        setForm={setFormBatida}
        ativos={ativosDoPonto}
        salvando={salvando}
        aoSalvar={gravarBatida}
        aoFechar={() => setFormBatida(null)}
      />
      <FormAusencia
        form={formAusencia}
        setForm={setFormAusencia}
        ativos={ativosDoPonto}
        salvando={salvando}
        aoSalvar={gravarAusencia}
        aoRemover={removerAusencia}
        aoFechar={() => setFormAusencia(null)}
      />
      <FormParametros
        form={formParametros}
        setForm={setFormParametros}
        salvando={salvando}
        aoSalvar={gravarParametros}
        aoFechar={() => setFormParametros(null)}
      />

      {/* O DETALHE DA PESSOA. Só leitura: quem corrige batida, lança ausência e
          fecha o mês continua sendo o botão da própria linha. `pontoDia` vai
          INTEIRA de propósito — o painel anda pelos meses por conta própria, e
          recortar aqui o mês da aba faria as setas ‹ › mostrarem meses vazios
          que têm dado. */}
      {detalhe && (
        <PessoaDetalhe
          pessoa={detalhe.pessoa}
          pontoDia={pontoDia}
          competencia={detalhe.diaFoco ? competenciaDe(detalhe.diaFoco) : competencia}
          diaFoco={detalhe.diaFoco}
          jornada={cfg.jornada}
          hojeISO={hojeISO}
          aoFechar={() => setDetalhe(null)}
        />
      )}
    </>
  );
}
