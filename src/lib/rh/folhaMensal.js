// A REGRA DO DIA NA FOLHA DE PONTO MENSAL, fora da tela para ter teste.
//
// Antes (até 28/09/2026) cada conta morava dentro do componente, escrita à
// mão em cinco lugares, e todas combinavam duas funções certas de um jeito
// errado:
//   · minutos(d)  = as horas PAGAS que o relógio informa (payrollHours);
//   · previsto(d) = 0 quando o dia tem ausência abonada (atestado etc.).
// Extra = pagas − previsto. Num atestado de dia inteiro: 8h − 0 = 8h de HORA
// EXTRA e +8h no banco, na folha que a pessoa assina. (Auditoria de 28/09.)
//
// A regra agora (revisada na tarde de 28/09, depois da revisão adversarial):
//   · ausência PURA (sem batida): o dia fica neutro, nem extra nem saldo. As horas
//     pagas pelo atestado não são trabalho a mais, e também não são falta;
//   · ausência num dia que TAMBÉM tem batida: a hora é real e continua somando,
//     como no Fechamento (ponto.js, apurarCompetencia). Se o relógio pagou o
//     atestado dentro da folha (horasAtestadoMin), a conta contra o dia cheio acerta
//     o parcial: 1h14 de batida + 4h pagas = −2h46. Sem saber o tamanho do abono
//     (lançado no painel), ele nunca vira falta: só o que passa do dia cheio conta;
//   · a linha que a folha cria para o dia sem registro (id "vazio_...") não entra em
//     conta nenhuma: quem decide falta é o Fechamento, e o total do mês já a ignorava.
// Dia, semana, mês e acumulado do banco passam por estas funções.
//
// Por que não "previsto cheio" em todo dia abonado: nem todo dia abonado chega com
// as horas pagas. Um atestado lançado no painel, num dia sem batida, chega com 0, e
// com previsto cheio viraria −8h de falta.

import { ausenciaDoDia, minutosTrabalhados } from "./ponto.js";

/* Horas do dia na folha: o payrollHours importado do relógio; dia corrigido à
   mão volta à conta pelas batidas (o total antigo do relógio não descreve mais
   a correção). As horas de atestado que o relógio PAGOU continuam na folha:
   lançar a ausência no painel também marca `corrigido` (só para a importação
   não apagar o lançamento), e sem esta soma o atestado anotado sumia da coluna
   de horas pagas. Sem batida nenhuma, o total gravado já traz o que foi pago. */
export function minutosDaFolha(d) {
  if (d?.emAberto === true) return 0;
  const folha = Number(d?.trabalhadoMin);
  if (d?.corrigido !== true && d?.origem === "jibble" && Number.isFinite(folha) && folha >= 0) return Math.round(folha);
  const pelasBatidas = minutosTrabalhados({ ...d, trabalhadoMin: undefined });
  if (pelasBatidas === null) return minutosTrabalhados(d) ?? 0;
  return pelasBatidas + (d?.origem === "jibble" ? Math.max(0, Number(d?.horasAtestadoMin) || 0) : 0);
}

export function ehFeriado(d) {
  return Boolean(d?.feriado || d?.isHoliday
    || String(d?.tipoDia || "").toLowerCase().includes("feriado")
    || String(d?.ocorrencia || "").toLowerCase().includes("feriado"));
}

/* Régua confirmada pela MinasLab para esta folha: almoço fora do trabalho;
   8h líquidas de segunda a quinta e 7h na sexta. O dia "cheio" da escala, sem
   olhar ausência: é o que o abono cobre. */
export function previstoCheio(d) {
  if (ehFeriado(d)) return 0;
  const dia = new Date(String(d?.data || "") + "T12:00:00").getDay();
  return dia >= 1 && dia <= 4 ? 480 : dia === 5 ? 420 : 0;
}

/* O previsto que a folha mostra: zero no dia abonado e no feriado. */
export function previstoDoDia(d) {
  const a = ausenciaDoDia(d);
  return a && !a.desconta ? 0 : previstoCheio(d);
}

/* Abonado = ausência que NÃO desconta, num dia que não é feriado. Feriado tem
   regra própria (quem trabalha nele faz extra). */
export function diaAbonado(d) {
  const a = ausenciaDoDia(d);
  return !ehFeriado(d) && Boolean(a) && !a.desconta;
}

export const linhaSemRegistro = (d) => String(d?.id || "").startsWith("vazio_");

function saldoAbonado(d) {
  const trabalhou = (minutosTrabalhados(d) ?? 0) > 0;
  if (!trabalhou) return 0;
  const contaCheia = minutosDaFolha(d) - previstoCheio(d);
  const pagoPeloRelogio = Number(d?.horasAtestadoMin) > 0 && d?.origem === "jibble";
  return pagoPeloRelogio ? contaCheia : Math.max(0, contaCheia);
}

/* No dia abonado as horas pagas contam como normais até o dia cheio: assim
   HRS FOLHA PAG. = HRS NORMAIS + HORAS EXTRAS também nesse dia. */
export const normaisDoDia = (d) =>
  linhaSemRegistro(d) ? 0 : Math.min(minutosDaFolha(d), diaAbonado(d) ? previstoCheio(d) : previstoDoDia(d));
export const saldoDoDia = (d) =>
  linhaSemRegistro(d) ? 0 : diaAbonado(d) ? saldoAbonado(d) : minutosDaFolha(d) - previstoDoDia(d);
export const extraDoDia = (d) => Math.max(0, saldoDoDia(d));
