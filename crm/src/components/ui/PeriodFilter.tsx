import { Select } from './DesignSystem'
import { MONTHS, type PeriodFilter } from '../../lib/period'

/** Par de seletores Ano + Mês, no padrão dos filtros das páginas. */
export function PeriodSelect({ value, onChange, years, className = '' }: { value: PeriodFilter; onChange: (next: PeriodFilter) => void; years: number[]; className?: string }) {
  return <div className={`flex gap-2 ${className}`.trim()}>
    <Select aria-label="Ano" value={value.year} onChange={e => onChange({ ...value, year: e.target.value })} className="min-w-28">
      <option value="TODOS">Todos os anos</option>
      {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
    </Select>
    <Select aria-label="Mês" value={value.month} onChange={e => onChange({ ...value, month: e.target.value })} className="min-w-36">
      <option value="TODOS">Todos os meses</option>
      {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
    </Select>
  </div>
}
