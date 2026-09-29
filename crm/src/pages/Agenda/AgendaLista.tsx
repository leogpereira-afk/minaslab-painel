import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Edit3, ExternalLink, Plus, RefreshCw, Search } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { PageShell } from '../../components/ui/PageShell'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../services/supabase'

type AgendaRow = {
  id: string
  ordem_servico_id: string | null
  proposta_id: string | null
  numero_proposta_referencia: string | null
  cliente_id: string | null
  endereco_id: string | null
  responsavel_id: string | null
  inicio: string
  fim: string | null
  status: string | null
  titulo: string | null
  descricao: string | null
  endereco_evento: string | null
  external_calendar_id: string | null
}

type Cliente = { id: string; nome_fantasia: string | null; razao_social: string | null }
type OrdemServico = { id: string; cliente_id: string | null; numero_os: string | null }
type Proposta = { id: string; cliente_id: string | null; numero_proposta: string | null }
type Perfil = { id: string; nome: string | null }
type Endereco = { id: string; nome_unidade: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null }

type AgendaForm = {
  ordem_servico_id: string
  proposta_id: string
  numero_proposta_referencia: string
  cliente_id: string
  endereco_id: string
  responsavel_id: string
  inicio: string
  fim: string
  status: string
  titulo: string
  descricao: string
  endereco_evento: string
}

const emptyForm: AgendaForm = {
  ordem_servico_id: '', proposta_id: '', numero_proposta_referencia: '', cliente_id: '', endereco_id: '', responsavel_id: '', inicio: '', fim: '', status: 'AGENDADO', titulo: '', descricao: '', endereco_evento: '',
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR')
}

function addressText(a: Endereco) {
  return [
    [a.logradouro, a.numero].filter(Boolean).join(', '),
    a.complemento,
    a.bairro,
    [a.cidade, a.uf].filter(Boolean).join('/'),
    a.cep ? `CEP ${a.cep}` : '',
  ].filter(Boolean).join(' - ')
}

function clientName(c?: Cliente) {
  return c?.nome_fantasia || c?.razao_social || '—'
}

async function withTimeout<T>(promise: Promise<T>, milliseconds = 15000): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Tempo limite excedido')), milliseconds)),
  ])
}

export function AgendaLista() {
  const { hasPermission } = useAuth()
  const canWrite = hasPermission('crm.write')
  const canAdmin = hasPermission('admin.manage')
  const [rows, setRows] = useState<AgendaRow[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [enderecos, setEnderecos] = useState<Endereco[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AgendaForm>(emptyForm)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clienteMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes])
  const osMap = useMemo(() => new Map(ordens.map(o => [o.id, o])), [ordens])
  const propostaMap = useMemo(() => new Map(propostas.map(p => [p.id, p])), [propostas])
  const perfilMap = useMemo(() => new Map(perfis.map(p => [p.id, p])), [perfis])

  async function load() {
    setLoading(true)
    setError(null)
    const [agendaRes, clientesRes, osRes, propostasRes, perfisRes] = await Promise.all([
      supabase.from('agendamentos').select('*').is('deleted_at', null).order('inicio', { ascending: false }).limit(500),
      supabase.from('clientes').select('id,nome_fantasia,razao_social').is('deleted_at', null).order('nome_fantasia').limit(1000),
      supabase.from('ordens_servico').select('id,cliente_id,numero_os').is('deleted_at', null).order('created_at', { ascending: false }).limit(1000),
      supabase.from('propostas').select('id,cliente_id,numero_proposta').is('deleted_at', null).order('created_at', { ascending: false }).limit(1000),
      supabase.from('profiles').select('id,nome').eq('ativo', true).order('nome').limit(500),
    ])
    const firstError = agendaRes.error || clientesRes.error || osRes.error || propostasRes.error || perfisRes.error
    if (firstError) setError(firstError.message)
    setRows((agendaRes.data ?? []) as AgendaRow[])
    setClientes((clientesRes.data ?? []) as Cliente[])
    setOrdens((osRes.data ?? []) as OrdemServico[])
    setPropostas((propostasRes.data ?? []) as Proposta[])
    setPerfis((perfisRes.data ?? []) as Perfil[])
    setLoading(false)
  }

  async function loadAddresses(clienteId: string, preferredId = '') {
    if (!clienteId) { setEnderecos([]); return }
    const { data, error: addressError } = await supabase.from('enderecos').select('id,nome_unidade,logradouro,numero,complemento,bairro,cidade,uf,cep').eq('cliente_id', clienteId).eq('ativo', true).is('deleted_at', null).order('nome_unidade')
    if (addressError) { setError(addressError.message); setEnderecos([]); return }
    const list = (data ?? []) as Endereco[]
    setEnderecos(list)
    if (!preferredId && list.length === 1) {
      setForm(current => ({ ...current, endereco_id: list[0].id, endereco_evento: current.endereco_evento || addressText(list[0]) }))
    }
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('google_calendar')
    if (status === 'connected') {
      setMessage('Google Calendar conectado com segurança. Agora os agendamentos podem ser sincronizados.')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (status) {
      setError(`Não foi possível concluir a conexão com o Google Calendar (${status}).`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-BR')
    if (!q) return rows
    return rows.filter(row => {
      const cliente = clientName(row.cliente_id ? clienteMap.get(row.cliente_id) : undefined)
      const numeroOs = row.ordem_servico_id ? osMap.get(row.ordem_servico_id)?.numero_os ?? '' : ''
      const numeroProposta = row.proposta_id ? propostaMap.get(row.proposta_id)?.numero_proposta ?? '' : row.numero_proposta_referencia ?? ''
      const coletor = row.responsavel_id ? perfilMap.get(row.responsavel_id)?.nome ?? '' : ''
      return [cliente, numeroOs, numeroProposta, coletor, row.status, row.titulo, row.descricao, row.endereco_evento].some(value => String(value ?? '').toLocaleLowerCase('pt-BR').includes(q))
    })
  }, [rows, query, clienteMap, osMap, propostaMap, perfilMap])

  function openNew() {
    setEditingId(null)
    setEnderecos([])
    setForm({ ...emptyForm })
    setError(null)
    setModalOpen(true)
  }

  async function openEdit(row: AgendaRow) {
    setEditingId(row.id)
    setForm({
      ordem_servico_id: row.ordem_servico_id ?? '', proposta_id: row.proposta_id ?? '', numero_proposta_referencia: row.numero_proposta_referencia ?? (row.proposta_id ? propostaMap.get(row.proposta_id)?.numero_proposta ?? '' : ''), cliente_id: row.cliente_id ?? '', endereco_id: row.endereco_id ?? '', responsavel_id: row.responsavel_id ?? '',
      inicio: toLocalDateTimeInput(row.inicio), fim: toLocalDateTimeInput(row.fim), status: row.status ?? 'AGENDADO', titulo: row.titulo ?? '', descricao: row.descricao ?? '', endereco_evento: row.endereco_evento ?? '',
    })
    if (row.cliente_id) await loadAddresses(row.cliente_id, row.endereco_id ?? '')
    else setEnderecos([])
    setError(null)
    setModalOpen(true)
  }

  async function changeClient(clienteId: string) {
    const selectedOs = ordens.find(o => o.id === form.ordem_servico_id)
    const selectedProposal = propostas.find(p => p.id === form.proposta_id)
    setForm(current => ({ ...current, cliente_id: clienteId, ordem_servico_id: selectedOs?.cliente_id === clienteId ? current.ordem_servico_id : '', proposta_id: selectedProposal?.cliente_id === clienteId ? current.proposta_id : '', numero_proposta_referencia: selectedProposal?.cliente_id === clienteId ? current.numero_proposta_referencia : '', endereco_id: '', endereco_evento: '' }))
    await loadAddresses(clienteId)
  }

  async function changeOs(osId: string) {
    const os = ordens.find(o => o.id === osId)
    const clienteId = os?.cliente_id ?? form.cliente_id
    setForm(current => ({ ...current, ordem_servico_id: osId, proposta_id: osId ? '' : current.proposta_id, numero_proposta_referencia: osId ? '' : current.numero_proposta_referencia, cliente_id: clienteId, endereco_id: '', endereco_evento: '' }))
    await loadAddresses(clienteId)
  }

  async function changeProposalReference(value: string) {
    const normalized = value.trim().toLocaleLowerCase('pt-BR')
    const proposal = propostas.find(p => (p.numero_proposta ?? '').trim().toLocaleLowerCase('pt-BR') === normalized)
    const clienteId = proposal?.cliente_id ?? form.cliente_id
    setForm(current => ({
      ...current,
      proposta_id: proposal?.id ?? '',
      numero_proposta_referencia: value,
      ordem_servico_id: value.trim() ? '' : current.ordem_servico_id,
      cliente_id: clienteId,
      endereco_id: proposal?.cliente_id && proposal.cliente_id !== current.cliente_id ? '' : current.endereco_id,
      endereco_evento: proposal?.cliente_id && proposal.cliente_id !== current.cliente_id ? '' : current.endereco_evento,
    }))
    if (proposal?.cliente_id && proposal.cliente_id !== form.cliente_id) await loadAddresses(proposal.cliente_id)
  }

  function changeAddress(addressId: string) {
    const address = enderecos.find(a => a.id === addressId)
    setForm(current => ({ ...current, endereco_id: addressId, endereco_evento: address ? addressText(address) : '' }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!form.inicio) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        ordem_servico_id: form.ordem_servico_id || null,
        proposta_id: form.proposta_id || null,
        numero_proposta_referencia: form.numero_proposta_referencia.trim() || null,
        cliente_id: form.cliente_id || null,
        endereco_id: form.endereco_id || null,
        responsavel_id: form.responsavel_id || null,
        inicio: new Date(form.inicio).toISOString(),
        fim: form.fim ? new Date(form.fim).toISOString() : null,
        status: form.status || 'AGENDADO',
        titulo: form.titulo.trim() || null,
        descricao: form.descricao.trim() || null,
        endereco_evento: form.endereco_evento.trim() || null,
      }

      let id = editingId
      if (editingId) {
        const { error: updateError } = await supabase.from('agendamentos').update(payload).eq('id', editingId)
        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await supabase.from('agendamentos').insert(payload).select('id').single()
        if (insertError) throw insertError
        id = String(data.id)
      }

      let calendarOk = false
      if (id) {
        try {
          const sync = await withTimeout(supabase.functions.invoke('google-calendar-sync', { body: { agendamento_id: id } }))
          calendarOk = !sync.error && !(sync.data as { error?: string } | null)?.error
        } catch {
          calendarOk = false
        }
      }

      setModalOpen(false)
      await load()
      setMessage(calendarOk ? 'Agendamento salvo e sincronizado com o Google Calendar.' : 'Agendamento salvo no CRM. O Google Calendar ainda precisa ser conectado ou sincronizado novamente.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o agendamento.')
    } finally {
      setSaving(false)
    }
  }

  async function connectGoogle() {
    setConnecting(true)
    setError(null)
    try {
      const { data, error: connectError } = await supabase.functions.invoke('google-calendar-auth-start', { body: {} })
      if (connectError) throw connectError
      const url = (data as { url?: string } | null)?.url
      if (!url) throw new Error('O Supabase não retornou o endereço de autorização do Google.')
      window.location.href = url
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Não foi possível iniciar a conexão com o Google Calendar.')
      setConnecting(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100'

  return <PageShell title="Agenda" description="Agenda de coletas, compromissos e execuções relacionadas a clientes e OS." action={<div className="flex flex-wrap gap-2">
    {canAdmin && <button onClick={() => void connectGoogle()} disabled={connecting} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"><CalendarDays className="h-4 w-4"/>{connecting ? 'Conectando...' : 'Conectar Google Calendar'}</button>}
    <a href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><ExternalLink className="h-4 w-4"/>Abrir Google Calendar</a>
    {canWrite && <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"><Plus className="h-4 w-4"/>Novo agendamento</button>}
  </div>}>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar cliente, OS, coletor..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:bg-white"/></div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4"/>Atualizar</button>
      </div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Início</th><th className="px-5 py-3">Cliente / OS</th><th className="px-5 py-3">Coletor</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Google Calendar</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">
        {loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Carregando...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Sem agendamentos</td></tr> : filtered.map(row => <tr key={row.id} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDate(row.inicio)}</td><td className="px-5 py-4 text-slate-700"><div className="font-medium">{clientName(row.cliente_id ? clienteMap.get(row.cliente_id) : undefined)}</div><div className="text-xs text-slate-500">{row.ordem_servico_id ? `OS ${osMap.get(row.ordem_servico_id)?.numero_os || 'sem número'}` : row.numero_proposta_referencia ? `Proposta ${row.numero_proposta_referencia}` : row.proposta_id ? `Proposta ${propostaMap.get(row.proposta_id)?.numero_proposta || 'sem número'}` : 'Sem vínculo'}</div></td><td className="px-5 py-4 text-slate-700">{row.responsavel_id ? perfilMap.get(row.responsavel_id)?.nome || '—' : '—'}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{row.status || 'AGENDADO'}</span></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.external_calendar_id ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{row.external_calendar_id ? 'SINCRONIZADO' : 'PENDENTE'}</span></td><td className="px-5 py-4 text-right">{canWrite && <button onClick={() => void openEdit(row)} title="Editar" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><Edit3 className="h-4 w-4"/></button>}</td></tr>)}
      </tbody></table></div>
      <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">{filtered.length} registro(s)</div>
    </section>

    <Modal open={modalOpen} title={`${editingId ? 'Editar' : 'Novo'} agendamento`} onClose={() => !saving && setModalOpen(false)}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700">Ordem de serviço (opcional)</span><select value={form.ordem_servico_id} onChange={e => void changeOs(e.target.value)} className={inputClass}><option value="">Selecione</option>{ordens.map(os => <option key={os.id} value={os.id}>{os.numero_os || os.id}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700">Número da proposta (opcional — vínculo alternativo)</span><input list="agenda-propostas" value={form.numero_proposta_referencia} onChange={e => void changeProposalReference(e.target.value)} placeholder="Selecione ou digite o número da proposta" className={inputClass}/><datalist id="agenda-propostas">{propostas.filter(p => p.numero_proposta).map(p => <option key={p.id} value={p.numero_proposta ?? ''}>{clientName(p.cliente_id ? clienteMap.get(p.cliente_id) : undefined)}</option>)}</datalist></label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700">Cliente</span><select value={form.cliente_id} onChange={e => void changeClient(e.target.value)} className={inputClass}><option value="">Selecione</option>{clientes.map(cliente => <option key={cliente.id} value={cliente.id}>{clientName(cliente)}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700">Endereço do cadastro</span><select value={form.endereco_id} onChange={e => changeAddress(e.target.value)} className={inputClass}><option value="">Selecione</option>{enderecos.map(endereco => <option key={endereco.id} value={endereco.id}>{endereco.nome_unidade ? `${endereco.nome_unidade} — ` : ''}{addressText(endereco)}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700">Endereço da coleta / evento</span><input value={form.endereco_evento} onChange={e => setForm(current => ({ ...current, endereco_evento: e.target.value }))} placeholder="Carregado automaticamente do cadastro e editável" className={inputClass}/></label>
        <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Coletor / responsável</span><select value={form.responsavel_id} onChange={e => setForm(current => ({ ...current, responsavel_id: e.target.value }))} className={inputClass}><option value="">Selecione</option>{perfis.map(perfil => <option key={perfil.id} value={perfil.id}>{perfil.nome || perfil.id}</option>)}</select></label>
        <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Status</span><select value={form.status} onChange={e => setForm(current => ({ ...current, status: e.target.value }))} className={inputClass}><option>AGENDADO</option><option>CONFIRMADO</option><option>REALIZADO</option><option>CANCELADO</option></select></label>
        <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Início *</span><input required type="datetime-local" value={form.inicio} onChange={e => setForm(current => ({ ...current, inicio: e.target.value }))} className={inputClass}/></label>
        <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Fim</span><input type="datetime-local" value={form.fim} onChange={e => setForm(current => ({ ...current, fim: e.target.value }))} className={inputClass}/></label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700">Título personalizado (opcional)</span><input value={form.titulo} onChange={e => setForm(current => ({ ...current, titulo: e.target.value }))} placeholder="Deixe vazio para gerar automaticamente com Cliente e OS" className={inputClass}/></label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700">Observações</span><textarea rows={4} value={form.descricao} onChange={e => setForm(current => ({ ...current, descricao: e.target.value }))} className={inputClass}/></label>
        <div className="sm:col-span-2 mt-2 flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancelar</button><button disabled={saving} className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar e sincronizar'}</button></div>
      </form>
    </Modal>
  </PageShell>
}
