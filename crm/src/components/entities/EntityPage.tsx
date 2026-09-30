import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Edit3, Eye, Plus, RefreshCw, Search, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import { formatValue, relationLabel } from '../../lib/format'
import type { EntityConfig, FieldConfig, RowData } from '../../types/crm'
import { Modal } from '../ui/Modal'
import { PageShell } from '../ui/PageShell'

const PAGE_SIZE = 20

type RelationOptions = Record<string, Array<{ value: string; label: string }>>

function toLocalDateTimeInput(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function initialForm(fields: FieldConfig[]) {
  return Object.fromEntries(fields.map(field => [field.key, field.type === 'boolean' ? true : field.type === 'multi_relation' ? [] : ''])) as Record<string, unknown>
}

function agendaStatusFromColeta(status: unknown) {
  const value = String(status ?? '').toUpperCase()
  if (value === 'CANCELADA') return 'CANCELADO'
  if (value === 'COLETADA') return 'REALIZADO'
  if (value === 'EM COLETA') return 'CONFIRMADO'
  return 'AGENDADO'
}

export function EntityPage({ config }: { config: EntityConfig }) {
  const { profile, hasPermission } = useAuth()
  const canWrite = hasPermission(config.writePermission ?? 'crm.write')
  const canDeactivate = hasPermission(config.deactivatePermission ?? 'crm.deactivate') || (config.deactivatePermission == null && hasPermission(config.writePermission ?? 'crm.write'))
  const [rows, setRows] = useState<RowData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>(() => initialForm(config.fields))
  const [saving, setSaving] = useState(false)
  const [relations, setRelations] = useState<RelationOptions>({})

  async function load() {
    setLoading(true); setError(null)
    let request = supabase.from(config.table).select('*').limit(500)
    if (config.softDelete) request = request.is('deleted_at', null)
    const { data, error: loadError } = await request.order(config.orderBy ?? 'created_at', { ascending: false })
    if (loadError) { setError(loadError.message); setRows([]) } else setRows((data ?? []) as RowData[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [config.table])

  useEffect(() => {
    if (!canWrite || (config.canCreate === false && config.canEdit === false)) {
      setRelations({})
      return
    }
    async function loadRelations() {
      const relationFields = config.fields.filter(field => (field.type === 'relation' || field.type === 'multi_relation') && field.relation)
      const next: RelationOptions = {}
      await Promise.all(relationFields.map(async field => {
        const relation = field.relation!
        let request = supabase.from(relation.table).select('*').limit(500)
        if (relation.filter) for (const [key, value] of Object.entries(relation.filter)) request = request.eq(key, value)
        const { data } = await request
        next[field.key] = ((data ?? []) as RowData[]).map(row => ({ value: String(row[relation.valueKey ?? 'id']), label: relationLabel(row, relation.labelKeys) }))
      }))
      setRelations(next)
    }
    void loadRelations()
  }, [config.table, canWrite, config.canCreate, config.canEdit])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalized) return rows
    return rows.filter(row => config.searchKeys.some(key => String(row[key] ?? '').toLocaleLowerCase('pt-BR').includes(normalized)))
  }, [rows, query, config.searchKeys])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openNew() { setEditingId(null); setForm(initialForm(config.fields)); setModalOpen(true) }
  async function openEdit(row: RowData) {
    setEditingId(String(row.id))
    const next = initialForm(config.fields)
    for (const field of config.fields) {
      if (field.type === 'multi_relation' && field.junction) {
        const { data } = await supabase.from(field.junction.table).select(field.junction.relationKey).eq(field.junction.parentKey, String(row.id))
        next[field.key] = (data ?? []).map(item => String((item as unknown as RowData)[field.junction!.relationKey]))
        continue
      }
      const value = row[field.key]
      next[field.key] = field.type === 'datetime' ? toLocalDateTimeInput(value) : (value ?? (field.type === 'boolean' ? false : ''))
    }
    setForm(next); setModalOpen(true)
  }

  async function syncMultiRelations(parentId: string) {
    for (const field of config.fields.filter(f => f.type === 'multi_relation' && f.junction)) {
      const values = Array.isArray(form[field.key]) ? (form[field.key] as unknown[]).map(String) : []
      const junction = field.junction!
      const deleted = await supabase.from(junction.table).delete().eq(junction.parentKey, parentId)
      if (deleted.error) return deleted.error
      if (values.length) {
        const inserted = await supabase.from(junction.table).insert(values.map(value => ({ [junction.parentKey]: parentId, [junction.relationKey]: value })))
        if (inserted.error) return inserted.error
      }
    }
    return null
  }

  async function syncColetaCalendar(coletaId: string) {
    const { data: coleta, error: coletaError } = await supabase
      .from('coletas')
      .select('id,agendamento_id,ordem_servico_id,coletor_id,ocorrida_em,status,observacoes')
      .eq('id', coletaId)
      .single()
    if (coletaError || !coleta) throw new Error(coletaError?.message ?? 'Coleta não encontrada após salvar.')
    if (!coleta.ordem_servico_id || !coleta.ocorrida_em) throw new Error('A coleta precisa ter Ordem de Serviço e data/hora para sincronizar com o Google Agenda.')

    const { data: os, error: osError } = await supabase
      .from('ordens_servico')
      .select('id,cliente_id,numero_os')
      .eq('id', coleta.ordem_servico_id)
      .single()
    if (osError || !os) throw new Error(osError?.message ?? 'Ordem de Serviço não encontrada.')

    let enderecoId: string | null = null
    let enderecoEvento: string | null = null
    if (os.cliente_id) {
      const { data: endereco } = await supabase
        .from('enderecos')
        .select('id,logradouro,numero,complemento,bairro,cidade,uf,cep')
        .eq('cliente_id', os.cliente_id)
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (endereco) {
        enderecoId = endereco.id
        enderecoEvento = [
          [endereco.logradouro, endereco.numero].filter(Boolean).join(', '),
          endereco.complemento,
          endereco.bairro,
          [endereco.cidade, endereco.uf].filter(Boolean).join('/'),
          endereco.cep ? `CEP ${endereco.cep}` : '',
        ].filter(Boolean).join(' - ')
      }
    }

    const agendaPayload = {
      ordem_servico_id: coleta.ordem_servico_id,
      cliente_id: os.cliente_id,
      endereco_id: enderecoId,
      responsavel_id: coleta.coletor_id,
      inicio: coleta.ocorrida_em,
      fim: new Date(new Date(coleta.ocorrida_em).getTime() + 60 * 60 * 1000).toISOString(),
      status: agendaStatusFromColeta(coleta.status),
      titulo: null,
      descricao: coleta.observacoes,
      endereco_evento: enderecoEvento,
    }

    let agendamentoId = coleta.agendamento_id as string | null
    if (agendamentoId) {
      const { error: agendaUpdateError } = await supabase.from('agendamentos').update(agendaPayload).eq('id', agendamentoId)
      if (agendaUpdateError) throw new Error(agendaUpdateError.message)
    } else {
      const { data: agenda, error: agendaInsertError } = await supabase.from('agendamentos').insert(agendaPayload).select('id').single()
      if (agendaInsertError || !agenda) throw new Error(agendaInsertError?.message ?? 'Não foi possível criar o agendamento.')
      agendamentoId = String(agenda.id)
      const { error: linkError } = await supabase.from('coletas').update({ agendamento_id: agendamentoId }).eq('id', coletaId)
      if (linkError) throw new Error(linkError.message)
    }

    const { data: syncData, error: syncError } = await supabase.functions.invoke('google-calendar-sync', {
      body: { agendamento_id: agendamentoId },
    })
    if (syncError) throw new Error(`Google Agenda: ${syncError.message}`)
    if (syncData?.error) throw new Error(`Google Agenda: ${String(syncData.error)}`)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(null)
    const payload: Record<string, unknown> = {}
    for (const field of config.fields) {
      if (field.type === 'multi_relation') continue
      const raw = form[field.key]
      if (field.type === 'number') payload[field.key] = raw === '' ? null : Number(raw)
      else if (field.type === 'boolean') payload[field.key] = Boolean(raw)
      else if (field.type === 'datetime') payload[field.key] = raw === '' ? null : new Date(String(raw)).toISOString()
      else payload[field.key] = raw === '' ? null : raw
    }
    if (profile?.id) {
      if (!editingId && config.hasCreatedBy) payload.created_by = profile.id
      if (editingId && config.hasUpdatedBy) payload.updated_by = profile.id
    }
    let parentId = editingId
    if (editingId) {
      const response = await supabase.from(config.table).update(payload).eq('id', editingId)
      if (response.error) { setError(response.error.message); setSaving(false); return }
    } else {
      const response = await supabase.from(config.table).insert(payload).select('id').single()
      if (response.error) { setError(response.error.message); setSaving(false); return }
      parentId = String(response.data.id)
    }
    if (parentId) {
      const relationError = await syncMultiRelations(parentId)
      if (relationError) { setError(relationError.message); setSaving(false); return }
      if (config.table === 'coletas') {
        try {
          await syncColetaCalendar(parentId)
        } catch (calendarError) {
          setEditingId(parentId)
          setError(`Coleta salva no CRM, mas não foi sincronizada com o Google Agenda. ${calendarError instanceof Error ? calendarError.message : String(calendarError)}`)
          setSaving(false)
          return
        }
      }
    }
    setModalOpen(false); await load(); setSaving(false)
  }

  async function toggleActive(row: RowData) {
    const id = String(row.id)
    const active = Boolean(row.ativo)
    const payload: Record<string, unknown> = { ativo: !active }
    if (profile?.id && config.hasUpdatedBy) payload.updated_by = profile.id
    const { error: updateError } = await supabase.from(config.table).update(payload).eq('id', id)
    if (updateError) setError(updateError.message); else await load()
  }

  return <PageShell title={config.title} description={config.description} action={config.canCreate !== false && canWrite ? <button onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"><Plus className="h-4 w-4"/>Novo {config.singular}</button> : undefined}>
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Pesquisar..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:bg-white"/></div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4"/>Atualizar</button>
      </div>
      {error && <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{config.columns.map(col => <th key={col.key} className="whitespace-nowrap px-5 py-3 font-semibold">{col.label}</th>)}<th className="px-5 py-3 text-right font-semibold">Ações</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={config.columns.length + 1} className="px-5 py-12 text-center text-slate-500">Carregando...</td></tr> : visible.length === 0 ? <tr><td colSpan={config.columns.length + 1} className="px-5 py-12 text-center text-slate-500">Sem dados</td></tr> : visible.map(row => <tr key={String(row.id)} className="hover:bg-slate-50/70">{config.columns.map(col => <td key={col.key} className="max-w-[260px] truncate whitespace-nowrap px-5 py-4 text-slate-700">{col.format === 'status' ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{formatValue(row[col.key])}</span> : formatValue(row[col.key], col.format)}</td>)}<td className="px-5 py-4"><div className="flex justify-end gap-2">{config.detailBasePath && <Link to={`${config.detailBasePath}/${String(row.id)}`} title="Abrir detalhes" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><Eye className="h-4 w-4"/></Link>}{config.canEdit !== false && canWrite && <button onClick={() => void openEdit(row)} title="Editar" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><Edit3 className="h-4 w-4"/></button>}{config.canDeactivate && canDeactivate && 'ativo' in row && <button onClick={() => void toggleActive(row)} title={row.ativo ? 'Inativar' : 'Reativar'} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100">{row.ativo ? <ToggleRight className="h-4 w-4 text-teal-700"/> : <ToggleLeft className="h-4 w-4"/>}</button>}</div></td></tr>)}</tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500"><span>{filtered.length} registro(s)</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Próxima</button></div></div>
    </section>
    <Modal open={modalOpen} title={`${editingId ? 'Editar' : 'Novo'} ${config.singular}`} onClose={() => setModalOpen(false)}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">{config.fields.map(field => <div key={field.key} className={field.width === 'full' || field.type === 'textarea' || field.type === 'multi_relation' ? 'sm:col-span-2' : ''}><span className="mb-1.5 block text-sm font-medium text-slate-700">{field.label}{field.required ? ' *' : ''}</span>{renderField(field, form[field.key], value => setForm(current => ({ ...current, [field.key]: value })), relations[field.key])}</div>)}
        <div className="sm:col-span-2 mt-2 flex justify-end gap-3"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancelar</button><button disabled={saving} className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button></div>
      </form>
    </Modal>
  </PageShell>
}

function renderField(field: FieldConfig, value: unknown, onChange: (value: unknown) => void, relationOptions: Array<{value:string;label:string}> = []) {
  const base = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100'
  if (field.type === 'textarea') return <textarea required={field.required} value={String(value ?? '')} onChange={e => onChange(e.target.value)} rows={4} placeholder={field.placeholder} className={base}/>
  if (field.type === 'select') return <select required={field.required} value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={base}><option value="">Selecione</option>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select>
  if (field.type === 'relation') return <select required={field.required} value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={base}><option value="">Selecione</option>{relationOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
  if (field.type === 'multi_relation') {
    const selected = Array.isArray(value) ? value.map(String) : []
    return <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">{relationOptions.map(option => <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={selected.includes(option.value)} onChange={() => onChange(selected.includes(option.value) ? selected.filter(v => v !== option.value) : [...selected, option.value])} className="h-4 w-4 rounded border-slate-300 text-teal-700"/>{option.label}</label>)}</div>
  }
  if (field.type === 'boolean') return <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} className="mt-3 h-5 w-5 rounded border-slate-300 text-teal-700"/>
  return <input required={field.required} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text'} step={field.type === 'number' ? '0.01' : undefined} value={String(value ?? '')} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={base}/>
}