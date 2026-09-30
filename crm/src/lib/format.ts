export function formatValue(value: unknown, format?: string) {
  if (value === null || value === undefined || value === '') return '—'
  if (format === 'currency') {
    const number = Number(value)
    return Number.isFinite(number) ? number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(value)
  }
  if (format === 'date' || format === 'datetime') {
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) return String(value)
    return format === 'date' ? date.toLocaleDateString('pt-BR') : date.toLocaleString('pt-BR')
  }
  if (format === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

export function relationLabel(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && String(value).trim()) return String(value)
  }
  return String(row.id ?? 'Registro')
}
