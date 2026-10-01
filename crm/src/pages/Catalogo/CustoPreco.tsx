import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ClipboardList, Search, TrendingDown } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { FichaInsumos } from './FichaInsumos'
import { chaveNome, dinheiro, tomMargem, type CustoParametro, type InsumoEstoque } from './custoInsumos'

type Filtro = 'todos' | 'com-ficha' | 'sem-ficha' | 'abaixo'
const POR_PAGINA = 30

export function CustoPreco({ canWrite, abrirParametroId, aoAbrirConsumido }: { canWrite: boolean; abrirParametroId?: string | null; aoAbrirConsumido?: () => void }) {
  const [linhas, setLinhas] = useState<CustoParametro[]>([])
  const [insumos, setInsumos] = useState<InsumoEstoque[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [limite, setLimite] = useState(50)
  const [pagina, setPagina] = useState(1)
  const [aberto, setAberto] = useState<string | null>(null)

  async function carregar() {
    setErro('')
    const [c, i] = await Promise.all([supabase.rpc('crm_custo_parametros'), supabase.rpc('crm_insumos_estoque')])
    if (c.error || i.error) setErro((c.error ?? i.error)?.message ?? 'Erro ao carregar.')
    else { setLinhas((c.data ?? []) as CustoParametro[]); setInsumos((i.data ?? []) as InsumoEstoque[]) }
    setCarregando(false)
  }
  useEffect(() => { void carregar() }, [])
  useEffect(() => { if (abrirParametroId) { setAberto(abrirParametroId); aoAbrirConsumido?.() } }, [abrirParametroId])

  const comFicha = linhas.filter(l => l.itens_ficha > 0)
  const abaixo = comFicha.filter(l => l.margem_pct != null && Number(l.margem_pct) < limite)
  const volumeTotal = linhas.reduce((s, l) => s + Number(l.analises_internas), 0)
  const volumeCoberto = comFicha.reduce((s, l) => s + Number(l.analises_internas), 0)

  const termo = chaveNome(busca)
  const filtradas = useMemo(() => linhas.filter(l =>
    (filtro === 'todos' || (filtro === 'com-ficha' && l.itens_ficha > 0) || (filtro === 'sem-ficha' && l.itens_ficha === 0) || (filtro === 'abaixo' && l.itens_ficha > 0 && l.margem_pct != null && Number(l.margem_pct) < limite)) &&
    (!termo || chaveNome(`${l.parametro} ${l.grupos ?? ''}`).includes(termo))
  ), [linhas, filtro, termo, limite])
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const atual = Math.min(pagina, totalPaginas)
  const itens = filtradas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA)
  const selecionado = aberto ? linhas.find(l => l.parametro_id === aberto) ?? null : null
  const irmaos = selecionado ? linhas.filter(l => l.parametro_id !== selecionado.parametro_id && l.itens_ficha > 0 && chaveNome(l.parametro) === chaveNome(selecionado.parametro)) : []

  if (carregando) return <div className="rounded-3xl border bg-white p-10 text-center text-sm text-slate-500">Calculando custos…</div>

  return (
    <div className="space-y-4">
      {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
        <strong>Custo × Preço:</strong> custo em insumos por análise (ficha de consumo × último preço pago nos Pedidos de Compra) contra o preço de tabela.
        Só entram parâmetros de <strong>execução interna</strong>, e o volume conta só análises feitas na casa. Mão de obra, equipamento e despesas fixas não estão no custo.
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><ClipboardList className="h-4 w-4" />Fichas preenchidas</div><div className="mt-1 text-2xl font-bold">{comFicha.length} <span className="text-sm font-normal text-slate-500">de {linhas.length}</span></div><div className="text-xs text-slate-500">cobrem {volumeTotal ? Math.round((volumeCoberto / volumeTotal) * 100) : 0}% das análises internas feitas</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><AlertTriangle className="h-4 w-4" />Margem abaixo de {limite}%</div><div className="mt-1 text-2xl font-bold text-amber-700">{abaixo.length}</div><div className="text-xs text-slate-500">{comFicha.filter(l => l.margem_pct != null && Number(l.margem_pct) < 0).length} com custo acima do preço</div></div>
        <label className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><TrendingDown className="h-4 w-4" />Margem mínima aceitável</div><div className="mt-1 flex items-center gap-2"><input type="number" min={0} max={100} value={limite} onChange={e => setLimite(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="w-24 rounded-xl border px-3 py-1.5 text-lg font-bold" /><span className="text-lg font-bold">%</span></div><div className="text-xs text-slate-500">sobre o custo de insumos</div></label>
      </div>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">{([['todos', 'Todos'], ['com-ficha', 'Com ficha'], ['sem-ficha', 'Sem ficha'], ['abaixo', 'Margem baixa']] as [Filtro, string][]).map(([v, r]) => <button key={v} type="button" onClick={() => { setFiltro(v); setPagina(1) }} className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${filtro === v ? 'bg-teal-700 text-white' : 'border bg-white text-slate-600'}`}>{r}</button>)}</div>
          <div className="relative w-full md:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={busca} onChange={e => { setBusca(e.target.value); setPagina(1) }} placeholder="Parâmetro ou grupo…" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm" /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Parâmetro</th><th className="p-3 text-right">Análises internas</th><th className="p-3 text-right">Preço</th><th className="p-3 text-right">Custo insumos</th><th className="p-3 text-right">Margem</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y">
              {itens.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nada encontrado com esse filtro.</td></tr> : itens.map(l => (
                <tr key={l.parametro_id} className="hover:bg-slate-50">
                  <td className="p-3"><div className="font-semibold text-slate-900">{l.parametro}</div><div className="text-xs text-slate-400">{l.grupos ?? 'Sem grupo'}{!l.ativo ? ' · INATIVO' : ''}</div></td>
                  <td className="p-3 text-right">{Number(l.analises_internas).toLocaleString('pt-BR')}{Number(l.analises_fora) > 0 && <div className="text-xs text-slate-400">+{Number(l.analises_fora).toLocaleString('pt-BR')} fora</div>}</td>
                  <td className="p-3 text-right">{dinheiro(l.preco)}</td>
                  <td className="p-3 text-right">{l.itens_ficha ? <>{dinheiro(l.custo_insumos)}{l.itens_sem_custo > 0 && <div className="text-xs text-amber-700">{l.itens_sem_custo} sem preço</div>}</> : <span className="text-xs text-slate-400">sem ficha</span>}</td>
                  <td className="p-3 text-right">{l.itens_ficha ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tomMargem(l.margem_pct == null ? null : Number(l.margem_pct), limite)}`}>{l.margem_pct == null ? '—' : `${Number(l.margem_pct).toLocaleString('pt-BR')}%`}</span> : null}{l.margem != null && <div className="mt-1 text-xs text-slate-500">{dinheiro(l.margem)}</div>}</td>
                  <td className="p-3 text-right"><button type="button" onClick={() => setAberto(l.parametro_id)} className="rounded-xl border px-3 py-1.5 text-xs font-semibold text-teal-700">{l.itens_ficha ? 'Ver ficha' : canWrite ? 'Montar ficha' : 'Ver'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPaginas > 1 && <div className="flex items-center justify-between border-t p-3 text-sm"><span className="text-slate-500">{filtradas.length} parâmetros · página {atual} de {totalPaginas}</span><div className="flex gap-2"><button type="button" disabled={atual <= 1} onClick={() => setPagina(atual - 1)} className="rounded-xl border px-3 py-1.5 text-xs disabled:opacity-40">Anterior</button><button type="button" disabled={atual >= totalPaginas} onClick={() => setPagina(atual + 1)} className="rounded-xl border px-3 py-1.5 text-xs disabled:opacity-40">Próxima</button></div></div>}
      </section>

      {selecionado && <FichaInsumos parametro={selecionado} insumos={insumos} irmaos={irmaos} canWrite={canWrite} limiteMargem={limite} onClose={() => setAberto(null)} onChanged={() => void carregar()} />}
    </div>
  )
}
