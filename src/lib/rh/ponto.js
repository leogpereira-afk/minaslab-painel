// Portado de rh/src/lib/pontoFolha.ts (Impresilk) em 27/08/2026 — as regras de
// virar HORA em DINHEIRO são as de lá, que já custaram a confiança do RH uma
// vez. O que mudou aqui foi o formato dos campos (a MinasLab lê o relógio
// Jibble, dia a dia, e não o cartão do Secullum já apurado) e três decisões do
// Leonardo, todas anotadas no lugar onde valem.
//
// ============================================================================
// O QUE ESTE ARQUIVO DECIDE
//
// 1. Divisor mensal 220 (jornada de 44h/semana, CF art. 7º XIII). Fica
//    PARAMETRIZÁVEL porque acordo coletivo muda — a tela lê e grava em
//    lerCfg/salvarCfg sob a chave "ponto"; aqui mora só o padrão da casa.
//
// 2. Hora extra +50% em dia útil (CF art. 7º XVI, que é PISO) e +100% em
//    domingo/feriado, escolhido linha a linha pelo RH.
//
// 3. ARREDONDA A CADA PASSO, em centavos inteiros. Ver o comentário longo em
//    calcularFechamento: é o conserto que fez o RH voltar a confiar no número.
//
// 4. Falta de mensalista desconta 1/30 do salário (decisão do Leonardo,
//    31/07/2026) — não a jornada convertida em horas.
//
// 5. NADA aqui calcula reflexo de DSR, nem sobre hora extra nem sobre falta
//    (decisão do Leonardo): quem faz esse cálculo é o escritório contábil, e
//    número inventado aqui viraria divergência com a folha que ele fecha. A
//    tela diz isso em voz alta, em vez de o RH descobrir na conferência.
//
// 6. Quem não tem salário na ficha recebe null em TODO campo de dinheiro —
//    nunca 0. Zero é um valor: afirmaria "esta pessoa não tem nada a receber",
//    quando o que houve foi ausência de cadastro. A tela transforma o null em
//    pendência escrita.
//
// Sem dependência de nenhum outro arquivo do projeto, como as demais libs de
// src/lib/rh: quem formata dinheiro na tela é lib/format.js, e esta lib só
// devolve NÚMEROS — assim a conta escrita na tela é composta exatamente dos
// mesmos valores que o sistema somou.
// ============================================================================

export const DIVISOR_MENSAL_PADRAO = 220;
/** Dia de falta do mensalista = 1/30 do salário (praxe da folha). */
export const DIVISOR_DIARIO = 30;
export const FATOR_HE_PADRAO = 1.5;
/** Adicional noturno: 20% é o piso urbano (CLT art. 73). */
export const PERCENTUAL_NOTURNO_PADRAO = 20;
/** Dias úteis na semana da casa (seg–sex): 44h cabem em 5 dias. */
export const DIAS_UTEIS_SEMANA = 5;

export const ADICIONAIS_HE = [
  { fator: 1.5, label: "+50% (dia útil)", curto: "+50%" },
  { fator: 2, label: "+100% (domingo/feriado)", curto: "+100%" },
];

/**
 * Número de verdade, ou null.
 *
 * A diferença entre `null` e `0` é o assunto deste arquivo inteiro: Number("")
 * e Number(null) devolvem 0, e foi assim que "não informado" virou "zero hora
 * trabalhada" em desconto de folha. Ausência entra e sai como null.
 */
function numeroOuNulo(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const positivo = (v) => {
  const n = numeroOuNulo(v);
  return n !== null && n > 0 ? n : 0;
};

/** "HH:MM" → minutos desde a meia-noite; null quando não é hora de relógio. */
function minutosDoRelogio(txt) {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(String(txt ?? "").trim());
  if (!m) return null;
  const h = +m[1];
  if (h > 23) return null;
  return h * 60 + +m[2];
}

/**
 * Intervalo de relógio em minutos: "18:00" → "21:30" = 210.
 * Fim antes do início é virada de meia-noite (22:00 → 06:00 = 8h), que acontece
 * em plantão — tratar como erro faria a noite inteira sumir da apuração.
 * Devolve null se algum lado não for hora: aqui também ausência não é zero.
 */
export function minutosEntre(inicio, fim) {
  const a = minutosDoRelogio(inicio);
  const b = minutosDoRelogio(fim);
  if (a === null || b === null) return null;
  return b >= a ? b - a : 24 * 60 - a + b;
}

/**
 * Quanto o dia rendeu, a partir das batidas: (saída − entrada) − pausa.
 *
 * Sem entrada OU sem saída devolve null — dia EM ABERTO, não dia de zero hora.
 * Pode ser esquecimento de bater, pode ser o relógio fora do ar, pode ser
 * falta; afirmar zero aqui vira desconto indevido na folha.
 *
 * Pausa ausente não desconta nada (é a única leitura possível de um campo em
 * branco), e pausa maior que o intervalo — erro de digitação — deixa o dia em
 * zero em vez de negativo; a linha mostra entrada, saída e pausa lado a lado,
 * então o erro fica à vista. O formulário de correção recusa antes disso.
 */
export function minutosDoDia(dia) {
  const bruto = minutosEntre(dia?.entrada, dia?.saida);
  if (bruto === null) return null;
  return Math.max(0, bruto - positivo(dia?.pausaMin));
}

/**
 * Os minutos que valem para a apuração do dia.
 *
 * A ponte (ml-ponto) já grava `trabalhadoMin`, e é ele que manda quando existe
 * — inclusive quando é 0, que é um zero de verdade (bateu entrada e saída no
 * mesmo minuto). `trabalhadoMin: null` é o "dia em aberto" da ponte, e aí a
 * conta sai das batidas, que podem ter sido corrigidas à mão.
 */
export function minutosTrabalhados(dia) {
  const gravado = numeroOuNulo(dia?.trabalhadoMin);
  if (gravado !== null) return Math.max(0, Math.round(gravado));
  return minutosDoDia(dia);
}

/**
 * Lê uma DURAÇÃO digitada ("02:50" = 2h50 = 170 min).
 *
 * Devolve null quando não entende, e é isso que importa: 0 minuto vira R$ 0,00
 * e o lançamento sairia zerado sem ninguém ver o erro de digitação. Com null a
 * tela recusa e pede de novo.
 *
 * Aceita horas decimais com VÍRGULA ("2,5" = 2h30), porque quem vem da planilha
 * digita dos dois jeitos. NÃO aceita "2.50" com ponto: seria 2h30 ou 2,5h?
 * Adivinhar aqui erra em dinheiro — melhor recusar e pedir "02:30".
 */
export function minutosDaDuracao(txt) {
  const s = String(txt ?? "").trim().replace(/\s/g, "");
  if (!s) return null;
  const relogio = /^(\d{1,3}):([0-5]\d)$/.exec(s);
  if (relogio) return +relogio[1] * 60 + +relogio[2];
  if (/^\d{1,3}(,\d{1,2})?$/.test(s)) return Math.round(Number(s.replace(",", ".")) * 60);
  return null;
}

/** Minutos → "4h30" para leitura. Devolve "" para ausência (a tela escreve a frase). */
export function duracaoTexto(min) {
  const n = numeroOuNulo(min);
  if (n === null) return "";
  const inteiro = Math.round(Math.abs(n));
  return `${n < 0 ? "−" : ""}${Math.floor(inteiro / 60)}h${String(inteiro % 60).padStart(2, "0")}`;
}

/**
 * Minutos → "04:30" para EDITAR no campo.
 * 0 volta como "00:00", não como "": zero gravado que some do formulário é
 * apagado no próximo Gravar, em silêncio.
 */
export function duracaoCampo(min) {
  const n = numeroOuNulo(min);
  if (n === null) return "";
  const inteiro = Math.round(Math.abs(n));
  return `${String(Math.floor(inteiro / 60)).padStart(2, "0")}:${String(inteiro % 60).padStart(2, "0")}`;
}

/** Minutos → horas decimais (4h30 → 4.5), para a coluna que SOMA na planilha. */
export function horasDecimais(min) {
  const n = numeroOuNulo(min);
  if (n === null) return null;
  return Math.round((n / 60) * 100) / 100;
}

/** "AAAA-MM-DD" → "AAAA-MM". Texto puro: nada de Date, que traria fuso junto. */
export function competenciaDe(iso) {
  return String(iso ?? "").slice(0, 7);
}

export function ehCompetencia(c) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(c ?? ""));
}

/**
 * A jornada prevista por dia, a partir das horas semanais da ficha.
 * 44h ÷ 5 dias = 528 min = 8h48.
 *
 * Sem `horasSemanais` na ficha devolve null — e null aqui significa "não dá
 * para calcular saldo", não "saldo zero": mostrar hora extra ou atraso sem
 * saber a jornada prevista é inventar número em cima de dinheiro.
 */
export function minutosPrevistosPorDia(horasSemanais, diasUteisSemana = DIAS_UTEIS_SEMANA) {
  const h = numeroOuNulo(horasSemanais);
  const d = positivo(diasUteisSemana) || DIAS_UTEIS_SEMANA;
  if (h === null || h <= 0) return null;
  return Math.round((h * 60) / d);
}

/**
 * O que as batidas de um mês dizem — a SUGESTÃO que o RH copia (ou não) para o
 * fechamento.
 *
 * Dia sem batida completa NÃO entra na soma e NÃO vira falta: sai contado à
 * parte, em `diasEmAberto`. Falta é afirmação trabalhista (pode ser feriado,
 * folga, atestado ou relógio mudo) e quem afirma é o RH, no lançamento.
 *
 * Sem jornada prevista, `extrasMin`/`atrasosMin` saem null e `semJornada` fica
 * true: o total trabalhado continua sendo verdade, o saldo é que não existe.
 */
export function apurarCompetencia(dias, previstoPorDia) {
  const previsto = numeroOuNulo(previstoPorDia);
  const semJornada = previsto === null || previsto <= 0;
  let diasComBatida = 0;
  let diasEmAberto = 0;
  let trabalhadoMin = 0;
  let extrasMin = 0;
  let atrasosMin = 0;

  for (const d of dias || []) {
    const min = minutosTrabalhados(d);
    if (min === null) {
      diasEmAberto += 1;
      continue;
    }
    diasComBatida += 1;
    trabalhadoMin += min;
    if (!semJornada) {
      const saldo = min - previsto;
      if (saldo > 0) extrasMin += saldo;
      else atrasosMin += -saldo;
    }
  }

  return {
    diasComBatida,
    diasEmAberto,
    trabalhadoMin: diasComBatida > 0 ? trabalhadoMin : null,
    previstoPorDia: semJornada ? null : previsto,
    extrasMin: semJornada ? null : extrasMin,
    atrasosMin: semJornada ? null : atrasosMin,
    semJornada,
  };
}

/**
 * Os parâmetros do ponto, vindos da configuração global (chave "ponto").
 *
 * Peneira o que vem do servidor: divisor 0 ou texto viraria divisão por zero e
 * NaN espalhado por toda a coluna de dinheiro. O que não presta cai no padrão
 * da casa, e `definida` conta se a configuração existe — a tela precisa dizer
 * "usando o padrão" em vez de deixar parecer que alguém escolheu 220.
 */
export function cfgDoPonto(config) {
  const p = (config && config.ponto) || null;
  const divisor = numeroOuNulo(p?.divisor);
  const fator = numeroOuNulo(p?.fatorHoraExtra);
  const noturno = numeroOuNulo(p?.percentualNoturno);
  return {
    divisor: divisor !== null && divisor > 0 ? divisor : DIVISOR_MENSAL_PADRAO,
    fatorHoraExtra: fator !== null && fator >= 1 ? fator : FATOR_HE_PADRAO,
    percentualNoturno: noturno !== null && noturno >= 0 ? noturno : PERCENTUAL_NOTURNO_PADRAO,
    definida: !!p,
  };
}

/**
 * O fechamento do mês de uma pessoa em DINHEIRO.
 *
 * ARREDONDA A CADA PASSO, em centavos inteiros:
 *   (salário ÷ divisor) → arredonda → × fator → arredonda → × horas → arredonda
 *
 * Matematicamente é menos exato do que fechar a conta em precisão cheia, e é DE
 * PROPÓSITO — foi um conserto, não um descuido. Com a conta inteira em precisão
 * cheia, a tela mostrava os passos já arredondados ("R$ 11,19/h · com +50% =
 * R$ 16,79/h · × 4h30") e cravava um total que aqueles números não produzem:
 * quem conferia na calculadora fazia 16,79 × 4,5 e achava R$ 75,56 enquanto o
 * sistema gravava R$ 75,54. Três centavos bastaram para o RH da Impresilk parar
 * de confiar no número — e número em que não se confia manda a pessoa de volta
 * para a planilha, que é o problema que o sistema existe para resolver.
 *
 * Arredondando a cada passo, a conta que a tela mostra é a conta que o sistema
 * faz. É também como a folha faz: o valor-hora vai ao holerite com dois
 * decimais, e a linha é quantidade × esse valor.
 *
 * O adicional noturno incide sobre os minutos LANÇADOS: a redução da hora
 * noturna (52min30, CLT art. 73 § 1º) é conversão do escritório contábil, e
 * fazê-la aqui daria dois números diferentes para a mesma noite.
 *
 * Devolve valores separados (extras, noturno, faltas, atrasos) porque é deles
 * que a tela monta a conta escrita — e porque um total sem as parcelas não se
 * confere.
 */
export function calcularFechamento({
  salario,
  divisor = DIVISOR_MENSAL_PADRAO,
  divisorDiario = DIVISOR_DIARIO,
  fator = FATOR_HE_PADRAO,
  percentualNoturno = PERCENTUAL_NOTURNO_PADRAO,
  horasExtrasMin = 0,
  faltas = 0,
  atrasosMin = 0,
  adicionalNoturnoMin = 0,
} = {}) {
  const s = numeroOuNulo(salario);
  const d = positivo(divisor) || DIVISOR_MENSAL_PADRAO;
  const dDia = positivo(divisorDiario) || DIVISOR_DIARIO;
  const f = positivo(fator) || FATOR_HE_PADRAO;
  const pct = Math.max(0, numeroOuNulo(percentualNoturno) ?? PERCENTUAL_NOTURNO_PADRAO);

  const minExtras = Math.max(0, Math.round(positivo(horasExtrasMin)));
  const minAtrasos = Math.max(0, Math.round(positivo(atrasosMin)));
  const minNoturno = Math.max(0, Math.round(positivo(adicionalNoturnoMin)));
  const diasFalta = Math.max(0, Math.round(positivo(faltas)));

  const base = {
    divisor: d,
    divisorDiario: dDia,
    fator: f,
    percentualNoturno: pct,
    horasExtrasMin: minExtras,
    atrasosMin: minAtrasos,
    adicionalNoturnoMin: minNoturno,
    faltas: diasFalta,
  };

  // PENDÊNCIA EXPLÍCITA, nunca R$ 0,00 mudo: sem salário na ficha não há conta,
  // e todo campo de dinheiro sai null para a tela ter de escrever o porquê.
  if (s === null || s <= 0) {
    return {
      ...base,
      semSalario: true,
      salarioBase: s,
      valorHora: null,
      valorHoraExtra: null,
      valorAdicionalNoturnoHora: null,
      valorDia: null,
      valorExtras: null,
      valorNoturno: null,
      valorFaltasDias: null,
      valorAtrasos: null,
      valorFaltas: null,
      valorCalculado: null,
    };
  }

  // Tudo em CENTAVOS INTEIROS: evita que 16,79 × 4,5 = 7555,4999… vire 75,55
  // por conta de float, quando a conta na mão dá 75,56.
  const centHora = Math.round((s / d) * 100);
  const centHoraExtra = Math.round(centHora * f);
  const centExtras = Math.round(centHoraExtra * (minExtras / 60));
  const centAdicNoturnoHora = Math.round(centHora * (pct / 100));
  const centNoturno = Math.round(centAdicNoturnoHora * (minNoturno / 60));
  const centDia = Math.round((s / dDia) * 100);
  const centFaltasDias = Math.round(centDia * diasFalta);
  const centAtrasos = Math.round(centHora * (minAtrasos / 60));
  const centDescontos = centFaltasDias + centAtrasos;

  return {
    ...base,
    semSalario: false,
    salarioBase: s,
    valorHora: centHora / 100,
    valorHoraExtra: centHoraExtra / 100,
    valorAdicionalNoturnoHora: centAdicNoturnoHora / 100,
    valorDia: centDia / 100,
    valorExtras: centExtras / 100,
    valorNoturno: centNoturno / 100,
    valorFaltasDias: centFaltasDias / 100,
    valorAtrasos: centAtrasos / 100,
    valorFaltas: centDescontos / 100,
    // Pode dar negativo (mais desconto que hora extra) — e negativo é o
    // resultado honesto: a folha do mês desconta.
    valorCalculado: (centExtras + centNoturno - centDescontos) / 100,
  };
}

/**
 * O valor digitado saiu do que a conta sugeriu?
 *
 * Existe porque o RH PRECISA poder alterar o valor calculado ("tem hora que tem
 * bônus"). Mas valor alterado que se parece com valor calculado é armadilha:
 * seis meses depois ninguém sabe se aqueles R$ 30 a mais foram combinado ou
 * erro de digitação. A tela mostra a diferença e ela vai na descrição.
 *
 * Tolerância de um centavo: arredondamento não é bônus.
 * Sem valor calculado (sem salário) não há do que divergir — devolve 0.
 */
export function diferencaDoCalculo(digitado, calculado) {
  const d = numeroOuNulo(digitado);
  const c = numeroOuNulo(calculado);
  if (d === null || c === null) return 0;
  const dif = Math.round((d - c) * 100) / 100;
  return Math.abs(dif) < 0.01 ? 0 : dif;
}
