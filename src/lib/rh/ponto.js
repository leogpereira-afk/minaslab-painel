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
// 7. O QUE O RELÓGIO JÁ APUROU MANDA (27/08/2026). A ponte (ml-ponto) passou a
//    gravar em "rh_ponto_dia" o que o Jibble apurou RESPEITANDO A ESCALA de
//    cada pessoa: `trabalhadoMin` (o que vai para a folha), `extraMin` (+50% de
//    dia normal) e `extraDobroMin` (+100% de descanso/feriado/dobra). Refazer
//    essa conta aqui — trabalhado contra previsto — daria um SEGUNDO resultado
//    para o mesmo dia, e o painel passaria a divergir do que a própria pessoa
//    vê no aplicativo do Jibble. Divergência assim não se explica em reunião: o
//    painel tem de dizer o mesmo número. A conta derivada continua existindo, e
//    só para o dia que o relógio NÃO apurou — lançado à mão, corrigido à mão ou
//    importado antes desta versão.
//
// 8. AS DUAS FAIXAS DE HORA EXTRA ANDAM SEPARADAS até o fim: +50% e +100%, cada
//    uma com seu fator e sua conta. Somar as duas numa quantidade só obrigaria
//    quem paga a adivinhar o fator depois — e adivinhar erra em dinheiro.
//
// 9. A JORNADA DA CASA É UMA ESCALA, NÃO UMA MÉDIA (28/08/2026). Até aqui o
//    previsto do dia saía de 44h ÷ 5 = 8h48, e média MENTE: na sexta (que tem
//    8h) inventava 48 min de atraso, e no sábado (que não se trabalha) cobrava
//    uma jornada inteira de quem não devia nada. O previsto agora sai do dia da
//    semana. Ver JORNADA_PADRAO.
//
// 10. FALTA É LANÇAMENTO, NUNCA DEDUÇÃO (28/08/2026). Dia sem batida e sem
//    ausência lançada é "sem registro" — não é falta. Numa empresa que acabou
//    de ligar o relógio, deduzir falta da ausência de linha seria inventar
//    desconto na folha de gente que estava trabalhando. Ver TIPOS_AUSENCIA.
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
/**
 * Extra de descanso/feriado/dobra: +100%. Não é parametrizável junto com o
 * fator de dia útil porque não é a mesma escolha — o +50% é piso que acordo
 * coletivo levanta, e a dobra do descanso é a dobra.
 */
export const FATOR_HE_DOBRA = 2;
/** Adicional noturno: 20% é o piso urbano (CLT art. 73). */
export const PERCENTUAL_NOTURNO_PADRAO = 20;

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

const texto = (v) => String(v ?? "").trim();

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
 * A ORDEM DAS DUAS PRIMEIRAS LINHAS É O CONSERTO (28/08/2026). A marca
 * `emAberto` é lida ANTES de `trabalhadoMin`, e não depois, porque o Jibble
 * devolve payrollHours "PT0S" para quem entrou e não saiu — e "PT0S" é uma
 * duração que a ponte entende, então ela grava `trabalhadoMin: 0`, não null.
 * Lido primeiro, esse zero fazia o dia EM ABERTO passar por dia FECHADO de
 * zero minuto: contava em `diasComBatida`, a tela imprimia "0h00 para a folha"
 * ao lado do selo "em aberto" e a planilha exportava 0.0 justamente na coluna
 * que o RH soma para descontar. Dia que o relógio diz que não terminou não tem
 * total — tem pendência.
 *
 * Fora do dia em aberto, `trabalhadoMin` MANDA quando existe, inclusive quando
 * é 0, que aí é um zero de verdade (bateu entrada e saída no mesmo minuto).
 *
 * ATENÇÃO: `trabalhadoMin` NÃO é (saída − entrada) − pausa. Em 17/08/2026 o
 * crachá ficou 10h16 aberto (`trackedMin` 616), a pausa não paga foi de 1h04 e
 * para a folha foram 8h12 (492). Quem concilia essas três coisas é a escala, e
 * quem apura a escala é o relógio — a tela mostra os três números lado a lado,
 * nunca como uma subtração que não fecha.
 *
 * Sem a marca de aberto e sem total gravado (dia lançado à mão, ou importado
 * antes desta versão) a conta sai das batidas, que podem ter sido corrigidas.
 */
export function minutosTrabalhados(dia) {
  if (dia?.emAberto === true) return null;
  const gravado = numeroOuNulo(dia?.trabalhadoMin);
  if (gravado !== null) return Math.max(0, Math.round(gravado));
  return minutosDoDia(dia);
}

/**
 * A apuração que o RELÓGIO já fez deste dia, ou null quando não fez.
 *
 * O que identifica o dia apurado é o DADO (`extraMin`/`extraDobroMin`, gravados
 * pela ponte), não o rótulo `origem`: dia corrigido à mão continua com
 * origem "jibble", e o que importa é se os números do relógio ainda descrevem o
 * dia. Por isso a correção que mexe nas batidas limpa esses campos e guarda o
 * que veio da máquina em `relogioExtraMin`/`relogioTrabalhadoMin`.
 *
 * Uma faixa ausente com a outra presente conta 0, e aqui isso NÃO é "ausência
 * virou zero": o relógio apurou o dia e disse que aquela faixa não existiu —
 * domingo trabalhado tem dobra e não tem extra de dia normal.
 */
export function apuracaoDoRelogio(dia) {
  const extra = numeroOuNulo(dia?.extraMin);
  const dobro = numeroOuNulo(dia?.extraDobroMin);
  if (extra === null && dobro === null) return null;
  return {
    extraMin: Math.max(0, Math.round(extra ?? 0)),
    extraDobroMin: Math.max(0, Math.round(dobro ?? 0)),
  };
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

// ============================================================================
// A JORNADA DA CASA — a escala, e o previsto que sai dela
// ============================================================================

/** 0 = domingo … 6 = sábado, na mesma numeração de Date#getDay(). */
export const NOMES_DIA_SEMANA = [
  "domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado",
];
/** "na segunda", mas "no sábado": a frase da tela sai daqui, não de um chute. */
const ARTIGO_DIA = ["no", "na", "na", "na", "na", "na", "no"];

/**
 * Turno maior que isto é erro de digitação, não plantão. Serve para o
 * "13:00 → 12:00" invertido não virar 23h de jornada prevista em silêncio — a
 * virada de meia-noite continua valendo (22:00 → 06:00 = 8h).
 */
const TURNO_MAXIMO_MIN = 16 * 60;

const TURNOS_SEG_A_QUI = [
  { inicio: "08:00", fim: "12:00" },
  { inicio: "13:00", fim: "18:00" },
];
const TURNOS_SEXTA = [
  { inicio: "08:00", fim: "12:00" },
  { inicio: "13:00", fim: "17:00" },
];

/**
 * A ESCALA PADRÃO DA MINASLAB, informada pelo Leonardo em 28/08/2026:
 *
 *   segunda a QUINTA  08:00–12:00 e 13:00–18:00 = 9h por dia
 *   SEXTA             08:00–12:00 e 13:00–17:00 = 8h
 *   sábado e domingo  não se trabalha
 *   Total: 4 × 9h + 8h = 44h por semana
 *
 * As 44h não são coincidência: são a MESMA jornada que o divisor 220 já
 * pressupõe (44 × 5 = 220), e os dois números têm de continuar batendo. Mexer
 * na escala sem mexer no divisor faz a hora extra ser paga por um valor-hora
 * que a jornada não sustenta — por isso `divisorDaJornada` existe e a tela
 * compara os dois.
 *
 * ISTO É SÓ O VALOR INICIAL. A escala vive na configuração (lerCfg/salvarCfg,
 * chave "ponto", campo `jornada`), porque acordo coletivo muda e jornada
 * cravada no código vira mentira silenciosa no dia em que mudar: o número
 * continua saindo, só que errado, e ninguém tem onde olhar para descobrir.
 *
 * A escala é DA CASA, não da pessoa. `horasSemanais` continua na ficha como
 * cadastro (o que está no contrato), mas o previsto do dia sai daqui — e, para
 * quem tem escala diferente, quem apura é o relógio, que já respeita a escala
 * de cada um no Jibble. A conta derivada desta lib só alcança o dia lançado à
 * mão.
 */
export const JORNADA_PADRAO = [
  { dia: 0, turnos: [] },
  { dia: 1, turnos: TURNOS_SEG_A_QUI },
  { dia: 2, turnos: TURNOS_SEG_A_QUI },
  { dia: 3, turnos: TURNOS_SEG_A_QUI },
  { dia: 4, turnos: TURNOS_SEG_A_QUI },
  { dia: 5, turnos: TURNOS_SEXTA },
  { dia: 6, turnos: [] },
];

function normalizarTurnos(bruta) {
  const turnos = [];
  let ignorados = 0;
  for (const t of Array.isArray(bruta) ? bruta : []) {
    const a = minutosDoRelogio(t?.inicio);
    const b = minutosDoRelogio(t?.fim);
    if (a === null || b === null) {
      ignorados += 1;
      continue;
    }
    const minutos = b >= a ? b - a : 24 * 60 - a + b;
    if (minutos <= 0 || minutos > TURNO_MAXIMO_MIN) {
      ignorados += 1;
      continue;
    }
    turnos.push({ inicio: duracaoCampo(a), fim: duracaoCampo(b), minutos });
  }
  return { turnos, ignorados };
}

const ehEscalaNormalizada = (v) =>
  !!v && Array.isArray(v.dias) && v.dias.length === 7 && typeof v.semanaMin === "number";

/**
 * A escala em forma canônica: sete dias, cada um com os turnos que a casa
 * entende e o previsto do dia já somado em minutos.
 *
 * PENEIRA o que vem do servidor, e peneira DIZENDO: turno com hora que não é
 * hora, invertido ou absurdo não entra, mas sai contado em `ignorados` — filtro
 * que descarta o desconhecido em silêncio é como se esconde problema (lição
 * paga na Impresilk, com uma lista de módulos que sumia sem erro).
 *
 * O que NÃO é lista de dias nenhuma cai INTEIRO no padrão da casa
 * (`padrao: true`), e a tela diz que está usando o padrão. Aproveitar metade de
 * uma configuração quebrada inventaria dia útil onde ninguém escolheu nenhum.
 *
 * Dia que a configuração menciona sem turno nenhum, ou não menciona, é dia NÃO
 * TRABALHADO — o padrão da casa não reaparece por baixo. Quem escreve a escala
 * escreve os sete dias; o que ele não escreveu, ele não previu.
 *
 * É idempotente: escala já normalizada volta como está, para as funções
 * poderem receber tanto o que veio do banco quanto o que já foi tratado.
 */
export function normalizarJornada(bruta) {
  if (ehEscalaNormalizada(bruta)) return bruta;
  const lista = Array.isArray(bruta) ? bruta : null;
  const porDia = new Map();
  let ignorados = 0;
  let comTurno = 0;
  if (lista) {
    for (const e of lista) {
      const n = numeroOuNulo(e?.dia);
      if (n === null || n < 0 || n > 6) {
        ignorados += 1;
        continue;
      }
      const r = normalizarTurnos(e?.turnos);
      ignorados += r.ignorados;
      if (r.turnos.length > 0) comTurno += 1;
      porDia.set(Math.round(n), r.turnos);
    }
  }
  // Configuração que não descreveu um único dia de trabalho não é escala: é
  // lixo, ou é o campo que nunca foi preenchido. Vale o padrão da casa.
  const padrao = !lista || comTurno === 0;
  const dias = [];
  let semanaMin = 0;
  for (let d = 0; d <= 6; d += 1) {
    const turnos = padrao
      ? normalizarTurnos(JORNADA_PADRAO.find((x) => x.dia === d)?.turnos).turnos
      : porDia.get(d) || [];
    const previstoMin = turnos.reduce((s, t) => s + t.minutos, 0);
    semanaMin += previstoMin;
    dias.push({ dia: d, nome: NOMES_DIA_SEMANA[d], turnos, previstoMin });
  }
  // `ignorados` continua sendo dito mesmo quando a escala inteira caiu no
  // padrão: é justamente aí que alguém precisa saber que o que estava gravado
  // não foi entendido, em vez de ver o número certo e supor que veio dele.
  return { dias, semanaMin, padrao, ignorados };
}

/** A escala de volta ao formato que se grava na configuração (sem os derivados). */
export function jornadaParaCfg(jornada) {
  return normalizarJornada(jornada).dias.map((d) => ({
    dia: d.dia,
    turnos: d.turnos.map((t) => ({ inicio: t.inicio, fim: t.fim })),
  }));
}

/**
 * O dia da semana de uma data "AAAA-MM-DD" (0 = domingo … 6 = sábado), ou null.
 *
 * Monta a data pelos TRÊS NÚMEROS, em meia-noite LOCAL. `new Date("2026-08-29")`
 * seria meia-noite UTC e, no Brasil, voltaria um dia: sábado viraria sexta e a
 * escala passaria a prever 8h num dia em que ninguém trabalha.
 *
 * Data que não existe (31/02) rolaria para o mês seguinte e responderia sobre
 * OUTRO dia — por isso a conferência de volta.
 */
export function diaDaSemanaISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  if (!m) return null;
  const ano = +m[1];
  const mes = +m[2];
  const dia = +m[3];
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d.getDay();
}

/** O dia da escala que vale para uma data, ou null quando a data não é dia. */
export function jornadaDoDia(iso, jornada) {
  const s = diaDaSemanaISO(iso);
  if (s === null) return null;
  return normalizarJornada(jornada).dias[s];
}

/**
 * O previsto de UM dia, em minutos.
 *
 * Fim de semana devolve 0, e este zero é RESULTADO: a escala foi consultada e
 * disse que não se trabalha. Data que não dá para ler devolve null — aí não se
 * mediu nada, e afirmar 0 faria a apuração tratar o dia inteiro como hora
 * extra.
 */
export function minutosPrevistosDoDia(iso, jornada) {
  const d = jornadaDoDia(iso, jornada);
  return d ? d.previstoMin : null;
}

/** A hora em que o dia deveria começar ("08:00"), ou null se não se trabalha. */
export function inicioPrevistoDoDia(iso, jornada) {
  const d = jornadaDoDia(iso, jornada);
  return d && d.turnos.length > 0 ? d.turnos[0].inicio : null;
}

/** A hora em que o dia deveria terminar ("18:00"), ou null se não se trabalha. */
export function fimPrevistoDoDia(iso, jornada) {
  const d = jornadaDoDia(iso, jornada);
  return d && d.turnos.length > 0 ? d.turnos[d.turnos.length - 1].fim : null;
}

/** Os dias de uma competência, em "AAAA-MM-DD". Lista vazia se não é competência. */
export function diasDoMes(competencia) {
  if (!ehCompetencia(competencia)) return [];
  const [ano, mes] = String(competencia).split("-").map(Number);
  // Dia 0 do mês seguinte é o último dia deste — em data LOCAL, sem fuso.
  const ultimo = new Date(ano, mes, 0).getDate();
  const out = [];
  for (let d = 1; d <= ultimo; d += 1) out.push(`${competencia}-${String(d).padStart(2, "0")}`);
  return out;
}

/**
 * O previsto do MÊS inteiro: a soma do previsto de cada dia da escala.
 *
 * Devolve null para o que não é competência — nunca 0, que afirmaria "este mês
 * não tem jornada prevista".
 *
 * A ESCALA NÃO CONHECE FERIADO, e é de propósito: manter um calendário de
 * feriados aqui daria um previsto que ninguém conferiu, e feriado municipal
 * muda de cidade para cidade. Feriado se resolve onde ele acontece — no dia,
 * lançado como ausência do tipo "folga", ou já apurado pelo relógio como dobra.
 */
export function minutosPrevistosDoMes(competencia, jornada) {
  const dias = diasDoMes(competencia);
  if (dias.length === 0) return null;
  const escala = normalizarJornada(jornada);
  let total = 0;
  // Todo dia daqui tem data válida (foi esta função que a montou), então o
  // previsto nunca vem null — mas o ?? 0 deixa isso escrito em vez de suposto.
  for (const iso of dias) total += minutosPrevistosDoDia(iso, escala) ?? 0;
  return total;
}

/** Quantos dias do mês a escala prevê trabalho. null para o que não é competência. */
export function diasUteisDoMes(competencia, jornada) {
  const dias = diasDoMes(competencia);
  if (dias.length === 0) return null;
  const escala = normalizarJornada(jornada);
  return dias.filter((iso) => (minutosPrevistosDoDia(iso, escala) ?? 0) > 0).length;
}

/**
 * O divisor mensal que uma jornada semanal sustenta: 44h × 5 = 220 (praxe da
 * folha, e o número que este sistema já usava).
 *
 * Serve para a tela comparar com o divisor configurado: escala e divisor são o
 * MESMO fato dito de dois jeitos, e vê-los divergir é o único jeito de
 * descobrir que alguém mexeu em um e esqueceu o outro.
 */
export function divisorDaJornada(jornada) {
  const escala = normalizarJornada(jornada);
  if (escala.semanaMin <= 0) return null;
  return Math.round((escala.semanaMin / 60) * 5);
}

/**
 * A escala em uma frase: "9h00 de segunda a quinta · 8h00 na sexta · 44h00 por
 * semana". Agrupa dias seguidos de mesmo previsto — a tela precisa dizer QUAL
 * régua usou, senão o previsto vira número sem dono.
 */
export function descreverJornada(jornada) {
  const escala = normalizarJornada(jornada);
  const grupos = [];
  for (const d of escala.dias) {
    if (d.previstoMin <= 0) continue;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.previstoMin === d.previstoMin && ultimo.fim === d.dia - 1) {
      ultimo.fim = d.dia;
      continue;
    }
    grupos.push({ inicio: d.dia, fim: d.dia, previstoMin: d.previstoMin });
  }
  if (grupos.length === 0) return "escala sem nenhum dia de trabalho";
  const partes = grupos.map((g) =>
    g.inicio === g.fim
      ? `${duracaoTexto(g.previstoMin)} ${ARTIGO_DIA[g.inicio]} ${NOMES_DIA_SEMANA[g.inicio]}`
      : `${duracaoTexto(g.previstoMin)} de ${NOMES_DIA_SEMANA[g.inicio]} a ${NOMES_DIA_SEMANA[g.fim]}`
  );
  return `${partes.join(" · ")} · ${duracaoTexto(escala.semanaMin)} por semana`;
}

// ---- pontualidade ----------------------------------------------------------

/** CLT art. 58 § 1º: até 5 minutos por marcação. */
export const TOLERANCIA_MARCACAO_MIN = 5;
/** CLT art. 58 § 1º: e no máximo 10 minutos somados no dia. */
export const TOLERANCIA_DIA_MIN = 10;

/**
 * A PONTUALIDADE DO DIA: a batida real contra o começo (e o fim) previstos pela
 * escala.
 *
 * Devolve null quando não dá para medir — dia que a escala não prevê (sábado),
 * dia sem entrada batida, data ilegível. Null é "não medi"; 0 seria "chegou na
 * hora", e afirmar isso sem ter medido é inventar um elogio ou uma acusação.
 *
 * OS DOIS NÚMEROS SAEM SEPARADOS, e é o ponto desta função:
 *
 *  - `atrasoEntradaMin` é o atraso CRU da entrada, COM SINAL: 7 é sete minutos
 *    depois do previsto, −7 é sete minutos antes. É o fato, sem interpretação.
 *
 *  - `atrasoMin` é o que a lei deixa contar. CLT art. 58 § 1º: variações de até
 *    5 minutos por marcação, e no máximo 10 minutos no dia, não são descontadas
 *    nem pagas como extra.
 *
 * POR QUE `atrasoMin` NÃO É `atrasoEntradaMin − 5`: a tolerância não é uma
 * franquia que se abate. Ou a variação cabe nos dois limites e vale ZERO, ou
 * estoura e vale INTEIRA — é a leitura firmada na Súmula 366 do TST
 * ("ultrapassado o limite, será considerada como extra a totalidade do tempo").
 * Abater os 5 minutos daria um terceiro número, que não é nem o fato nem a lei,
 * e é o tipo de número que ninguém consegue defender na mesa de negociação.
 *
 * Os dois limites valem juntos: nenhuma marcação pode passar de 5 E a soma das
 * variações do dia não pode passar de 10. A variação da saída entra pelo mesmo
 * caminho quando há saída batida e fim previsto — sem ela, o limite de 10
 * minutos "no dia" não teria o que somar.
 *
 * ESTE NÚMERO NÃO ENTRA NA SOMA DO MÊS. `apurarCompetencia` mede outra coisa
 * (trabalhado contra previsto, que é o dia inteiro), e somar as duas réguas
 * cobraria o mesmo atraso duas vezes.
 */
export function atrasoDoDia(dia, jornada) {
  const inicioPrevisto = inicioPrevistoDoDia(dia?.data, jornada);
  const fimPrevisto = fimPrevistoDoDia(dia?.data, jornada);
  const entrada = minutosDoRelogio(dia?.entrada);
  const inicio = minutosDoRelogio(inicioPrevisto);
  if (inicio === null || entrada === null) return null;

  const atrasoEntradaMin = entrada - inicio;
  const saida = minutosDoRelogio(dia?.saida);
  const fim = minutosDoRelogio(fimPrevisto);
  /* Positivo = saiu ANTES do previsto (encurta o dia). Null quando falta um dos
     dois lados — sem saída batida não se afirma nada sobre a saída — e também
     quando o dia VIRA A MEIA-NOITE, na escala ou na batida: aí a subtração de
     relógio deixa de descrever o intervalo (saiu 06:00 de um turno que termina
     18:00 daria 12h de "saída antecipada"), e afirmar isso inventaria atraso
     numa noite inteira trabalhada. */
  const viraMeiaNoite = fim !== null && (fim <= inicio || (saida !== null && saida < entrada));
  const saidaAntesMin = saida === null || fim === null || viraMeiaNoite ? null : fim - saida;

  const variacoes = [Math.abs(atrasoEntradaMin)];
  if (saidaAntesMin !== null) variacoes.push(Math.abs(saidaAntesMin));
  const somaVariacoes = variacoes.reduce((s, v) => s + v, 0);
  const tolerado =
    variacoes.every((v) => v <= TOLERANCIA_MARCACAO_MIN) && somaVariacoes <= TOLERANCIA_DIA_MIN;

  // Só o que ENCURTA o dia é atraso; chegar antes ou sair depois é assunto de
  // hora extra, e quem apura hora extra é o relógio.
  const atrasoBrutoMin = Math.max(0, atrasoEntradaMin) + Math.max(0, saidaAntesMin ?? 0);

  return {
    inicioPrevisto,
    fimPrevisto,
    atrasoEntradaMin,
    saidaAntesMin,
    atrasoBrutoMin,
    atrasoMin: tolerado ? 0 : atrasoBrutoMin,
    toleradoMin: tolerado ? atrasoBrutoMin : 0,
    tolerado,
    variacaoTotalMin: somaVariacoes,
  };
}

// ============================================================================
// FALTAS E JUSTIFICATIVAS
// ============================================================================

/**
 * Os tipos de ausência que a casa reconhece, e o que cada um faz com o dinheiro.
 *
 * Pedido do Leonardo (28/08/2026): "quando falta eu posso colocar falta ou então
 * justificada por atestado ou outra coisa". O `motivo` é texto livre de
 * propósito — a palavra de quem estava lá vale mais que uma etiqueta, e uma
 * lista fechada de motivos empurraria todo caso real para "outros".
 *
 * SÓ "falta" DESCONTA, e desconta 1/30 do salário (a mesma régua da decisão 4
 * do topo). Os demais são ausências que a lei ou a empresa abonam:
 *  - atestado: CLT art. 473 e Lei 8.213 art. 60 — os 15 primeiros dias de
 *    afastamento são do empregador, e não se descontam.
 *  - justificada: art. 473 em geral (casamento, falecimento, doação de sangue,
 *    alistamento…), ou outra justificativa que a empresa aceitou.
 *  - ferias e folga: nem falta são.
 *
 * A COR DIZ SE CUSTA DINHEIRO: `chip-bad` só para a falta, que é a única que
 * vira desconto; as outras ficam no chip neutro. O que distingue atestado de
 * férias na linha é a palavra, não a cor — cor demais faz o RH parar de olhar
 * justamente para a que importa.
 */
export const TIPOS_AUSENCIA = [
  {
    tipo: "falta",
    rotulo: "Falta (injustificada)",
    curto: "falta",
    desconta: true,
    chip: "chip-bad",
    ajuda: "Desconta 1/30 do salário por dia no fechamento (decisão do Leonardo, 31/07/2026).",
  },
  {
    tipo: "atestado",
    rotulo: "Atestado médico",
    curto: "atestado",
    desconta: false,
    chip: "chip",
    ajuda: "Não desconta — CLT art. 473 e Lei 8.213 art. 60: os 15 primeiros dias são do empregador.",
  },
  {
    tipo: "justificada",
    rotulo: "Falta justificada",
    curto: "falta justificada",
    desconta: false,
    chip: "chip",
    ajuda: "Outra justificativa aceita pela empresa — art. 473: casamento, falecimento, doação de sangue, alistamento…",
  },
  {
    tipo: "ferias",
    rotulo: "Férias",
    curto: "férias",
    desconta: false,
    chip: "chip",
    ajuda: "Está de férias: não é falta e não desconta.",
  },
  {
    tipo: "folga",
    rotulo: "Folga / compensação",
    curto: "folga",
    desconta: false,
    chip: "chip",
    ajuda: "Folga ou compensação combinada: não desconta.",
  },
];

const TIPO_AUSENCIA_POR_CHAVE = new Map(TIPOS_AUSENCIA.map((t) => [t.tipo, t]));

/**
 * A ausência lançada num dia, já lida, ou null quando não há ausência nenhuma.
 *
 * TIPO QUE ESTA VERSÃO NÃO CONHECE NÃO SOME E NÃO DESCONTA. Descartá-lo em
 * silêncio esconderia o lançamento de alguém (foi assim que uma lista de
 * módulos sumiu calada na Impresilk); cair em "falta" por omissão inventaria
 * desconto na folha. Ele sai marcado com `conhecido: false`, e a apuração o
 * conta à parte para a tela pedir conferência.
 */
export function ausenciaDoDia(dia) {
  const a = dia?.ausencia;
  if (!a || typeof a !== "object") return null;
  const tipo = texto(a.tipo);
  if (!tipo) return null;
  const conhecido = TIPO_AUSENCIA_POR_CHAVE.get(tipo) || null;
  return {
    tipo,
    conhecido: !!conhecido,
    desconta: conhecido ? conhecido.desconta : false,
    rotulo: conhecido ? conhecido.rotulo : `tipo de ausência não reconhecido (${tipo})`,
    curto: conhecido ? conhecido.curto : tipo,
    chip: conhecido ? conhecido.chip : "chip-warn",
    motivo: texto(a.motivo),
    documento: texto(a.documento),
  };
}

function contadorDeAusencias() {
  const porTipo = {};
  for (const t of TIPOS_AUSENCIA) porTipo[t.tipo] = 0;
  return porTipo;
}

// ============================================================================

/**
 * O que as batidas de um mês dizem — a SUGESTÃO que o RH copia (ou não) para o
 * fechamento.
 *
 * Recebe a ESCALA da casa (não mais uma média de horas semanais): o previsto de
 * cada dia sai do dia da semana daquela data. A média mentia duas vezes por
 * semana — na sexta, que tem 8h, e no sábado, que não tem nenhuma.
 *
 * PRECEDÊNCIA (decisão 7 do topo): quando o dia traz a apuração do RELÓGIO
 * (`extraMin`/`extraDobroMin`), é ELA que soma — extra de +50% é a soma de
 * `extraMin`, extra de +100% é a soma de `extraDobroMin`. Só o dia que o
 * relógio não apurou (lançado à mão, corrigido à mão, ou importado antes desta
 * versão) cai na conta antiga, derivada: trabalhado menos o previsto do dia.
 *
 * Por que não refazer sempre a conta derivada: o relógio apura respeitando a
 * escala de cada pessoa, e o dia já apurado ganharia um SEGUNDO resultado. O
 * painel passaria a divergir do que a própria pessoa vê no aplicativo do
 * Jibble, e número que diverge do aplicativo do funcionário não se defende em
 * reunião nenhuma.
 *
 * Dia SEM TOTAL (em aberto) não entra em soma nenhuma — nem no trabalhado, nem
 * nas extras: sai contado à parte, em `diasEmAberto`.
 *
 * AUSÊNCIAS SÃO CONTADAS, NUNCA DEDUZIDAS. O dia com `ausencia` lançada sai
 * contado por tipo, e o que DESCONTA (só "falta") vem separado do que não
 * desconta — quem soma 4 atestados não pode aparecer na tela como quem teve 4
 * faltas. E dia sem batida e SEM ausência lançada não é falta: é "sem
 * registro". Deduzir falta da ausência de linha, numa empresa que acabou de
 * ligar o relógio, seria inventar desconto na folha de gente que trabalhou.
 * Quem afirma falta é o RH, no lançamento — nunca este laço.
 *
 * O que sai null, e por quê nenhum deles é zero:
 *  - `extrasDobroMin` sem NENHUM dia apurado pelo relógio: a dobra fica SEM
 *    APURAÇÃO, porque a conta derivada soma tudo numa faixa só.
 *  - `atrasosMin` sem nenhum dia derivável: o relógio não devolve atraso (a
 *    jornada dele já é a da escala), e afirmar 0 seria dizer "não houve atraso"
 *    sem ter medido.
 *  - `extrasMin` quando não há nem apuração do relógio nem dia derivável.
 *
 * Já as contagens de ausência saem em 0 de verdade: o mês foi percorrido e
 * nenhuma ausência foi lançada — isso é medida, não lacuna.
 */
export function apurarCompetencia(dias, jornada) {
  const escala = normalizarJornada(jornada);
  let diasComBatida = 0;
  let diasEmAberto = 0;
  let trabalhadoMin = 0;
  let diasDoRelogio = 0;
  let diasDerivados = 0;
  let diasSemSaldo = 0;
  let diasForaDaEscala = 0;
  let previstoDerivadoMin = 0;
  let extrasRelogioMin = 0;
  let extrasDobroRelogioMin = 0;
  let extrasDerivadosMin = 0;
  let atrasosDerivadosMin = 0;

  const ausencias = contadorDeAusencias();
  let ausenciasTotal = 0;
  let faltasQueDescontam = 0;
  let ausenciasSemDesconto = 0;
  let ausenciasDesconhecidas = 0;
  let ausenciasComTrabalho = 0;

  for (const d of dias || []) {
    const min = minutosTrabalhados(d);
    const ausencia = ausenciaDoDia(d);

    if (ausencia) {
      ausenciasTotal += 1;
      if (!ausencia.conhecido) ausenciasDesconhecidas += 1;
      else {
        ausencias[ausencia.tipo] += 1;
        if (ausencia.desconta) faltasQueDescontam += 1;
        else ausenciasSemDesconto += 1;
      }
      // Dia de ausência PURA (sem hora trabalhada) fica fora das somas de
      // trabalho: não é dia com batida nem dia em aberto — é dia explicado.
      if (min === null || min === 0) continue;
      // Ausência lançada num dia que TAMBÉM tem hora trabalhada (atestado da
      // tarde, por exemplo): a hora é real e continua somando, e o caso sai
      // contado para a tela pedir conferência — descontar 1/30 de um dia
      // parcialmente trabalhado seria cobrar duas vezes.
      ausenciasComTrabalho += 1;
    }

    // Dia em aberto fica fora de TODA soma — inclusive das horas extras do
    // relógio: dia que não terminou não tem apuração fechada.
    if (min === null) {
      diasEmAberto += 1;
      continue;
    }
    diasComBatida += 1;
    trabalhadoMin += min;

    const apurado = apuracaoDoRelogio(d);
    if (apurado) {
      diasDoRelogio += 1;
      extrasRelogioMin += apurado.extraMin;
      extrasDobroRelogioMin += apurado.extraDobroMin;
      continue;
    }

    diasDerivados += 1;
    const previsto = minutosPrevistosDoDia(d?.data, escala);
    if (previsto === null) {
      // Dia à mão sem data legível: o total trabalhado continua sendo verdade,
      // o saldo é que não existe — e a tela diz que a sugestão saiu incompleta,
      // em vez de mostrar um número que ninguém sabe de onde veio.
      diasSemSaldo += 1;
      continue;
    }
    previstoDerivadoMin += previsto;
    if (previsto === 0) {
      // Trabalho em dia que a escala não prevê (sábado, domingo): tudo é
      // excedente. Entra na faixa de +50% porque é onde a conta derivada sabe
      // pôr — e sai CONTADO em `diasForaDaEscala`, para a tela lembrar que
      // descanso e feriado se pagam em dobro e podem precisar ser movidos à mão.
      diasForaDaEscala += 1;
      extrasDerivadosMin += min;
      continue;
    }
    const saldo = min - previsto;
    if (saldo > 0) extrasDerivadosMin += saldo;
    else atrasosDerivadosMin += -saldo;
  }

  const temRelogio = diasDoRelogio > 0;
  const temDerivado = diasDerivados > diasSemSaldo;

  return {
    diasComBatida,
    diasEmAberto,
    trabalhadoMin: diasComBatida > 0 ? trabalhadoMin : null,
    // De onde veio a sugestão — é isto que a conta escrita repete para quem
    // lê: número do relógio e número do dedo de alguém não se confundem.
    diasDoRelogio,
    diasDerivados,
    diasSemSaldo,
    diasForaDaEscala,
    // A régua que a parte derivada usou, somada: sem ela o saldo é um número
    // sem denominador.
    previstoDerivadoMin: temDerivado ? previstoDerivadoMin : null,
    fonteExtras: temRelogio && temDerivado ? "misto" : temRelogio ? "relogio" : temDerivado ? "manual" : "sem",
    extrasMin:
      temRelogio || temDerivado
        ? (temRelogio ? extrasRelogioMin : 0) + (temDerivado ? extrasDerivadosMin : 0)
        : null,
    extrasRelogioMin: temRelogio ? extrasRelogioMin : null,
    extrasDerivadosMin: temDerivado ? extrasDerivadosMin : null,
    extrasDobroMin: temRelogio ? extrasDobroRelogioMin : null,
    atrasosMin: temDerivado ? atrasosDerivadosMin : null,
    // Ausências: contadas, separadas por efeito no dinheiro.
    ausencias,
    ausenciasTotal,
    faltasQueDescontam,
    ausenciasSemDesconto,
    ausenciasDesconhecidas,
    ausenciasComTrabalho,
  };
}

/**
 * O que foi lançado é o que o relógio apurou, ou é número de gente?
 *
 * Serve para CARIMBAR a procedência no fechamento, na hora de gravar — e o
 * carimbo é que vale depois, não uma comparação refeita na leitura: batida
 * corrigida amanhã mudaria a apuração e a linha de ontem passaria a dizer outra
 * coisa sobre um mês já conferido.
 *
 * Sem apuração do relógio (null), qualquer número lançado é "à mão" — inclusive
 * o que foi copiado da sugestão derivada das batidas, que também é conta desta
 * casa e não do relógio.
 */
export function origemDoLancamento(minutosLancados, minutosApurados) {
  const lancado = numeroOuNulo(minutosLancados);
  const apurado = numeroOuNulo(minutosApurados);
  if (lancado === null) return "sem";
  if (apurado === null) return "manual";
  return Math.round(lancado) === Math.round(apurado) ? "relogio" : "manual";
}

/**
 * Os parâmetros do ponto, vindos da configuração global (chave "ponto").
 *
 * Peneira o que vem do servidor: divisor 0 ou texto viraria divisão por zero e
 * NaN espalhado por toda a coluna de dinheiro. O que não presta cai no padrão
 * da casa, e `definida` conta se a configuração existe — a tela precisa dizer
 * "usando o padrão" em vez de deixar parecer que alguém escolheu 220.
 *
 * `jornada` sai já normalizada (sete dias), e `jornadaDefinida` diz se ela foi
 * escolhida por alguém ou é a escala inicial da casa. São duas perguntas
 * diferentes da mesma configuração, e a tela responde as duas.
 */
export function cfgDoPonto(config) {
  const p = (config && config.ponto) || null;
  const divisor = numeroOuNulo(p?.divisor);
  const fator = numeroOuNulo(p?.fatorHoraExtra);
  const noturno = numeroOuNulo(p?.percentualNoturno);
  const jornada = normalizarJornada(p?.jornada);
  return {
    divisor: divisor !== null && divisor > 0 ? divisor : DIVISOR_MENSAL_PADRAO,
    fatorHoraExtra: fator !== null && fator >= 1 ? fator : FATOR_HE_PADRAO,
    percentualNoturno: noturno !== null && noturno >= 0 ? noturno : PERCENTUAL_NOTURNO_PADRAO,
    jornada,
    jornadaDefinida: !jornada.padrao,
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
 * AS DUAS FAIXAS DE HORA EXTRA SÃO DUAS CONTAS (decisão 8 do topo):
 * `horasExtrasMin` no fator do dia útil (+50%, parametrizável) e
 * `horasExtrasDobroMin` no fator da dobra (+100%), cada uma com seu valor-hora
 * arredondado antes de multiplicar. Somá-las numa quantidade só obrigaria a
 * tela a adivinhar depois qual fator usar — e adivinhar erra em dinheiro.
 *
 * `faltas` é o número de DIAS de falta injustificada, e só ele desconta 1/30.
 * Atestado, justificada, férias e folga são contados pela apuração e NÃO chegam
 * aqui: ausência abonada que virasse desconto é o erro mais caro que esta tela
 * poderia cometer.
 *
 * REGISTRO ANTIGO, sem `horasExtrasDobroMin`, continua valendo: o campo ausente
 * entra como 0. Aqui — e SÓ aqui — ausência é zero de verdade, e não a
 * "ausência que virou zero" que este arquivo inteiro combate: o registro é de
 * antes de existir a faixa de +100%, então não havia dobra a lançar; o que
 * houve foi gravado em `horasExtrasMin`, com o `fatorHoraExtra` carimbado no
 * próprio registro (às vezes 2, quando o mês inteiro era domingo). Não é
 * medição que faltou, é faixa que não existia.
 *
 * Devolve valores separados (as duas faixas de extra, noturno, faltas,
 * atrasos) porque é deles que a tela monta a conta escrita — e porque um total
 * sem as parcelas não se confere.
 */
export function calcularFechamento({
  salario,
  divisor = DIVISOR_MENSAL_PADRAO,
  divisorDiario = DIVISOR_DIARIO,
  fator = FATOR_HE_PADRAO,
  fatorDobro = FATOR_HE_DOBRA,
  percentualNoturno = PERCENTUAL_NOTURNO_PADRAO,
  horasExtrasMin = 0,
  horasExtrasDobroMin = 0,
  faltas = 0,
  atrasosMin = 0,
  adicionalNoturnoMin = 0,
} = {}) {
  const s = numeroOuNulo(salario);
  const d = positivo(divisor) || DIVISOR_MENSAL_PADRAO;
  const dDia = positivo(divisorDiario) || DIVISOR_DIARIO;
  const f = positivo(fator) || FATOR_HE_PADRAO;
  const fDobro = positivo(fatorDobro) || FATOR_HE_DOBRA;
  const pct = Math.max(0, numeroOuNulo(percentualNoturno) ?? PERCENTUAL_NOTURNO_PADRAO);

  const minExtras = Math.max(0, Math.round(positivo(horasExtrasMin)));
  const minExtrasDobro = Math.max(0, Math.round(positivo(horasExtrasDobroMin)));
  const minAtrasos = Math.max(0, Math.round(positivo(atrasosMin)));
  const minNoturno = Math.max(0, Math.round(positivo(adicionalNoturnoMin)));
  const diasFalta = Math.max(0, Math.round(positivo(faltas)));

  const base = {
    divisor: d,
    divisorDiario: dDia,
    fator: f,
    fatorDobro: fDobro,
    percentualNoturno: pct,
    horasExtrasMin: minExtras,
    horasExtrasDobroMin: minExtrasDobro,
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
      valorHoraExtraDobro: null,
      valorAdicionalNoturnoHora: null,
      valorDia: null,
      valorExtras: null,
      valorExtrasDobro: null,
      valorExtrasTotal: null,
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
  // A segunda faixa refaz o MESMO caminho a partir do valor-hora já
  // arredondado: dois fatores, dois valores-hora, duas linhas conferíveis.
  const centHoraExtraDobro = Math.round(centHora * fDobro);
  const centExtrasDobro = Math.round(centHoraExtraDobro * (minExtrasDobro / 60));
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
    valorHoraExtraDobro: centHoraExtraDobro / 100,
    valorAdicionalNoturnoHora: centAdicNoturnoHora / 100,
    valorDia: centDia / 100,
    valorExtras: centExtras / 100,
    valorExtrasDobro: centExtrasDobro / 100,
    // A soma das duas faixas, para quem precisa de UMA linha de hora extra (o
    // carimbo do registro e a planilha). Cada parcela continua ao lado — o
    // total sozinho não se confere.
    valorExtrasTotal: (centExtras + centExtrasDobro) / 100,
    valorNoturno: centNoturno / 100,
    valorFaltasDias: centFaltasDias / 100,
    valorAtrasos: centAtrasos / 100,
    valorFaltas: centDescontos / 100,
    // Pode dar negativo (mais desconto que hora extra) — e negativo é o
    // resultado honesto: a folha do mês desconta.
    valorCalculado: (centExtras + centExtrasDobro + centNoturno - centDescontos) / 100,
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
