import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarClock, ClipboardCheck, Eye, Gavel, SearchX, Target, Trophy } from 'lucide-react'
import { Badge, Card, CardBody } from '../../components/ui/DesignSystem'
import { supabase } from '../../services/supabase'
import { periodLabel, type PeriodFilter } from '../../lib/period'
import { sourceTargets } from './fontes'

type Bid = { id: string; numero: string; orgao: string; objeto: string; status: string; data_sessao: string | null; valor_estimado: number | null; valor_proposta: number | null; valor_homologado: number | null; responsavel_id: string | null }
type Option = { value: string; label: string }
type Consulta = { fonte: string; data_consulta: string; status: 'VERIFICADO' | 'SEM_LICITACAO' }

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const dateBr = (v: string) => { const [y, m, d] = v.slice(0, 10).split('-'); return `${d}/${m}/${y}` }
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) }
const statusOrder = ['MONITORAMENTO', 'ANALISE', 'PREPARACAO', 'PROPOSTA_ENVIADA', 'SESSAO', 'HABILITACAO', 'ADJUDICADA', 'GANHA', 'PERDIDA', 'CANCELADA']
const closed = ['GANHA', 'PERDIDA', 'CANCELADA']

function Kpi({ icon: Icon, label, value, hint, onClick }: { icon: typeof Gavel; label: string; value: string; hint?: string; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="flex h-full items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></span>
    <span className="min-w-0"><span className="block text-xs text-slate-500">{label}</span><strong className="mt-1 block truncate text-xl text-slate-900">{value}</strong>{hint && <span className="block text-[11px] text-slate-400">{hint}</span>}</span>
  </button>
}

/** Primeira aba de Licitações: visão geral do período, próximas sessões e situação das consultas às fontes. */
export function PainelLicitacoes<T extends Bid>({ rows, periodRows, period, profiles, openTab, openBid }: { rows: T[]; periodRows: T[]; period: PeriodFilter; profiles: Option[]; openTab: (t: 'licitacoes' | 'radar' | 'consultas' | 'pncp') => void; openBid: (b: T) => void }) {
  const [consultas, setConsultas] = useState<Consulta[]>([])
  useEffect(() => {
    void supabase.from('licitacao_consultas').select('fonte,data_consulta,status').order('data_consulta', { ascending: false }).limit(2000)
      .then(({ data }) => setConsultas((data ?? []) as Consulta[]))
  }, [])

  const label = periodLabel(period)
  const now = Date.now()
  const stats = useMemo(() => {
    const won = periodRows.filter(x => x.status === 'GANHA')
    const finished = periodRows.filter(x => x.status === 'GANHA' || x.status === 'PERDIDA').length
    return {
      open: periodRows.filter(x => !closed.includes(x.status)).length,
      won: won.length,
      value: won.reduce((n, x) => n + (x.valor_homologado ?? x.valor_proposta ?? 0), 0),
      rate: finished ? Math.round((won.length * 100) / finished) : 0,
      next7: rows.filter(x => x.data_sessao && new Date(x.data_sessao).getTime() >= now && new Date(x.data_sessao).getTime() - now <= 7 * 864e5).length,
    }
  }, [rows, periodRows, now])
  const upcoming = useMemo(() => rows.filter(x => x.data_sessao && new Date(x.data_sessao).getTime() >= now && !closed.includes(x.status)).sort((a, b) => String(a.data_sessao).localeCompare(String(b.data_sessao))).slice(0, 6), [rows, now])
  const byStatus = useMemo(() => statusOrder.map(s => ({ s, n: periodRows.filter(x => x.status === s).length })).filter(x => x.n > 0), [periodRows])
  const maxStatus = Math.max(1, ...byStatus.map(x => x.n))

  const last = useMemo(() => { const m = new Map<string, Consulta>(); for (const c of consultas) if (!m.has(c.fonte)) m.set(c.fonte, c); return m }, [consultas])
  const fontes = sourceTargets.map(t => ({ ...t, last: last.get(t.label) }))
  const hoje = today(), semana = daysAgo(7)
  const consultadasHoje = fontes.filter(f => f.last?.data_consulta === hoje).length
  const atrasadas = fontes.filter(f => !f.last || f.last.data_consulta < semana)
  const comLicitacao = fontes.filter(f => f.last?.status === 'VERIFICADO' && f.last.data_consulta >= semana)
  const person = (id: string | null) => profiles.find(p => p.value === id)?.label ?? 'Não definido'

  return <div className="space-y-5">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi icon={Gavel} label={`Em andamento — ${label}`} value={String(stats.open)} onClick={() => openTab('licitacoes')} />
      <Kpi icon={Bell} label="Sessões nos próximos 7 dias" value={String(stats.next7)} hint="todas as licitações" onClick={() => openTab('licitacoes')} />
      <Kpi icon={Trophy} label={`Ganhas — ${label}`} value={String(stats.won)} hint={`taxa de vitória ${stats.rate}%`} onClick={() => openTab('licitacoes')} />
      <Kpi icon={Target} label={`Valor homologado — ${label}`} value={brl.format(stats.value)} onClick={() => openTab('licitacoes')} />
      <Kpi icon={ClipboardCheck} label="Fontes consultadas hoje" value={`${consultadasHoje} de ${fontes.length}`} hint={`${atrasadas.length} sem consulta há mais de 7 dias`} onClick={() => openTab('consultas')} />
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <Card><CardBody>
        <div className="mb-3 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-teal-700" /><h3 className="font-bold text-slate-900">Próximas sessões</h3></div>
        {upcoming.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Nenhuma sessão marcada.</p> :
          <ul className="divide-y divide-slate-100">{upcoming.map(x => <li key={x.id}><button type="button" onClick={() => openBid(x)} className="flex w-full items-start justify-between gap-3 py-2.5 text-left hover:bg-slate-50">
            <span className="min-w-0"><b className="text-sm text-slate-900">{x.numero} · {x.orgao}</b><span className="block truncate text-xs text-slate-500">{x.objeto}</span><span className="block text-[11px] text-slate-400">{person(x.responsavel_id)}</span></span>
            <span className="shrink-0 text-right text-xs font-semibold text-slate-700">{new Date(String(x.data_sessao)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}<span className="mt-1 block"><Badge variant="warning">{x.status.replaceAll('_', ' ')}</Badge></span></span>
          </button></li>)}</ul>}
      </CardBody></Card>

      <Card><CardBody>
        <div className="mb-3 flex items-center gap-2"><Gavel className="h-5 w-5 text-teal-700" /><h3 className="font-bold text-slate-900">Licitações por etapa — {label}</h3></div>
        {byStatus.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Nenhuma licitação no período.</p> :
          <div className="space-y-2">{byStatus.map(x => <div key={x.s} className="grid grid-cols-[140px_1fr_32px] items-center gap-2 text-sm">
            <span className="truncate text-slate-600">{x.s.replaceAll('_', ' ')}</span>
            <span className="h-3 rounded-full bg-slate-100"><span className={`block h-3 rounded-full ${x.s === 'GANHA' ? 'bg-emerald-500' : x.s === 'PERDIDA' || x.s === 'CANCELADA' ? 'bg-red-400' : 'bg-teal-600'}`} style={{ width: `${(x.n / maxStatus) * 100}%` }} /></span>
            <span className="text-right font-semibold text-slate-900">{x.n}</span>
          </div>)}</div>}
      </CardBody></Card>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <Card><CardBody>
        <div className="mb-3 flex items-center justify-between gap-2"><span className="flex items-center gap-2"><SearchX className="h-5 w-5 text-teal-700" /><h3 className="font-bold text-slate-900">Fontes para consultar</h3></span><button type="button" onClick={() => openTab('radar')} className="text-xs font-semibold text-teal-700 hover:underline">Abrir radar</button></div>
        <p className="mb-2 text-xs text-slate-500">Sem consulta registrada nos últimos 7 dias.</p>
        {atrasadas.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Todas as fontes foram consultadas nesta semana.</p> :
          <ul className="grid gap-1.5 sm:grid-cols-2">{atrasadas.slice(0, 14).map(f => <li key={f.url + f.label} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 text-xs"><a href={f.url} target="_blank" rel="noreferrer" className="truncate font-medium text-teal-700 hover:underline">{f.label}</a><span className="shrink-0 text-slate-400">{f.last ? dateBr(f.last.data_consulta) : 'nunca'}</span></li>)}</ul>}
        {atrasadas.length > 14 && <p className="mt-2 text-xs text-slate-500">e mais {atrasadas.length - 14} fontes.</p>}
      </CardBody></Card>

      <Card><CardBody>
        <div className="mb-3 flex items-center justify-between gap-2"><span className="flex items-center gap-2"><Eye className="h-5 w-5 text-teal-700" /><h3 className="font-bold text-slate-900">Fontes com licitação na semana</h3></span><button type="button" onClick={() => openTab('consultas')} className="text-xs font-semibold text-teal-700 hover:underline">Ver consultas</button></div>
        {comLicitacao.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Nenhuma consulta com licitação encontrada nos últimos 7 dias.</p> :
          <ul className="divide-y divide-slate-100">{comLicitacao.map(f => <li key={f.url + f.label} className="flex items-center justify-between gap-2 py-2 text-sm"><a href={f.url} target="_blank" rel="noreferrer" className="font-medium text-teal-700 hover:underline">{f.label}</a><span className="text-xs text-slate-500">{f.last ? dateBr(f.last.data_consulta) : ''} · Verificado</span></li>)}</ul>}
      </CardBody></Card>
    </section>
  </div>
}
