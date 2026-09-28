// A REGRA DO DIA NA FOLHA DE PONTO MENSAL — fora da tela, para ter teste.
//
// Antes (até 28/09/2026) cada conta morava dentro do componente, escrita à
// mão em cinco lugares, e todas combinavam duas funções certas de um jeito
// errado:
//   · minutos(d)  = as horas PAGAS que o relógio informa (payrollHours);
//   · previsto(d) = 0 quando o dia tem ausência abonada (atestado etc.).
// Extra = pagas − previsto. Num atestado de dia inteiro: 8h − 0 = 8h de HORA
// EXTRA e +8h no banco — na folha que a pessoa assina. (Auditoria de 28/09.)
//
// A regra agora: DIA ABONADO NÃO GERA EXTRA NEM SALDO. As horas pagas pelo
// atestado não são trabalho a mais, e também não são falta. Fica neutro. Isso
// vale para o dia, para a semana e para o mês, porque as três contas passam
// por estas funções — e para o acumulado anterior do banco de horas.
//
// Por que neutro, e não "previsto cheio": nem todo dia abonado chega com as
// horas pagas. Um atestado lançado no painel, num dia sem batida, chega com 0.
// Com previsto cheio ele viraria −8h de falta. Neutro não inventa hora em
// nenhum dos dois casos. (O pedaço não coberto de um atestado PARCIAL é
// assunto do Fechamento, não desta folha.)

import { ausenciaDoDia, minutosTrabalhados } from "./ponto.js";

/* Horas do dia na folha: o payrollHours importado do relógio; dia corrigido à
   mão volta à conta pelas batidas (o total antigo do relógio não descreve mais
   a correção). Mesma regra que morava no componente. */
export function minutosDaFolha(d) {
  if (d?.emAberto === true) return 0;
  const folha = Number(d?.trabalhadoMin);
  if (d?.corrigido !== true && d?.origem === "jibble" && Number.isFinite(folha) && folha >= 0) return Math.round(folha);
  return minutosTrabalhados(d) ?? 0;
}

export function ehFeriado(d) {
  return Boolean(d?.feriado || d?.isHoliday
    || String(d?.tipoDia || "").toLowerCase().includes("feriado")
    || String(d?.ocorrencia || "").toLowerCase().includes("feriado"));
}

/* Régua confirmada pela MinasLab para esta folha: almoço fora do trabalho;
   8h líquidas de segunda a quinta e 7h na sexta. */
export function previstoDoDia(d) {
  const a = ausenciaDoDia(d);
  if (ehFeriado(d) || (a && !a.desconta)) return 0;
  const dia = new Date(String(d?.data || "") + "T12:00:00").getDay();
  return dia >= 1 && dia <= 4 ? 480 : dia === 5 ? 420 : 0;
}

/* Abonado = ausência que NÃO desconta, num dia que não é feriado. Feriado tem
   regra própria (quem trabalha nele faz extra). */
export function diaAbonado(d) {
  const a = ausenciaDoDia(d);
  return !ehFeriado(d) && Boolean(a) && !a.desconta;
}

export const normaisDoDia = (d) => Math.min(minutosDaFolha(d), previstoDoDia(d));
export const extraDoDia = (d) => (diaAbonado(d) ? 0 : Math.max(0, minutosDaFolha(d) - previstoDoDia(d)));
export const saldoDoDia = (d) => (diaAbonado(d) ? 0 : minutosDaFolha(d) - previstoDoDia(d));
