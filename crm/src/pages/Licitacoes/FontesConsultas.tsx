import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, ClipboardCheck, ExternalLink, Plus, SearchX, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Badge, Button, Card, CardBody, FieldLabel, Input, Select } from '../../components/ui/DesignSystem'
import { supabase } from '../../services/supabase'
import { opportunitySources, sourceTargets, type SourceLink } from './fontes'

type Option = { value: string; label: string }
type Consulta = { id: string; fonte: string; fonte_url: string | null; data_consulta: string; status: 'VERIFICADO' | 'SEM_LICITACAO'; observacao: string | null; responsavel_id: string | null; created_by: string | null; created_at: string }
type ConsultaForm = { fonte: string; outra: string; data_consulta: string; status: 'VERIFICADO' | 'SEM_LICITACAO'; observacao: string; responsavel_id: string }

const OUTRA = '__OUTRA__'
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const dateBr = (v: string) => { const [y, m, d] = v.slice(0, 10).split('-'); return `${d}/${m}/${y}` }
const statusLabel = (s: Consulta['status']) => s === 'SEM_LICITACAO' ? 'Sem licitação' : 'Verificado'
const emptyForm = (fonte = '', userId: string | null = null): ConsultaForm => ({ fonte, outra: '', data_consulta: today(), status: 'SEM_LICITACAO', observacao: '', responsavel_id: userId ?? '' })

function LastCheck({ c }: { c: Consulta | undefined }) {
  if (!c) return <span className="text-[11px] text-slate-400">Ainda não consultado</span>
  return <span className={`text-[11px] font-medium ${c.status === 'SEM_LICITACAO' ? 'text-slate-500' : 'text-emerald-700'}`}>{dateBr(c.data_consulta)} · {statusLabel(c.status)}</span>
}

/** Radar de fontes + registro das consultas feitas em cada fonte (data e resultado). */
export function FontesConsultas({ canWrite, profiles, userId }: { canWrite: boolean; profiles: Option[]; userId: string | null }) {
  const [rows, setRows] = useState<Consulta[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ConsultaForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [fonteFiltro, setFonteFiltro] = useState('TODAS')
  const [limit, setLimit] = useState(20)

  const load = useCallback(async () => {
    const r = await supabase.from('licitacao_consultas').select('id,fonte,fonte_url,data_consulta,status,observacao,responsavel_id,created_by,created_at').order('data_consulta', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
    if (r.error) setError(r.error.message); else { setError(''); setRows((r.data ?? []) as Consulta[]) }
  }, [])
  useEffect(() => { void load() }, [load])

  const last = useMemo(() => { const m = new Map<string, Consulta>(); for (const c of rows) if (!m.has(c.fonte)) m.set(c.fonte, c); return m }, [rows])
  const fontesUsadas = useMemo(() => [...new Set(rows.map(r => r.fonte))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [rows])
  const lista = useMemo(() => rows.filter(r => fonteFiltro === 'TODAS' || r.fonte === fonteFiltro), [rows, fonteFiltro])
  const person = (id: string | null) => profiles.find(p => p.value === id)?.label ?? '—'

  function registrar(fonte = '') { setForm(emptyForm(fonte, userId)); setError(''); setOpen(true) }
  async function save(e: FormEvent) {
    e.preventDefault()
    const fonte = form.fonte === OUTRA ? form.outra.trim() : form.fonte
    if (!fonte) { setError('Informe a fonte consultada.'); return }
    setSaving(true)
    const target: SourceLink | undefined = sourceTargets.find(t => t.label === fonte)
    const r = await supabase.from('licitacao_consultas').insert({ fonte, fonte_url: target?.url ?? null, data_consulta: form.data_consulta || today(), status: form.status, observacao: form.observacao.trim() || null, responsavel_id: form.responsavel_id || null })
    setSaving(false)
    if (r.error) { setError(r.error.message); return }
    setOpen(false); await load()
  }
  async function remove(c: Consulta) {
    if (!confirm(`Excluir a consulta de ${c.fonte} em ${dateBr(c.data_consulta)}?`)) return
    const r = await supabase.from('licitacao_consultas').delete().eq('id', c.id)
    if (r.error) setError(r.error.message); else await load()
  }

  const total = sourceTargets.length
  const consultadasHoje = sourceTargets.filter(t => last.get(t.label)?.data_consulta === today()).length

  return <>
    <Card><CardBody><details>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div><div className="font-bold text-slate-900">Radar de oportunidades públicas</div><p className="mt-1 text-sm text-slate-500">Atalhos para órgãos e entidades com potencial de contratação dos serviços da MinasLab, com a data da última consulta de cada fonte.</p></div>
        <span className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-teal-700">Ver {total} fontes · {consultadasHoje} consultadas hoje</span>
      </summary>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">{opportunitySources.map(source => {
        const badge = <span className={`mt-0.5 rounded-full px-2 py-1 text-[10px] font-bold ${source.priority === 'ALTA' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{source.priority === 'ALTA' ? 'ALTA' : 'MÉDIA'}</span>
        const links = source.links ?? (source.url ? [{ label: source.name, url: source.url }] : [])
        return <div key={source.name} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">{badge}<span className="min-w-0 flex-1">
          <b className="text-sm text-slate-900">{source.name}</b>
          <span className="mt-1 block text-xs leading-relaxed text-slate-500">{source.scope}</span>
          <span className="mt-2 grid gap-1.5">{links.map(link => <span key={link.url} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
            <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">{link.label}<ExternalLink className="h-3 w-3" /></a>
            <span className="flex items-center gap-2"><LastCheck c={last.get(link.label)} />{canWrite && <button type="button" onClick={() => registrar(link.label)} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-teal-300 hover:text-teal-700">Registrar consulta</button>}</span>
          </span>)}</span>
        </span></div>
      })}</div>
      <p className="mt-4 text-xs text-slate-500">Nos portais gerais, pesquise pelo nome do órgão e por termos como análise de água, potabilidade, efluentes, microbiologia e monitoramento ambiental.</p>
    </details></CardBody></Card>

    <Card><CardBody>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-teal-50 text-teal-700"><ClipboardCheck className="h-5 w-5" /></span><div><div className="font-bold text-slate-900">Consultas às fontes</div><p className="text-sm text-slate-500">Registro de quando cada fonte foi olhada e o que foi encontrado.</p></div></div>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Fonte" value={fonteFiltro} onChange={e => setFonteFiltro(e.target.value)} className="min-w-52"><option value="TODAS">Todas as fontes</option>{fontesUsadas.map(f => <option key={f} value={f}>{f}</option>)}</Select>
          {canWrite && <Button onClick={() => registrar()}><Plus className="h-4 w-4" />Registrar consulta</Button>}
        </div>
      </div>
      {error && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Fonte</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Observação</th>{canWrite && <th className="px-4 py-3" />}</tr></thead>
        <tbody>{lista.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhuma consulta registrada ainda.</td></tr> : lista.slice(0, limit).map(c => <tr key={c.id} className="border-b border-slate-100 last:border-0">
          <td className="whitespace-nowrap px-4 py-3 font-medium">{dateBr(c.data_consulta)}</td>
          <td className="px-4 py-3">{c.fonte_url ? <a href={c.fonte_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-teal-700 hover:underline">{c.fonte}<ExternalLink className="h-3 w-3" /></a> : <span className="font-medium">{c.fonte}</span>}</td>
          <td className="px-4 py-3"><Badge variant={c.status === 'SEM_LICITACAO' ? 'info' : 'success'}>{c.status === 'SEM_LICITACAO' ? <SearchX className="mr-1 inline h-3 w-3" /> : <CheckCircle2 className="mr-1 inline h-3 w-3" />}{statusLabel(c.status)}</Badge></td>
          <td className="px-4 py-3">{person(c.responsavel_id ?? c.created_by)}</td>
          <td className="max-w-md px-4 py-3 text-slate-600">{c.observacao || '—'}</td>
          {canWrite && <td className="px-4 py-3 text-right"><button type="button" title="Excluir consulta" aria-label="Excluir consulta" onClick={() => void remove(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>}
        </tr>)}</tbody>
      </table></div>
      {lista.length > limit && <div className="mt-3 text-center"><Button variant="secondary" onClick={() => setLimit(l => l + 20)}>Mostrar mais</Button></div>}
    </CardBody></Card>

    <Modal open={open} onClose={() => setOpen(false)} title="Registrar consulta">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><FieldLabel>Fonte consultada *</FieldLabel><Select required value={form.fonte} onChange={e => setForm({ ...form, fonte: e.target.value })}><option value="">Selecione</option>{sourceTargets.map(t => <option key={t.url + t.label} value={t.label}>{t.label}</option>)}<option value={OUTRA}>Outra fonte…</option></Select></label>
        {form.fonte === OUTRA && <label className="sm:col-span-2"><FieldLabel>Nome da fonte *</FieldLabel><Input required value={form.outra} onChange={e => setForm({ ...form, outra: e.target.value })} placeholder="Ex.: SAAE Pirapora" /></label>}
        <label><FieldLabel>Data da consulta *</FieldLabel><Input type="date" required value={form.data_consulta} onChange={e => setForm({ ...form, data_consulta: e.target.value })} /></label>
        <label><FieldLabel>Status *</FieldLabel><Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ConsultaForm['status'] })}><option value="SEM_LICITACAO">Sem licitação</option><option value="VERIFICADO">Verificado (com licitação)</option></Select></label>
        <label className="sm:col-span-2"><FieldLabel>Responsável</FieldLabel><Select value={form.responsavel_id} onChange={e => setForm({ ...form, responsavel_id: e.target.value })}><option value="">Selecione</option>{profiles.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</Select></label>
        <label className="sm:col-span-2"><FieldLabel>Observação</FieldLabel><textarea className="ds-field min-h-20" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} placeholder="Ex.: nenhum edital de análise de água; próximo pregão previsto para dezembro" /></label>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar consulta'}</Button></div>
      </form>
    </Modal>
  </>
}
