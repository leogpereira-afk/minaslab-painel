// Custo de insumos por parâmetro — tipos e utilitários compartilhados pela
// aba "Custo × Preço" e pela ficha de insumos do Catálogo.
//
// Regra da casa: a ficha só vale para execução INTERNA. O banco garante
// (trigger em parametro_insumos + funções crm_custo_parametros /
// crm_insumos_estoque); a tela só reflete.

export type InsumoEstoque = {
  produto_base_id: string
  produto: string
  grupo: string | null
  unidade: string
  custo_unitario: number | null
  preco_kit: number | null
  conteudo_kit: number | null
  unidade_compra: string | null
  fornecedor: string | null
  data_compra: string | null
  pedido: string | null
  situacao_preco: 'OK' | 'SEM_COMPRA' | 'UNIDADE_DIVERGENTE'
}

export type CustoParametro = {
  parametro_id: string
  parametro: string
  grupos: string | null
  ativo: boolean
  preco: number | null
  preco_minimo: number | null
  itens_ficha: number
  itens_sem_custo: number
  custo_insumos: number | null
  margem: number | null
  margem_pct: number | null
  analises_internas: number
  analises_fora: number
  // Custo TOTAL (insumos + mão de obra + equipamento + outros + despesas fixas). Nulo = nada informado ainda.
  minutos_mao_obra: number
  custo_equipamento: number
  outros_custos: number
  custo_mao_obra: number
  custo_despesas_fixas: number | null
  custo_total: number | null
  margem_total: number | null
  margem_total_pct: number | null
}

// Valores gerais da casa (linha única em crm_custo_config).
export type ConfigCusto = { custo_hora: number; pct_despesas_fixas: number }

// Mesma conta do banco (crm_custo_parametros): despesas fixas = percentual sobre o subtotal.
export function montarCustoTotal(insumos: number, minutos: number, equipamento: number, outros: number, cfg: ConfigCusto) {
  const maoObra = (minutos / 60) * cfg.custo_hora
  const subtotal = insumos + maoObra + equipamento + outros
  const despesas = (subtotal * cfg.pct_despesas_fixas) / 100
  return { insumos, maoObra, equipamento, outros, despesas, total: subtotal + despesas }
}

export type ItemFicha = {
  id: string
  parametro_id: string
  produto_base_id: string
  produto: string
  quantidade: number
  unidade: string
  observacao: string | null
  ativo: boolean
}

export const dinheiro = (v: number | null | undefined, casas = 2) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: casas })

export const dataBr = (v: string | null | undefined) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—')

const FAMILIA: Record<string, string> = { ML: 'VOLUME', L: 'VOLUME', UL: 'VOLUME', G: 'MASSA', KG: 'MASSA', MG: 'MASSA' }
const FATOR: Record<string, number> = { L: 1000, UL: 0.001, KG: 1000, MG: 0.001 }
const OPCOES: Record<string, string[]> = { VOLUME: ['mL', 'L'], MASSA: ['g', 'kg', 'mg'] }

export const familiaUnidade = (u: string) => FAMILIA[u.trim().toUpperCase()] ?? (u.trim().toUpperCase() || 'UN')
export const fatorUnidade = (u: string) => FATOR[u.trim().toUpperCase()] ?? 1
// Unidades em que a quantidade pode ser digitada para um insumo (mesma família).
export const unidadesCompativeis = (base: string) => OPCOES[familiaUnidade(base)] ?? [base || 'UN']

// Custo de uma linha da ficha: quantidade (na unidade escolhida) × custo por unidade-base do insumo.
export function custoLinha(item: Pick<ItemFicha, 'quantidade' | 'unidade'>, insumo?: InsumoEstoque | null) {
  if (!insumo || insumo.custo_unitario == null) return null
  return (Number(item.quantidade) * fatorUnidade(item.unidade)) / fatorUnidade(insumo.unidade) * Number(insumo.custo_unitario)
}

export function tomMargem(pct: number | null, limite: number) {
  if (pct == null) return 'bg-slate-100 text-slate-500'
  if (pct < 0) return 'bg-red-100 text-red-700'
  if (pct < limite) return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-700'
}

export const chaveNome = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
