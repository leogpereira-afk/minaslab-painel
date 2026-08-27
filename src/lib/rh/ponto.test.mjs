// Testes do motor do ponto. Rodar com TZ=UTC (`npm test` já fixa) — teste que
// só passa no fuso de quem escreveu não é teste.
//
// Os casos foram escolhidos começando pelo CASO RUIM: o que já deu errado na
// Impresilk (os três centavos), o que erra em dinheiro se for adivinhado
// ("2.50") e o que vira desconto indevido se ausência virar zero (dia em
// aberto, mês sem batida, ficha sem salário).
import test from "node:test";
import assert from "node:assert/strict";
import {
  apurarCompetencia,
  calcularFechamento,
  cfgDoPonto,
  competenciaDe,
  diferencaDoCalculo,
  duracaoCampo,
  duracaoTexto,
  ehCompetencia,
  horasDecimais,
  minutosDaDuracao,
  minutosDoDia,
  minutosEntre,
  minutosPrevistosPorDia,
  minutosTrabalhados,
  DIVISOR_MENSAL_PADRAO,
  FATOR_HE_PADRAO,
  PERCENTUAL_NOTURNO_PADRAO,
} from "./ponto.js";

// O salário que a Impresilk usou para descobrir o defeito dos três centavos.
const SALARIO = 2462;

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

// ---- apuração do mês -------------------------------------------------------

test("apurarCompetencia: saldo por dia, com o dia em aberto contado à parte", () => {
  const r = apurarCompetencia(
    [
      { trabalhadoMin: 600 }, // +72 sobre 8h48
      { trabalhadoMin: 480 }, // −48
      { trabalhadoMin: null, entrada: "08:00", saida: "" }, // em aberto
    ],
    528
  );
  assert.equal(r.diasComBatida, 2);
  assert.equal(r.diasEmAberto, 1);
  assert.equal(r.trabalhadoMin, 1080);
  assert.equal(r.extrasMin, 72);
  assert.equal(r.atrasosMin, 48);
  assert.equal(r.semJornada, false);
});

test("apurarCompetencia: sem jornada na ficha não inventa saldo", () => {
  const r = apurarCompetencia([{ trabalhadoMin: 600 }], null);
  assert.equal(r.semJornada, true);
  assert.equal(r.extrasMin, null);
  assert.equal(r.atrasosMin, null);
  assert.equal(r.trabalhadoMin, 600); // o total trabalhado continua sendo verdade
});

test("apurarCompetencia: mês sem batida nenhuma devolve null, não zero hora", () => {
  const r = apurarCompetencia([], 528);
  assert.equal(r.diasComBatida, 0);
  assert.equal(r.trabalhadoMin, null);
});

test("minutosPrevistosPorDia: 44h ÷ 5 dias = 8h48; sem jornada, null", () => {
  assert.equal(minutosPrevistosPorDia(44), 528);
  assert.equal(minutosPrevistosPorDia(40), 480);
  assert.equal(minutosPrevistosPorDia(""), null);
  assert.equal(minutosPrevistosPorDia(null), null);
  assert.equal(minutosPrevistosPorDia(0), null);
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

  // Divisor 0 dividiria por zero e espalharia NaN pela coluna de dinheiro.
  const ruim = cfgDoPonto({ ponto: { divisor: 0, fatorHoraExtra: "x" } });
  assert.equal(ruim.divisor, 220);
  assert.equal(ruim.fatorHoraExtra, 1.5);
  assert.equal(ruim.definida, true);

  const escolhida = cfgDoPonto({ ponto: { divisor: 200, fatorHoraExtra: 2, percentualNoturno: 30 } });
  assert.deepEqual(escolhida, { divisor: 200, fatorHoraExtra: 2, percentualNoturno: 30, definida: true });
});
