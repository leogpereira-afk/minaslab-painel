// Pós-venda › Pesquisa de satisfação (PG 012 · PSC). A Qualidade gera um link por cliente/OS e envia
// (copiar, WhatsApp ou e-mail); o cliente responde na página pública /pesquisa/ e a resposta cai aqui.
// Insatisfação (recomendação 0–6 ou item com nota 1–2) abre tratativa com prazo de 5 dias.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Copy, Download, Mail, MessageCircle, Send, Smile, Star, ThumbsUp } from 'lucide-react'
import { PageShell } from '../../components/ui/PageShell'
import { Modal } from '../../components/ui/Modal'
import { PeriodSelect } from '../../components/ui/PeriodFilter'
import { ALL_PERIOD, MONTHS, inPeriod, periodLabel, yearMonthOf, yearsFrom, type PeriodFilter } from '../../lib/period'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../services/supabase'

type Client = { id: string; razao_social: string | null; nome_fantasia: string | null }
type Os = { id: string; numero_os: string | null; cliente_id: string | null; data_recepcao: string | null }
type Contrato = { id: string; numero_contrato: string | null; cliente_id: string | null; status: string | null }
type Contato = { id: string; cliente_id: string; nome: string | null; email: string | null; whatsapp_e164: string | null; telefone_e164: string | null }
type Person = { id: string; nome: string | null }
type Envio = { id: string; token: string; cliente_id: string | null; contrato_id: string | null; ordem_servico_id: string | null; contato_id: string | null; empresa_nome: string | null; canal: string; destino: string | null; enviado_por: string | null; enviado_por_painel?: string | null; enviado_em: string; expira_em: string; respondido_em: string | null; cancelado_em: string | null }
type Resposta = { id: string; envio_id: string | null; cliente_id: string | null; contrato_id: string | null; ordem_servico_id: string | null; empresa_nome: string | null; servicos: string[]; notas: Record<string, number>; nota_coleta: number | null; nps: number; gostou: string | null; mudaria: string | null; melhorar: string | null; explicacao_nps: string | null; textos?: Record<string, string> | null; autoriza_anonimo: boolean; insatisfeito: boolean; melhoria_status: string; origem: string; respondido_em: string }
type Tratativa = { id: string; resposta_id: string; cliente_id: string | null; motivo: string; prazo: string; status: string; responsavel_id: string | null; responsavel_painel?: string | null; tarefa_id: string | null; tarefa_painel_id?: string | null; causa: string | null; acao: string | null; retorno_cliente: string | null; concluida_em: string | null }
type QueryResult<T> = { data: T[] | null; error: { message: string } | null }

// Perguntas vêm de satisfacao_perguntas (editadas só no painel › Laboratório › Qualidade). Reserva: o formulário original.
type Pergunta = { chave: string; texto: string; tipo: string; ativa: boolean }
const PADRAO: Pergunta[] = [
  ['atendimento_inicial', 'Facilidade no atendimento inicial'], ['clareza_orcamentos', 'Clareza das informações e orçamentos'],
  ['agilidade_prazos', 'Agilidade e cumprimento de prazos'], ['equipe', 'Competência e cordialidade da equipe'],
  ['confiabilidade', 'Confiabilidade dos resultados'], ['relatorios', 'Qualidade dos relatórios emitidos'],
  ['requisitos', 'Requisitos técnicos e normativos'], ['custo_beneficio', 'Custo-benefício dos serviços'],
  ['satisfacao_geral', 'Satisfação geral com o laboratório'], ['coleta', 'Processo de coleta/amostragem'],
].map(([chave, texto]) => ({ chave, texto, tipo: 'ESCALA', ativa: true }))
let PERGUNTAS: Pergunta[] = PADRAO
const escalaQs = () => PERGUNTAS.filter(q => q.tipo === 'ESCALA')
const textoQs = () => PERGUNTAS.filter(q => q.tipo === 'TEXTO')
const nota = (r: Resposta, k: string): number | null => { const v = r.notas?.[k] ?? (k === 'coleta' ? r.nota_coleta : null); return typeof v === 'number' ? v : null }
const textosDe = (r: Resposta): Record<string, string> => ({ ...Object.fromEntries(([['gostou', r.gostou], ['mudaria', r.mudaria], ['melhorar', r.melhorar]] as [string, string | null][]).filter((x): x is [string, string] => !!x[1])), ...(r.textos || {}) })
const comentario = (r: Resposta) => Object.values(textosDe(r)).find(Boolean) || r.explicacao_nps || ''
const sugestao = (r: Resposta) => Object.entries(textosDe(r)).filter(([k, v]) => k !== 'gostou' && v).map(([, v]) => v).join(' · ')
const rotTexto = (k: string) => textoQs().find(q => q.chave === k)?.texto || ({ gostou: 'O que mais gostou', mudaria: 'O que mudaria', melhorar: 'O que podemos melhorar' } as Record<string, string>)[k] || k
const MELHORIA = ['AVALIAR', 'EM ANDAMENTO', 'IMPLEMENTADA', 'DESCARTADA', 'SEM SUGESTAO']
const PAGE = 1000
async function fetchAll<T>(q: (from: number, to: number) => PromiseLike<QueryResult<T>>) { const rows: T[] = []; for (let from = 0; ; from += PAGE) { const r = await q(from, from + PAGE - 1); if (r.error) return { data: rows, error: r.error }; const b = (r.data ?? []) as T[]; rows.push(...b); if (b.length < PAGE) return { data: rows, error: null } } }
const fmtData = (v: string | null) => v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString('pt-BR') : '—'
const media = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
const dec = (n: number | null) => n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const linkDe = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL.replace(/crm\/?$/, '')}pesquisa/?t=${token}`
const mensagem = (link: string) => `Olá! Aqui é da MinasLab. Sua opinião é muito importante para nós: poderia responder nossa pesquisa de satisfação? Leva cerca de 2 minutos.\n${link}`
const clientName = (c?: Client) => c?.nome_fantasia || c?.razao_social || ''

export function PosVendaSatisfacao() {
  const { profile, hasPermission } = useAuth()
  const canWrite = hasPermission('crm.write') || hasPermission('operational.read')
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'geral' | 'respostas' | 'tratativas' | 'envios'>('geral')
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [envios, setEnvios] = useState<Envio[]>([]), [respostas, setRespostas] = useState<Resposta[]>([]), [tratativas, setTratativas] = useState<Tratativa[]>([])
  const [clients, setClients] = useState<Client[]>([]), [oss, setOss] = useState<Os[]>([]), [contratos, setContratos] = useState<Contrato[]>([]), [people, setPeople] = useState<Person[]>([])
  const [period, setPeriod] = useState<PeriodFilter>(ALL_PERIOD)
  const [ver, setVer] = useState<Resposta | null>(null), [trat, setTrat] = useState<Tratativa | null>(null)
  const [enviarOpen, setEnviarOpen] = useState(false), [soSugestoes, setSoSugestoes] = useState(false)

  async function load() {
    setLoading(true)
    const pq = await supabase.from('satisfacao_perguntas').select('chave,texto,tipo,ativa').order('ordem')
    if (!pq.error && pq.data?.length) PERGUNTAS = pq.data as Pergunta[]
    const [e, r, t, c, o, p, k] = await Promise.all([
      fetchAll<Envio>((f, to) => supabase.from('satisfacao_envios').select('*').order('enviado_em', { ascending: false }).range(f, to)),
      fetchAll<Resposta>((f, to) => supabase.from('satisfacao_respostas').select('*').is('deleted_at', null).order('respondido_em', { ascending: false }).range(f, to)),
      fetchAll<Tratativa>((f, to) => supabase.from('satisfacao_tratativas').select('*').order('prazo').range(f, to)),
      fetchAll<Client>((f, to) => supabase.from('clientes').select('id,razao_social,nome_fantasia').is('deleted_at', null).order('razao_social').range(f, to)),
      fetchAll<Os>((f, to) => supabase.from('ordens_servico').select('id,numero_os,cliente_id,data_recepcao').is('deleted_at', null).order('data_recepcao', { ascending: false }).range(f, to)),
      fetchAll<Person>((f, to) => supabase.from('profiles').select('id,nome').order('nome').range(f, to)),
      fetchAll<Contrato>((f, to) => supabase.from('contratos').select('id,numero_contrato,cliente_id,status').is('deleted_at', null).order('numero_contrato').range(f, to)),
    ])
    const err = [e, r, t, c, o, p, k].find(x => x.error)?.error
    if (err) setError(err.message); else setError('')
    setEnvios(e.data); setRespostas(r.data); setTratativas(t.data.filter(x => r.data.some(y => y.id === x.resposta_id))); setClients(c.data); setOss(o.data); setContratos(k.data); setPeople(p.data)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])
  useEffect(() => { if (params.get('enviar') === '1') { setEnviarOpen(true); params.delete('enviar'); setParams(params, { replace: true }) } }, [params, setParams])

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients])
  const osMap = useMemo(() => Object.fromEntries(oss.map(o => [o.id, o])), [oss])
  const ctMap = useMemo(() => Object.fromEntries(contratos.map(k => [k.id, k])), [contratos])
  const vinculo = (x: { contrato_id: string | null; ordem_servico_id: string | null }) => [x.contrato_id && ctMap[x.contrato_id]?.numero_contrato ? `Contrato ${ctMap[x.contrato_id].numero_contrato}` : '', x.ordem_servico_id && osMap[x.ordem_servico_id]?.numero_os || ''].filter(Boolean).join(' · ') || 'Sem vínculo'
  const personMap = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people])
  const years = useMemo(() => yearsFrom([...respostas.map(r => r.respondido_em), ...envios.map(e => e.enviado_em)]), [respostas, envios])
  const rPer = useMemo(() => respostas.filter(r => inPeriod(r.respondido_em, period)), [respostas, period])
  const ePer = useMemo(() => envios.filter(e => !e.cancelado_em && inPeriod(e.enviado_em, period)), [envios, period])
  const nome = (r: { cliente_id: string | null; empresa_nome: string | null }) => clientName(clientMap[r.cliente_id || '']) || r.empresa_nome || 'Cliente'

  const kpi = useMemo(() => {
    const prom = rPer.filter(r => r.nps >= 9).length, det = rPer.filter(r => r.nps <= 6).length
    return {
      nps: rPer.length ? Math.round((prom - det) / rPer.length * 100) : null,
      geral: media(rPer.map(r => nota(r, 'satisfacao_geral')).filter((x): x is number => x != null)),
      taxa: ePer.length ? Math.round(ePer.filter(e => e.respondido_em).length / ePer.length * 100) : null,
      respondidas: ePer.filter(e => e.respondido_em).length,
      abertas: tratativas.filter(t => t.status !== 'CONCLUIDA').length,
      atrasadas: tratativas.filter(t => t.status !== 'CONCLUIDA' && t.prazo < new Date().toISOString().slice(0, 10)).length,
    }
  }, [rPer, ePer, tratativas])
  const periodo = periodLabel(period)
  const hoje = yearMonthOf(new Date())
  const mesAtual = hoje ? `${MONTHS[hoje.month - 1].toLowerCase()}/${hoje.year}` : ''
  const respostasMes = respostas.filter(r => { const m = yearMonthOf(r.respondido_em); return m && hoje && m.year === hoje.year && m.month === hoje.month }).length
  const npsMes = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i))
    const ym = yearMonthOf(d)!; const rs = respostas.filter(r => { const m = yearMonthOf(r.respondido_em); return m?.year === ym.year && m?.month === ym.month })
    const nps = rs.length ? Math.round((rs.filter(r => r.nps >= 9).length - rs.filter(r => r.nps <= 6).length) / rs.length * 100) : null
    return { k: `${ym.year}-${ym.month}`, rot: MONTHS[ym.month - 1].slice(0, 3).toLowerCase(), nps, n: rs.length, atual: i === 5 }
  }), [respostas])
  const sugestoesAbertas = rPer.filter(r => r.melhoria_status === 'AVALIAR' || r.melhoria_status === 'EM ANDAMENTO').length
  const rLista = soSugestoes ? rPer.filter(r => r.melhoria_status !== 'SEM SUGESTAO') : rPer

  function exportar() {
    const esc = (v: unknown) => { const t = v == null ? '' : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
    const linhas: unknown[][] = [
      ['Pesquisa de Satisfação de Clientes — PG 012 · PSC'], ['Período', periodo], ['Gerado em', new Date().toLocaleString('pt-BR')], [],
      ['NPS', kpi.nps ?? ''], ['Respostas', rPer.length], ['Satisfação geral (1–5)', dec(kpi.geral)], ['Taxa de resposta', kpi.taxa == null ? '' : `${kpi.taxa}%`],
      ['Tratativas abertas', kpi.abertas], ['Tratativas atrasadas', kpi.atrasadas], [],
      ['Média por pergunta'], ...porItem.map(i => [i.l, dec(i.m)]), [],
      ['Respostas'], ['Data', 'Cliente', 'Contrato/OS', 'NPS', ...escalaQs().map(q => q.texto), ...textoQs().map(q => q.texto), 'Explicação 0–6', 'Status da melhoria', 'Uso anônimo autorizado'],
      ...rPer.map(r => [fmtData(r.respondido_em), nome(r), vinculo(r), r.nps, ...escalaQs().map(q => nota(r, q.chave) ?? ''), ...textoQs().map(q => textosDe(r)[q.chave] || ''), r.explicacao_nps, r.melhoria_status, r.autoriza_anonimo ? 'Sim' : 'Não']), [],
      ['Tratativas'], ['Prazo', 'Cliente', 'Motivo', 'Status', 'Causa', 'Ação', 'Retorno ao cliente', 'Concluída em'],
      ...tratativas.filter(t => rPer.some(r => r.id === t.resposta_id)).map(t => [fmtData(t.prazo), clientName(clientMap[t.cliente_id || '']), t.motivo, t.status, t.causa, t.acao, t.retorno_cliente, fmtData(t.concluida_em)]),
    ]
    const csv = '﻿' + linhas.map(l => l.map(esc).join(';')).join('\r\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `pesquisa-satisfacao-${periodo.replace(/[^\w]+/g, '-').toLowerCase()}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  const porItem = useMemo(() => escalaQs().map(q => ({ k: q.chave, l: q.ativa ? q.texto : `${q.texto} (retirada)`, ativa: q.ativa, m: media(rPer.map(r => nota(r, q.chave)).filter((x): x is number => x != null)) })).filter(i => i.ativa || i.m != null), [rPer, respostas])

  async function salvarMelhoria(r: Resposta, status: string) {
    const { error } = await supabase.from('satisfacao_respostas').update({ melhoria_status: status }).eq('id', r.id)
    if (error) setError(error.message); else setRespostas(rs => rs.map(x => x.id === r.id ? { ...x, melhoria_status: status } : x))
  }
  async function cancelarEnvio(e: Envio) {
    if (!window.confirm('Cancelar este link? O cliente não conseguirá mais responder por ele.')) return
    const { error } = await supabase.from('satisfacao_envios').update({ cancelado_em: new Date().toISOString() }).eq('id', e.id)
    if (error) setError(error.message); else await load()
  }

  const tabs: [typeof tab, string, number?][] = [['geral', 'Visão geral'], ['respostas', 'Respostas', rPer.length], ['tratativas', 'Tratativas', kpi.abertas], ['envios', 'Envios', ePer.length]]
  return <PageShell title="Pós-venda — Pesquisa de satisfação" description="PG 012 · PSC. Envie o link ao cliente, acompanhe as respostas, trate insatisfações e registre melhorias."
    action={canWrite ? <button onClick={() => setEnviarOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"><Send className="h-4 w-4" />Enviar pesquisa</button> : undefined}>
    {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <section className="flex flex-wrap items-center gap-3 rounded-3xl border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap gap-1">{tabs.map(([k, l, n]) => <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-3 py-2 text-sm ${tab === k ? 'bg-teal-50 font-semibold text-teal-800' : 'text-slate-600 hover:bg-slate-50'}`}>{l}{n ? <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{n}</span> : null}</button>)}</div>
      <div className="ml-auto"><PeriodSelect value={period} onChange={setPeriod} years={years} /></div>
    </section>
    {loading ? <div className="rounded-3xl border bg-white p-8 text-center text-slate-500">Carregando...</div> : <>
      {tab === 'geral' && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <K icon={Smile} label={`NPS (${periodo})`} value={kpi.nps == null ? '—' : (kpi.nps > 0 ? '+' : '') + kpi.nps} hint={`${rPer.length} resposta(s) · ${rPer.filter(r => r.nps >= 9).length} promotor(es), ${rPer.filter(r => r.nps <= 6).length} detrator(es)`} />
          <K icon={Star} label="Satisfação geral (1–5)" value={dec(kpi.geral)} hint="meta ≥ 4,5" />
          <K icon={Send} label="Taxa de resposta" value={kpi.taxa == null ? '—' : `${kpi.taxa}%`} hint={`${kpi.respondidas} de ${ePer.length} enviadas`} />
          <K icon={ThumbsUp} label="Respostas no mês" value={String(respostasMes)} hint={mesAtual} />
          <K icon={AlertTriangle} label="Insatisfações abertas" value={String(kpi.abertas)} hint={kpi.atrasadas ? `${kpi.atrasadas} atrasada(s)` : 'aguardando tratativa'} alert={kpi.abertas > 0} onClick={() => setTab('tratativas')} />
        </section>
        <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
          <div className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="mb-3 font-semibold text-slate-900">Média por pergunta (1–5)</h3>
            {porItem.map(i => <div key={i.k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_40px] items-center gap-3 py-1.5 text-sm"><span className="truncate text-slate-700">{i.l}</span><div className="h-2.5 rounded-full bg-slate-100"><div className={`h-2.5 rounded-full ${i.m != null && i.m < 4.5 ? 'bg-amber-500' : 'bg-teal-500'}`} style={{ width: `${(i.m ?? 0) / 5 * 100}%` }} /></div><b className="text-right">{dec(i.m)}</b></div>)}
            <p className="mt-2 text-xs text-slate-400">Em laranja: abaixo da meta de 4,5.</p>
          </div>
          <div className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="mb-2 font-semibold text-slate-900">Últimas respostas</h3>
            {rPer.length === 0 ? <p className="py-4 text-sm text-slate-500">Nenhuma resposta no período.</p> : <table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2 pr-2 font-semibold">Data</th><th className="py-2 pr-2 font-semibold">Cliente</th><th className="py-2 pr-2 font-semibold">NPS</th><th className="py-2 font-semibold">Comentário</th></tr></thead>
              <tbody>{rPer.slice(0, 4).map(r => { const tr = tratativas.find(t => t.resposta_id === r.id && t.status !== 'CONCLUIDA'); return <tr key={r.id} onClick={() => setVer(r)} className="cursor-pointer border-t align-top hover:bg-slate-50">
                <td className="whitespace-nowrap py-2.5 pr-2">{fmtData(r.respondido_em).slice(0, 5)}</td>
                <td className="py-2.5 pr-2"><b className="block text-slate-900">{nome(r)}</b><span className="text-xs text-slate-500">{vinculo(r)}</span></td>
                <td className="py-2.5 pr-2"><Nps n={r.nps} /></td>
                <td className="py-2.5 text-slate-600"><span className="line-clamp-2">{comentario(r) || '—'}</span>{tr && <b className="text-xs text-red-700">→ tratativa aberta</b>}</td>
              </tr> })}</tbody></table>}
            <h3 className="mb-1 mt-4 font-semibold text-slate-900">NPS por mês</h3>
            <div className="flex h-32 items-end gap-2 pb-5">{npsMes.map(m => <div key={m.k} className="relative flex h-full flex-1 flex-col justify-end">
              <span className="mb-1 text-center text-[11px] font-semibold text-slate-600">{m.nps == null ? '' : (m.nps > 0 ? '+' : '') + m.nps}</span>
              <div title={`${m.n} resposta(s)`} className={`rounded-t-md ${m.atual ? 'bg-teal-500' : 'bg-teal-100'}`} style={{ height: `${m.nps == null ? 3 : Math.max(6, (m.nps + 100) / 2)}%` }} />
              <span className="absolute -bottom-5 left-0 right-0 text-center text-[11px] text-slate-500">{m.rot}</span></div>)}</div>
          </div>
        </section>
        <section className="grid gap-3 md:grid-cols-3">
          <button type="button" onClick={() => setTab('tratativas')} className="rounded-3xl border border-red-200 bg-red-50 p-4 text-left text-sm leading-relaxed text-red-900 hover:border-red-300"><b className="block">Insatisfeito (NPS 0–6 ou item ≤ 2)</b>Abre tratativa para a Qualidade com prazo de 5 dias: análise da causa, ação e retorno ao cliente. <span className="mt-2 block font-semibold">{kpi.abertas} aberta(s){kpi.atrasadas ? ` · ${kpi.atrasadas} atrasada(s)` : ''} →</span></button>
          <button type="button" onClick={() => { setSoSugestoes(true); setTab('respostas') }} className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-left text-sm leading-relaxed text-amber-900 hover:border-amber-300"><b className="block">Sugestões de melhoria</b>Comentários de "o que mudaria / o que melhorar" viram oportunidades com status (avaliar · em andamento · implementada). <span className="mt-2 block font-semibold">{sugestoesAbertas} para avaliar/em andamento →</span></button>
          <button type="button" onClick={exportar} className="rounded-3xl border border-teal-200 bg-teal-50 p-4 text-left text-sm leading-relaxed text-teal-900 hover:border-teal-300"><b className="block">Validação e análise crítica</b>Relatório do período ({periodo}) com NPS, médias por pergunta, respostas e tratativas, para a análise crítica pela direção. <span className="mt-2 inline-flex items-center gap-1 font-semibold"><Download className="h-4 w-4" />Exportar planilha (Excel)</span></button>
        </section>
      </>}

      {tab === 'respostas' && <section className="overflow-hidden rounded-3xl border bg-white shadow-sm"><div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={soSugestoes} onChange={e => setSoSugestoes(e.target.checked)} className="accent-teal-700" />Só respostas com sugestão de melhoria</label><span className="ml-auto text-xs text-slate-500">{rLista.length} resposta(s)</span></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Cliente / OS</th><th className="px-4 py-3">NPS</th><th className="px-4 py-3">Geral</th><th className="px-4 py-3">Sugestão de melhoria</th><th className="px-4 py-3">Status da melhoria</th></tr></thead>
        <tbody>{rLista.map(r => <tr key={r.id} className="border-t align-top hover:bg-slate-50">
          <td className="whitespace-nowrap px-4 py-3">{fmtData(r.respondido_em)}{r.origem !== 'LINK' && <span className="block text-xs text-slate-400">{r.origem === 'GOOGLE_FORMS' ? 'Google Forms' : 'Manual'}</span>}</td>
          <td className="px-4 py-3"><button onClick={() => setVer(r)} className="text-left font-semibold text-teal-800 hover:underline">{nome(r)}</button><span className="block text-xs text-slate-500">{vinculo(r)}</span></td>
          <td className="px-4 py-3"><Nps n={r.nps} />{r.insatisfeito && <span className="mt-1 block text-xs font-semibold text-red-700">insatisfação</span>}</td>
          <td className="px-4 py-3">{nota(r, 'satisfacao_geral') ?? '—'}</td>
          <td className="max-w-md px-4 py-3 text-slate-600">{sugestao(r) || '—'}</td>
          <td className="px-4 py-3"><select disabled={!canWrite} value={r.melhoria_status} onChange={e => void salvarMelhoria(r, e.target.value)} className="rounded-lg border px-2 py-1.5 text-xs">{MELHORIA.map(m => <option key={m} value={m}>{m === 'SEM SUGESTAO' ? 'Sem sugestão' : m.charAt(0) + m.slice(1).toLowerCase()}</option>)}</select></td>
        </tr>)}</tbody></table>{rPer.length === 0 && <div className="p-10 text-center text-slate-500">Nenhuma resposta no período.</div>}</div></section>}

      {tab === 'tratativas' && <section className="overflow-hidden rounded-3xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Prazo</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead>
        <tbody>{tratativas.map(t => { const atrasada = t.status !== 'CONCLUIDA' && t.prazo < new Date().toISOString().slice(0, 10); return <tr key={t.id} className="border-t align-top">
          <td className={`whitespace-nowrap px-4 py-3 ${atrasada ? 'font-semibold text-red-700' : ''}`}>{fmtData(t.prazo)}{atrasada && <span className="block text-xs">atrasada</span>}</td>
          <td className="px-4 py-3 font-medium">{clientName(clientMap[t.cliente_id || '']) || respostas.find(r => r.id === t.resposta_id)?.empresa_nome || '—'}</td>
          <td className="max-w-md px-4 py-3 text-slate-600">{t.motivo}</td>
          <td className="px-4 py-3">{personMap[t.responsavel_id || '']?.nome || t.responsavel_painel || '—'}</td>
          <td className="px-4 py-3"><Status s={t.status} /></td>
          <td className="px-4 py-3 text-right">{canWrite && <button onClick={() => setTrat(t)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-teal-800">{t.status === 'CONCLUIDA' ? 'Ver' : 'Tratar'}</button>}</td>
        </tr> })}</tbody></table>{tratativas.length === 0 && <div className="p-10 text-center text-slate-500">Nenhuma insatisfação registrada.</div>}</div></section>}

      {tab === 'envios' && <section className="overflow-hidden rounded-3xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Enviado em</th><th className="px-4 py-3">Cliente / OS</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Por</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead>
        <tbody>{ePer.map(e => { const sit = e.respondido_em ? 'Respondida' : new Date(e.expira_em) < new Date() ? 'Expirada' : 'Aguardando'; return <tr key={e.id} className="border-t">
          <td className="whitespace-nowrap px-4 py-3">{fmtData(e.enviado_em)}</td>
          <td className="px-4 py-3"><b>{nome(e)}</b><span className="block text-xs text-slate-500">{vinculo(e)}</span></td>
          <td className="px-4 py-3">{e.canal === 'WHATSAPP' ? 'WhatsApp' : e.canal === 'EMAIL' ? 'E-mail' : 'Link'}{e.destino && <span className="block text-xs text-slate-500">{e.destino}</span>}</td>
          <td className="px-4 py-3">{personMap[e.enviado_por || '']?.nome || (e.enviado_por_painel ? `${e.enviado_por_painel} (painel)` : '—')}</td>
          <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sit === 'Respondida' ? 'bg-emerald-50 text-emerald-700' : sit === 'Expirada' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{sit}</span>{e.respondido_em && <span className="block text-xs text-slate-500">{fmtData(e.respondido_em)}</span>}</td>
          <td className="whitespace-nowrap px-4 py-3 text-right">{sit === 'Aguardando' && <><button onClick={() => void navigator.clipboard.writeText(linkDe(e.token))} title="Copiar link" className="rounded-lg border p-2 text-slate-600"><Copy className="h-4 w-4" /></button>{canWrite && <button onClick={() => void cancelarEnvio(e)} className="ml-2 rounded-lg border px-2 py-1.5 text-xs text-red-700">Cancelar</button>}</>}</td>
        </tr> })}</tbody></table>{ePer.length === 0 && <div className="p-10 text-center text-slate-500">Nenhum envio no período.</div>}</div></section>}
    </>}

    {enviarOpen && <EnviarModal clients={clients} oss={oss} contratos={contratos} profileId={profile?.id ?? null} onClose={() => setEnviarOpen(false)} onSaved={load} />}
    {ver && <Modal open title={`Resposta — ${nome(ver)}`} onClose={() => setVer(null)}><RespostaDetalhe r={ver} os={vinculo(ver) === 'Sem vínculo' ? null : vinculo(ver)} /></Modal>}
    {trat && <TratativaModal t={trat} resposta={respostas.find(r => r.id === trat.resposta_id)} canWrite={canWrite} profileId={profile?.id ?? null} onClose={() => setTrat(null)} onSaved={async () => { setTrat(null); await load() }} />}
  </PageShell>
}

function EnviarModal({ clients, oss, contratos, profileId, onClose, onSaved }: { clients: Client[]; oss: Os[]; contratos: Contrato[]; profileId: string | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [busca, setBusca] = useState(''), [clienteId, setClienteId] = useState(''), [osId, setOsId] = useState(''), [contratoId, setContratoId] = useState(''), [contatoId, setContatoId] = useState('')
  const [contatos, setContatos] = useState<Contato[]>([]), [link, setLink] = useState(''), [envioId, setEnvioId] = useState(''), [erro, setErro] = useState(''), [salvando, setSalvando] = useState(false), [copiado, setCopiado] = useState(false)
  const label = (c: Client) => `${clientName(c)}${c.razao_social && c.nome_fantasia && c.razao_social !== c.nome_fantasia ? ` — ${c.razao_social}` : ''}`
  const osCliente = oss.filter(o => o.cliente_id === clienteId).slice(0, 40)
  const ctCliente = contratos.filter(k => k.cliente_id === clienteId)
  const contato = contatos.find(c => c.id === contatoId)
  useEffect(() => { setOsId(''); setContratoId(''); setContatoId(''); setLink(''); setContatos([]); if (!clienteId) return; void supabase.from('contatos').select('id,cliente_id,nome,email,whatsapp_e164,telefone_e164').eq('cliente_id', clienteId).is('deleted_at', null).order('nome').then(({ data }) => setContatos((data ?? []) as Contato[])) }, [clienteId])
  useEffect(() => { setLink('') }, [osId, contratoId, contatoId])
  function escolher(v: string) { setBusca(v); const c = clients.find(x => label(x).toLowerCase() === v.trim().toLowerCase()); setClienteId(c?.id || '') }
  async function gerar(canal: 'LINK' | 'WHATSAPP' | 'EMAIL') {
    setErro('')
    if (!clienteId) { setErro('Escolha o cliente.'); return null }
    if (link && envioId) { await supabase.from('satisfacao_envios').update({ canal, destino: canal === 'WHATSAPP' ? contato?.whatsapp_e164 || contato?.telefone_e164 : canal === 'EMAIL' ? contato?.email : null }).eq('id', envioId); return link }
    setSalvando(true)
    const { data, error } = await supabase.from('satisfacao_envios').insert({ cliente_id: clienteId, contrato_id: contratoId || null, ordem_servico_id: osId || null, contato_id: contatoId || null, empresa_nome: clientName(clients.find(c => c.id === clienteId)), canal, destino: canal === 'WHATSAPP' ? contato?.whatsapp_e164 || contato?.telefone_e164 || null : canal === 'EMAIL' ? contato?.email || null : null, enviado_por: profileId }).select('id,token').single()
    setSalvando(false)
    if (error || !data) { setErro(error?.message || 'Não foi possível gerar o link.'); return null }
    const l = linkDe(String(data.token)); setLink(l); setEnvioId(String(data.id)); void onSaved(); return l
  }
  async function copiar() { const l = await gerar('LINK'); if (!l) return; await navigator.clipboard.writeText(mensagem(l)); setCopiado(true); setTimeout(() => setCopiado(false), 2500) }
  async function whatsapp() { const l = await gerar('WHATSAPP'); if (!l) return; const fone = (contato?.whatsapp_e164 || contato?.telefone_e164 || '').replace(/\D/g, ''); window.open(`https://wa.me/${fone}?text=${encodeURIComponent(mensagem(l))}`, '_blank', 'noopener') }
  async function email() { const l = await gerar('EMAIL'); if (!l) return; window.location.href = `mailto:${contato?.email || ''}?subject=${encodeURIComponent('Pesquisa de satisfação MinasLab')}&body=${encodeURIComponent(mensagem(l))}` }
  return <Modal open title="Enviar pesquisa de satisfação" onClose={onClose}>
    <div className="grid gap-4">
      <label><span className="mb-1 block text-sm font-medium">Cliente *</span><input list="pesq-clientes" value={busca} onChange={e => escolher(e.target.value)} placeholder="Digite para buscar..." className="w-full rounded-xl border px-3 py-2.5" /><datalist id="pesq-clientes">{clients.map(c => <option key={c.id} value={label(c)} />)}</datalist></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="mb-1 block text-sm font-medium">Contrato <span className="font-normal text-slate-400">(opcional)</span></span><select value={contratoId} onChange={e => setContratoId(e.target.value)} disabled={!clienteId} className="w-full rounded-xl border px-3 py-2.5"><option value="">Sem contrato</option>{ctCliente.map(k => <option key={k.id} value={k.id}>{k.numero_contrato || 'Sem número'}{k.status ? ` · ${k.status}` : ''}</option>)}</select></label>
        <label><span className="mb-1 block text-sm font-medium">Ordem de serviço <span className="font-normal text-slate-400">(opcional)</span></span><select value={osId} onChange={e => setOsId(e.target.value)} disabled={!clienteId} className="w-full rounded-xl border px-3 py-2.5"><option value="">Sem OS</option>{osCliente.map(o => <option key={o.id} value={o.id}>{o.numero_os} · {fmtData(o.data_recepcao)}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Contato <span className="font-normal text-slate-400">(para WhatsApp/e-mail)</span></span><select value={contatoId} onChange={e => setContatoId(e.target.value)} disabled={!clienteId} className="w-full rounded-xl border px-3 py-2.5"><option value="">—</option>{contatos.map(c => <option key={c.id} value={c.id}>{c.nome || c.email || c.whatsapp_e164}</option>)}</select></label>
      </div>
      {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      <div className="grid gap-2 sm:grid-cols-3">
        <button disabled={salvando} onClick={() => void copiar()} className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold">{copiado ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}{copiado ? 'Copiado!' : 'Copiar mensagem'}</button>
        <button disabled={salvando} onClick={() => void whatsapp()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" />WhatsApp</button>
        <button disabled={salvando} onClick={() => void email()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-3 py-2.5 text-sm font-semibold text-white"><Mail className="h-4 w-4" />E-mail</button>
      </div>
      {link && <div className="break-all rounded-xl bg-teal-50 p-3 text-xs text-teal-900"><b className="mb-1 block text-sm">Link gerado (válido por 60 dias)</b>{link}</div>}
      <p className="text-xs text-slate-500">Cada link vale para uma resposta. A resposta aparece aqui e em Laboratório › Qualidade no painel.</p>
    </div>
  </Modal>
}

function RespostaDetalhe({ r, os }: { r: Resposta; os?: string | null }) {
  return <div className="grid gap-4 text-sm">
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-600"><span>Respondida em <b>{fmtData(r.respondido_em)}</b></span>{os && <span>Vínculo: <b>{os}</b></span>}<span>Serviços: <b>{r.servicos?.join(', ') || '—'}</b></span></div>
    <div className="grid gap-1.5 rounded-2xl border p-3">{escalaQs().filter(q => q.ativa || nota(r, q.chave) != null).map(q => { const n = nota(r, q.chave); return <div key={q.chave} className="flex justify-between gap-4"><span>{q.texto}</span><b className={n != null && n <= 2 ? 'text-red-700' : ''}>{n ?? 'N/A'}</b></div> })}</div>
    <div className="flex items-center gap-2">Recomendação: <Nps n={r.nps} /></div>
    {[...Object.entries(textosDe(r)).map(([k, v]) => [rotTexto(k), v]), ['Explicação da nota 0–6', r.explicacao_nps]].map(([t, v]) => v ? <div key={t as string}><span className="text-xs font-semibold uppercase text-slate-500">{t}</span><p className="mt-0.5 whitespace-pre-line">{v}</p></div> : null)}
    <p className="text-xs text-slate-500">{r.autoriza_anonimo ? 'Autorizou o uso anônimo dos comentários para divulgação.' : 'Não autorizou o uso dos comentários para divulgação.'}</p>
  </div>
}

function TratativaModal({ t, resposta, canWrite, profileId, onClose, onSaved }: { t: Tratativa; resposta?: Resposta; canWrite: boolean; profileId: string | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({ status: t.status, causa: t.causa || '', acao: t.acao || '', retorno_cliente: t.retorno_cliente || '' }), [erro, setErro] = useState(''), [salvando, setSalvando] = useState(false)
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro('')
    if (f.status === 'CONCLUIDA' && (!f.causa.trim() || !f.acao.trim() || !f.retorno_cliente.trim())) { setErro('Para concluir, preencha causa, ação e retorno ao cliente.'); return }
    setSalvando(true)
    const concl = f.status === 'CONCLUIDA'
    const { error } = await supabase.from('satisfacao_tratativas').update({ ...f, causa: f.causa.trim() || null, acao: f.acao.trim() || null, retorno_cliente: f.retorno_cliente.trim() || null, concluida_em: concl ? t.concluida_em || new Date().toISOString() : null, concluida_por: concl ? profileId : null, updated_at: new Date().toISOString() }).eq('id', t.id)
    if (!error && concl && t.tarefa_id) { await supabase.from('tarefas').update({ status: 'CONCLUIDA', updated_at: new Date().toISOString() }).eq('id', t.tarefa_id); await supabase.from('tarefa_responsaveis').update({ status: 'CONCLUIDA', concluida_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('tarefa_id', t.tarefa_id) }
    setSalvando(false)
    if (error) setErro(error.message); else await onSaved()
  }
  const ro = !canWrite || t.status === 'CONCLUIDA'
  return <Modal open title="Tratativa de insatisfação" onClose={onClose}><form onSubmit={salvar} className="grid gap-4 text-sm">
    <div className="rounded-2xl bg-red-50 p-3 text-red-800"><b className="block">Motivo</b>{t.motivo}<span className="mt-1 block text-xs">Prazo: {fmtData(t.prazo)}</span></div>
    {resposta && <details className="rounded-2xl border p-3"><summary className="cursor-pointer font-semibold">Ver resposta completa</summary><div className="mt-3"><RespostaDetalhe r={resposta} /></div></details>}
    <label><span className="mb-1 block font-medium">Status</span><select disabled={ro} value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className="w-full rounded-xl border px-3 py-2.5"><option value="ABERTA">Aberta</option><option value="EM ANDAMENTO">Em andamento</option><option value="CONCLUIDA">Concluída</option></select></label>
    <label><span className="mb-1 block font-medium">Análise da causa</span><textarea disabled={ro} value={f.causa} onChange={e => setF({ ...f, causa: e.target.value })} rows={3} className="w-full rounded-xl border px-3 py-2" /></label>
    <label><span className="mb-1 block font-medium">Ação tomada</span><textarea disabled={ro} value={f.acao} onChange={e => setF({ ...f, acao: e.target.value })} rows={3} className="w-full rounded-xl border px-3 py-2" /></label>
    <label><span className="mb-1 block font-medium">Retorno ao cliente</span><textarea disabled={ro} value={f.retorno_cliente} onChange={e => setF({ ...f, retorno_cliente: e.target.value })} rows={2} placeholder="Quando e como o cliente foi informado" className="w-full rounded-xl border px-3 py-2" /></label>
    {erro && <div className="rounded-xl bg-red-50 p-3 text-red-700">{erro}</div>}
    {!ro && <button disabled={salvando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white"><ClipboardCheck className="h-4 w-4" />{salvando ? 'Salvando...' : 'Salvar tratativa'}</button>}
  </form></Modal>
}

function Nps({ n }: { n: number }) { return <span className={`inline-grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs font-bold ${n >= 9 ? 'bg-emerald-100 text-emerald-800' : n >= 7 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{n}</span> }
function Status({ s }: { s: string }) { return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s === 'CONCLUIDA' ? 'bg-emerald-50 text-emerald-700' : s === 'EM ANDAMENTO' ? 'bg-sky-50 text-sky-700' : 'bg-red-50 text-red-700'}`}>{s === 'CONCLUIDA' ? 'Concluída' : s === 'EM ANDAMENTO' ? 'Em andamento' : 'Aberta'}</span> }
function K({ icon: I, label, value, hint, alert, onClick }: { icon: typeof Smile; label: string; value: string; hint?: string; alert?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} disabled={!onClick} className={`flex items-center gap-3 rounded-3xl border p-4 text-left shadow-sm ${alert ? 'border-red-200 bg-red-50' : 'bg-white'}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${alert ? 'bg-red-100 text-red-700' : 'bg-teal-50 text-teal-700'}`}><I className="h-5 w-5" /></span><span><span className="text-xs text-slate-500">{label}</span><b className={`mt-0.5 block text-xl ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value}</b>{hint && <span className="text-xs text-slate-500">{hint}</span>}</span></button>
}
