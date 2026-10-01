// Histórico de preços da Gestão de Estoque: onde compramos cada insumo e por
// quanto. Serve para ninguém comprar de novo mais caro sem saber.
//
// FONTE: os itens de Pedido de Compra (coleção estoque_pedidos). Cada item já
// guarda fornecedor, data e o valor POR KIT. As entradas de estoque
// (estoque_lotes) ficam de fora de propósito: lá o "valorNF" é a nota inteira,
// não o preço do item, e comparar isso com preço unitário daria número errado.
//
// Regras:
//  - Só conta como "compra" o item que saiu de PENDENTE (autorizado, concluído,
//    integrado...). PENDENTE é cotação em aberto; CANCELADO/REPROVADO não
//    aconteceram.
//  - Valor simbólico (R$ 0,01 — doação, brinde) aparece no histórico mas não
//    vira "menor preço": senão todo pedido novo pareceria caro.
//  - Kits de tamanhos diferentes são comparados pelo preço por unidade de
//    conteúdo (R$/mL, R$/g, R$/UN) quando todas as compras têm conteúdo e a
//    mesma unidade; caso contrário, pelo preço do kit.

const STATUS_FORA = new Set(["PENDENTE", "CANCELADO", "REPROVADO", "EXCLUÍDO", "EXCLUIDO"]);
const VALOR_SIMBOLICO = 0.01;
// Diferença abaixo disto é arredondamento de cotação, não "mais caro".
export const TOLERANCIA = 0.01;
// Mais que o dobro quase nunca é "ficou mais caro": é outro modelo/tamanho com
// o mesmo nome (ex.: placa de Petri de vidro x descartável) ou kit cadastrado
// com conteúdo diferente. Nesses casos a tela pede conferência, não acusa preço.
export const LIMITE_DUVIDOSO = 1;

const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export function chaveTexto(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const statusDoItem = (it) => chaveTexto(it?.status) || "PENDENTE";

export function normalizarCompras(pedidos = []) {
  return pedidos
    .map((it) => {
      const valorKit = num(it?.valor);
      const conteudoKit = num(it?.conteudoKit);
      const status = statusDoItem(it);
      const efetiva = !STATUS_FORA.has(status);
      const simbolico = valorKit > 0 && valorKit <= VALOR_SIMBOLICO;
      const especificacao = String(it?.especificacao ?? "").trim();
      return {
        id: String(it?.id ?? ""),
        pedido: String(it?.pedidoCodigo || it?.codigoPc || it?.idPedido || it?.codigoPedido || ""),
        produto: String(it?.produto ?? "").trim(),
        chave: chaveTexto(it?.produto),
        grupo: String(it?.grupo ?? "").toUpperCase(),
        especificacao: chaveTexto(especificacao) === "GERAL" ? "" : especificacao,
        fornecedor: String(it?.fornecedor ?? "").trim(),
        chaveFornecedor: chaveTexto(it?.fornecedor),
        cnpj: String(it?.cnpj ?? ""),
        data: String(it?.dataPedido || it?.dataCriacao || "").slice(0, 10),
        valorKit,
        conteudoKit,
        unidade: String(it?.unidade || "UN"),
        quantidadeKits: num(it?.quantidadeKits) || 1,
        valorPorUnidade: conteudoKit > 0 ? valorKit / conteudoKit : null,
        status,
        efetiva,
        simbolico,
        // Entra na conta de "último" e "menor" preço pago.
        valida: efetiva && !simbolico,
      };
    })
    .filter((c) => c.chave && c.valorKit > 0);
}

const maisRecentePrimeiro = (a, b) =>
  String(b.data).localeCompare(String(a.data)) || String(b.pedido).localeCompare(String(a.pedido), undefined, { numeric: true });

// Base de comparação de um conjunto de compras do MESMO produto.
export function baseComparacao(compras) {
  const lista = compras.filter((c) => c.valida);
  if (!lista.length) return "kit";
  const unidades = new Set(lista.map((c) => chaveTexto(c.unidade)));
  return lista.every((c) => c.conteudoKit > 0) && unidades.size === 1 ? "unidade" : "kit";
}

export const precoNaBase = (c, base) => (base === "unidade" && c.valorPorUnidade != null ? c.valorPorUnidade : c.valorKit);

export function resumirProduto(compras) {
  const ordenadas = [...compras].sort(maisRecentePrimeiro);
  const validas = ordenadas.filter((c) => c.valida);
  const base = baseComparacao(ordenadas);
  const preco = (c) => precoNaBase(c, base);
  const ultima = validas[0] ?? null;
  const menor = validas.reduce((m, c) => (!m || preco(c) < preco(m) ? c : m), null);
  const maior = validas.reduce((m, c) => (!m || preco(c) > preco(m) ? c : m), null);

  const porFornecedor = new Map();
  for (const c of ordenadas) {
    const k = c.chaveFornecedor || "(SEM FORNECEDOR)";
    if (!porFornecedor.has(k)) porFornecedor.set(k, { fornecedor: c.fornecedor || "—", cnpj: c.cnpj, compras: [] });
    porFornecedor.get(k).compras.push(c);
  }
  const fornecedores = [...porFornecedor.values()]
    .map((f) => {
      const v = f.compras.filter((c) => c.valida);
      return {
        fornecedor: f.fornecedor,
        cnpj: f.cnpj,
        qtdCompras: v.length,
        ultima: v[0] ?? null,
        menor: v.reduce((m, c) => (!m || preco(c) < preco(m) ? c : m), null),
        emAberto: f.compras.filter((c) => c.status === "PENDENTE").length,
      };
    })
    .sort((a, b) => {
      if (!a.menor) return 1;
      if (!b.menor) return -1;
      return preco(a.menor) - preco(b.menor);
    });

  const variacao = ultima && menor && preco(menor) > 0 ? preco(ultima) / preco(menor) - 1 : 0;
  return {
    produto: ordenadas[0]?.produto ?? "",
    chave: ordenadas[0]?.chave ?? "",
    grupo: ordenadas.find((c) => c.grupo)?.grupo ?? "",
    unidade: ultima?.unidade ?? ordenadas[0]?.unidade ?? "UN",
    base,
    ultima,
    menor,
    maior,
    // Quanto a última compra ficou acima da menor já paga (0,15 = 15%).
    ultimaAcimaDoMenor: variacao > TOLERANCIA && variacao <= LIMITE_DUVIDOSO ? variacao : 0,
    comparacaoDuvidosa: variacao > LIMITE_DUVIDOSO,
    fornecedores,
    compras: ordenadas,
    qtdCompras: validas.length,
  };
}

export function resumirPorProduto(pedidos = []) {
  const grupos = new Map();
  for (const c of normalizarCompras(pedidos)) {
    if (!grupos.has(c.chave)) grupos.set(c.chave, []);
    grupos.get(c.chave).push(c);
  }
  return [...grupos.values()]
    .map(resumirProduto)
    .sort((a, b) => String(b.compras[0]?.data).localeCompare(String(a.compras[0]?.data)) || a.produto.localeCompare(b.produto, "pt-BR"));
}

// Confere um valor que está sendo digitado num pedido novo contra o histórico.
export function avaliarValor(resumo, { valor, conteudoKit, unidade } = {}) {
  if (!resumo || !resumo.menor) return { situacao: "sem-historico" };
  const valorKit = num(valor);
  if (valorKit <= 0) return { situacao: "sem-valor" };
  const conteudo = num(conteudoKit);
  const mesmaUnidade = chaveTexto(unidade || resumo.unidade) === chaveTexto(resumo.unidade);
  const usarUnidade = resumo.base === "unidade" && conteudo > 0 && mesmaUnidade;
  const base = usarUnidade ? "unidade" : "kit";
  const informado = usarUnidade ? valorKit / conteudo : valorKit;
  const referencia = precoNaBase(resumo.menor, base);
  if (!(referencia > 0)) return { situacao: "sem-historico" };
  const diferenca = informado / referencia - 1;
  const situacao = diferenca > LIMITE_DUVIDOSO ? "duvidosa" : diferenca > TOLERANCIA ? "acima" : diferenca < -TOLERANCIA ? "abaixo" : "igual";
  return { situacao, diferenca, base, informado, referencia };
}

export function encontrarResumo(resumos, produto) {
  const k = chaveTexto(produto);
  return k ? resumos.find((r) => r.chave === k) ?? null : null;
}

export const moeda = (v) => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const moedaUnitaria = (v) =>
  num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: num(v) < 1 ? 4 : 2 });
export const percentual = (v) => `${(num(v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export function dataBr(v) {
  if (!v) return "—";
  const d = new Date(String(v).slice(0, 10) + "T12:00:00");
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR");
}
