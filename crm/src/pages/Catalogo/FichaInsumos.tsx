import { useEffect, useMemo, useState } from 'react'
import { Copy, FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { supabase } from '../../services/supabase'
import { chaveNome, custoLinha, dataBr, dinheiro, tomMargem, unidadesCompativeis, type CustoParametro, type InsumoEstoque, type ItemFicha } from './custoInsumos'

type Props = {
  parametro: CustoParametro
  insumos: InsumoEstoque[]
  irmaos: CustoParametro[]
  canWrite: boolean
  limiteMargem: number
  onClose: () => void
  onChanged: () => void
}

const CAMPOS = 'id,parametro_id,produto_base_id,produto,quantidade,unidade,observacao,ativo'
const vazio = { produtoBaseId: '', quantidade: '', unidade: '', observacao: '' }

export function FichaInsumos({ parametro, insumos, irmaos, canWrite, limiteMargem, onClose, onChanged }: Props) {
  const [itens, setItens] = useState<ItemFicha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [form, setForm] = useState(vazio)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)

  const porId = useMemo(() => new Map(insumos.map(i => [i.produto_base_id, i])), [insumos])
  const escolhido = form.produtoBaseId ? porId.get(form.produtoBaseId) ?? null : null
  const termo = chaveNome(busca)
  const sugestoes = termo.length < 2 ? [] : insumos.filter(i => chaveNome(`${i.produto} ${i.produto_base_id} ${i.grupo ?? ''}`).includes(termo)).slice(0, 25)

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase.from('parametro_insumos').select(CAMPOS).eq('parametro_id', parametro.parametro_id).eq('ativo', true).order('created_at')
    if (error) setErro(error.message)
    else setItens((data ?? []) as ItemFicha[])
    setCarregando(false)
  }
  useEffect(() => { void carregar() }, [parametro.parametro_id])

  const linhas = itens.map(it => ({ it, insumo: porId.get(it.produto_base_id) ?? null, custo: custoLinha(it, porId.get(it.produto_base_id)) }))
  const total = linhas.reduce((s, l) => s + (l.custo ?? 0), 0)
  const semCusto = linhas.filter(l => l.custo == null).length
  const preco = parametro.preco == null ? null : Number(parametro.preco)
  const margemPct = itens.length && preco && preco > 0 ? ((preco - total) / preco) * 100 : null

  function escolher(i: InsumoEstoque) {
    setForm(f => ({ ...f, produtoBaseId: i.produto_base_id, unidade: i.unidade || 'UN' }))
    setBusca('')
  }
  function editar(it: ItemFicha) {
    setForm({ produtoBaseId: it.produto_base_id, quantidade: String(it.quantidade), unidade: it.unidade, observacao: it.observacao ?? '' })
    setAviso(''); setErro('')
  }

  async function gravar(registros: { produto_base_id: string; quantidade: number; unidade: string; observacao: string | null }[]) {
    for (const r of registros) {
      const existente = itens.find(i => i.produto_base_id === r.produto_base_id)
      const resp = existente
        ? await supabase.from('parametro_insumos').update({ quantidade: r.quantidade, unidade: r.unidade, observacao: r.observacao }).eq('id', existente.id)
        : await supabase.from('parametro_insumos').insert({ parametro_id: parametro.parametro_id, produto: porId.get(r.produto_base_id)?.produto ?? r.produto_base_id, ...r })
      if (resp.error) throw new Error(resp.error.message)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!canWrite) return
    setErro(''); setAviso('')
    const qtd = Number(String(form.quantidade).replace(',', '.'))
    if (!escolhido) return setErro('Escolha o insumo na lista.')
    if (!(qtd > 0)) return setErro('Informe a quantidade gasta por análise (maior que zero).')
    setSalvando(true)
    try {
      await gravar([{ produto_base_id: escolhido.produto_base_id, quantidade: qtd, unidade: form.unidade || escolhido.unidade, observacao: form.observacao.trim() || null }])
      setForm(vazio)
      await carregar(); onChanged()
    } catch (x) { setErro(x instanceof Error ? x.message : 'Não foi possível salvar.') }
    finally { setSalvando(false) }
  }

  async function remover(it: ItemFicha) {
    if (!canWrite || !confirm(`Tirar ${it.produto} da ficha?`)) return
    const { error } = await supabase.from('parametro_insumos').update({ ativo: false }).eq('id', it.id)
    if (error) setErro(error.message)
    else { await carregar(); onChanged() }
  }

  async function copiarDe(origem: CustoParametro) {
    if (!canWrite) return
    setErro(''); setAviso('')
    const { data, error } = await supabase.from('parametro_insumos').select(CAMPOS).eq('parametro_id', origem.parametro_id).eq('ativo', true)
    if (error) return setErro(error.message)
    const lista = (data ?? []) as ItemFicha[]
    if (!lista.length) return setAviso('A ficha de origem está vazia.')
    setSalvando(true)
    try {
      await gravar(lista.map(i => ({ produto_base_id: i.produto_base_id, quantidade: Number(i.quantidade), unidade: i.unidade, observacao: i.observacao })))
      setAviso(`${lista.length} insumo(s) copiado(s) de ${origem.grupos ?? 'outro grupo'}. Confira se o consumo é o mesmo.`)
      await carregar(); onChanged()
    } catch (x) { setErro(x instanceof Error ? x.message : 'Não foi possível copiar.') }
    finally { setSalvando(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Insumos por análise — ${parametro.parametro}`}>
      <div className="space-y-5 text-sm">
        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-teal-900">
          <p><strong>{parametro.grupos ?? 'Sem grupo'}</strong> · execução interna · {parametro.analises_internas.toLocaleString('pt-BR')} análises internas registradas{parametro.analises_fora > 0 ? ` (outras ${parametro.analises_fora.toLocaleString('pt-BR')} foram terceirizadas/externas e não consomem insumo da casa)` : ''}.</p>
          <p className="mt-1 text-xs">Informe quanto de cada insumo <strong>uma</strong> análise consome. O custo usa o último preço pago nos Pedidos de Compra da Gestão de Estoque e se atualiza sozinho a cada compra.</p>
        </div>

        {erro && <div className="rounded-xl bg-red-50 p-3 text-red-700">{erro}</div>}
        {aviso && <div className="rounded-xl bg-amber-50 p-3 text-amber-800">{aviso}</div>}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border p-4"><div className="text-xs font-semibold uppercase text-slate-500">Custo em insumos</div><div className="mt-1 text-xl font-bold">{itens.length ? dinheiro(total) : '—'}</div>{semCusto > 0 && <div className="mt-1 text-xs text-amber-700">{semCusto} insumo(s) sem preço de compra</div>}</div>
          <div className="rounded-2xl border p-4"><div className="text-xs font-semibold uppercase text-slate-500">Preço de tabela</div><div className="mt-1 text-xl font-bold">{dinheiro(preco)}</div>{parametro.preco_minimo ? <div className="mt-1 text-xs text-slate-500">mínimo {dinheiro(parametro.preco_minimo)}</div> : null}</div>
          <div className="rounded-2xl border p-4"><div className="text-xs font-semibold uppercase text-slate-500">Margem sobre insumos</div><div className="mt-1 flex items-center gap-2 text-xl font-bold">{preco != null && itens.length ? dinheiro(preco - total) : '—'}{margemPct != null && <span className={`rounded-full px-2 py-0.5 text-xs ${tomMargem(margemPct, limiteMargem)}`}>{margemPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>}</div></div>
        </div>

        {canWrite && irmaos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-xs text-slate-600">
            <Copy className="h-4 w-4" />Mesmo parâmetro em outro grupo já tem ficha:
            {irmaos.map(i => <button key={i.parametro_id} type="button" disabled={salvando} onClick={() => void copiarDe(i)} className="rounded-lg border bg-white px-2.5 py-1 font-semibold text-teal-700">Copiar de {i.grupos ?? 'outro grupo'} ({i.itens_ficha})</button>)}
          </div>
        )}

        <section className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Insumo</th><th className="p-3 text-right">Por análise</th><th className="p-3">Último preço pago</th><th className="p-3 text-right">Custo</th>{canWrite && <th className="p-3" />}</tr></thead>
            <tbody className="divide-y">
              {carregando ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Carregando…</td></tr>
                : !linhas.length ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Nenhum insumo na ficha ainda.</td></tr>
                : linhas.map(({ it, insumo, custo }) => (
                  <tr key={it.id}>
                    <td className="p-3"><div className="font-semibold">{it.produto}</div><div className="text-xs text-slate-400">{it.produto_base_id}{it.observacao ? ` · ${it.observacao}` : ''}</div></td>
                    <td className="p-3 text-right">{Number(it.quantidade).toLocaleString('pt-BR')} {it.unidade}</td>
                    <td className="p-3 text-xs">{insumo?.situacao_preco === 'OK'
                      ? <>{dinheiro(insumo.preco_kit)} / {Number(insumo.conteudo_kit).toLocaleString('pt-BR')} {insumo.unidade_compra}<div className="text-slate-400">{insumo.fornecedor} · {dataBr(insumo.data_compra)}{insumo.pedido ? ` · ${insumo.pedido}` : ''}</div></>
                      : <span className="text-amber-700">{insumo?.situacao_preco === 'UNIDADE_DIVERGENTE' ? 'Compra em unidade diferente do cadastro' : 'Sem compra registrada'}</span>}</td>
                    <td className="p-3 text-right font-semibold">{custo == null ? '—' : dinheiro(custo, 4)}</td>
                    {canWrite && <td className="p-3"><div className="flex justify-end gap-1"><button type="button" title="Editar" onClick={() => editar(it)} className="rounded-lg border p-1.5 text-slate-600"><Pencil className="h-4 w-4" /></button><button type="button" title="Tirar da ficha" onClick={() => void remover(it)} className="rounded-lg border p-1.5 text-red-600"><Trash2 className="h-4 w-4" /></button></div></td>}
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        {canWrite && (
          <form onSubmit={salvar} className="space-y-3 rounded-2xl border bg-slate-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-700"><FlaskConical className="h-4 w-4 text-teal-700" />{escolhido && itens.some(i => i.produto_base_id === escolhido.produto_base_id) ? 'Alterar insumo' : 'Adicionar insumo'}</div>
            <div className="relative">
              <span className="mb-1 block text-xs font-medium">Insumo (cadastro de Produtos Base do estoque)</span>
              {escolhido
                ? <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2.5"><span><strong>{escolhido.produto}</strong> <span className="text-xs text-slate-400">{escolhido.produto_base_id} · {escolhido.unidade}</span></span><button type="button" className="text-xs font-semibold text-teal-700" onClick={() => setForm(vazio)}>trocar</button></div>
                : <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Digite o nome ou código ML…" className="w-full rounded-xl border px-3 py-2.5" />}
              {!escolhido && sugestoes.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-white shadow-lg">
                  {sugestoes.map(i => <button type="button" key={i.produto_base_id} onClick={() => escolher(i)} className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-xs hover:bg-slate-50"><span className="font-semibold">{i.produto}</span><span className="shrink-0 text-slate-400">{i.produto_base_id} · {i.custo_unitario != null ? `${dinheiro(i.custo_unitario, 4)}/${i.unidade}` : 'sem preço'}</span></button>)}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label><span className="mb-1 block text-xs font-medium">Quantidade por análise</span><input inputMode="decimal" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} className="w-full rounded-xl border px-3 py-2.5" placeholder="ex.: 1 ou 2,5" /></label>
              <label><span className="mb-1 block text-xs font-medium">Unidade</span><select value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })} disabled={!escolhido} className="w-full rounded-xl border px-3 py-2.5">{(escolhido ? unidadesCompativeis(escolhido.unidade) : ['—']).map(u => <option key={u} value={u}>{u}</option>)}</select></label>
              <label><span className="mb-1 block text-xs font-medium">Observação (opcional)</span><input value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} className="w-full rounded-xl border px-3 py-2.5" placeholder="ex.: diluição 1:10" /></label>
            </div>
            {escolhido && Number(String(form.quantidade).replace(',', '.')) > 0 && <p className="text-xs text-slate-600">Custo desta linha: <strong>{(() => { const c = custoLinha({ quantidade: Number(String(form.quantidade).replace(',', '.')), unidade: form.unidade || escolhido.unidade }, escolhido); return c == null ? 'sem preço de compra para calcular' : dinheiro(c, 4) })()}</strong></p>}
            <div className="flex justify-end"><button disabled={salvando || !escolhido} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{salvando ? 'Salvando…' : 'Salvar na ficha'}</button></div>
          </form>
        )}
      </div>
    </Modal>
  )
}
