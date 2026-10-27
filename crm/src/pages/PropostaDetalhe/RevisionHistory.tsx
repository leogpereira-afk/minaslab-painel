import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { formatValue } from '../../lib/format'

type Revision = {
  id: string
  versao: number
  gerencialab_id: number | null
  status_gerencialab: string | null
  status: string | null
  responsavel_nome: string | null
  solicitante: string | null
  valor: number | null
  data_criacao: string | null
  data_validade: string | null
  data_aceite: string | null
  grupos: string[] | null
  atual: boolean
}

const statusTone: Record<string, string> = {
  APROVADA: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ENVIADA: 'border-sky-200 bg-sky-50 text-sky-700',
  RASCUNHO: 'border-slate-200 bg-slate-50 text-slate-600',
  REVISADA: 'border-amber-200 bg-amber-50 text-amber-700',
  CANCELADA: 'border-red-200 bg-red-50 text-red-700',
  RECUSADA: 'border-red-200 bg-red-50 text-red-700',
}

function dateOnly(value: string | null) {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Histórico de versões (revisões) da proposta vindas do GerenciaLab. Não aparece se a proposta não tiver revisões. */
export function RevisionHistory({ proposalId }: { proposalId: string }) {
  const [rows, setRows] = useState<Revision[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void supabase
      .from('proposta_revisoes')
      .select('id,versao,gerencialab_id,status_gerencialab,status,responsavel_nome,solicitante,valor,data_criacao,data_validade,data_aceite,grupos,atual')
      .eq('proposta_id', proposalId)
      .order('versao', { ascending: false })
      .order('gerencialab_id', { ascending: false })
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) setError(e.message)
        else setRows((data ?? []) as Revision[])
      })
    return () => { alive = false }
  }, [proposalId])

  if (!rows.length && !error) return null

  return <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center gap-3 border-b border-slate-100 p-5">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-50 text-teal-700"><History className="h-5 w-5" /></span>
      <div>
        <h3 className="font-semibold text-slate-900">Histórico de revisões</h3>
        <p className="text-sm text-slate-500">Versões da proposta no GerenciaLab. A versão vigente é a que aparece nos dados da proposta.</p>
      </div>
    </div>
    {error && <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Revisão</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Criação</th>
            <th className="px-5 py-3">Aceite</th>
            <th className="px-5 py-3">Responsável</th>
            <th className="px-5 py-3">Escopo</th>
            <th className="px-5 py-3 text-right">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(r => <tr key={r.id} className={r.atual ? 'bg-teal-50/40' : ''}>
            <td className="px-5 py-3 font-semibold text-slate-800">
              Rev. {r.versao}
              {r.atual && <span className="ml-2 rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-semibold text-white">Vigente</span>}
              {r.gerencialab_id != null && <div className="text-xs font-normal text-slate-400">ID GerenciaLab {r.gerencialab_id}</div>}
            </td>
            <td className="px-5 py-3">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone[r.status ?? ''] ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}>{r.status ?? '—'}</span>
              {r.status_gerencialab && <div className="mt-1 text-xs text-slate-400">{r.status_gerencialab}</div>}
            </td>
            <td className="px-5 py-3 text-slate-700">{dateOnly(r.data_criacao)}<div className="text-xs text-slate-400">Validade {dateOnly(r.data_validade)}</div></td>
            <td className="px-5 py-3 text-slate-700">{r.data_aceite ? formatValue(r.data_aceite, 'datetime') : '—'}</td>
            <td className="px-5 py-3 text-slate-700">{r.responsavel_nome ?? '—'}{r.solicitante && <div className="text-xs text-slate-400">Solicitante: {r.solicitante}</div>}</td>
            <td className="px-5 py-3 text-slate-700">{r.grupos?.length ? r.grupos.join(', ') : '—'}</td>
            <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatValue(r.valor, 'currency')}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>
}
