import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { PageShell } from '../../components/ui/PageShell'
import { supabase } from '../../services/supabase'

type AuditRow = {
  id: string
  actor_user_id: string | null
  table_name: string
  record_id: string | null
  action: string
  source_system: string | null
  importacao_id: string | null
  before_data: unknown
  after_data: unknown
  metadata: unknown
  created_at: string
  profiles?: { nome: string | null } | null
}

export function Auditoria() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('TODAS')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('audit_log')
      .select('id,actor_user_id,table_name,record_id,action,before_data,after_data,source_system,importacao_id,metadata,created_at,profiles(nome)')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) setError(error.message)
    else {
      setError('')
      setRows((data ?? []) as unknown as AuditRow[])
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const actions = useMemo(
    () => ['TODAS', ...Array.from(new Set(rows.map((row) => row.action).filter(Boolean))).sort()],
    [rows],
  )

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesAction = action === 'TODAS' || row.action === action
      const haystack = `${row.table_name} ${row.action} ${row.record_id ?? ''} ${row.source_system ?? ''} ${row.profiles?.nome ?? ''}`.toLowerCase()
      return matchesAction && (!term || haystack.includes(term))
    })
  }, [rows, query, action])

  return (
    <PageShell
      title="Auditoria"
      description="Rastreabilidade das alterações já registradas no audit_log. Esta tela é somente leitura."
      action={
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-600">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      }
    >
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tabela, registro, origem ou usuário" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm" />
          </label>
          <select value={action} onChange={(event) => setAction(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            {actions.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
      </section>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b p-5">
          <ShieldCheck className="h-5 w-5 text-teal-700" />
          <h3 className="font-semibold">Eventos registrados</h3>
          <span className="ml-auto text-xs text-slate-400">{visible.length} exibidos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-5 py-3">Data</th><th className="px-5 py-3">Ação</th><th className="px-5 py-3">Tabela</th><th className="px-5 py-3">Registro</th><th className="px-5 py-3">Usuário</th><th className="px-5 py-3">Origem</th><th className="px-5 py-3">Alteração</th></tr>
            </thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={7} className="p-10 text-center text-slate-500">Carregando auditoria...</td></tr> : visible.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-slate-500">Sem eventos de auditoria para este filtro.</td></tr> : visible.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-5 py-4">{new Date(row.created_at).toLocaleString('pt-BR')}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{row.action}</span></td>
                  <td className="px-5 py-4 font-medium">{row.table_name}</td>
                  <td className="max-w-52 truncate px-5 py-4 text-xs text-slate-500" title={row.record_id ?? ''}>{row.record_id ?? '—'}</td>
                  <td className="px-5 py-4">{row.profiles?.nome || row.actor_user_id || 'Sistema / não informado'}</td>
                  <td className="px-5 py-4">{row.source_system || '—'}</td><td className="max-w-80 px-5 py-4"><details><summary className="cursor-pointer text-xs font-semibold text-teal-700">Ver dados</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-slate-500">{JSON.stringify({antes:row.before_data,depois:row.after_data,metadata:row.metadata},null,2)}</pre></details></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  )
}
