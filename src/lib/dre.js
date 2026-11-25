// DRE MENSAL (25/11/2026). Calculado no navegador a partir da cópia do financeiro; nada aqui grava.
//
// Linhas pelo plano de contas (categorias_financeiras: fluxo › agrupamento › grupo):
//   Receita bruta              agrupamento RECEITA LÍQUIDA, grupo RECEITA
//   (−) Impostos s/ receita    agrupamento RECEITA LÍQUIDA, grupo IMPOSTO SOBRE RECEITA
//   = Receita líquida
//   (−) Custos                 agrupamento CUSTOS E DESPESAS, grupo CUSTOS
//   (−) Despesas               agrupamento CUSTOS E DESPESAS, grupo DESPESAS
//   (−) Sem categoria          lançamento sem categoria do plano: entra no resultado, à mostra
//   = Resultado operacional
// Investimento, financiamento (sócios, empréstimos, mútuos) e transferências ficam em "fora do resultado".
//
// Regimes:
// - competência: receita no mês de emissão da NF de saída (empresa + número); sem NF, a data de emissão da
//   Omie; sem nenhuma, o vencimento (contado em "aproximados"). Despesa no mês do lançamento (ou vencimento).
// - caixa: baixas não estornadas no mês do pagamento; sem baixas, a data de pagamento com o valor pago
//   (títulos conciliados e da Omie), como o painel (financeiroPainel.js).
// Consolidado: sai o que uma empresa fatura para a outra, dos dois lados (pelo CNPJ), e o valor tirado fica
// em "eliminado".
// Cada linha positiva aumenta o resultado; dedução é negativa. Somas em centavos.

const norm = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const digitos = (v) => String(v || "").replace(/\D/g, "");
const centavos = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const dia = (v) => String(v || "").slice(0, 10);
const cancelado = (t) => t?.apagado || ["CANCELADO", "CANCELADA"].includes(norm(t?.status));
const brParaIso = (v) => {
  const m = String(v || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : dia(v);
};

export const LINHAS = [
  { id: "receita", rotulo: "Receita bruta", tipo: "valor" },
  { id: "impostos", rotulo: "(−) Impostos sobre a receita", tipo: "valor" },
  { id: "receitaLiquida", rotulo: "= Receita líquida", tipo: "subtotal", soma: ["receita", "impostos"] },
  { id: "custos", rotulo: "(−) Custos", tipo: "valor" },
  { id: "despesas", rotulo: "(−) Despesas", tipo: "valor" },
  { id: "semCategoria", rotulo: "(−) Sem categoria do plano", tipo: "valor" },
  { id: "resultado", rotulo: "= Resultado operacional", tipo: "subtotal", soma: ["receita", "impostos", "custos", "despesas", "semCategoria"] },
  { id: "margem", rotulo: "Margem (resultado ÷ receita líquida)", tipo: "margem" },
];

export function classificarCategoria(c) {
  if (!c || !c.agrupamento) return "sem";
  const fluxo = norm(c.fluxo), agr = norm(c.agrupamento), grupo = norm(c.grupo);
  if (fluxo && !fluxo.includes("OPERACIONAL")) return "fora";
  if (agr.includes("RECEITA")) return grupo.includes("IMPOSTO") ? "impostos" : "receita";
  if (grupo.includes("CUSTO")) return "custos";
  return "despesas";
}

// Valor por mês "AAAA-MM" de um título no regime de caixa.
function caixaPorMes(t, campo) {
  const r = new Map();
  const somar = (data, v) => {
    const m = dia(data).slice(0, 7);
    if (m) r.set(m, (r.get(m) || 0) + centavos(v));
  };
  const baixas = (t.baixas || []).filter((b) => !b.estornada);
  if (baixas.length) baixas.forEach((b) => somar(b.data_pagamento, b.valor));
  else if (t.data_pagamento && Number(t[campo]) > 0) somar(t.data_pagamento, t[campo]);
  return r;
}

export function montarDre({ receber = [], pagar = [], notas = [], categorias = [], empresas = [], empresaId = "", ano, regime = "competencia" }) {
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
  const idxMes = new Map(meses.map((m, i) => [m, i]));
  const cats = new Map(categorias.map((c) => [c.id, c]));
  const doEscopo = (t) => !empresaId || t.empresa_id === empresaId;

  // Consolidado: CNPJ de cada empresa, para tirar o que uma fatura para a outra.
  const cnpjEmpresa = new Map(empresas.map((e) => [e.id, digitos(e.cnpj)]));
  const entreEmpresas = (t) => {
    if (empresaId) return false;
    const doc = digitos(t.cnpj_cpf);
    return !!doc && [...cnpjEmpresa.entries()].some(([id, cnpj]) => id !== t.empresa_id && cnpj && cnpj === doc);
  };

  // Emissão da NF de saída: prioridade para a nota ligada ao título, depois empresa + número.
  const nfPorTitulo = new Map(), nfPorNumero = new Map();
  for (const n of notas) {
    if (n.apagado || norm(n.tipo) === "ENTRADA" || !n.data_emissao) continue;
    const d = dia(n.data_emissao);
    if (n.recebimento_id && (!nfPorTitulo.has(n.recebimento_id) || d < nfPorTitulo.get(n.recebimento_id))) nfPorTitulo.set(n.recebimento_id, d);
    const k = `${n.empresa_id}|${String(n.numero_nf || "").trim()}`;
    if (String(n.numero_nf || "").trim() && (!nfPorNumero.has(k) || d < nfPorNumero.get(k))) nfPorNumero.set(k, d);
  }
  let aproximados = 0;
  const competenciaReceita = (t) => {
    const nf = nfPorTitulo.get(t.id) || nfPorNumero.get(`${t.empresa_id}|${String(t.numero_nf || "").trim()}`);
    if (nf) return { data: nf };
    const omie = brParaIso(t.dados_omie?.data_emissao);
    if (omie) return { data: omie };
    return { data: dia(t.data_vencimento), aproximado: true };
  };

  // Acumuladores em centavos: linha -> categoria -> mês, e os lançamentos de cada célula.
  const acc = new Map(), fora = new Map();
  const eliminado = { receita: 0, despesa: 0 };
  const lancar = (destino, chave, nomeCat, mes, valorC, lanc) => {
    const i = idxMes.get(mes);
    if (i === undefined || !valorC) return;
    if (!destino.has(chave)) destino.set(chave, new Map());
    const porCat = destino.get(chave);
    if (!porCat.has(nomeCat)) porCat.set(nomeCat, { valores: Array(12).fill(0), lancamentos: Array.from({ length: 12 }, () => []) });
    const c = porCat.get(nomeCat);
    c.valores[i] += valorC;
    c.lancamentos[i].push({ ...lanc, valor: valorC / 100 });
  };

  const processar = (lista, tipo) => {
    const sinal = tipo === "REC" ? 1 : -1;
    const campoValor = tipo === "REC" ? "valor_previsto" : "valor_original";
    const campoPago = tipo === "REC" ? "valor_recebido" : "valor_pago";
    for (const t of lista) {
      if (cancelado(t) || !doEscopo(t)) continue;
      const comp = regime === "caixa" ? null : tipo === "REC" ? competenciaReceita(t) : { data: dia(t.data_lancamento || t.data_vencimento) };
      const parcelas = comp ? new Map([[comp.data.slice(0, 7), centavos(t[campoValor])]]) : caixaPorMes(t, campoPago);
      if (entreEmpresas(t)) {
        for (const [m, v] of parcelas) if (idxMes.has(m)) eliminado[tipo === "REC" ? "receita" : "despesa"] += v;
        continue;
      }
      if (comp?.aproximado && idxMes.has(comp.data.slice(0, 7))) aproximados++;
      const c = cats.get(t.categoria_id);
      const classe = classificarCategoria(c);
      const nomeCat = c?.nome || t.categoria_texto || "Sem categoria";
      const lanc = { id: t.id, tipo, nome: tipo === "REC" ? t.cliente : t.fornecedor, nf: t.numero_nf || "", empresa_id: t.empresa_id, data: regime === "caixa" ? dia(t.data_pagamento) : "" };
      for (const [m, v] of parcelas) {
        if (classe === "fora") lancar(fora, c.agrupamento, nomeCat, m, sinal * v, lanc);
        else lancar(acc, classe, nomeCat, m, sinal * v, lanc);
      }
    }
  };
  processar(receber, "REC");
  processar(pagar, "DESP");

  const montarLinha = (porCat) => {
    const categoriasLinha = [...(porCat?.entries() || [])]
      .map(([nome, c]) => ({ nome, valores: c.valores.map((v) => v / 100), total: c.valores.reduce((s, v) => s + v, 0) / 100, lancamentos: c.lancamentos }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const valoresC = Array(12).fill(0);
    for (const [, c] of porCat || []) c.valores.forEach((v, i) => (valoresC[i] += v));
    return { valoresC, categorias: categoriasLinha };
  };

  const base = new Map();
  for (const id of ["receita", "impostos", "custos", "despesas", "semCategoria"]) base.set(id, montarLinha(acc.get(id === "semCategoria" ? "sem" : id)));
  const linhas = LINHAS.map((l) => {
    if (l.tipo === "valor") {
      const b = base.get(l.id);
      return { ...l, valores: b.valoresC.map((v) => v / 100), total: b.valoresC.reduce((s, v) => s + v, 0) / 100, categorias: b.categorias };
    }
    if (l.tipo === "subtotal") {
      const valoresC = Array(12).fill(0);
      l.soma.forEach((id) => base.get(id).valoresC.forEach((v, i) => (valoresC[i] += v)));
      return { ...l, valores: valoresC.map((v) => v / 100), total: valoresC.reduce((s, v) => s + v, 0) / 100, categorias: [] };
    }
    return { ...l, categorias: [] };
  });
  const rl = linhas.find((l) => l.id === "receitaLiquida"), res = linhas.find((l) => l.id === "resultado"), margem = linhas.find((l) => l.id === "margem");
  margem.valores = rl.valores.map((v, i) => (Math.abs(v) > 0.005 ? res.valores[i] / v : null));
  margem.total = Math.abs(rl.total) > 0.005 ? res.total / rl.total : null;

  const foraLinhas = [...fora.entries()]
    .map(([rotulo, porCat]) => {
      const b = montarLinha(porCat);
      return { id: `fora:${rotulo}`, rotulo, valores: b.valoresC.map((v) => v / 100), total: b.valoresC.reduce((s, v) => s + v, 0) / 100, categorias: b.categorias };
    })
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));

  return {
    ano, regime, meses, linhas, fora: foraLinhas, aproximados,
    eliminado: { receita: eliminado.receita / 100, despesa: eliminado.despesa / 100 },
  };
}

// Lançamentos de uma linha (ou de uma categoria dela) num mês; mes = null traz o ano inteiro.
export function lancamentosDaCelula(dre, linhaId, mes, categoria = null) {
  const linha = [...dre.linhas, ...dre.fora].find((l) => l.id === linhaId);
  if (!linha) return [];
  const cats = categoria ? linha.categorias.filter((c) => c.nome === categoria) : linha.categorias;
  return cats.flatMap((c) => (mes === null ? c.lancamentos.flat() : c.lancamentos[mes] || []).map((x) => ({ ...x, categoria: c.nome })));
}
