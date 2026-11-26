// Controle de Kits (CRM › Gestão): frascos, sacos, placas e materiais enviados aos clientes.
// Substitui a planilha "CONTROLE DE ENVIO DE MATERIAIS". Cada envio tem prazo de devolução;
// passou do prazo, a rotina diária (kit_envios_cobrar_atrasados) cria uma tarefa de cobrança.
// A devolução é conferida item a item: o que falta ou volta danificado vira valor a cobrar.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Check, Download, MessageCircle, PackageCheck, Pencil, Phone, Plus, RefreshCw, Search, StickyNote, Trash2, X } from 'lucide-react'
import { PageShell } from '../../components/ui/PageShell'
import { Modal } from '../../components/ui/Modal'
import { Badge, Button, Card, CardBody, FieldLabel, Input, Select } from '../../components/ui/DesignSystem'
import { InlineAlert, TableEmpty, TableFooter, TableLoading } from '../../components/ui/DataDisplay'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'

type Status = 'AGUARDANDO_RETIRADA' | 'COM_CLIENTE' | 'DEVOLVIDO' | 'DEVOLVIDO_COM_FALTA' | 'CANCELADO'
type Cobranca = 'A_COBRAR' | 'COBRADO' | 'PAGO' | 'ABONADO' | null
type Item = { id: string; nome: string; retornavel: boolean; custo: number | null; ativo: boolean; ordem: number }
type EnvioItem = { id: string; envio_id: string; item_id: string | null; descricao: string; quantidade: number; devolvido: number; avariado: number; retornavel: boolean; custo_unitario: number | null }
type Evento = { id: string; envio_id: string; tipo: string; texto: string | null; automatico: boolean; created_at: string; created_by: string | null }
type Envio = {
  id: string; numero: string; cliente_id: string | null; cliente_nome: string | null; contato_id: string | null; contato_nome: string | null; contato_whatsapp: string | null
  ordem_servico_id: string | null; numero_os: string | null; data_envio: string | null; forma_envio: string | null; prazo_dias: number; data_limite: string | null; prazo_manual: boolean
  status: Status; data_devolucao: string | null; valor_a_cobrar: number; cobranca: Cobranca; responsavel_id: string | null; tarefa_atraso_id: string | null; observacoes: string | null
  created_at: string; created_by: string | null; itens: EnvioItem[]
}
type Pessoa = { id: string; nome: string | null }
type Contato = { id: string; nome: string | null; whatsapp_e164: string | null; telefone_e164: string | null }
type Linha = { item_id: string; descricao: string; quantidade: string }
type Form = { id?: string; cliente_id: string; cliente_nome: string; contato_id: string; numero_os: string; data_envio: string; forma_envio: string; prazo_dias: string; responsavel_id: string; observacoes: string; status: Status; linhas: Linha[] }

const FORMAS: [string, string][] = [['RETIRADA', 'Retirada no laboratório'], ['MOTOBOY', 'Motoboy'], ['COLETOR', 'Entregue pelo coletor'], ['CORREIO', 'Correios'], ['TRANSPORTADORA', 'Transportadora'], ['OUTRA', 'Outra']]
const NOME_FORMA = Object.fromEntries(FORMAS)
const COBRANCA: Record<string, string> = { A_COBRAR: 'A cobrar', COBRADO: 'Cobrado', PAGO: 'Pago', ABONADO: 'Abonado' }
const EVENTO_ICONE: Record<string, string> = { CRIADO: '📦', ENVIADO: '🚚', WHATSAPP: '💬', LIGACAO: '📞', NOTA: '📝', PRORROGADO: '📅', DEVOLUCAO: '✅', COBRANCA: '💰', TAREFA: '⏰', CANCELADO: '✖', EDITADO: '✏️' }
const PAGE = 25
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hoje = () => iso(new Date())
const parse = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d) }
const br = (v: string | null) => (v ? parse(v).toLocaleDateString('pt-BR') : '—')
const brCurto = (v: string | null) => (v ? parse(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—')
const dias = (de: string, ate: string) => Math.round((parse(ate).getTime() - parse(de).getTime()) / 86400000)
const quando = (v: string) => new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const somaDias = (v: string, n: number) => { const d = parse(v); d.setDate(d.getDate() + n); return iso(d) }

const comCliente = (e: Envio) => e.status === 'COM_CLIENTE'
const atrasado = (e: Envio) => comCliente(e) && !!e.data_limite && e.data_limite < hoje()
const venceLogo = (e: Envio) => comCliente(e) && !!e.data_limite && e.data_limite >= hoje() && dias(hoje(), e.data_limite) <= 2
const comFalta = (e: Envio) => e.status === 'DEVOLVIDO_COM_FALTA' && e.cobranca !== 'PAGO' && e.cobranca !== 'ABONADO'
const resumoItens = (e: Envio) => e.itens.map((i) => `${i.quantidade} ${i.descricao}`).join(', ') || '—'
const pendentes = (e: Envio) => e.itens.reduce((s, i) => s + Math.max(0, i.quantidade - i.devolvido), 0)
const valorAberto = (e: Envio) => e.itens.reduce((s, i) => s + (i.retornavel ? Math.max(0, i.quantidade - i.devolvido) : 0) * (i.custo_unitario ?? 0), 0)

function situacao(e: Envio): [string, 'brand' | 'success' | 'warning' | 'danger' | 'info'] {
  if (e.status === 'CANCELADO') return ['cancelado', 'brand']
  if (e.status === 'AGUARDANDO_RETIRADA') return ['aguardando retirada', 'warning']
  if (e.status === 'DEVOLVIDO') return ['devolvido', 'success']
  if (e.status === 'DEVOLVIDO_COM_FALTA') return [comFalta(e) ? `devolvido · faltou (${COBRANCA[e.cobranca || 'A_COBRAR']})` : `devolvido · falta ${COBRANCA[e.cobranca || ''] || ''}`.trim(), comFalta(e) ? 'warning' : 'success']
  if (atrasado(e)) return [`${dias(e.data_limite!, hoje())} dia(s) de atraso`, 'danger']
  if (venceLogo(e)) { const n = dias(hoje(), e.data_limite!); return [n === 0 ? 'vence hoje' : `vence em ${n} dia(s)`, 'warning'] }
  return ['com o cliente', 'info']
}

const FILTROS: Record<string, [string, (e: Envio) => boolean]> = {
  ATRASADOS: ['Devolução atrasada', atrasado],
  COM_CLIENTE: ['Com o cliente', comCliente],
  RETIRADA: ['Aguardando retirada', (e) => e.status === 'AGUARDANDO_RETIRADA'],
  FALTA: ['Devolvido com falta', comFalta],
  DEVOLVIDOS: ['Devolvidos', (e) => e.status === 'DEVOLVIDO' || e.status === 'DEVOLVIDO_COM_FALTA'],
  TODOS: ['Todos', (e) => e.status !== 'CANCELADO'],
}

const formVazio = (): Form => ({ cliente_id: '', cliente_nome: '', contato_id: '', numero_os: '', data_envio: hoje(), forma_envio: 'MOTOBOY', prazo_dias: '10', responsavel_id: '', observacoes: '', status: 'COM_CLIENTE', linhas: [{ item_id: '', descricao: '', quantidade: '1' }] })

export function ControleKits() {
  const { hasPermission, profile } = useAuth()
  const podeEscrever = hasPermission('crm.write') || hasPermission('operational.import')
  const [envios, setEnvios] = useState<Envio[]>([])
  const [catalogo, setCatalogo] = useState<Item[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('COM_CLIENTE')
  const [pagina, setPagina] = useState(1)
  const [selId, setSelId] = useState<string | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [devolucao, setDevolucao] = useState<{ data: string; itens: Record<string, { devolvido: string; avariado: string }>; aindaDevolve: boolean; obs: string } | null>(null)
  const [catalogoAberto, setCatalogoAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('')
    const [e, i, c, p] = await Promise.all([
      supabase.from('kit_envios').select('*').is('deleted_at', null).order('data_envio', { ascending: false, nullsFirst: true }).limit(3000),
      supabase.from('kit_envio_itens').select('*').limit(20000),
      supabase.from('kit_itens').select('*').order('ordem').order('nome'),
      supabase.from('profiles').select('id,nome').eq('ativo', true).order('nome'),
    ])
    const falha = e.error || i.error || c.error || p.error
    if (falha) { setErro(falha.message); setCarregando(false); return }
    const porEnvio = new Map<string, EnvioItem[]>()
    for (const it of (i.data ?? []) as EnvioItem[]) porEnvio.set(it.envio_id, [...(porEnvio.get(it.envio_id) ?? []), it])
    setEnvios(((e.data ?? []) as Omit<Envio, 'itens'>[]).map((x) => ({ ...x, valor_a_cobrar: Number(x.valor_a_cobrar) || 0, itens: porEnvio.get(x.id) ?? [] })))
    setCatalogo(((c.data ?? []) as Item[]).map((x) => ({ ...x, custo: x.custo == null ? null : Number(x.custo) })))
    setPessoas((p.data ?? []) as Pessoa[])
    setCarregando(false)
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const sel = envios.find((e) => e.id === selId) ?? null
  const carregarEventos = useCallback(async (id: string) => {
    const { data } = await supabase.from('kit_eventos').select('*').eq('envio_id', id).order('created_at', { ascending: false }).limit(200)
    setEventos((data ?? []) as Evento[])
  }, [])
  useEffect(() => { if (selId) void carregarEventos(selId); else setEventos([]) }, [selId, carregarEventos])
  useEffect(() => { setPagina(1) }, [busca, filtro])

  const nomePessoa = (id: string | null) => pessoas.find((p) => p.id === id)?.nome || ''
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return envios.filter((e) => FILTROS[filtro][1](e) && (!q || `${e.numero} ${e.cliente_nome || ''} ${e.contato_nome || ''} ${e.numero_os || ''} ${resumoItens(e)}`.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (filtro === 'ATRASADOS' || filtro === 'COM_CLIENTE') return String(a.data_limite || '9999').localeCompare(String(b.data_limite || '9999'))
        return String(b.data_envio || b.created_at).localeCompare(String(a.data_envio || a.created_at))
      })
  }, [envios, filtro, busca])
  const paginaLista = lista.slice((pagina - 1) * PAGE, pagina * PAGE)

  const ativos = envios.filter((e) => e.status !== 'CANCELADO')
  const atrasados = ativos.filter(atrasado)
  const comClientes = ativos.filter(comCliente)
  const retirada = ativos.filter((e) => e.status === 'AGUARDANDO_RETIRADA')
  const faltas = ativos.filter(comFalta)
  const mes = hoje().slice(0, 7)
  const devolvidosMes = ativos.filter((e) => (e.status === 'DEVOLVIDO' || e.status === 'DEVOLVIDO_COM_FALTA') && e.data_devolucao?.startsWith(mes))
  const noPrazo = devolvidosMes.filter((e) => !e.data_limite || (e.data_devolucao ?? '') <= e.data_limite).length
  const maisAntigo = atrasados.reduce((m, e) => Math.max(m, dias(e.data_limite!, hoje())), 0)
  const ranking = useMemo(() => {
    const m = new Map<string, { nome: string; itens: number; atrasados: number }>()
    for (const e of comClientes) {
      const k = e.cliente_id || e.cliente_nome || '?'
      const r = m.get(k) ?? { nome: e.cliente_nome || 'Cliente', itens: 0, atrasados: 0 }
      r.itens += pendentes(e); if (atrasado(e)) r.atrasados++
      m.set(k, r)
    }
    return [...m.values()].sort((a, b) => b.atrasados - a.atrasados || b.itens - a.itens).slice(0, 5)
  }, [comClientes])

  async function evento(envio_id: string, tipo: string, texto: string) {
    await supabase.from('kit_eventos').insert({ envio_id, tipo, texto, created_by: profile?.id ?? null })
    if (envio_id === selId) void carregarEventos(envio_id)
  }

  // ---------------------------------------------------------------- novo / editar envio
  function abrirNovo() { setForm({ ...formVazio(), responsavel_id: profile?.id ?? '' }) }
  function abrirEdicao(e: Envio) {
    setForm({
      id: e.id, cliente_id: e.cliente_id ?? '', cliente_nome: e.cliente_nome ?? '', contato_id: e.contato_id ?? '', numero_os: e.numero_os ?? '', data_envio: e.data_envio ?? hoje(),
      forma_envio: e.forma_envio ?? 'MOTOBOY', prazo_dias: String(e.prazo_dias), responsavel_id: e.responsavel_id ?? '', observacoes: e.observacoes ?? '', status: e.status,
      linhas: e.itens.map((i) => ({ item_id: i.item_id ?? '', descricao: i.descricao, quantidade: String(i.quantidade) })),
    })
  }
  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    if (!form) return
    const linhas = form.linhas.map((l) => ({ ...l, quantidade: Number(l.quantidade) })).filter((l) => (l.item_id || l.descricao.trim()) && l.quantidade > 0)
    if (!form.cliente_id && !form.cliente_nome.trim()) { setAviso('Escolha o cliente.'); return }
    if (!linhas.length) { setAviso('Inclua ao menos um item.'); return }
    if (!form.id && form.cliente_id) {
      const outros = atrasados.filter((e) => e.cliente_id === form.cliente_id)
      if (outros.length && !window.confirm(`Este cliente tem ${outros.length} envio(s) com devolução atrasada (${outros.map((e) => e.numero).join(', ')}). Enviar mesmo assim?`)) return
    }
    setSalvando(true); setAviso('')
    const dados = {
      cliente_id: form.cliente_id || null, cliente_nome: form.cliente_id ? null : form.cliente_nome.trim(), contato_id: form.contato_id || null,
      numero_os: form.numero_os.trim() || null, data_envio: form.status === 'AGUARDANDO_RETIRADA' ? null : form.data_envio || hoje(), forma_envio: form.forma_envio || null,
      prazo_dias: Math.max(0, Math.min(365, Number(form.prazo_dias) || 10)), responsavel_id: form.responsavel_id || null, observacoes: form.observacoes.trim() || null,
      updated_by: profile?.id ?? null,
      ...(form.id ? {} : { status: form.status, created_by: profile?.id ?? null }),
    }
    const res = form.id ? await supabase.from('kit_envios').update(dados).eq('id', form.id).select('id').single() : await supabase.from('kit_envios').insert(dados).select('id').single()
    if (res.error) { setAviso(res.error.message); setSalvando(false); return }
    const id = res.data.id as string
    const itens = linhas.map((l) => {
      const c = catalogo.find((x) => x.id === l.item_id)
      return { envio_id: id, item_id: c?.id ?? null, descricao: c?.nome ?? l.descricao.trim(), quantidade: l.quantidade, retornavel: c?.retornavel ?? true, custo_unitario: c?.custo ?? null }
    })
    if (form.id) {
      // Edição: refaz a lista de itens preservando o que já foi devolvido de cada um.
      const antigos = envios.find((e) => e.id === form.id)?.itens ?? []
      await supabase.from('kit_envio_itens').delete().eq('envio_id', id)
      const ins = await supabase.from('kit_envio_itens').insert(itens.map((it) => { const a = antigos.find((x) => x.descricao === it.descricao); return { ...it, devolvido: Math.min(a?.devolvido ?? 0, it.quantidade), avariado: Math.min(a?.avariado ?? 0, it.quantidade) } }))
      if (ins.error) { setAviso(ins.error.message); setSalvando(false); return }
      await evento(id, 'EDITADO', 'Envio editado.')
    } else {
      const ins = await supabase.from('kit_envio_itens').insert(itens)
      if (ins.error) { setAviso(ins.error.message); setSalvando(false); return }
      await evento(id, 'CRIADO', form.status === 'AGUARDANDO_RETIRADA' ? 'Kit separado, aguardando retirada.' : `Enviado (${NOME_FORMA[form.forma_envio] || form.forma_envio}) com prazo de ${dados.prazo_dias} dias.`)
    }
    setForm(null); setSalvando(false); setSelId(id); await carregar()
  }

  // ---------------------------------------------------------------- ações do envio
  async function atualizar(e: Envio, patch: Partial<Envio>, tipo: string, texto: string) {
    const { error } = await supabase.from('kit_envios').update({ ...patch, updated_by: profile?.id ?? null }).eq('id', e.id)
    if (error) { setAviso(error.message); return false }
    await evento(e.id, tipo, texto); await carregar(); return true
  }
  async function marcarEntregue(e: Envio) {
    await atualizar(e, { status: 'COM_CLIENTE', data_envio: hoje() }, 'ENVIADO', `Retirado/entregue em ${br(hoje())}. Prazo: ${e.prazo_dias} dias.`)
  }
  async function prorrogar(e: Envio) {
    const v = window.prompt('Nova data limite de devolução (DD/MM/AAAA):', br(somaDias(e.data_limite || hoje(), 7)))
    if (!v) return
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!m) { setAviso('Use o formato DD/MM/AAAA.'); return }
    const nova = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    await atualizar(e, { data_limite: nova, prazo_manual: true, tarefa_atraso_id: null }, 'PRORROGADO', `Prazo prorrogado de ${br(e.data_limite)} para ${br(nova)}.`)
  }
  async function nota(e: Envio, tipo: 'NOTA' | 'LIGACAO') {
    const t = window.prompt(tipo === 'LIGACAO' ? 'O que foi combinado na ligação?' : 'Anotação:')
    if (t?.trim()) await evento(e.id, tipo, t.trim())
  }
  async function whatsapp(e: Envio) {
    let fone = (e.contato_whatsapp || '').replace(/\D/g, '')
    if (!fone && e.cliente_id) {
      const { data } = await supabase.from('contatos').select('whatsapp_e164,telefone_e164').eq('cliente_id', e.cliente_id).is('deleted_at', null).order('principal', { ascending: false }).limit(1)
      fone = String(data?.[0]?.whatsapp_e164 || data?.[0]?.telefone_e164 || '').replace(/\D/g, '')
    }
    const prazo = e.data_limite ? (atrasado(e) ? `O prazo de devolução era ${br(e.data_limite)}.` : `O prazo de devolução é ${br(e.data_limite)}.`) : ''
    const msg = `Olá${e.contato_nome ? `, ${e.contato_nome.split(' ')[0]}` : ''}! Aqui é da MinasLab. Consta conosco o material enviado em ${br(e.data_envio)} (${e.numero}): ${resumoItens(e)}. ${prazo} Poderia nos informar quando será a devolução? Obrigado!`
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
    await evento(e.id, 'WHATSAPP', `Cobrança enviada pelo WhatsApp${fone ? ` (${fone})` : ''}.`)
  }
  async function cobranca(e: Envio, valor: Cobranca) {
    await atualizar(e, { cobranca: valor }, 'COBRANCA', `Cobrança da falta: ${COBRANCA[valor || ''] || '—'} (${brl.format(e.valor_a_cobrar)}).`)
  }
  async function cancelar(e: Envio) {
    if (!window.confirm(`Cancelar o envio ${e.numero}?`)) return
    await atualizar(e, { status: 'CANCELADO' }, 'CANCELADO', 'Envio cancelado.')
  }
  function abrirDevolucao(e: Envio) {
    setDevolucao({ data: hoje(), aindaDevolve: false, obs: '', itens: Object.fromEntries(e.itens.map((i) => [i.id, { devolvido: String(i.retornavel ? i.quantidade : i.devolvido), avariado: String(i.avariado) }])) })
  }
  async function salvarDevolucao(ev: FormEvent) {
    ev.preventDefault()
    if (!sel || !devolucao) return
    setSalvando(true)
    let falta = 0, valor = 0
    const partes: string[] = []
    for (const i of sel.itens) {
      const d = devolucao.itens[i.id]
      const dev = Math.max(0, Math.min(i.quantidade, Number(d?.devolvido) || 0)), av = Math.max(0, Math.min(dev, Number(d?.avariado) || 0))
      const { error } = await supabase.from('kit_envio_itens').update({ devolvido: dev, avariado: av }).eq('id', i.id)
      if (error) { setAviso(error.message); setSalvando(false); return }
      const f = i.retornavel ? i.quantidade - dev : 0
      falta += f + av; valor += (f + av) * (i.custo_unitario ?? 0)
      partes.push(`${i.descricao}: ${dev}/${i.quantidade}${av ? ` (${av} danificado)` : ''}`)
    }
    const status: Status = devolucao.aindaDevolve && falta > 0 ? 'COM_CLIENTE' : falta > 0 ? 'DEVOLVIDO_COM_FALTA' : 'DEVOLVIDO'
    const patch: Partial<Envio> = { status, data_devolucao: status === 'COM_CLIENTE' ? null : devolucao.data, valor_a_cobrar: status === 'DEVOLVIDO_COM_FALTA' ? Math.round(valor * 100) / 100 : 0, cobranca: status === 'DEVOLVIDO_COM_FALTA' ? 'A_COBRAR' : null }
    const texto = `${status === 'COM_CLIENTE' ? 'Devolução parcial' : 'Devolução conferida'} em ${br(devolucao.data)}: ${partes.join('; ')}.${status === 'DEVOLVIDO_COM_FALTA' ? ` Falta a cobrar: ${brl.format(patch.valor_a_cobrar ?? 0)}.` : ''}${devolucao.obs.trim() ? ` ${devolucao.obs.trim()}` : ''}`
    if (await atualizar(sel, patch, 'DEVOLUCAO', texto)) setDevolucao(null)
    setSalvando(false)
  }

  function exportar() {
    const cab = ['Envio', 'Cliente', 'Contato', 'OS', 'Enviado em', 'Forma', 'Devolver até', 'Situação', 'Itens', 'Itens pendentes', 'Devolvido em', 'Valor a cobrar', 'Cobrança']
    const linhas = lista.map((e) => [e.numero, e.cliente_nome || '', e.contato_nome || '', e.numero_os || '', br(e.data_envio), NOME_FORMA[e.forma_envio || ''] || '', br(e.data_limite), situacao(e)[0], resumoItens(e), String(pendentes(e)), br(e.data_devolucao), e.valor_a_cobrar ? e.valor_a_cobrar.toFixed(2).replace('.', ',') : '', COBRANCA[e.cobranca || ''] || ''])
    const csv = [cab, ...linhas].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })); a.download = `controle-de-kits-${hoje()}.csv`; a.click()
  }

  const card = (k: string, rotulo: string, valor: number, sub: string, tom = '') => (
    <button type="button" onClick={() => setFiltro(k)} className={`rounded-2xl border bg-white p-4 text-left transition hover:shadow-sm ${filtro === k ? 'border-[#00B29A] ring-2 ring-[#00B29A]/30' : 'border-slate-200'}`}>
      <span className="block text-xs font-semibold text-slate-500">{rotulo}</span>
      <strong className={`mt-1 block text-2xl ${tom}`}>{valor}</strong>
      <span className="block text-xs text-slate-500">{sub}</span>
    </button>
  )

  return (
    <PageShell title="Controle de Kits" description="Frascos, sacos, placas e materiais enviados aos clientes. Cada envio tem prazo de devolução; passou do prazo, o CRM cria uma tarefa de cobrança para o responsável."
      action={<div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void carregar()}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
        <Button variant="secondary" onClick={() => setCatalogoAberto(true)}>Catálogo de itens</Button>
        <Button variant="secondary" onClick={exportar}><Download className="h-4 w-4" /> Exportar</Button>
        {podeEscrever && <Button onClick={abrirNovo}><Plus className="h-4 w-4" /> Novo envio</Button>}
      </div>}>
      {erro && <InlineAlert>{erro}</InlineAlert>}
      {aviso && <InlineAlert variant="warning"><span className="flex items-center justify-between gap-2">{aviso}<button type="button" onClick={() => setAviso('')} aria-label="Fechar aviso"><X className="h-4 w-4" /></button></span></InlineAlert>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {card('COM_CLIENTE', 'Com clientes', comClientes.length, `envios · ${comClientes.reduce((s, e) => s + pendentes(e), 0)} itens`)}
        {card('ATRASADOS', 'Devolução atrasada', atrasados.length, atrasados.length ? `${new Set(atrasados.map((e) => e.cliente_id || e.cliente_nome)).size} cliente(s) · mais antigo ${maisAntigo} dia(s)` : 'nenhum', atrasados.length ? 'text-red-700' : '')}
        {card('RETIRADA', 'Aguardando retirada', retirada.length, 'separados no laboratório', retirada.length ? 'text-amber-700' : '')}
        {card('FALTA', 'Devolvido com falta', faltas.length, faltas.length ? `${brl.format(faltas.reduce((s, e) => s + e.valor_a_cobrar, 0))} a cobrar` : 'nada a cobrar', faltas.length ? 'text-amber-700' : '')}
        {card('DEVOLVIDOS', 'Devolvidos no mês', devolvidosMes.length, devolvidosMes.length ? `${Math.round((noPrazo / devolvidosMes.length) * 100)}% dentro do prazo` : 'nenhum ainda')}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <Card><CardBody className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
              <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Cliente, OS, número, item…" /></div>
              {Object.entries(FILTROS).map(([k, [rot, fn]]) => <button key={k} type="button" onClick={() => setFiltro(k)} className={`rounded-full border px-3 py-1 text-xs ${filtro === k ? 'border-teal-300 bg-teal-50 font-semibold text-teal-800' : 'border-slate-200 text-slate-600'}`}>{rot} <span className="text-slate-400">{ativos.filter(fn).length}</span></button>)}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Envio</th><th className="px-3 py-2.5">Cliente</th><th className="px-3 py-2.5">Itens</th><th className="px-3 py-2.5">Devolver até</th><th className="px-3 py-2.5">Situação</th></tr></thead>
                <tbody>{paginaLista.map((e) => { const [t, v] = situacao(e); return (
                  <tr key={e.id} onClick={() => setSelId(e.id)} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selId === e.id ? 'bg-teal-50/60' : ''}`}>
                    <td className="px-3 py-2.5"><b className="block whitespace-nowrap">{e.numero}</b><span className="text-xs text-slate-400">{e.numero_os ? `OS ${e.numero_os} · ` : ''}{brCurto(e.data_envio)}</span></td>
                    <td className="px-3 py-2.5"><b className="block">{e.cliente_nome || '—'}</b><span className="text-xs text-slate-400">{e.contato_nome || ''}</span></td>
                    <td className="max-w-[260px] px-3 py-2.5 text-slate-600">{resumoItens(e)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{brCurto(e.data_limite)}</td>
                    <td className="px-3 py-2.5"><Badge variant={v}>{t}</Badge></td>
                  </tr>) })}</tbody>
              </table>
              {carregando ? <TableLoading /> : lista.length === 0 && <TableEmpty label={envios.length ? 'Nenhum envio com esse filtro.' : 'Nenhum envio ainda. Comece em “Novo envio”.'} />}
            </div>
            {lista.length > PAGE && <TableFooter><span>{(pagina - 1) * PAGE + 1}–{Math.min(lista.length, pagina * PAGE)} de {lista.length}</span>
              <span className="flex gap-2"><Button variant="secondary" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button><Button variant="secondary" disabled={pagina * PAGE >= lista.length} onClick={() => setPagina(pagina + 1)}>Próxima</Button></span></TableFooter>}
          </CardBody></Card>
          {ranking.length > 0 && <Card><CardBody>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Clientes com mais itens em aberto</h3>
            {ranking.map((r) => <div key={r.nome} className="flex justify-between border-t border-slate-100 py-1.5 text-sm"><span>{r.nome}</span><b>{r.itens} item(ns){r.atrasados ? ` · ${r.atrasados} atrasado(s)` : ''}</b></div>)}
          </CardBody></Card>}
        </div>

        {sel ? <Card><CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div><h3 className="text-base font-semibold text-slate-900">{sel.numero}</h3>
              <p className="text-xs text-slate-500">{sel.cliente_id ? <Link to={`/clientes/${sel.cliente_id}`} className="text-teal-700 hover:underline">{sel.cliente_nome}</Link> : sel.cliente_nome}{sel.numero_os ? ` · OS ${sel.numero_os}` : ''}</p></div>
            <Badge variant={situacao(sel)[1]}>{situacao(sel)[0]}</Badge>
          </div>
          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">Contato</dt><dd>{sel.contato_nome || '—'}{sel.contato_whatsapp ? ` · ${sel.contato_whatsapp}` : ''}</dd>
            <dt className="text-slate-500">Enviado em</dt><dd>{br(sel.data_envio)}{sel.forma_envio ? ` · ${NOME_FORMA[sel.forma_envio]}` : ''}</dd>
            <dt className="text-slate-500">Devolver até</dt><dd><b>{br(sel.data_limite)}</b>{sel.data_envio && !sel.prazo_manual ? ` (${sel.prazo_dias} dias)` : sel.prazo_manual ? ' (prorrogado)' : ''}</dd>
            <dt className="text-slate-500">Responsável</dt><dd>{nomePessoa(sel.responsavel_id) || nomePessoa(sel.created_by) || '—'}</dd>
            {sel.data_devolucao && <><dt className="text-slate-500">Devolvido em</dt><dd>{br(sel.data_devolucao)}</dd></>}
            {sel.observacoes && <><dt className="text-slate-500">Observação</dt><dd className="whitespace-pre-wrap">{sel.observacoes}</dd></>}
          </dl>
          <div className="overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="px-2.5 py-1.5">Item</th><th className="px-2.5 py-1.5">Enviado</th><th className="px-2.5 py-1.5">Devolvido</th><th className="px-2.5 py-1.5">Custo un.</th></tr></thead>
            <tbody>{sel.itens.map((i) => <tr key={i.id} className="border-t border-slate-100"><td className="px-2.5 py-1.5">{i.descricao}{!i.retornavel && <span className="ml-1 text-slate-400">(consumível)</span>}</td><td className="px-2.5 py-1.5">{i.quantidade}</td><td className="px-2.5 py-1.5">{i.devolvido}{i.avariado ? <span className="text-red-600"> ({i.avariado} danif.)</span> : ''}</td><td className="px-2.5 py-1.5">{i.custo_unitario != null ? brl.format(i.custo_unitario) : '—'}</td></tr>)}
              {comCliente(sel) && <tr className="border-t border-slate-200 font-semibold"><td className="px-2.5 py-1.5" colSpan={3}>Valor em aberto</td><td className="px-2.5 py-1.5">{brl.format(valorAberto(sel))}</td></tr>}
              {sel.status === 'DEVOLVIDO_COM_FALTA' && <tr className="border-t border-slate-200 font-semibold"><td className="px-2.5 py-1.5" colSpan={3}>Falta a cobrar · {COBRANCA[sel.cobranca || ''] || '—'}</td><td className="px-2.5 py-1.5">{brl.format(sel.valor_a_cobrar)}</td></tr>}
            </tbody></table></div>
          {atrasado(sel) && <InlineAlert>{dias(sel.data_limite!, hoje())} dia(s) depois do prazo.{(() => { const outros = atrasados.filter((x) => x.id !== sel.id && x.cliente_id && x.cliente_id === sel.cliente_id); return outros.length ? ` Este cliente tem outro envio atrasado (${outros.map((x) => x.numero).join(', ')}).` : '' })()}{sel.tarefa_atraso_id ? ' Tarefa de cobrança criada.' : ''}</InlineAlert>}
          {podeEscrever && sel.status !== 'CANCELADO' && <div className="flex flex-wrap gap-2">
            {sel.status === 'AGUARDANDO_RETIRADA' && <Button onClick={() => void marcarEntregue(sel)}><Check className="h-4 w-4" /> Retirado / entregue hoje</Button>}
            {comCliente(sel) && <Button onClick={() => abrirDevolucao(sel)}><PackageCheck className="h-4 w-4" /> Registrar devolução</Button>}
            {comCliente(sel) && <Button variant="secondary" onClick={() => void whatsapp(sel)}><MessageCircle className="h-4 w-4" /> Cobrar no WhatsApp</Button>}
            {comCliente(sel) && <Button variant="secondary" onClick={() => void prorrogar(sel)}><CalendarPlus className="h-4 w-4" /> Prorrogar prazo</Button>}
            {sel.status === 'DEVOLVIDO_COM_FALTA' && <Select value={sel.cobranca || 'A_COBRAR'} onChange={(ev) => void cobranca(sel, ev.target.value as Cobranca)} className="w-auto">{Object.entries(COBRANCA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}
            <Button variant="secondary" onClick={() => void nota(sel, 'LIGACAO')}><Phone className="h-4 w-4" /> Ligação</Button>
            <Button variant="secondary" onClick={() => void nota(sel, 'NOTA')}><StickyNote className="h-4 w-4" /> Anotação</Button>
            <Button variant="secondary" onClick={() => abrirEdicao(sel)}><Pencil className="h-4 w-4" /> Editar</Button>
            {(sel.status === 'AGUARDANDO_RETIRADA' || comCliente(sel)) && <Button variant="danger" onClick={() => void cancelar(sel)}><Trash2 className="h-4 w-4" /> Cancelar</Button>}
          </div>}
          <div><h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">Histórico</h4>
            {eventos.length === 0 ? <p className="text-xs text-slate-400">Sem registros.</p> : <ul className="max-h-80 overflow-auto text-sm">{eventos.map((h) => <li key={h.id} className="flex gap-2 border-t border-slate-100 py-1.5">
              <span className="w-5 shrink-0">{EVENTO_ICONE[h.tipo] || '•'}</span>
              <span className="flex-1">{h.texto}{h.automatico ? <span className="text-slate-400"> · automático</span> : h.created_by ? <span className="text-slate-400"> · {nomePessoa(h.created_by)}</span> : ''}</span>
              <span className="shrink-0 text-xs text-slate-400">{quando(h.created_at)}</span></li>)}</ul>}
          </div>
        </CardBody></Card>
          : <Card><CardBody><p className="text-center text-sm text-slate-500">Clique num envio para ver os itens, registrar a devolução, cobrar pelo WhatsApp e ver o histórico.</p></CardBody></Card>}
      </div>

      <Modal open={!!form} title={form?.id ? `Editar ${envios.find((e) => e.id === form.id)?.numero ?? 'envio'}` : 'Novo envio de kit'} onClose={() => setForm(null)}>
        {form && <FormEnvio form={form} setForm={setForm} catalogo={catalogo} pessoas={pessoas} salvando={salvando} onSubmit={salvar} />}
      </Modal>

      <Modal open={!!devolucao && !!sel} title={`Registrar devolução · ${sel?.numero ?? ''}`} onClose={() => setDevolucao(null)}>
        {devolucao && sel && <form onSubmit={salvarDevolucao} className="space-y-4">
          <label className="block max-w-xs"><FieldLabel>Data da devolução</FieldLabel><Input type="date" value={devolucao.data} onChange={(ev) => setDevolucao({ ...devolucao, data: ev.target.value })} required /></label>
          <table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-1.5">Item</th><th className="py-1.5">Enviado</th><th className="py-1.5">Voltou</th><th className="py-1.5">Danificado</th></tr></thead>
            <tbody>{sel.itens.map((i) => <tr key={i.id} className="border-t border-slate-100"><td className="py-1.5">{i.descricao}{!i.retornavel && <span className="block text-xs text-slate-400">consumível: não precisa voltar</span>}</td><td className="py-1.5">{i.quantidade}</td>
              <td className="py-1.5 pr-2"><Input type="number" min={0} max={i.quantidade} value={devolucao.itens[i.id]?.devolvido ?? '0'} onChange={(ev) => setDevolucao({ ...devolucao, itens: { ...devolucao.itens, [i.id]: { ...devolucao.itens[i.id], devolvido: ev.target.value } } })} /></td>
              <td className="py-1.5"><Input type="number" min={0} max={i.quantidade} value={devolucao.itens[i.id]?.avariado ?? '0'} onChange={(ev) => setDevolucao({ ...devolucao, itens: { ...devolucao.itens, [i.id]: { ...devolucao.itens[i.id], avariado: ev.target.value } } })} /></td></tr>)}</tbody></table>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={devolucao.aindaDevolve} onChange={(ev) => setDevolucao({ ...devolucao, aindaDevolve: ev.target.checked })} /> O cliente ainda vai devolver o que falta (fica como “com o cliente”)</label>
          <label className="block"><FieldLabel>Observação</FieldLabel><Input value={devolucao.obs} onChange={(ev) => setDevolucao({ ...devolucao, obs: ev.target.value })} placeholder="Voltou pelo coletor, frasco trincado…" /></label>
          <p className="text-xs text-slate-500">O que não voltar (e o que voltar danificado) vira falta a cobrar, pelo custo do catálogo.</p>
          <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar devolução'}</Button>
        </form>}
      </Modal>

      <Modal open={catalogoAberto} title="Catálogo de itens" onClose={() => setCatalogoAberto(false)}>
        <Catalogo itens={catalogo} podeEscrever={podeEscrever} aoMudar={carregar} avisar={setAviso} />
      </Modal>
    </PageShell>
  )
}

function FormEnvio({ form, setForm, catalogo, pessoas, salvando, onSubmit }: { form: Form; setForm: (f: Form) => void; catalogo: Item[]; pessoas: Pessoa[]; salvando: boolean; onSubmit: (e: FormEvent) => void }) {
  const [busca, setBusca] = useState(form.cliente_nome)
  const [opcoes, setOpcoes] = useState<{ id: string; nome: string }[]>([])
  const [contatos, setContatos] = useState<Contato[]>([])
  useEffect(() => {
    const q = busca.trim()
    if (form.cliente_id || q.length < 2) { setOpcoes([]); return }
    const t = setTimeout(async () => {
      const like = `%${q.replace(/[%_,()]/g, ' ')}%`
      const { data } = await supabase.from('clientes').select('id,razao_social,nome_fantasia').is('deleted_at', null).or(`razao_social.ilike.${like},nome_fantasia.ilike.${like}`).order('razao_social').limit(8)
      setOpcoes((data ?? []).map((c) => ({ id: c.id as string, nome: (c.nome_fantasia as string) || (c.razao_social as string) })))
    }, 250)
    return () => clearTimeout(t)
  }, [busca, form.cliente_id])
  useEffect(() => {
    if (!form.cliente_id) { setContatos([]); return }
    void supabase.from('contatos').select('id,nome,whatsapp_e164,telefone_e164').eq('cliente_id', form.cliente_id).is('deleted_at', null).order('principal', { ascending: false }).then(({ data }) => setContatos((data ?? []) as Contato[]))
  }, [form.cliente_id])
  const ativos = catalogo.filter((c) => c.ativo)
  const linha = (i: number, patch: Partial<Linha>) => setForm({ ...form, linhas: form.linhas.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="relative sm:col-span-2"><FieldLabel>Cliente *</FieldLabel>
        {form.cliente_id ? <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><b>{form.cliente_nome}</b><button type="button" className="text-xs text-teal-700 underline" onClick={() => { setForm({ ...form, cliente_id: '', contato_id: '' }); setBusca('') }}>trocar</button></div>
          : <><Input value={busca} onChange={(e) => { setBusca(e.target.value); setForm({ ...form, cliente_nome: e.target.value }) }} placeholder="Digite o nome do cliente" autoComplete="off" />
            {opcoes.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{opcoes.map((o) => <button key={o.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50" onClick={() => { setForm({ ...form, cliente_id: o.id, cliente_nome: o.nome }); setBusca(o.nome); setOpcoes([]) }}>{o.nome}</button>)}</div>}
            <span className="mt-1 block text-xs text-slate-400">Escolha da lista para ligar ao cadastro. Se não achar, o nome digitado fica guardado.</span></>}
      </label>
      <label><FieldLabel>Contato que recebe</FieldLabel><Select value={form.contato_id} onChange={(e) => setForm({ ...form, contato_id: e.target.value })} disabled={!form.cliente_id}><option value="">{form.cliente_id ? '—' : 'escolha o cliente'}</option>{contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.whatsapp_e164 || c.telefone_e164 ? ` · ${c.whatsapp_e164 || c.telefone_e164}` : ''}</option>)}</Select></label>
      <label><FieldLabel>Nº da OS (opcional)</FieldLabel><Input value={form.numero_os} onChange={(e) => setForm({ ...form, numero_os: e.target.value })} placeholder="01121" /></label>
      {!form.id && <label className="sm:col-span-2"><FieldLabel>Situação</FieldLabel><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}><option value="COM_CLIENTE">Já saiu / entregue ao cliente</option><option value="AGUARDANDO_RETIRADA">Separado, aguardando retirada</option></Select></label>}
      {form.status !== 'AGUARDANDO_RETIRADA' && <label><FieldLabel>Data do envio</FieldLabel><Input type="date" value={form.data_envio} onChange={(e) => setForm({ ...form, data_envio: e.target.value })} /></label>}
      <label><FieldLabel>Forma de envio</FieldLabel><Select value={form.forma_envio} onChange={(e) => setForm({ ...form, forma_envio: e.target.value })}>{FORMAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></label>
      <label><FieldLabel>Prazo para devolver (dias)</FieldLabel><Input type="number" min={0} max={365} value={form.prazo_dias} onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })} /></label>
      <label><FieldLabel>Responsável por cobrar</FieldLabel><Select value={form.responsavel_id} onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}><option value="">—</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></label>
      <div className="sm:col-span-2"><FieldLabel>Itens *</FieldLabel>
        <div className="space-y-2">{form.linhas.map((l, i) => <div key={i} className="flex gap-2">
          <Select className="flex-1" value={l.item_id || (l.descricao ? '__outro' : '')} onChange={(e) => linha(i, e.target.value === '__outro' ? { item_id: '', descricao: l.descricao || ' ' } : { item_id: e.target.value, descricao: '' })}>
            <option value="">Escolha o item</option>{ativos.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.retornavel ? '' : ' (consumível)'}</option>)}<option value="__outro">Outro (digitar)</option></Select>
          {!l.item_id && l.descricao !== '' && <Input className="flex-1" value={l.descricao.trimStart()} onChange={(e) => linha(i, { descricao: e.target.value || ' ' })} placeholder="Descrição do item" />}
          <Input className="w-20" type="number" min={1} value={l.quantidade} onChange={(e) => linha(i, { quantidade: e.target.value })} aria-label="Quantidade" />
          <button type="button" className="px-2 text-slate-400 hover:text-red-600" onClick={() => setForm({ ...form, linhas: form.linhas.filter((_, j) => j !== i) })} aria-label="Tirar item"><Trash2 className="h-4 w-4" /></button>
        </div>)}</div>
        <button type="button" className="mt-2 text-sm font-semibold text-teal-700" onClick={() => setForm({ ...form, linhas: [...form.linhas, { item_id: '', descricao: '', quantidade: '1' }] })}>+ adicionar item</button>
      </div>
      <label className="sm:col-span-2"><FieldLabel>Observação</FieldLabel><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="04 placas e 01 branco…" /></label>
      <div className="sm:col-span-2"><Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar envio'}</Button></div>
    </form>
  )
}

function Catalogo({ itens, podeEscrever, aoMudar, avisar }: { itens: Item[]; podeEscrever: boolean; aoMudar: () => Promise<void>; avisar: (s: string) => void }) {
  const [novo, setNovo] = useState({ nome: '', retornavel: true, custo: '' })
  async function salvar(i: Item, patch: Partial<Item>) {
    const { error } = await supabase.from('kit_itens').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', i.id)
    if (error) avisar(error.message); else await aoMudar()
  }
  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!novo.nome.trim()) return
    const { error } = await supabase.from('kit_itens').insert({ nome: novo.nome.trim(), retornavel: novo.retornavel, custo: novo.custo ? Number(novo.custo.replace(',', '.')) : null })
    if (error) avisar(error.message.includes('duplicate') ? 'Já existe um item com esse nome.' : error.message)
    else { setNovo({ nome: '', retornavel: true, custo: '' }); await aoMudar() }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">O custo é usado para calcular o valor a cobrar quando o item não volta ou volta danificado. Item consumível (saco, swab, esponja) não precisa voltar.</p>
      <table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-1.5">Item</th><th className="py-1.5">Volta?</th><th className="py-1.5">Custo un. (R$)</th><th className="py-1.5">Ativo</th></tr></thead>
        <tbody>{itens.map((i) => <tr key={i.id} className="border-t border-slate-100">
          <td className="py-1.5">{i.nome}</td>
          <td className="py-1.5"><input type="checkbox" disabled={!podeEscrever} checked={i.retornavel} onChange={(e) => void salvar(i, { retornavel: e.target.checked })} aria-label={`${i.nome} volta`} /></td>
          <td className="py-1.5"><Input className="w-28" disabled={!podeEscrever} defaultValue={i.custo != null ? String(i.custo).replace('.', ',') : ''} onBlur={(e) => { const v = e.target.value.trim(); const n = v ? Number(v.replace(',', '.')) : null; if (n !== i.custo && (n == null || !Number.isNaN(n))) void salvar(i, { custo: n }) }} placeholder="—" /></td>
          <td className="py-1.5"><input type="checkbox" disabled={!podeEscrever} checked={i.ativo} onChange={(e) => void salvar(i, { ativo: e.target.checked })} aria-label={`${i.nome} ativo`} /></td>
        </tr>)}</tbody></table>
      {podeEscrever && <form onSubmit={criar} className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
        <label className="flex-1"><FieldLabel>Novo item</FieldLabel><Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Frasco âmbar 250 mL" /></label>
        <label><FieldLabel>Custo (R$)</FieldLabel><Input className="w-28" value={novo.custo} onChange={(e) => setNovo({ ...novo, custo: e.target.value })} /></label>
        <label className="flex items-center gap-1.5 pb-2 text-sm"><input type="checkbox" checked={novo.retornavel} onChange={(e) => setNovo({ ...novo, retornavel: e.target.checked })} /> volta</label>
        <Button type="submit">Adicionar</Button>
      </form>}
    </div>
  )
}
