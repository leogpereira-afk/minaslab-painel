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

import { ausenciaDoDia, diaDeFeriado, minutosTrabalhados } from "./ponto.js";

/* Horas do dia na folha: PELAS BATIDAS (entrada→saída menos o almoço registrado),
   a mesma conta do Fechamento (ponto.js, apurarCompetencia) e do Período.
   Até 04/11/2026 a folha usava o payrollHours do Jibble, e o Jibble desconta 1h
   automática ALÉM do almoço batido: todo dia saía 1h a menos (Ana Claudia,
   02/10: 08:00–12:00 e 13:00–17:41 = 8h41, e a folha mostrava 7h41), e a folha
   não batia com o Fechamento. As horas de afastamento que o relógio PAGOU
   (horasAtestadoMin) continuam somando — menos quando o dia virou FALTA. Sem
   batida nenhuma e sem tracked, o total gravado já traz o que foi pago. */
export function minutosDaFolha(d) {
  if (d?.emAberto === true) return 0;
  const pelasBatidas = minutosTrabalhados({ ...d, trabalhadoMin: undefined });
  if (pelasBatidas === null) return minutosTrabalhados(d) ?? 0;
  /* FALTA NÃO LEVA AS HORAS PAGAS DO RELÓGIO. Quando o RH troca no painel um
     afastamento pago pelo Jibble por "falta", o dia guarda o horasAtestadoMin
     antigo; somá-lo fazia a falta virar horas pagas e até HORA EXTRA (Ana
     Claudia, 01/10/2026: falta com 10h na folha e +2h de saldo). */
  const a = ausenciaDoDia(d);
  const somaAbono = d?.origem === "jibble" && !(a && (a.desconta || a.compensaBanco));
  return pelasBatidas + (somaAbono ? Math.max(0, Number(d?.horasAtestadoMin) || 0) : 0);
}

/* Feriado: o nacional pela data (lei federal) e o municipal pela marca do relógio. A mesma
   regra do Fechamento (ponto.js, diaDeFeriado). */
export function ehFeriado(d) {
  return diaDeFeriado(d);
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
  // Folga paga com o banco: o dia continua previsto, e o que faltou sai do saldo/extras.
  return a && !a.desconta && !a.compensaBanco ? 0 : previstoCheio(d);
}

/* Abonado = ausência que NÃO desconta, num dia que não é feriado. Feriado tem
   regra própria (quem trabalha nele faz extra). */
export function diaAbonado(d) {
  const a = ausenciaDoDia(d);
  return !ehFeriado(d) && Boolean(a) && !a.desconta && !a.compensaBanco;
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
