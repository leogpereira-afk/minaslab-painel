// Filtro de Ano/Mês compartilhado pelas páginas de lista.
// Valores 'TODOS' = sem filtro. Datas comparadas no fuso de São Paulo.

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'] as const

export type PeriodFilter = { year: string; month: string }
export const ALL_PERIOD: PeriodFilter = { year: 'TODOS', month: 'TODOS' }

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })

/** Ano e mês (1–12) de uma data no fuso de São Paulo; aceita 'YYYY-MM-DD' sem deslocar o dia. */
export function yearMonthOf(value: string | Date | null | undefined): { year: number; month: number } | null {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const [year, month] = fmt.format(date).split('-').map(Number)
  return { year, month }
}

/** true quando a data cai no ano/mês escolhido (ou quando não há filtro). Sem data e com filtro ativo = false. */
export function inPeriod(value: string | Date | null | undefined, period: PeriodFilter): boolean {
  if (period.year === 'TODOS' && period.month === 'TODOS') return true
  const ym = yearMonthOf(value)
  if (!ym) return false
  return (period.year === 'TODOS' || ym.year === Number(period.year)) && (period.month === 'TODOS' || ym.month === Number(period.month))
}

/** Parâmetros p_year/p_month para as consultas do banco. */
export function periodParams(period: PeriodFilter): { p_year: number | null; p_month: number | null } {
  return { p_year: period.year === 'TODOS' ? null : Number(period.year), p_month: period.month === 'TODOS' ? null : Number(period.month) }
}

/** Anos para o seletor: do mais recente ao mais antigo, a partir das datas existentes (sempre inclui o ano atual). */
export function yearsFrom(values: Array<string | Date | null | undefined>, fallbackFrom = 2024): number[] {
  const current = new Date().getFullYear()
  const found = new Set<number>([current])
  for (const value of values) { const ym = yearMonthOf(value); if (ym && ym.year >= 2000 && ym.year <= current + 1) found.add(ym.year) }
  if (found.size === 1) for (let y = fallbackFrom; y <= current; y++) found.add(y)
  return [...found].sort((a, b) => b - a)
}
