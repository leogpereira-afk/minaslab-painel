// Testes do motor do ponto. Rodar com TZ=UTC (`npm test` já fixa) — teste que
// só passa no fuso de quem escreveu não é teste.
//
// Os casos foram escolhidos começando pelo CASO RUIM: o que já deu errado na
// Impresilk (os três centavos), o que erra em dinheiro se for adivinhado
// ("2.50"), o que vira desconto indevido se ausência virar zero (dia em aberto,
// mês sem batida, ficha sem salário) e o que a MÉDIA de 44h ÷ 5 mentia (sexta,
// que tem 8h, e sábado, que não tem nenhuma).
//
// As datas de agosto/2026 não são decorativas: 17/08 é SEGUNDA (9h previstas),
// 21/08 é SEXTA (8h), 22/08 é SÁBADO e 23/08 é DOMINGO (nenhuma).
import test from "node:test";
import assert from "node:assert/strict";
import {
  apuracaoDoRelogio,
  apurarCompetencia,
  atrasoDoDia,
  ausenciaDoDia,
  calcularFechamento,
  cfgDoPonto,
  competenciaDe,
  descreverJornada,
  diaDaSemanaISO,
  diasDoMes,
  diasUteisDoMes,
  diferencaDoCalculo,
  divisorDaJornada,
  duracaoCampo,
  duracaoTexto,
  ehCompetencia,
  fimPrevistoDoDia,
  horasDecimais,
  inicioPrevistoDoDia,
  jornadaParaCfg,
  minutosDaDuracao,
  minutosDoDia,
  minutosEntre,
  minutosNormais,
  minutosPrevistosDoDia,
  minutosPrevistosDoMes,
  minutosTrabalhados,
  normaisDoDia,
  normalizarJornada,
  origemDoLancamento,
  DIVISOR_MENSAL_PADRAO,
  FATOR_HE_DOBRA,
  FATOR_HE_PADRAO,
  JORNADA_PADRAO,
  PERCENTUAL_NOTURNO_PADRAO,
  TIPOS_AUSENCIA,
  TOLERANCIA_DIA_MIN,
  TOLERANCIA_MARCACAO_MIN,
} from "./ponto.js";

// O salário que a Impresilk usou para descobrir o defeito dos três centavos.
const SALARIO = 2462;

const SEGUNDA = "2026-08-17";
const TERCA = "2026-08-18";
const QUARTA = "2026-08-19";
const SEXTA = "2026-08-21";
const SABADO = "2026-08-22";
const DOMINGO = "2026-08-23";
const SEGUNDA_SEGUINTE = "2026-08-24";
// A sexta do caso real da Ana, o dia em que o Jibble abriu a composição da
// folha na frente do dono: Normais 8h00 + Horas extras diárias 1h15 = 9h15.
const SEXTA_ANA = "2026-08-28";

// ---- leitura da duração digitada -------------------------------------------

test("minutosDaDuracao: relógio, decimal com vírgula e o que NÃO se adivinha", () => {
  assert.equal(minutosDaDuracao("02:50"), 170);
  assert.equal(minutosDaDuracao("2:50"), 170);
  assert.equal(minutosDaDuracao("120:00"), 7200); // total do mês passa de 24h
  assert.equal(minutosDaDuracao("2,5"), 150); // 2h30
  assert.equal(minutosDaDuracao(" 3 "), 180);
  assert.equal(minutosDaDuracao("0"), 0); // zero digitado é zero de verdade
  assert.equal(minutosDaDuracao("00:00"), 0);
});

test("minutosDaDuracao: devolve null em vez de chutar — null é o que faz a tela recusar", () => {
  // "2.50" seria 2h30 ou 2,5h? Adivinhar aqui erra em dinheiro.
  assert.equal(minutosDaDuracao("2.50"), null);
  assert.equal(minutosDaDuracao("abc"), null);
  assert.equal(minutosDaDuracao("2:5"), null); // minuto sem dois dígitos
  assert.equal(minutosDaDuracao("2:70"), null); // 70 minutos não existem
  assert.equal(minutosDaDuracao(""), null);
  assert.equal(minutosDaDuracao(null), null);
  assert.equal(minutosDaDuracao(undefined), null);
});

test("duracaoCampo: 0 volta como 00:00 — zero que some do campo é apagado no próximo Gravar", () => {
  assert.equal(duracaoCampo(0), "00:00");
  assert.equal(duracaoCampo(270), "04:30");
  assert.equal(duracaoCampo(null), "");
  assert.equal(duracaoCampo(""), "");
  assert.equal(duracaoTexto(270), "4h30");
  assert.equal(duracaoTexto(0), "0h00");
  assert.equal(duracaoTexto(null), "");
  assert.equal(horasDecimais(270), 4.5);
  assert.equal(horasDecimais(null), null);
});

// ---- o dia -----------------------------------------------------------------

test("minutosDoDia: soma o dia descontando a pausa", () => {
  assert.equal(minutosDoDia({ entrada: "08:00", saida: "17:30", pausaMin: 60 }), 510);
  // Pausa em branco não desconta nada — é a única leitura possível.
  assert.equal(minutosDoDia({ entrada: "08:00", saida: "12:00", pausaMin: "" }), 240);
  // Plantão que vira a meia-noite: 22:00 → 06:00 são 8h, não uma volta ao passado.
  assert.equal(minutosDoDia({ entrada: "22:00", saida: "06:00", pausaMin: 0 }), 480);
  // Pausa maior que o intervalo (erro de digitação) não devolve negativo.
  assert.equal(minutosDoDia({ entrada: "08:00", saida: "12:00", pausaMin: 600 }), 0);
});

test("minutosDoDia: batida faltando é dia EM ABERTO (null), não dia de zero hora", () => {
  assert.equal(minutosDoDia({ entrada: "08:00", saida: "", pausaMin: 60 }), null);
  assert.equal(minutosDoDia({ entrada: "", saida: "17:00" }), null);
  assert.equal(minutosDoDia({}), null);
  assert.equal(minutosEntre("08:00", ""), null);
});

test("minutosTrabalhados: o que a ponte gravou manda, inclusive o zero de verdade", () => {
  assert.equal(minutosTrabalhados({ trabalhadoMin: 480, entrada: "08:00", saida: "23:00" }), 480);
  assert.equal(minutosTrabalhados({ trabalhadoMin: 0, entrada: "08:00", saida: "08:00" }), 0);
  // trabalhadoMin null = dia em aberto na ponte: a conta cai para as batidas,
  // que podem ter sido corrigidas à mão.
  assert.equal(minutosTrabalhados({ trabalhadoMin: null, entrada: "08:00", saida: "12:00" }), 240);
  assert.equal(minutosTrabalhados({ trabalhadoMin: null, entrada: "08:00", saida: "" }), null);
});

test("minutosTrabalhados: a marca EM ABERTO é lida ANTES do total — o PT0S do Jibble não vira dia fechado", () => {
  // O caso que motivou o conserto: quem entrou e não saiu recebe payrollHours
  // "PT0S", que a ponte entende e grava como trabalhadoMin 0 — não null. Lido
  // depois do total, esse zero fazia o dia em aberto contar como dia FECHADO de
  // zero minuto: entrava em diasComBatida, a tela escrevia "0h00 para a folha"
  // ao lado do selo "em aberto" e a planilha exportava 0.0 na coluna do
  // desconto.
  assert.equal(
    minutosTrabalhados({ trabalhadoMin: 0, emAberto: true, entrada: "08:03", saida: "" }),
    null
  );
  // E vale mesmo com total apurado e as duas batidas: quem diz que o dia não
  // terminou é o relógio, e enquanto ele disser isso o dia não tem total.
  assert.equal(minutosTrabalhados({ trabalhadoMin: 492, emAberto: true }), null);
  assert.equal(
    minutosTrabalhados({ trabalhadoMin: null, emAberto: true, entrada: "08:00", saida: "17:00" }),
    null
  );
  // Fechado o dia, a próxima importação reescreve as duas coisas juntas.
  assert.equal(minutosTrabalhados({ trabalhadoMin: 492, emAberto: false }), 492);
});

test("apuracaoDoRelogio: reconhece o dia pelo DADO, não pelo rótulo de origem", () => {
  // O dia real de 17/08: 10h16 de crachá, 1h04 de pausa, 8h12 para a folha.
  assert.deepEqual(
    apuracaoDoRelogio({ trabalhadoMin: 492, trackedMin: 616, pausaMin: 64, extraMin: 12 }),
    { extraMin: 12, extraDobroMin: 0 }
  );
  // Domingo trabalhado: só dobra. A faixa que não veio conta 0 porque o relógio
  // APUROU o dia e disse que ela não existiu.
  assert.deepEqual(apuracaoDoRelogio({ trabalhadoMin: 240, extraDobroMin: 240 }), {
    extraMin: 0,
    extraDobroMin: 240,
  });
  // Dia lançado à mão (e dia importado antes desta versão): sem apuração.
  assert.equal(apuracaoDoRelogio({ trabalhadoMin: 480, origem: "manual" }), null);
  assert.equal(apuracaoDoRelogio({ origem: "jibble", extraMin: null, extraDobroMin: null }), null);
  assert.equal(apuracaoDoRelogio(null), null);
});

// ---- a jornada da casa -----------------------------------------------------

test("a escala padrão fecha exatamente 44h por semana — o mesmo fato que o divisor 220", () => {
  const escala = normalizarJornada(undefined);
  assert.equal(escala.semanaMin, 44 * 60);
  assert.equal(escala.padrao, true);
  // Escala e divisor são o mesmo fato dito de dois jeitos. Se um dia deixarem
  // de bater, é porque alguém mexeu num e esqueceu o outro.
  assert.equal(divisorDaJornada(escala), DIVISOR_MENSAL_PADRAO);
});

test("previsto por dia da semana: segunda 540, sexta 480, sábado e domingo 0", () => {
  assert.equal(minutosPrevistosDoDia(SEGUNDA, JORNADA_PADRAO), 540); // 9h
  assert.equal(minutosPrevistosDoDia(TERCA, JORNADA_PADRAO), 540);
  assert.equal(minutosPrevistosDoDia(QUARTA, JORNADA_PADRAO), 540);
  assert.equal(minutosPrevistosDoDia("2026-08-20", JORNADA_PADRAO), 540); // quinta
  assert.equal(minutosPrevistosDoDia(SEXTA, JORNADA_PADRAO), 480); // 8h
  // Zero de RESULTADO: a escala foi consultada e disse que não se trabalha.
  assert.equal(minutosPrevistosDoDia(SABADO, JORNADA_PADRAO), 0);
  assert.equal(minutosPrevistosDoDia(DOMINGO, JORNADA_PADRAO), 0);
  // A MÉDIA que isto substituiu diria 528 nos cinco dias: 48 min de atraso toda
  // sexta, e uma jornada inteira cobrada de quem não trabalha no sábado.
  assert.notEqual(minutosPrevistosDoDia(SEXTA, JORNADA_PADRAO), 528);
});

test("previsto por dia: data que não dá para ler devolve null, nunca 0", () => {
  // 0 aqui faria a apuração tratar o dia inteiro como hora extra.
  assert.equal(minutosPrevistosDoDia("", JORNADA_PADRAO), null);
  assert.equal(minutosPrevistosDoDia(null, JORNADA_PADRAO), null);
  assert.equal(minutosPrevistosDoDia("2026-08", JORNADA_PADRAO), null);
  assert.equal(minutosPrevistosDoDia("2026-13-01", JORNADA_PADRAO), null);
  // 30 de fevereiro rolaria para 2 de março e responderia sobre OUTRO dia.
  assert.equal(minutosPrevistosDoDia("2026-02-30", JORNADA_PADRAO), null);
});

test("diaDaSemanaISO: monta a data em meia-noite LOCAL (UTC voltaria um dia)", () => {
  assert.equal(diaDaSemanaISO(DOMINGO), 0);
  assert.equal(diaDaSemanaISO(SEGUNDA), 1);
  assert.equal(diaDaSemanaISO(SEXTA), 5);
  assert.equal(diaDaSemanaISO(SABADO), 6);
  assert.equal(diaDaSemanaISO("2026-08-32"), null);
});

test("início e fim previstos saem da escala — e a sexta termina uma hora antes", () => {
  assert.equal(inicioPrevistoDoDia(SEGUNDA, JORNADA_PADRAO), "08:00");
  assert.equal(fimPrevistoDoDia(SEGUNDA, JORNADA_PADRAO), "18:00");
  assert.equal(inicioPrevistoDoDia(SEXTA, JORNADA_PADRAO), "08:00");
  assert.equal(fimPrevistoDoDia(SEXTA, JORNADA_PADRAO), "17:00");
  // Dia sem turno não tem começo previsto: null, não "00:00".
  assert.equal(inicioPrevistoDoDia(SABADO, JORNADA_PADRAO), null);
  assert.equal(fimPrevistoDoDia(SABADO, JORNADA_PADRAO), null);
});

test("previsto do MÊS: soma os dias úteis da escala, e a régua vem escrita", () => {
  // Agosto/2026 começa num sábado: 5 segundas, 4 terças, 4 quartas, 4 quintas
  // (17 × 9h) e 4 sextas (4 × 8h) = 185h = 11100 min, em 21 dias úteis.
  assert.equal(minutosPrevistosDoMes("2026-08", JORNADA_PADRAO), 11100);
  assert.equal(diasUteisDoMes("2026-08", JORNADA_PADRAO), 21);
  assert.equal(diasDoMes("2026-08").length, 31);
  // Fevereiro/2026 tem 28 dias e começa num domingo: 4 semanas cheias.
  assert.equal(minutosPrevistosDoMes("2026-02", JORNADA_PADRAO), 4 * 44 * 60);
  assert.equal(diasUteisDoMes("2026-02", JORNADA_PADRAO), 20);
  // O que não é competência sai null — nunca 0, que afirmaria "mês sem jornada".
  assert.equal(minutosPrevistosDoMes("2026-13", JORNADA_PADRAO), null);
  assert.equal(minutosPrevistosDoMes("", JORNADA_PADRAO), null);
  assert.equal(diasUteisDoMes("2026-13", JORNADA_PADRAO), null);
});

test("a escala é CONFIGURÁVEL: acordo coletivo que põe o sábado muda o previsto", () => {
  const comSabado = [
    { dia: 0, turnos: [] },
    { dia: 1, turnos: [{ inicio: "08:00", fim: "12:00" }, { inicio: "13:00", fim: "17:00" }] },
    { dia: 2, turnos: [{ inicio: "08:00", fim: "12:00" }, { inicio: "13:00", fim: "17:00" }] },
    { dia: 3, turnos: [{ inicio: "08:00", fim: "12:00" }, { inicio: "13:00", fim: "17:00" }] },
    { dia: 4, turnos: [{ inicio: "08:00", fim: "12:00" }, { inicio: "13:00", fim: "17:00" }] },
    { dia: 5, turnos: [{ inicio: "08:00", fim: "12:00" }, { inicio: "13:00", fim: "17:00" }] },
    { dia: 6, turnos: [{ inicio: "08:00", fim: "12:00" }] },
  ];
  const escala = normalizarJornada(comSabado);
  assert.equal(escala.padrao, false);
  assert.equal(minutosPrevistosDoDia(SABADO, escala), 240);
  assert.equal(minutosPrevistosDoDia(SEXTA, escala), 480);
  assert.equal(escala.semanaMin, 5 * 480 + 240); // 44h também, por outro caminho
  assert.equal(divisorDaJornada(escala), 220);
  // Ida e volta pela configuração não muda a escala.
  assert.deepEqual(normalizarJornada(jornadaParaCfg(escala)).dias, escala.dias);
});

test("normalizarJornada peneira DIZENDO, e o que não é escala cai inteiro no padrão", () => {
  const comLixo = [
    { dia: 1, turnos: [{ inicio: "08:00", fim: "12:00" }, { inicio: "13:00", fim: "25:00" }] },
    { dia: 5, turnos: [{ inicio: "08:00", fim: "08:00" }] },
  ];
  const escala = normalizarJornada(comLixo);
  assert.equal(escala.padrao, false);
  assert.equal(escala.ignorados, 2); // "25:00" não é hora; turno de duração zero
  assert.equal(escala.dias[1].previstoMin, 240); // sobrou o turno que presta
  // Dia que a configuração não menciona é dia NÃO trabalhado — o padrão da casa
  // não reaparece por baixo.
  assert.equal(escala.dias[2].previstoMin, 0);

  // Nada disso é escala: vale o padrão, e a tela diz que está no padrão.
  for (const ruim of [null, undefined, "seg a sex", {}, []]) {
    const p = normalizarJornada(ruim);
    assert.equal(p.padrao, true, JSON.stringify(ruim));
    assert.equal(p.semanaMin, 44 * 60);
  }
  // Idempotente: escala já normalizada volta como está.
  assert.equal(normalizarJornada(escala), escala);
});

test("descreverJornada: a régua em uma frase, para a tela não mostrar previsto sem dono", () => {
  assert.equal(
    descreverJornada(JORNADA_PADRAO),
    "9h00 de segunda a quinta · 8h00 na sexta · 44h00 por semana"
  );
});

// ---- pontualidade e a tolerância do art. 58 § 1º ---------------------------

test("atrasoDoDia: o atraso CRU da entrada vem com sinal — negativo é ter chegado antes", () => {
  const atrasado = atrasoDoDia({ data: SEGUNDA, entrada: "08:12" }, JORNADA_PADRAO);
  assert.equal(atrasado.inicioPrevisto, "08:00");
  assert.equal(atrasado.atrasoEntradaMin, 12);
  assert.equal(atrasado.atrasoCobravelMin, 12);
  assert.equal(atrasado.pontual, false);
  const adiantado = atrasoDoDia({ data: SEGUNDA, entrada: "07:48" }, JORNADA_PADRAO);
  assert.equal(adiantado.atrasoEntradaMin, -12);
  // Chegar antes não é atraso: o que encurta o dia é o que conta.
  assert.equal(adiantado.atrasoBrutoMin, 0);
  assert.equal(adiantado.atrasoMin, 0);
  assert.equal(adiantado.atrasoCobravelMin, 0);
  // E é PONTUAL, ainda que os 12 min de adiantamento estourem a tolerância:
  // `tolerado` responde outra pergunta, e confundir as duas acusaria de atraso
  // quem madrugou.
  assert.equal(adiantado.tolerado, false);
  assert.equal(adiantado.pontual, true);
});

test("atrasoDoDia: 08:04 é pontual; 08:12 são 12 min cobráveis, não 2 (Súmula 366)", () => {
  // O caso que o Leonardo quer ver na tela: quem chega no horário.
  const quatro = atrasoDoDia({ data: SEGUNDA, entrada: "08:04" }, JORNADA_PADRAO);
  assert.equal(quatro.atrasoEntradaMin, 4); // o fato: chegou 4 min depois
  assert.equal(quatro.atrasoCobravelMin, 0); // a lei: nada a cobrar
  assert.equal(quatro.pontual, true);

  // 12 minutos NÃO viram "12 crus e 2 cobráveis". A tolerância não é franquia
  // que se abate do atraso: uma única marcação de 12 min já passa dos 5 do art.
  // 58 § 1º, e passando o limite conta-se "a totalidade do tempo" (Súmula 366
  // do TST). Descontar os 10 daria 2 — um número que não é nem o fato (12) nem
  // a lei (12), e que ninguém defende numa mesa de negociação.
  const doze = atrasoDoDia({ data: SEGUNDA, entrada: "08:12" }, JORNADA_PADRAO);
  assert.equal(doze.atrasoEntradaMin, 12);
  assert.equal(doze.atrasoCobravelMin, 12);
  assert.notEqual(doze.atrasoCobravelMin, 2);
  assert.equal(doze.pontual, false);
});

test("atrasoDoDia: até 5 min por marcação e 10 no dia não contam (CLT art. 58 § 1º)", () => {
  assert.equal(TOLERANCIA_MARCACAO_MIN, 5);
  assert.equal(TOLERANCIA_DIA_MIN, 10);
  // Entrou 4 min depois, saiu 2 min antes: 4 e 2 cabem nos 5, e a soma (6) cabe
  // nos 10. Nada é descontado — e o atraso CRU continua à vista.
  const dentro = atrasoDoDia({ data: SEGUNDA, entrada: "08:04", saida: "17:58" }, JORNADA_PADRAO);
  assert.equal(dentro.atrasoEntradaMin, 4);
  assert.equal(dentro.saidaAntesMin, 2);
  assert.equal(dentro.atrasoBrutoMin, 6);
  assert.equal(dentro.tolerado, true);
  assert.equal(dentro.atrasoMin, 0); // o que a folha pode cobrar
  assert.equal(dentro.atrasoCobravelMin, 0); // o mesmo número, pelo nome novo
  assert.equal(dentro.pontual, true); // e por isso ela ENTRA na lista dos pontuais
  assert.equal(dentro.toleradoMin, 6); // o que a tolerância absorveu
  // No limite exato: 5 + 5 = 10, ainda dentro. Com DUAS marcações o teto de 10
  // é justamente 5+5 — ele existe para o dia com mais marcações que estas.
  const limite = atrasoDoDia({ data: SEGUNDA, entrada: "08:05", saida: "17:55" }, JORNADA_PADRAO);
  assert.equal(limite.tolerado, true);
  assert.equal(limite.atrasoMin, 0);
  assert.equal(limite.toleradoMin, 10);
});

test("atrasoDoDia: estourou a tolerância, conta o tempo INTEIRO (Súmula 366 do TST)", () => {
  // 7 min passam dos 5 da marcação: não se abatem 5 e cobram 2 — cobra-se 7.
  const um = atrasoDoDia({ data: SEGUNDA, entrada: "08:07" }, JORNADA_PADRAO);
  assert.equal(um.atrasoEntradaMin, 7);
  assert.equal(um.tolerado, false);
  assert.equal(um.atrasoMin, 7);
  assert.equal(um.atrasoCobravelMin, 7);
  assert.equal(um.pontual, false);
  assert.equal(um.toleradoMin, 0);
  // Uma marcação dentro e outra fora: o dia inteiro deixa de ser tolerado.
  const dois = atrasoDoDia({ data: SEGUNDA, entrada: "08:05", saida: "17:54" }, JORNADA_PADRAO);
  assert.equal(dois.saidaAntesMin, 6);
  assert.equal(dois.tolerado, false);
  assert.equal(dois.atrasoMin, 11); // 5 da entrada + 6 da saída, tudo
  assert.equal(dois.toleradoMin, 0);
});

test("atrasoDoDia: a sexta termina às 17:00, e é contra ISSO que a saída é medida", () => {
  const sexta = atrasoDoDia({ data: SEXTA, entrada: "08:00", saida: "16:00" }, JORNADA_PADRAO);
  assert.equal(sexta.fimPrevisto, "17:00");
  assert.equal(sexta.saidaAntesMin, 60);
  assert.equal(sexta.atrasoMin, 60);
  // Sair às 17:00 na sexta é sair na hora — pela média de 8h48 seria "faltou".
  const naHora = atrasoDoDia({ data: SEXTA, entrada: "08:00", saida: "17:00" }, JORNADA_PADRAO);
  assert.equal(naHora.atrasoBrutoMin, 0);
  assert.equal(naHora.atrasoMin, 0);
});

test("atrasoDoDia: turno que vira a meia-noite não vira 12h de 'saída antecipada'", () => {
  // Plantão 22:00 → 06:00. A subtração de relógio (18:00 − 06:00) descreveria
  // outra coisa, e inventaria atraso numa noite inteira trabalhada.
  const noturna = [
    { dia: 1, turnos: [{ inicio: "22:00", fim: "06:00" }] },
    { dia: 2, turnos: [] },
  ];
  const p = atrasoDoDia({ data: SEGUNDA, entrada: "22:05", saida: "06:00" }, noturna);
  assert.equal(p.inicioPrevisto, "22:00");
  assert.equal(p.atrasoEntradaMin, 5);
  assert.equal(p.saidaAntesMin, null); // não se afirma nada sobre a saída
  assert.equal(p.atrasoBrutoMin, 5);
  assert.equal(p.tolerado, true); // 5 min cabem na tolerância da marcação
  assert.equal(p.atrasoMin, 0);
  assert.equal(p.toleradoMin, 5);
});

test("atrasoDoDia: sem o que medir devolve null — 0 seria dizer 'chegou na hora' sem medir", () => {
  assert.equal(atrasoDoDia({ data: SABADO, entrada: "08:30" }, JORNADA_PADRAO), null);
  assert.equal(atrasoDoDia({ data: DOMINGO, entrada: "08:30" }, JORNADA_PADRAO), null);
  assert.equal(atrasoDoDia({ data: SEGUNDA, entrada: "" }, JORNADA_PADRAO), null);
  assert.equal(atrasoDoDia({ data: "", entrada: "08:30" }, JORNADA_PADRAO), null);
  assert.equal(atrasoDoDia(null, JORNADA_PADRAO), null);
});

// ---- ausências --------------------------------------------------------------

test("TIPOS_AUSENCIA: a regra do dinheiro mora na lista, para a tela não repeti-la", () => {
  // A tela monta o seletor daqui. Se ela mantivesse a própria lista, a cópia
  // envelheceria calada — no dia em que um tipo mudasse de efeito, a régua da
  // tela e a régua da conta passariam a discordar sem ninguém ver.
  assert.deepEqual(
    TIPOS_AUSENCIA.map((t) => t.tipo),
    ["falta", "atestado", "justificada", "ferias", "folga"]
  );
  for (const t of TIPOS_AUSENCIA) {
    assert.equal(typeof t.rotulo, "string", t.tipo);
    assert.ok(t.rotulo.length > 0, t.tipo);
    assert.equal(typeof t.desconta, "boolean", t.tipo);
    assert.ok(t.ajuda.length > 0, t.tipo); // o porquê viaja junto com a opção
  }
  // Uma única linha da lista custa dinheiro, e é a falta injustificada.
  assert.deepEqual(TIPOS_AUSENCIA.filter((t) => t.desconta).map((t) => t.tipo), ["falta"]);
});

test("ausenciaDoDia: só 'falta' desconta; atestado, justificada, férias e folga não", () => {
  assert.equal(ausenciaDoDia({ ausencia: { tipo: "falta" } }).desconta, true);
  for (const tipo of ["atestado", "justificada", "ferias", "folga"]) {
    const a = ausenciaDoDia({ ausencia: { tipo } });
    assert.equal(a.desconta, false, tipo);
    assert.equal(a.conhecido, true, tipo);
  }
  // O motivo é texto livre — a palavra da casa vale mais que uma etiqueta.
  const atestado = ausenciaDoDia({
    ausencia: { tipo: "atestado", motivo: "consulta no ortopedista", documento: "ASO 4471" },
  });
  assert.equal(atestado.motivo, "consulta no ortopedista");
  assert.equal(atestado.documento, "ASO 4471");
  assert.equal(atestado.chip, "chip");
  assert.equal(ausenciaDoDia({ ausencia: { tipo: "falta" } }).chip, "chip-bad");
  // Dia sem ausência é dia sem ausência.
  assert.equal(ausenciaDoDia({ trabalhadoMin: 480 }), null);
  assert.equal(ausenciaDoDia({ ausencia: { tipo: "  " } }), null);
  assert.equal(ausenciaDoDia(null), null);
});

test("ausenciaDoDia: tipo desconhecido NÃO some e NÃO desconta", () => {
  // Descartar em silêncio esconderia o lançamento de alguém; cair em "falta"
  // por omissão inventaria desconto na folha.
  const a = ausenciaDoDia({ ausencia: { tipo: "licenca_paternidade" } });
  assert.equal(a.conhecido, false);
  assert.equal(a.desconta, false);
  assert.equal(a.tipo, "licenca_paternidade");
});

test("apurarCompetencia: conta as ausências por tipo, e separa o que desconta do que não", () => {
  const r = apurarCompetencia(
    [
      { data: "2026-08-03", ausencia: { tipo: "atestado", documento: "ASO 1" } },
      { data: "2026-08-04", ausencia: { tipo: "atestado", documento: "ASO 1" } },
      { data: "2026-08-05", ausencia: { tipo: "atestado", documento: "ASO 1" } },
      { data: "2026-08-06", ausencia: { tipo: "atestado", documento: "ASO 1" } },
      { data: "2026-08-07", ausencia: { tipo: "falta", motivo: "não avisou" } },
      { data: "2026-08-10", ausencia: { tipo: "ferias" } },
      { data: "2026-08-11", ausencia: { tipo: "folga", motivo: "compensou o sábado" } },
    ],
    JORNADA_PADRAO
  );
  // Quem soma 4 atestados não pode aparecer como quem teve 4 faltas.
  assert.equal(r.ausencias.atestado, 4);
  assert.equal(r.ausencias.falta, 1);
  assert.equal(r.ausencias.ferias, 1);
  assert.equal(r.ausencias.folga, 1);
  assert.equal(r.ausenciasTotal, 7);
  assert.equal(r.faltasQueDescontam, 1);
  assert.equal(r.ausenciasSemDesconto, 6);
  assert.equal(r.ausenciasDesconhecidas, 0);
  // Dia de ausência pura não é dia com batida nem dia em aberto: é dia explicado.
  assert.equal(r.diasComBatida, 0);
  assert.equal(r.diasEmAberto, 0);
  assert.equal(r.trabalhadoMin, null);

  // E é SÓ a falta que vira dinheiro: 1/30 do salário, uma vez.
  const conta = calcularFechamento({ salario: SALARIO, faltas: r.faltasQueDescontam });
  assert.equal(conta.valorDia, 82.07); // 2462 ÷ 30
  assert.equal(conta.valorFaltas, 82.07);
  // Se os atestados descontassem, seriam R$ 410,35 tirados de quem estava doente.
  assert.equal(calcularFechamento({ salario: SALARIO, faltas: 5 }).valorFaltas, 410.35);
});

test("apurarCompetencia: tipo desconhecido sai contado à parte e não desconta nada", () => {
  const r = apurarCompetencia(
    [{ data: "2026-08-03", ausencia: { tipo: "licenca_paternidade" } }],
    JORNADA_PADRAO
  );
  assert.equal(r.ausenciasTotal, 1);
  assert.equal(r.ausenciasDesconhecidas, 1);
  assert.equal(r.faltasQueDescontam, 0);
  assert.equal(r.ausencias.falta, 0);
});

test("apurarCompetencia: dia SEM batida e SEM ausência lançada NÃO é falta", () => {
  // Regra da casa: falta é afirmação trabalhista, e quem afirma é o RH no
  // lançamento. Numa empresa que acabou de ligar o relógio, deduzir falta da
  // ausência de linha inventaria desconto na folha de gente que trabalhou.
  const mesVazio = apurarCompetencia([], JORNADA_PADRAO);
  assert.equal(mesVazio.faltasQueDescontam, 0);
  assert.equal(mesVazio.ausenciasTotal, 0);
  assert.equal(mesVazio.diasComBatida, 0);
  // Dia em aberto também não vira falta: vira pendência.
  const aberto = apurarCompetencia(
    [{ data: SEGUNDA, trabalhadoMin: 0, emAberto: true, entrada: "08:00", saida: "" }],
    JORNADA_PADRAO
  );
  assert.equal(aberto.faltasQueDescontam, 0);
  assert.equal(aberto.diasEmAberto, 1);
});

test("apurarCompetencia: ausência num dia que TAMBÉM teve trabalho não desconta 1/30", () => {
  // "Atestado da tarde": a hora trabalhada é real e continua somando, e o caso
  // sai contado para a tela pedir conferência — descontar o dia inteiro de quem
  // trabalhou metade dele seria cobrar duas vezes.
  const r = apurarCompetencia(
    [{ data: SEGUNDA, trabalhadoMin: 240, ausencia: { tipo: "atestado" } }],
    JORNADA_PADRAO
  );
  assert.equal(r.ausenciasComTrabalho, 1);
  assert.equal(r.faltasQueDescontam, 0);
  assert.equal(r.diasComBatida, 1);
  assert.equal(r.trabalhadoMin, 240);
});

// ---- apuração do mês -------------------------------------------------------

test("apurarCompetencia: saldo por dia pela ESCALA, com o dia em aberto contado à parte", () => {
  const r = apurarCompetencia(
    [
      { data: SEGUNDA, trabalhadoMin: 600 }, // +60 sobre as 9h da segunda
      { data: TERCA, trabalhadoMin: 480 }, // −60
      { data: QUARTA, trabalhadoMin: null, entrada: "08:00", saida: "" }, // em aberto
    ],
    JORNADA_PADRAO
  );
  assert.equal(r.diasComBatida, 2);
  assert.equal(r.diasEmAberto, 1);
  assert.equal(r.trabalhadoMin, 1080);
  assert.equal(r.extrasMin, 60);
  assert.equal(r.atrasosMin, 60);
  assert.equal(r.previstoDerivadoMin, 1080); // 540 + 540, a régua que foi usada
});

test("apurarCompetencia: a MÉDIA mentia na sexta e no sábado — a escala não mente", () => {
  // Oito horas cravadas na sexta: jornada cumprida, saldo zero. A média de
  // 44h ÷ 5 = 8h48 acusaria 48 min de atraso em quem cumpriu o expediente.
  const sexta = apurarCompetencia([{ data: SEXTA, trabalhadoMin: 480 }], JORNADA_PADRAO);
  assert.equal(sexta.extrasMin, 0);
  assert.equal(sexta.atrasosMin, 0);
  assert.equal(sexta.previstoDerivadoMin, 480);

  // Quatro horas num sábado: a escala não prevê nada, então TUDO é excedente.
  // A média cobraria 288 min de atraso de quem foi trabalhar no fim de semana.
  const sabado = apurarCompetencia([{ data: SABADO, trabalhadoMin: 240 }], JORNADA_PADRAO);
  assert.equal(sabado.extrasMin, 240);
  assert.equal(sabado.atrasosMin, 0);
  assert.equal(sabado.diasForaDaEscala, 1); // a tela lembra que dobra é outra faixa
  assert.equal(sabado.previstoDerivadoMin, 0);
});

test("apurarCompetencia: o apurado do relógio MANDA sobre a conta derivada", () => {
  // O relógio, que respeita a escala de cada um, apurou 12 min de extra e um
  // domingo inteiro em dobra.
  const r = apurarCompetencia(
    [
      { data: SEGUNDA, origem: "jibble", entrada: "08:03", saida: "18:19", pausaMin: 64, trackedMin: 616, trabalhadoMin: 492, extraMin: 12 },
      { data: TERCA, origem: "jibble", trabalhadoMin: 480, extraMin: 0, extraDobroMin: 0 },
      { data: DOMINGO, origem: "jibble", trabalhadoMin: 240, extraMin: 0, extraDobroMin: 240 },
    ],
    JORNADA_PADRAO
  );
  assert.equal(r.extrasMin, 12); // e não o que a conta derivada diria
  assert.equal(r.extrasDobroMin, 240);
  assert.equal(r.trabalhadoMin, 1212);
  assert.equal(r.diasDoRelogio, 3);
  assert.equal(r.diasDerivados, 0);
  assert.equal(r.fonteExtras, "relogio");
  // Atraso derivado NÃO se afirma sobre dia que o relógio apurou: seria um
  // segundo resultado, com régua diferente, em cima de desconto de folha.
  assert.equal(r.atrasosMin, null);
  assert.equal(r.previstoDerivadoMin, null);
});

test("apurarCompetencia: mês misto soma cada dia pela sua régua e diz que é misto", () => {
  const r = apurarCompetencia(
    [
      { data: SEGUNDA, trabalhadoMin: 492, extraMin: 12 }, // apurado pelo relógio
      { data: TERCA, trabalhadoMin: 600 }, // lançado à mão: +60 sobre as 9h
    ],
    JORNADA_PADRAO
  );
  assert.equal(r.extrasMin, 72); // 12 do relógio + 60 derivados
  assert.equal(r.extrasRelogioMin, 12);
  assert.equal(r.extrasDerivadosMin, 60);
  assert.equal(r.fonteExtras, "misto");
  assert.equal(r.atrasosMin, 0); // medido no dia derivável, e zero medido é resultado
  // Dobra continua SEM APURAÇÃO na parte derivada — mas o dia do relógio já
  // basta para o número existir, e ele é zero de verdade.
  assert.equal(r.extrasDobroMin, 0);
});

test("apurarCompetencia: dia sem total não entra em soma nenhuma, nem na extra do relógio", () => {
  const r = apurarCompetencia(
    [
      { data: SEGUNDA, trabalhadoMin: 0, emAberto: true, entrada: "08:00", saida: "", extraMin: 30 },
      { data: TERCA, trabalhadoMin: 492, extraMin: 12 },
    ],
    JORNADA_PADRAO
  );
  assert.equal(r.diasEmAberto, 1);
  assert.equal(r.diasComBatida, 1);
  assert.equal(r.trabalhadoMin, 492); // o dia aberto não soma 0 — ele não soma
  assert.equal(r.extrasMin, 12); // os 30 min do dia aberto ficam de fora
  assert.equal(r.diasDoRelogio, 1);
});

test("apurarCompetencia: sem dia do relógio, a dobra fica SEM APURAÇÃO — nunca zero", () => {
  const r = apurarCompetencia([{ data: SEGUNDA, trabalhadoMin: 600 }], JORNADA_PADRAO);
  assert.equal(r.extrasMin, 60);
  assert.equal(r.extrasDobroMin, null); // a conta derivada soma tudo numa faixa só
  assert.equal(r.fonteExtras, "manual");
});

test("apurarCompetencia: dia à mão sem data legível sai contado, não somado", () => {
  const r = apurarCompetencia(
    [
      { data: SEGUNDA, trabalhadoMin: 492, extraMin: 12 }, // o relógio não depende da data
      { trabalhadoMin: 600 }, // este precisaria do dia da semana, que não existe
    ],
    JORNADA_PADRAO
  );
  assert.equal(r.extrasMin, 12); // só o que o relógio apurou
  assert.equal(r.diasSemSaldo, 1); // e a tela avisa que a sugestão saiu incompleta
  assert.equal(r.atrasosMin, null);
  assert.equal(r.trabalhadoMin, 1092);
});

test("apurarCompetencia: mês sem batida nenhuma devolve null, não zero hora", () => {
  const r = apurarCompetencia([], JORNADA_PADRAO);
  assert.equal(r.diasComBatida, 0);
  assert.equal(r.trabalhadoMin, null);
  assert.equal(r.extrasMin, null);
  assert.equal(r.atrasosMin, null);
});

// ---- as normais, e a folha que já contém a extra ---------------------------

test("normaisDoDia: o caso real da Ana — folha 9h15 é normais 8h00 + extra 1h15", () => {
  // 28/08/2026, uma sexta. O bloco "Horas de folha de pagamento" do Jibble
  // abriu e mostrou DO QUE a folha é feita: Normais 8h00 + Horas extras
  // diárias 1h15 = TOTAL DA FOLHA 9h15. As 8h00 são exatamente o previsto da
  // sexta na escala da casa — o 1h15 vem POR CIMA, não ao lado.
  const dia = { data: SEXTA_ANA, trabalhadoMin: 555, extraMin: 75, extraDobroMin: 0 };
  const n = normaisDoDia(dia, JORNADA_PADRAO);
  assert.equal(n.fonte, "relogio");
  assert.equal(n.folhaMin, 555); // 9h15, o payrollHours que a ponte gravou
  assert.equal(n.extraMin, 75); // 1h15
  assert.equal(n.normaisMin, 480); // 8h00
  assert.equal(n.previstoMin, 480); // e a normal fecha com o previsto do dia
  assert.equal(n.extraMaiorQueFolha, false);
  // A conta escrita é a conta feita: a folha é a soma das duas parcelas.
  assert.equal(n.normaisMin + n.extraMin + n.extraDobroMin, n.folhaMin);
  assert.equal(minutosNormais(dia, JORNADA_PADRAO), 480);
});

test("normaisDoDia: a dobra também sai de DENTRO da folha, não por fora", () => {
  // Domingo inteiro em dobra: a folha do dia é 4h e as 4h são todas extra.
  const n = normaisDoDia(
    { data: DOMINGO, trabalhadoMin: 240, extraMin: 0, extraDobroMin: 240 },
    JORNADA_PADRAO
  );
  assert.equal(n.normaisMin, 0); // e este zero é medida: não houve hora comum
  assert.equal(n.extraDobroMin, 240);
  assert.equal(n.normaisMin + n.extraMin + n.extraDobroMin, n.folhaMin);
});

test("normaisDoDia: extra maior que a folha vira 0 COM SINALIZAÇÃO, nunca negativo", () => {
  // Dado torto (correção pela metade, importação antiga). Normal negativa aqui
  // viraria desconto inventado na folha; zero calado esconderia o defeito.
  const dia = { data: SEGUNDA, trabalhadoMin: 480, extraMin: 600, extraDobroMin: 0 };
  const n = normaisDoDia(dia, JORNADA_PADRAO);
  assert.equal(n.normaisMin, 0);
  assert.equal(n.extraMaiorQueFolha, true);

  const r = apurarCompetencia([dia], JORNADA_PADRAO);
  assert.equal(r.normaisMin, 0);
  assert.equal(r.folhaMin, 480);
  assert.equal(r.diasExtraMaiorQueFolha, 1); // o mês conta o dia torto e diz
});

test("normaisDoDia: dia EM ABERTO não tem composição — null, e não 0 hora normal", () => {
  // O PT0S do Jibble grava trabalhadoMin 0 no dia que não terminou.
  const aberto = { data: SEGUNDA, trabalhadoMin: 0, emAberto: true, entrada: "08:00", saida: "", extraMin: 30 };
  assert.equal(normaisDoDia(aberto, JORNADA_PADRAO), null);
  assert.equal(minutosNormais(aberto, JORNADA_PADRAO), null);

  const r = apurarCompetencia([aberto], JORNADA_PADRAO);
  assert.equal(r.diasEmAberto, 1);
  assert.equal(r.normaisMin, null); // mês sem nenhuma batida fechada
  assert.equal(r.folhaMin, null);
});

test("normaisDoDia: dia à mão — a normal é o previsto, o que passou é excedente", () => {
  const passou = normaisDoDia({ data: SEGUNDA, trabalhadoMin: 600 }, JORNADA_PADRAO);
  assert.equal(passou.fonte, "derivado");
  assert.equal(passou.normaisMin, 540); // as 9h da segunda
  assert.equal(passou.extraMin, 60);
  assert.equal(passou.extraDobroMin, null); // a conta derivada não separa a dobra

  const curto = normaisDoDia({ data: SEGUNDA, trabalhadoMin: 480 }, JORNADA_PADRAO);
  assert.equal(curto.normaisMin, 480); // dia curto é normal inteira...
  assert.equal(curto.extraMin, 0); // ...e excedente nenhum

  const sabado = normaisDoDia({ data: SABADO, trabalhadoMin: 240 }, JORNADA_PADRAO);
  assert.equal(sabado.normaisMin, 0); // a escala não prevê o sábado: tudo é excedente
  assert.equal(sabado.extraMin, 240);
});

test("normaisDoDia: sem data legível não há previsto — o total inteiro é normal", () => {
  const n = normaisDoDia({ trabalhadoMin: 600 }, JORNADA_PADRAO);
  assert.equal(n.fonte, "sem-regua");
  assert.equal(n.normaisMin, 600); // não existe evidência de excedente nenhum
  assert.equal(n.extraMin, null); // e "não apurei" não vira zero
  assert.equal(n.previstoMin, null);

  const r = apurarCompetencia([{ trabalhadoMin: 600 }], JORNADA_PADRAO);
  assert.equal(r.folhaMin, 600);
  assert.equal(r.normaisMin, 600);
  assert.equal(r.diasSemSaldo, 1); // e a tela avisa que a sugestão saiu incompleta
  assert.equal(r.extrasMin, null);
  assert.equal(r.atrasosMin, null);
});

test("A FOLHA JÁ CONTÉM AS EXTRAS — somar folha + extra paga a hora duas vezes (TRAVA)", () => {
  // Se um dia a ponte passar a gravar em `trabalhadoMin` só as horas normais,
  // este teste cai — e é PARA cair: a tela inteira, e a comparação com o
  // previsto do mês, estão montadas em cima desta regra.
  const r = apurarCompetencia(
    [
      { data: SEGUNDA, trabalhadoMin: 600, extraMin: 60, extraDobroMin: 0 }, // 9h + 1h
      { data: DOMINGO, trabalhadoMin: 240, extraMin: 0, extraDobroMin: 240 }, // domingo em dobra
    ],
    JORNADA_PADRAO
  );
  assert.equal(r.folhaMin, 840);
  assert.equal(r.folhaMin, r.trabalhadoMin); // dois nomes, UMA variável
  assert.equal(r.extrasMin, 60);
  assert.equal(r.extrasDobroMin, 240);
  assert.equal(r.normaisMin, 540); // 540 da segunda + 0 do domingo
  assert.equal(r.diasExtraMaiorQueFolha, 0);
  // A identidade: a folha É as normais mais as extras.
  assert.equal(r.normaisMin + r.extrasMin + r.extrasDobroMin, r.folhaMin);
  // E o tamanho do estrago da leitura errada, para ninguém achar que é detalhe:
  const leituraErrada = r.folhaMin + r.extrasMin + r.extrasDobroMin;
  assert.equal(leituraErrada - r.folhaMin, 300); // 5h de hora que nunca existiu
});

test("apurarCompetencia: quem se compara com o previsto são as NORMAIS", () => {
  // O caso da VICTORIA em miniatura: duas segundas (9h previstas cada), 9h de
  // folha em cada uma — mas com 1h de extra DENTRO. Pela folha a jornada
  // estaria cumprida; pelas normais faltaram 2h.
  const r = apurarCompetencia(
    [
      { data: SEGUNDA, trabalhadoMin: 540, extraMin: 60, extraDobroMin: 0 },
      { data: SEGUNDA_SEGUINTE, trabalhadoMin: 540, extraMin: 60, extraDobroMin: 0 },
    ],
    JORNADA_PADRAO
  );
  const previsto = minutosPrevistosDoDia(SEGUNDA, JORNADA_PADRAO) * 2; // 1080
  assert.equal(r.folhaMin, 1080);
  assert.equal(r.folhaMin - previsto, 0); // pela folha: jornada cumprida
  assert.equal(r.normaisMin, 960);
  assert.equal(previsto - r.normaisMin, 120); // pelas normais: faltaram 2h
});

test("apurarCompetencia: o atraso derivado é o previsto menos as NORMAIS", () => {
  const r = apurarCompetencia(
    [
      { data: SEGUNDA, trabalhadoMin: 480 }, // −60 sobre as 9h
      { data: TERCA, trabalhadoMin: 600 }, // +60
    ],
    JORNADA_PADRAO
  );
  assert.equal(r.atrasosMin, 60); // a extra de terça não apaga o atraso da segunda
  assert.equal(r.extrasMin, 60);
  assert.equal(r.normaisMin, 1020); // 480 + 540
  assert.equal(r.folhaMin, 1080);
  assert.equal(r.normaisMin + r.extrasMin, r.folhaMin);
});

// ---- o arredondamento passo a passo ----------------------------------------

test("calcularFechamento: arredonda a cada passo — a conta da tela é a conta do sistema", () => {
  const c = calcularFechamento({ salario: SALARIO, horasExtrasMin: 270 }); // 4h30
  assert.equal(c.valorHora, 11.19); // 2462 ÷ 220
  assert.equal(c.valorHoraExtra, 16.79); // × 1,5
  assert.equal(c.valorExtras, 75.56); // × 4,5 — 16,79 × 4,5 na calculadora dá isto
  assert.equal(c.valorCalculado, 75.56);
  // Em precisão cheia daria 75,54: é a diferença que fez o RH desconfiar.
  assert.equal(Math.round((SALARIO / 220) * 1.5 * 4.5 * 100) / 100, 75.54);
});

test("calcularFechamento: o caso dos três centavos (8h de extra no mesmo salário)", () => {
  const c = calcularFechamento({ salario: SALARIO, horasExtrasMin: 480 });
  assert.equal(c.valorExtras, 134.32); // 16,79 × 8, como na calculadora do RH
  const precisaoCheia = Math.round((SALARIO / 220) * 1.5 * 8 * 100) / 100;
  assert.equal(precisaoCheia, 134.29);
  assert.equal(Math.round((c.valorExtras - precisaoCheia) * 100), 3);
});

test("calcularFechamento: +100% em domingo/feriado sai do valor-hora já arredondado", () => {
  const c = calcularFechamento({ salario: SALARIO, horasExtrasMin: 270, fator: 2 });
  assert.equal(c.valorHora, 11.19);
  assert.equal(c.valorHoraExtra, 22.38); // 1119 × 2
  assert.equal(c.valorExtras, 100.71); // 2238 × 4,5 = 10071
});

test("calcularFechamento: as duas faixas somam com os fatores certos, cada uma com seu passo", () => {
  const c = calcularFechamento({
    salario: SALARIO,
    horasExtrasMin: 270, // 4h30 de dia útil
    horasExtrasDobroMin: 120, // 2h de descanso/feriado
  });
  assert.equal(c.valorHora, 11.19);
  assert.equal(c.valorHoraExtra, 16.79); // 1119 × 1,5
  assert.equal(c.valorHoraExtraDobro, 22.38); // 1119 × 2
  assert.equal(c.valorExtras, 75.56); // 16,79 × 4,5
  assert.equal(c.valorExtrasDobro, 44.76); // 22,38 × 2
  assert.equal(c.valorExtrasTotal, 120.32);
  assert.equal(c.valorCalculado, 120.32);
  // POR QUE AS DUAS NÃO VIRAM UMA: somadas em 6h30 num fator só, a conta daria
  // R$ 109,14 — onze reais a menos, e ninguém saberia dizer de onde sumiram.
  assert.equal(calcularFechamento({ salario: SALARIO, horasExtrasMin: 390 }).valorExtras, 109.14);
});

test("calcularFechamento: mês só de dobra paga só a dobra, e a faixa de 50% fica em zero", () => {
  const c = calcularFechamento({ salario: SALARIO, horasExtrasDobroMin: 480 });
  assert.equal(c.valorExtras, 0);
  assert.equal(c.valorExtrasDobro, 179.04); // 22,38 × 8
  assert.equal(c.valorCalculado, 179.04);
  assert.equal(c.fatorDobro, FATOR_HE_DOBRA);
});

test("calcularFechamento: registro ANTIGO, sem horasExtrasDobroMin, continua valendo", () => {
  // Registro gravado antes de existirem as duas faixas: a dobra do mês inteiro
  // foi lançada em horasExtrasMin com o fator 2 carimbado no próprio registro.
  // O campo novo entra como 0 porque a faixa não existia — não é medição que
  // faltou, e por isso aqui zero não afirma nada de falso.
  const antigo = calcularFechamento({ salario: SALARIO, horasExtrasMin: 480, fator: 2 });
  assert.equal(antigo.horasExtrasDobroMin, 0);
  assert.equal(antigo.valorExtrasDobro, 0);
  assert.equal(antigo.valorExtras, 179.04); // 22,38 × 8, como sempre foi
  assert.equal(antigo.valorCalculado, 179.04);
  // E o mesmo registro relido com o campo vazio dá exatamente o mesmo número.
  const relido = calcularFechamento({ salario: SALARIO, horasExtrasMin: 480, fator: 2, horasExtrasDobroMin: "" });
  assert.equal(relido.valorCalculado, antigo.valorCalculado);
});

test("calcularFechamento: sem salário, as DUAS faixas ficam pendentes — nenhuma vira R$ 0,00", () => {
  const c = calcularFechamento({ salario: "", horasExtrasMin: 270, horasExtrasDobroMin: 120 });
  assert.equal(c.semSalario, true);
  assert.equal(c.valorExtras, null);
  assert.equal(c.valorExtrasDobro, null);
  assert.equal(c.valorExtrasTotal, null);
  assert.equal(c.valorHoraExtraDobro, null);
  // As quantidades continuam registradas: o que falta é o preço, não a hora.
  assert.equal(c.horasExtrasMin, 270);
  assert.equal(c.horasExtrasDobroMin, 120);
});

test("calcularFechamento: falta de mensalista desconta 1/30 do salário", () => {
  const c = calcularFechamento({ salario: SALARIO, faltas: 2 });
  assert.equal(c.valorDia, 82.07); // 2462 ÷ 30, arredondado
  assert.equal(c.valorFaltasDias, 164.14); // 82,07 × 2 (em precisão cheia daria 164,13)
  assert.equal(c.valorFaltas, 164.14);
  assert.equal(c.valorCalculado, -164.14); // mês só de desconto sai negativo mesmo
});

test("calcularFechamento: atraso desconta hora normal; noturno é só o adicional", () => {
  const c = calcularFechamento({
    salario: SALARIO,
    horasExtrasMin: 270,
    faltas: 2,
    atrasosMin: 90,
    adicionalNoturnoMin: 120,
  });
  assert.equal(c.valorAtrasos, 16.79); // 11,19 × 1,5h
  assert.equal(c.valorAdicionalNoturnoHora, 2.24); // 20% de 11,19
  assert.equal(c.valorNoturno, 4.48); // 2,24 × 2h
  assert.equal(c.valorFaltas, 180.93); // 164,14 + 16,79
  assert.equal(c.valorCalculado, -100.89); // 75,56 + 4,48 − 180,93
});

test("calcularFechamento: divisor e adicional são parametrizáveis (acordo coletivo muda)", () => {
  const c = calcularFechamento({ salario: SALARIO, horasExtrasMin: 60, divisor: 200, fator: 1.6 });
  assert.equal(c.valorHora, 12.31); // 2462 ÷ 200
  assert.equal(c.valorHoraExtra, 19.7); // 1231 × 1,6 = 1969,6 → 1970
  assert.equal(c.valorExtras, 19.7);
});

test("calcularFechamento: sem salário na ficha é PENDÊNCIA — null em tudo, nunca R$ 0,00", () => {
  for (const salario of ["", null, undefined, 0]) {
    const c = calcularFechamento({ salario, horasExtrasMin: 270, faltas: 1 });
    assert.equal(c.semSalario, true, `salário ${JSON.stringify(salario)}`);
    assert.equal(c.valorHora, null);
    assert.equal(c.valorExtras, null);
    assert.equal(c.valorFaltas, null);
    assert.equal(c.valorCalculado, null);
    // As quantidades continuam registradas: o que falta é o preço, não a hora.
    assert.equal(c.horasExtrasMin, 270);
    assert.equal(c.faltas, 1);
  }
});

test("calcularFechamento: salário gravado como texto é o mesmo salário", () => {
  assert.equal(calcularFechamento({ salario: "2462", horasExtrasMin: 270 }).valorExtras, 75.56);
});

test("calcularFechamento: sem nada lançado, o mês fecha em zero — e zero aqui é resultado", () => {
  const c = calcularFechamento({ salario: SALARIO });
  assert.equal(c.semSalario, false);
  assert.equal(c.valorCalculado, 0);
});

// ---- valor lançado × valor calculado ---------------------------------------

test("diferencaDoCalculo: mostra o que foi alterado, e ignora ruído abaixo de um centavo", () => {
  assert.equal(diferencaDoCalculo(105.56, 75.56), 30);
  assert.equal(diferencaDoCalculo(45.56, 75.56), -30);
  assert.equal(diferencaDoCalculo(75.56, 75.56), 0);
  assert.equal(diferencaDoCalculo(75.565, 75.56), 0); // arredondamento não é bônus
  // Sem valor calculado (sem salário) não há do que divergir.
  assert.equal(diferencaDoCalculo(100, null), 0);
  assert.equal(diferencaDoCalculo("", 75.56), 0);
});

// ---- de onde veio o número --------------------------------------------------

test("origemDoLancamento: carimba relógio só quando o lançado é o apurado", () => {
  assert.equal(origemDoLancamento(12, 12), "relogio");
  assert.equal(origemDoLancamento(30, 12), "manual"); // o RH mudou o número
  // Sem apuração do relógio, tudo é à mão — inclusive o que foi copiado da
  // sugestão derivada das batidas, que é conta desta casa e não do relógio.
  assert.equal(origemDoLancamento(72, null), "manual");
  assert.equal(origemDoLancamento(0, 0), "relogio"); // zero apurado é zero conferido
  assert.equal(origemDoLancamento(null, 12), "sem");
  assert.equal(origemDoLancamento("", null), "sem");
});

// ---- competência e configuração --------------------------------------------

test("competenciaDe: recorta o texto do dia, sem passar por Date (fuso não entra)", () => {
  assert.equal(competenciaDe("2026-08-27"), "2026-08");
  assert.equal(competenciaDe(""), "");
  assert.equal(ehCompetencia("2026-08"), true);
  assert.equal(ehCompetencia("2026-13"), false);
  assert.equal(ehCompetencia("2026-08-27"), false);
});

test("cfgDoPonto: o que não presta cai no padrão da casa, e 'definida' conta a verdade", () => {
  const padrao = cfgDoPonto(null);
  assert.equal(padrao.divisor, DIVISOR_MENSAL_PADRAO);
  assert.equal(padrao.fatorHoraExtra, FATOR_HE_PADRAO);
  assert.equal(padrao.percentualNoturno, PERCENTUAL_NOTURNO_PADRAO);
  assert.equal(padrao.definida, false);
  assert.equal(padrao.jornadaDefinida, false);
  assert.equal(padrao.jornada.semanaMin, 44 * 60);

  // Divisor 0 dividiria por zero e espalharia NaN pela coluna de dinheiro.
  const ruim = cfgDoPonto({ ponto: { divisor: 0, fatorHoraExtra: "x" } });
  assert.equal(ruim.divisor, 220);
  assert.equal(ruim.fatorHoraExtra, 1.5);
  assert.equal(ruim.definida, true);
  // Configuração que existe mas nunca escolheu escala continua no padrão da
  // casa — e diz isso, em vez de deixar parecer que alguém escolheu 44h.
  assert.equal(ruim.jornadaDefinida, false);

  const escolhida = cfgDoPonto({
    ponto: {
      divisor: 200,
      fatorHoraExtra: 2,
      percentualNoturno: 30,
      jornada: [
        { dia: 1, turnos: [{ inicio: "08:00", fim: "16:00" }] },
        { dia: 2, turnos: [{ inicio: "08:00", fim: "16:00" }] },
        { dia: 3, turnos: [{ inicio: "08:00", fim: "16:00" }] },
        { dia: 4, turnos: [{ inicio: "08:00", fim: "16:00" }] },
        { dia: 5, turnos: [{ inicio: "08:00", fim: "16:00" }] },
      ],
    },
  });
  assert.equal(escolhida.divisor, 200);
  assert.equal(escolhida.fatorHoraExtra, 2);
  assert.equal(escolhida.percentualNoturno, 30);
  assert.equal(escolhida.definida, true);
  assert.equal(escolhida.jornadaDefinida, true);
  assert.equal(escolhida.jornada.semanaMin, 40 * 60);
  assert.equal(minutosPrevistosDoDia(SEXTA, escolhida.jornada), 480);
  assert.equal(divisorDaJornada(escolhida.jornada), 200); // e o divisor bate
});
