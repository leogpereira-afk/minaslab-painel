// E-mail (caixa contato@ da Hostinger) no estilo webmail: pastas, lista, leitura e escrita.
// Os e-mails são lidos pela função email-atendimento a cada 5 minutos (entrada e enviados)
// e ficam em email_mensagens; os enviados por aqui também vão para "Enviados" do webmail.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Forward, Image as ImageIcon, Inbox, Link2, Mail, MailOpen, Paperclip, PenSquare, RefreshCw, Reply, ReplyAll, Search, Send, UserRoundPlus, X } from 'lucide-react'
import { PageShell } from '../../components/ui/PageShell'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'

type Anexo = { nome: string; tipo?: string | null; tamanho?: number | null; caminho: string }
type Resumo = { id: string; direcao: 'RECEIVED' | 'SENT'; de_email: string | null; de_nome: string | null; para: string[]; assunto: string | null; texto_resumido: string | null; anexos: Anexo[]; recebido_em: string; lido: boolean; lead_id: string | null; automatica: boolean }
type Completo = Resumo & { message_id: string; cc: string[]; texto: string | null; html: string | null; referencias: string[] }
type LeadMini = { id: string; nome: string | null; email_contato: string | null; empresa_contato: string | null; status: string | null }
type Pasta = 'ENTRADA' | 'NAO_LIDOS' | 'SEM_ATENDIMENTO' | 'AUTOMATICOS' | 'ENVIADOS'
type Rascunho = { para: string; cc: string; assunto: string; texto: string; responderA: string; leadId: string | null; titulo: string }

const POR_PAGINA = 50
const PASTAS: { k: Pasta; rotulo: string; Icone: typeof Inbox }[] = [
  { k: 'ENTRADA', rotulo: 'Entrada', Icone: Inbox },
  { k: 'NAO_LIDOS', rotulo: 'Não lidos', Icone: Mail },
  { k: 'SEM_ATENDIMENTO', rotulo: 'Sem atendimento', Icone: UserRoundPlus },
  { k: 'AUTOMATICOS', rotulo: 'Automáticos', Icone: Bot },
  { k: 'ENVIADOS', rotulo: 'Enviados', Icone: Send },
]
const CAMPOS = 'id,direcao,de_email,de_nome,para,assunto,texto_resumido,anexos,recebido_em,lido,lead_id,automatica'
const hojeOuData = (v: string) => { const d = new Date(v), h = new Date(); return d.toDateString() === h.toDateString() ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: d.getFullYear() === h.getFullYear() ? undefined : '2-digit' }) }
const dataHora = (v: string) => new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const tamanho = (n?: number | null) => !n ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
const nomeArquivo = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80)
const quemDe = (m: Resumo) => m.direcao === 'SENT' ? `Para: ${m.para.join(', ') || '—'}` : (m.de_nome || m.de_email || '—')
const citar = (m: Completo) => `\n\n\nEm ${dataHora(m.recebido_em)}, ${m.de_nome ? `${m.de_nome} <${m.de_email}>` : m.de_email} escreveu:\n${(m.texto_resumido || m.texto || '').split('\n').map((l) => `> ${l}`).join('\n')}`
const comPrefixo = (p: string, a: string | null) => (new RegExp(`^${p}:`, 'i').test(a || '') ? a || '' : `${p}: ${a || ''}`)

async function abrirAnexo(caminho: string) {
  const i = caminho.indexOf(':')
  const { data, error } = await supabase.storage.from(caminho.slice(0, i)).createSignedUrl(caminho.slice(i + 1), 600)
  if (error || !data?.signedUrl) { window.alert('Não foi possível abrir o anexo.'); return }
  window.open(data.signedUrl, '_blank', 'noopener')
}

// Corpo original num quadro isolado: sem scripts e, até o usuário pedir, sem imagens externas
// (evita "pixels" que avisam o remetente que o e-mail foi aberto).
function CorpoHtml({ html, imagens }: { html: string; imagens: boolean }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: cid:${imagens ? ' https: http:' : ''}"><base target="_blank"><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.45;color:#0f172a;margin:12px;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}blockquote{border-left:3px solid #cbd5e1;margin:0 0 0 4px;padding-left:10px;color:#475569}</style></head><body>${html}</body></html>`
  return <iframe title="Conteúdo do e-mail" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} className="h-full min-h-[420px] w-full flex-1 rounded-lg border bg-white" />
}

export function Email() {
  const { hasPermission } = useAuth(), podeEscrever = hasPermission('crm.write')
  const [pasta, setPasta] = useState<Pasta>('ENTRADA'), [q, setQ] = useState(''), [busca, setBusca] = useState(''), [pagina, setPagina] = useState(0)
  const [lista, setLista] = useState<Resumo[]>([]), [total, setTotal] = useState(0), [contagens, setContagens] = useState<Record<string, number>>({})
  const [carregando, setCarregando] = useState(true), [erro, setErro] = useState('')
  const [selId, setSelId] = useState<string | null>(null), [sel, setSel] = useState<Completo | null>(null), [lead, setLead] = useState<LeadMini | null>(null)
  const [imagens, setImagens] = useState(false), [textoPuro, setTextoPuro] = useState(false)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null), [arquivo, setArquivo] = useState<File | null>(null), [enviando, setEnviando] = useState(false), [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [ligando, setLigando] = useState(false), [buscaLead, setBuscaLead] = useState(''), [leadsAchados, setLeadsAchados] = useState<LeadMini[]>([])

  useEffect(() => { const t = setTimeout(() => { setBusca(q.trim().replace(/[,()%*]/g, ' ')); setPagina(0) }, 350); return () => clearTimeout(t) }, [q])

  const filtrar = useCallback((consulta: any, p: Pasta) => {
    if (p === 'ENVIADOS') return consulta.eq('direcao', 'SENT')
    consulta = consulta.eq('direcao', 'RECEIVED')
    if (p === 'ENTRADA') return consulta.eq('automatica', false)
    if (p === 'NAO_LIDOS') return consulta.eq('lido', false).eq('automatica', false)
    if (p === 'SEM_ATENDIMENTO') return consulta.is('lead_id', null).eq('automatica', false)
    return consulta.eq('automatica', true)
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('')
    let c = filtrar(supabase.from('email_mensagens').select(CAMPOS, { count: 'exact' }), pasta)
    if (busca) c = c.or(`assunto.ilike.%${busca}%,de_email.ilike.%${busca}%,de_nome.ilike.%${busca}%,texto_resumido.ilike.%${busca}%`)
    const r = await c.order('recebido_em', { ascending: false }).range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1)
    if (r.error) setErro(r.error.message); else { setLista((r.data ?? []) as Resumo[]); setTotal(r.count ?? 0) }
    const conta = await Promise.all((['NAO_LIDOS', 'SEM_ATENDIMENTO'] as Pasta[]).map(async (p) => [p, (await filtrar(supabase.from('email_mensagens').select('id', { count: 'exact', head: true }), p)).count ?? 0] as const))
    setContagens(Object.fromEntries(conta))
    setCarregando(false)
  }, [pasta, busca, pagina, filtrar])
  useEffect(() => { void carregar() }, [carregar])
  // A caixa é lida a cada 5 min no servidor; a tela se atualiza sozinha a cada minuto.
  useEffect(() => { const t = setInterval(() => void carregar(), 60000); return () => clearInterval(t) }, [carregar])

  // Abrir um e-mail: corpo completo, atendimento ligado e marca como lido.
  useEffect(() => {
    if (!selId) { setSel(null); setLead(null); return }
    let ativo = true
    void (async () => {
      const { data } = await supabase.from('email_mensagens').select(`${CAMPOS},message_id,cc,texto,html,referencias`).eq('id', selId).single()
      if (!ativo || !data) return
      const m = data as Completo
      setSel(m); setImagens(false); setTextoPuro(false); setLigando(false); setAviso(null)
      if (m.lead_id) { const l = await supabase.from('leads').select('id,nome,email_contato,empresa_contato,status').eq('id', m.lead_id).single(); if (ativo) setLead((l.data as LeadMini) ?? null) } else setLead(null)
      if (!m.lido && m.direcao === 'RECEIVED') {
        await supabase.rpc('email_marcar_lido', { p_ids: [m.id], p_lido: true })
        setLista((ls) => ls.map((x) => x.id === m.id ? { ...x, lido: true } : x)); setContagens((c) => ({ ...c, NAO_LIDOS: Math.max(0, (c.NAO_LIDOS || 1) - 1) }))
      }
    })()
    return () => { ativo = false }
  }, [selId])

  async function marcarNaoLido() {
    if (!sel) return
    await supabase.rpc('email_marcar_lido', { p_ids: [sel.id], p_lido: false })
    setLista((ls) => ls.map((x) => x.id === sel.id ? { ...x, lido: false } : x)); setSelId(null); void carregar()
  }
  async function sincronizar() {
    setSincronizando(true)
    const { data, error } = await supabase.functions.invoke('email-atendimento', { body: { acao: 'buscar' } })
    if (error || !data?.ok) setAviso({ ok: false, texto: data?.erro || error?.message || 'Não foi possível ler a caixa agora.' })
    await carregar(); setSincronizando(false)
  }

  function escrever(tipo: 'novo' | 'responder' | 'todos' | 'encaminhar') {
    setArquivo(null); setAviso(null)
    if (tipo === 'novo' || !sel) { setRascunho({ para: '', cc: '', assunto: '', texto: '', responderA: '', leadId: null, titulo: 'Novo e-mail' }); return }
    if (tipo === 'encaminhar') {
      setRascunho({ para: '', cc: '', assunto: comPrefixo('Enc', sel.assunto), texto: `\n\n\n---------- Mensagem encaminhada ----------\nDe: ${sel.de_nome ? `${sel.de_nome} <${sel.de_email}>` : sel.de_email}\nData: ${dataHora(sel.recebido_em)}\nAssunto: ${sel.assunto || ''}\nPara: ${sel.para.join(', ')}\n\n${sel.texto || ''}`, responderA: '', leadId: sel.lead_id, titulo: 'Encaminhar' })
      return
    }
    const destino = sel.direcao === 'RECEIVED' ? (sel.de_email || '') : (sel.para[0] || '')
    const outros = tipo === 'todos' ? [...sel.para, ...sel.cc].filter((e) => e && e !== destino && !/@([a-z0-9-]+\.)*minaslab\./i.test(e)) : []
    setRascunho({ para: destino, cc: outros.join(', '), assunto: comPrefixo('Re', sel.assunto), texto: citar(sel), responderA: sel.message_id, leadId: sel.lead_id, titulo: tipo === 'todos' ? 'Responder a todos' : 'Responder' })
  }
  async function enviar() {
    if (!rascunho) return
    if (arquivo && arquivo.size > 16 * 1024 * 1024) { setAviso({ ok: false, texto: 'O anexo passa de 16 MB.' }); return }
    setEnviando(true); setAviso(null)
    let anexo = ''
    if (arquivo) {
      anexo = `${rascunho.leadId || 'webmail'}/email-${Date.now()}-${nomeArquivo(arquivo.name)}`
      const up = await supabase.storage.from('chatpro-envios').upload(anexo, arquivo, { contentType: arquivo.type || undefined, upsert: false })
      if (up.error) { setAviso({ ok: false, texto: `Não foi possível subir o anexo: ${up.error.message}` }); setEnviando(false); return }
    }
    const { data, error } = await supabase.functions.invoke('email-atendimento', { body: { acao: 'enviar', lead_id: rascunho.leadId || undefined, para: rascunho.para, cc: rascunho.cc, assunto: rascunho.assunto, texto: rascunho.texto, responder_a: rascunho.responderA || undefined, anexo: anexo || undefined } })
    if (error || !data?.ok) setAviso({ ok: false, texto: data?.erro || error?.message || 'O e-mail não foi enviado.' })
    else { setRascunho(null); setArquivo(null); setAviso({ ok: true, texto: 'E-mail enviado. Ele também aparece em Enviados no webmail.' }); void carregar() }
    setEnviando(false)
  }

  useEffect(() => {
    if (!ligando) return
    const termo = buscaLead.trim().replace(/[,()%*]/g, ' ')
    const t = setTimeout(async () => {
      let c = supabase.from('leads').select('id,nome,email_contato,empresa_contato,status').is('deleted_at', null).order('updated_at', { ascending: false }).limit(8)
      if (termo) c = c.or(`nome.ilike.%${termo}%,email_contato.ilike.%${termo}%,empresa_contato.ilike.%${termo}%,telefone_whatsapp.ilike.%${termo}%`)
      else if (sel?.de_email) c = c.ilike('email_contato', sel.de_email)
      const r = await c; setLeadsAchados((r.data ?? []) as LeadMini[])
    }, 300)
    return () => clearTimeout(t)
  }, [ligando, buscaLead, sel?.de_email])
  async function ligar(leadId: string | null) {
    if (!sel) return
    const { data, error } = await supabase.rpc('email_ligar', { p_email: sel.id, p_lead: leadId })
    if (error) { setAviso({ ok: false, texto: error.message.includes('interno') ? 'E-mail interno da MinasLab não vira atendimento.' : `Não foi possível ligar: ${error.message}` }); return }
    setLigando(false); setAviso({ ok: true, texto: leadId ? 'E-mail ligado ao atendimento.' : 'Atendimento criado a partir do e-mail.' })
    const l = await supabase.from('leads').select('id,nome,email_contato,empresa_contato,status').eq('id', data as string).single()
    setLead((l.data as LeadMini) ?? null); setSel((s) => s ? { ...s, lead_id: data as string } : s); void carregar()
  }

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const tituloPasta = useMemo(() => PASTAS.find((p) => p.k === pasta)?.rotulo, [pasta])

  return <PageShell title="E-mail" description="Caixa contato@minaslab.net dentro do CRM. Tudo continua também no webmail da Hostinger." action={podeEscrever ? <button onClick={() => escrever('novo')} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white"><PenSquare className="h-3.5 w-3.5" />Escrever</button> : undefined}>
    {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}
    <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-200px)] lg:grid-cols-[190px_minmax(280px,380px)_minmax(0,1fr)]">
      {/* Pastas */}
      <nav className="flex gap-1 overflow-x-auto border-b p-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r" aria-label="Pastas">
        {PASTAS.map(({ k, rotulo, Icone }) => <button key={k} onClick={() => { setPasta(k); setPagina(0); setSelId(null) }} className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold ${pasta === k ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-100' : 'text-slate-600 hover:bg-slate-50'}`}>
          <Icone className="h-4 w-4" /><span className="flex-1">{rotulo}</span>{contagens[k] ? <span className="rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] text-white">{contagens[k]}</span> : null}
        </button>)}
        <button onClick={() => void sincronizar()} disabled={sincronizando} className="mt-auto hidden items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50 lg:flex"><RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />{sincronizando ? 'Lendo a caixa...' : 'Atualizar caixa'}</button>
      </nav>

      {/* Lista */}
      <section className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
        <div className="shrink-0 border-b p-2"><div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar em ${tituloPasta}...`} className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs outline-none" /></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {carregando && !lista.length ? <p className="p-6 text-center text-xs text-slate-500">Carregando...</p>
            : !lista.length ? <p className="p-6 text-center text-xs text-slate-500">Nenhum e-mail aqui.</p>
            : lista.map((m) => <button key={m.id} onClick={() => setSelId(m.id)} className={`block w-full border-b px-3 py-2.5 text-left ${selId === m.id ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
              <div className="flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-xs ${!m.lido ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{!m.lido && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-sky-600 align-middle" />}{quemDe(m)}</span><span className="shrink-0 text-[10px] text-slate-400">{hojeOuData(m.recebido_em)}</span></div>
              <div className={`mt-0.5 truncate text-xs ${!m.lido ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{m.assunto || '(sem assunto)'}</div>
              <div className="mt-0.5 flex items-center gap-1.5"><span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">{(m.texto_resumido || '').replace(/\s+/g, ' ').slice(0, 140)}</span>{m.anexos?.length > 0 && <Paperclip className="h-3 w-3 shrink-0 text-slate-400" />}{m.lead_id && <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">Atendimento</span>}</div>
            </button>)}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t px-3 py-1.5 text-[11px] text-slate-500"><span>{total} e-mail(s)</span><span className="flex items-center gap-1"><button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} className="rounded border px-2 py-0.5 disabled:opacity-40">‹</button>{pagina + 1}/{paginas}<button disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)} className="rounded border px-2 py-0.5 disabled:opacity-40">›</button></span></div>
      </section>

      {/* Leitura */}
      <section className="flex min-h-0 flex-col">
        {!sel ? <div className="grid flex-1 place-items-center p-8 text-center text-xs text-slate-500"><div><MailOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" />Escolha um e-mail para ler.{aviso && <p className={`mt-3 rounded-lg px-3 py-2 ${aviso.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{aviso.texto}</p>}</div></div> : <>
          <header className="shrink-0 space-y-2 border-b p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 flex-1 text-sm font-bold text-slate-900">{sel.assunto || '(sem assunto)'}</h2><button onClick={() => setSelId(null)} className="rounded p-1 text-slate-400 hover:text-slate-700 lg:hidden" aria-label="Fechar"><X className="h-4 w-4" /></button></div>
            <div className="text-[11px] leading-5 text-slate-600"><div><strong className="text-slate-800">De:</strong> {sel.de_nome ? `${sel.de_nome} <${sel.de_email}>` : sel.de_email}</div><div><strong className="text-slate-800">Para:</strong> {sel.para.join(', ') || '—'}</div>{sel.cc.length > 0 && <div><strong className="text-slate-800">Cc:</strong> {sel.cc.join(', ')}</div>}<div className="text-slate-400">{dataHora(sel.recebido_em)}</div></div>
            {podeEscrever && <div className="flex flex-wrap gap-1.5">
              <button onClick={() => escrever('responder')} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"><Reply className="h-3.5 w-3.5" />Responder</button>
              <button onClick={() => escrever('todos')} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"><ReplyAll className="h-3.5 w-3.5" />Responder a todos</button>
              <button onClick={() => escrever('encaminhar')} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"><Forward className="h-3.5 w-3.5" />Encaminhar</button>
              {sel.direcao === 'RECEIVED' && <button onClick={() => void marcarNaoLido()} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold text-slate-500"><Mail className="h-3.5 w-3.5" />Marcar como não lido</button>}
            </div>}
            {/* Atendimento */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px]">
              {lead ? <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-slate-600">Atendimento: <strong className="text-slate-800">{lead.nome || lead.email_contato || 'sem nome'}</strong>{lead.empresa_contato ? ` · ${lead.empresa_contato}` : ''}{lead.status ? ` · ${lead.status}` : ''}</span><Link to={`/leads/${lead.id}`} className="font-semibold text-blue-700">Abrir atendimento</Link></div>
                : !ligando ? <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-slate-500">{sel.automatica ? 'Mensagem automática (não vira atendimento sozinha).' : 'Este e-mail não está ligado a um atendimento.'}</span>{podeEscrever && <span className="flex gap-1.5"><button onClick={() => void ligar(null)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 font-semibold text-white"><UserRoundPlus className="h-3 w-3" />Criar atendimento</button><button onClick={() => { setLigando(true); setBuscaLead('') }} className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 font-semibold text-slate-700"><Link2 className="h-3 w-3" />Ligar a um existente</button></span>}</div>
                : <div className="space-y-1.5"><div className="flex items-center gap-1.5"><input autoFocus value={buscaLead} onChange={(e) => setBuscaLead(e.target.value)} placeholder="Buscar atendimento por nome, e-mail, empresa ou telefone" className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none" /><button onClick={() => setLigando(false)} className="rounded p-1 text-slate-400" aria-label="Cancelar"><X className="h-3.5 w-3.5" /></button></div>
                  {leadsAchados.length === 0 ? <p className="text-slate-400">Nenhum atendimento encontrado.</p> : leadsAchados.map((l) => <button key={l.id} onClick={() => void ligar(l.id)} className="block w-full rounded-md bg-white px-2 py-1 text-left hover:bg-sky-50"><strong>{l.nome || l.email_contato || 'sem nome'}</strong><span className="text-slate-500">{l.empresa_contato ? ` · ${l.empresa_contato}` : ''}{l.status ? ` · ${l.status}` : ''}</span></button>)}</div>}
            </div>
            {aviso && <div className={`rounded-lg px-2.5 py-1.5 text-[11px] ${aviso.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{aviso.texto}</div>}
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
            {sel.anexos?.length > 0 && <div className="flex flex-wrap gap-1.5">{sel.anexos.map((a, i) => <button key={i} onClick={() => void abrirAnexo(a.caminho)} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"><Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{a.nome}</span>{a.tamanho ? <span className="font-normal text-slate-400">{tamanho(a.tamanho)}</span> : null}</button>)}</div>}
            {sel.html && <div className="flex flex-wrap items-center gap-3 text-[11px]">{!textoPuro && !imagens && <button onClick={() => setImagens(true)} className="inline-flex items-center gap-1 font-semibold text-sky-700"><ImageIcon className="h-3.5 w-3.5" />Mostrar imagens</button>}<button onClick={() => setTextoPuro((t) => !t)} className="font-semibold text-slate-500">{textoPuro ? 'Ver com formatação' : 'Ver só o texto'}</button></div>}
            {sel.html && !textoPuro ? <CorpoHtml html={sel.html} imagens={imagens} /> : <div className="whitespace-pre-wrap break-words rounded-lg border bg-white p-3 text-[13px] leading-relaxed text-slate-800">{sel.texto || '(sem conteúdo)'}</div>}
          </div>
        </>}
      </section>
    </div>

    {/* Escrever / responder */}
    {rascunho && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-2 sm:items-center" role="dialog" aria-label={rascunho.titulo}>
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-2.5"><strong className="flex items-center gap-1.5 text-sm"><Mail className="h-4 w-4 text-sky-600" />{rascunho.titulo}</strong><button onClick={() => setRascunho(null)} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Fechar"><X className="h-4 w-4" /></button></div>
        <div className="space-y-2 overflow-y-auto p-4">
          <input value={rascunho.para} onChange={(e) => setRascunho({ ...rascunho, para: e.target.value })} placeholder="Para (separe vários com vírgula)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" aria-label="Para" />
          <input value={rascunho.cc} onChange={(e) => setRascunho({ ...rascunho, cc: e.target.value })} placeholder="Cc (opcional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" aria-label="Cópia" />
          <input value={rascunho.assunto} onChange={(e) => setRascunho({ ...rascunho, assunto: e.target.value })} placeholder="Assunto" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" aria-label="Assunto" />
          <textarea value={rascunho.texto} onChange={(e) => setRascunho({ ...rascunho, texto: e.target.value })} rows={12} placeholder="Escreva a mensagem..." className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-slate-400" aria-label="Mensagem" />
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600"><Paperclip className="h-4 w-4" />{arquivo ? `${arquivo.name} (${tamanho(arquivo.size)})` : 'Anexar arquivo (até 16 MB)'}<input type="file" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></label>
          {rascunho.titulo === 'Encaminhar' && sel?.anexos?.length ? <p className="text-[11px] text-amber-700">Os anexos do e-mail original não vão junto; anexe de novo se precisar.</p> : null}
          {aviso && !aviso.ok && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{aviso.texto}</div>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5"><span className="text-[11px] text-slate-500">Sai por contato@minaslab.net e fica em Enviados no webmail.</span><button disabled={enviando || !rascunho.para.trim() || !rascunho.assunto.trim() || !rascunho.texto.trim()} onClick={() => void enviar()} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Send className="h-3.5 w-3.5" />{enviando ? 'Enviando...' : 'Enviar'}</button></div>
      </div>
    </div>}
  </PageShell>
}
