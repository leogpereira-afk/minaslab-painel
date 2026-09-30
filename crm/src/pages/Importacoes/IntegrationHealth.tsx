import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, RotateCcw } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../services/supabase'

type ScheduleRow = {
  id: string
  titulo: string | null
  inicio: string
  status: string | null
  external_calendar_id: string | null
}

async function withTimeout<T>(promise: Promise<T>, milliseconds = 15000): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Tempo limite excedido')), milliseconds)),
  ])
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR')
}

export function IntegrationHealth() {
  const { hasPermission } = useAuth()
  const canRetry = hasPermission('crm.write') || hasPermission('admin.manage')
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load(manual = false) {
    if (manual) setRefreshing(true)
    else setLoading(true)
    setError('')
    const { data, error: loadError } = await supabase
      .from('agendamentos')
      .select('id,titulo,inicio,status,external_calendar_id')
      .is('deleted_at', null)
      .order('inicio', { ascending: false })
      .limit(500)

    if (loadError) setError(loadError.message)
    else setRows((data ?? []) as ScheduleRow[])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { void load() }, [])

  const synced = useMemo(() => rows.filter(row => !!row.external_calendar_id), [rows])
  const pending = useMemo(() => rows.filter(row => !row.external_calendar_id), [rows])
  const cancelledPending = useMemo(() => pending.filter(row => row.status === 'CANCELADO'), [pending])
  const actionablePending = useMemo(() => pending.filter(row => row.status !== 'CANCELADO'), [pending])

  async function retry(row: ScheduleRow) {
    if (!canRetry || retryingId) return
    setRetryingId(row.id)
    setError('')
    setMessage('')
    try {
      const sync = await withTimeout(supabase.functions.invoke('google-calendar-sync', { body: { agendamento_id: row.id } }))
      const syncError = (sync.data as { error?: string } | null)?.error
      if (sync.error || syncError) throw new Error(sync.error?.message || syncError || 'Falha ao sincronizar.')
      setMessage(`Agendamento ${row.titulo || row.id} sincronizado com sucesso.`)
      await load()
    } catch (retryError) {
      setError(`A sincronização não foi concluída. O mesmo agendamento foi preservado para nova tentativa. ${retryError instanceof Error ? retryError.message : String(retryError)}`)
    } finally {
      setRetryingId(null)
    }
  }

  return <section className="ds-card space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="ds-section-title">Saúde da sincronização do Google Agenda</h2>
        <p className="mt-1 text-sm text-ink-500">Leitura dos agendamentos reais do CRM. Pendências podem ser reprocessadas usando o mesmo identificador interno.</p>
      </div>
      <button type="button" onClick={() => void load(true)} disabled={refreshing} className="ds-button ds-button-secondary">
        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}/>{refreshing ? 'Atualizando...' : 'Atualizar'}
      </button>
    </div>

    {error && <div className="rounded-lg border border-danger/20 bg-danger-soft p-3 text-sm text-danger">{error}</div>}
    {message && <div className="rounded-lg border border-success/20 bg-success-soft p-3 text-sm text-success">{message}</div>}

    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Agendamentos lidos" value={rows.length} loading={loading}/>
      <Metric label="Sincronizados" value={synced.length} loading={loading} ok/>
      <Metric label="Pendentes de sincronização" value={actionablePending.length} loading={loading} warning={actionablePending.length > 0}/>
    </div>

    {!loading && cancelledPending.length > 0 && <p className="text-xs text-ink-500">Há {cancelledPending.length} agendamento(s) cancelado(s) sem ID externo; eles não entram na fila de ação principal.</p>}

    {!loading && actionablePending.length === 0 ? <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-soft p-4 text-sm text-success"><CheckCircle2 className="h-4 w-4"/>Nenhum agendamento ativo está pendente de sincronização.</div> : null}

    {!loading && actionablePending.length > 0 ? <div className="overflow-x-auto rounded-xl border border-border-ui">
      <table className="min-w-full text-sm">
        <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-500"><tr><th className="px-4 py-3">Agendamento</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
        <tbody className="divide-y divide-border-ui">{actionablePending.slice(0, 20).map(row => <tr key={row.id}><td className="px-4 py-3 font-medium text-ink-800">{row.titulo || 'Agendamento sem título'}</td><td className="px-4 py-3 text-ink-600">{formatDate(row.inicio)}</td><td className="px-4 py-3"><span className="ds-badge ds-badge-warning">{row.status || 'AGENDADO'}</span></td><td className="px-4 py-3 text-right">{canRetry ? <button type="button" onClick={() => void retry(row)} disabled={retryingId !== null} className="ds-button ds-button-secondary"><RotateCcw className={`h-4 w-4 ${retryingId === row.id ? 'animate-spin' : ''}`}/>{retryingId === row.id ? 'Sincronizando...' : 'Ressincronizar'}</button> : <span className="text-xs text-ink-400">Sem permissão de escrita</span>}</td></tr>)}</tbody>
      </table>
    </div> : null}

    {!loading && actionablePending.length > 20 ? <div className="flex items-center gap-2 text-xs text-warning"><AlertTriangle className="h-4 w-4"/>Mostrando as 20 pendências mais recentes de {actionablePending.length}. Use a Agenda para consultar o restante.</div> : null}
  </section>
}

function Metric({ label, value, loading, ok = false, warning = false }: { label: string; value: number; loading: boolean; ok?: boolean; warning?: boolean }) {
  const tone = warning ? 'text-warning' : ok ? 'text-success' : 'text-ink-800'
  const Icon = warning ? AlertTriangle : CheckCircle2
  return <div className="flex h-20 items-center gap-3 rounded-3xl border border-border-ui bg-white p-4 shadow-sm"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${warning?'bg-amber-50 text-warning':ok?'bg-emerald-50 text-success':'bg-teal-50 text-teal-700'}`}><Icon className="h-5 w-5"/></span><div className="min-w-0"><div className="text-xs text-ink-500">{label}</div><div className={`mt-1 truncate text-xl font-bold ${tone}`}>{loading ? '…' : value}</div></div></div>
}
