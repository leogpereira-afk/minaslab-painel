// Solicitação de materiais (Compras › Pedidos) — as regras que a TELA e o
// SERVIDOR (ml-sync) usam. Mora em _shared para as duas pontas lerem a mesma
// lista: categoria que só existe na tela vira "Outros" no servidor, calada.
//
// O desenho (prévia aprovada em 19/11/2026):
// - Qualquer pessoa do painel pede material: solicitante e data vêm do LOGIN,
//   nunca de uma lista para escolher o nome.
// - Cada item vira UM pedido "solicitada" na coleção `compras` — a mesma lista
//   que quem compra já usa (cotação, ordem de compra, recebimento no estoque).
// - Quem compra vê tudo agrupado por categoria, como lista de compras, e muda a
//   situação de vários de uma vez; quem pediu é avisado no sino.

export const CATEGORIAS_SOLICITACAO = {
  papelaria: "Papelaria",
  mercado: "Mercado / limpeza",
  epi: "EPI",
  laboratorio: "Laboratório (reagente, vidraria)",
  manutencao: "Manutenção / construção",
  outros: "Outros",
};

export const UNIDADES_SOLICITACAO = ["unidade", "caixa", "pacote", "rolo", "frasco", "litro", "fardo", "par", "kit"];

export const URGENCIAS = { alta: "Alta", media: "Média", baixa: "Baixa" };
const PESO_URGENCIA = { alta: 0, media: 1, baixa: 2 };

export const SETORES = ["Laboratório", "Administrativo", "Comercial", "Qualidade", "Marketing", "Logística"];

// Um pedido de material não precisa de mais que isso; o teto protege o
// servidor de um formulário colado com centenas de linhas por engano.
export const MAX_ITENS = 30;

const txt = (v, max = 200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const rotuloCategoria = (c) => CATEGORIAS_SOLICITACAO[c] || CATEGORIAS_SOLICITACAO.outros;
export const rotuloUrgencia = (u) => URGENCIAS[u] || URGENCIAS.media;

/* Confere e arruma os itens de uma solicitação. Devolve { itens, erros }:
   linha sem produto é IGNORADA (é a linha em branco do formulário), mas
   quantidade inválida num item com produto é ERRO — pedir "0 caixas" ou
   "-2" não é um pedido. Produto vai em MAIÚSCULAS, como na planilha antiga,
   para "luva nitrílica" e "LUVA NITRÍLICA" agruparem juntas. */
export function normalizarItens(lista) {
  const itens = [];
  const erros = [];
  for (const bruto of Array.isArray(lista) ? lista : []) {
    const produto = txt(bruto?.produto, 120).toLocaleUpperCase("pt-BR");
    if (!produto) continue;
    const qtd = Number(String(bruto?.quantidade ?? "").replace(",", "."));
    if (!Number.isFinite(qtd) || qtd <= 0 || qtd > 100000) {
      erros.push(`${produto}: quantidade inválida`);
      continue;
    }
    itens.push({
      produto,
      detalhes: txt(bruto?.detalhes, 200),
      categoria: Object.prototype.hasOwnProperty.call(CATEGORIAS_SOLICITACAO, bruto?.categoria) ? bruto.categoria : "outros",
      quantidade: Math.round(qtd * 1000) / 1000,
      unidade: UNIDADES_SOLICITACAO.includes(bruto?.unidade) ? bruto.unidade : "unidade",
    });
  }
  if (itens.length > MAX_ITENS) erros.push(`No máximo ${MAX_ITENS} itens por solicitação.`);
  return { itens, erros };
}

export const normalizarUrgencia = (u) => (Object.prototype.hasOwnProperty.call(URGENCIAS, u) ? u : "media");
export const normalizarSetor = (s) => (SETORES.includes(s) ? s : txt(s, 60));

// "2 caixas", "1 rolo", "1,5 litro": o texto que a lista antiga de pedidos já mostra em `qtde`.
const PLURAL = { unidade: "unidades", caixa: "caixas", pacote: "pacotes", rolo: "rolos", frasco: "frascos", litro: "litros", fardo: "fardos", par: "pares", kit: "kits" };
export function textoQuantidade(quantidade, unidade) {
  const n = Number(quantidade);
  if (!Number.isFinite(n)) return "";
  const num = n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  const un = unidade ? (n === 1 ? unidade : PLURAL[unidade] || unidade) : "";
  return un ? `${num} ${un}` : num;
}

/* QUEM GERE OS PEDIDOS (vê a lista da equipe, muda situação, recebe o aviso de
   solicitação nova): a direção e quem tem, na tela Acessos, Compras inteiro
   ou a aba Pedidos. Equipe antiga, sem a matriz de páginas, segue como antes
   (via tudo). Todo o resto do painel só pede e acompanha o que pediu. */
export function gerePedidos({ papel, permissoes }) {
  if (papel === "direcao" || papel === "maquina") return true;
  if (papel !== "equipe") return false;
  const p = Array.isArray(permissoes) ? permissoes : [];
  if (!p.includes("__matriz_v1")) return true;
  return p.includes("compras") || p.includes("compras/pedidos");
}

/* Quem recebe o aviso de solicitação nova: quem tem Compras liberado na tela
   Acessos (o responsável pelo controle). Se ninguém tiver, a direção — aviso
   que não chega a ninguém é pedido parado sem ninguém saber. */
export function destinatariosSolicitacao(contas, autor) {
  const ativas = (contas || []).filter((c) => c && c.ativo === true && c.usuario && c.usuario !== autor);
  const responsaveis = ativas.filter((c) => {
    const p = Array.isArray(c.paginas_consulta) ? c.paginas_consulta : [];
    return c.papel === "equipe" && p.includes("__matriz_v1") && (p.includes("compras") || p.includes("compras/pedidos"));
  });
  const lista = responsaveis.length ? responsaveis : ativas.filter((c) => c.papel === "direcao");
  return [...new Set(lista.map((c) => c.usuario))];
}

// Situações que quem compra pode dar a vários de uma vez. "recebida" fica de
// fora: chegar passa pela conferência de quantidade (entrada no estoque).
export const SITUACOES_LOTE = ["cotando", "comprada", "cancelada"];
export const ROTULO_SITUACAO = { solicitada: "Solicitada", cotando: "Em cotação", comprada: "Comprada", recebida: "Recebida", cancelada: "Recusada" };
export const ANDAMENTO = ["solicitada", "cotando", "comprada", "recebida"];

// A frase do aviso para quem pediu. Um aviso por pessoa, mesmo que mude cinco itens dela.
export function avisoMudanca(itens, status, motivo = "") {
  const rot = ROTULO_SITUACAO[status] || status;
  const nomes = itens.map((i) => i.item).filter(Boolean);
  const titulo = itens.length === 1
    ? `Sua solicitação: ${nomes[0] || "item"} — ${rot}`
    : `Sua solicitação: ${itens.length} itens — ${rot}`;
  const lista = nomes.length > 1 ? nomes.slice(0, 5).join(", ") + (nomes.length > 5 ? "…" : "") : "";
  const corpo = [lista, status === "cancelada" && motivo ? `Motivo: ${motivo}` : ""].filter(Boolean).join(" · ");
  return { titulo, corpo };
}

// Lista de compras: por categoria (ordem alfabética do rótulo), dentro dela a
// urgência alta primeiro e, no empate, quem espera há mais tempo.
export function agruparPorCategoria(pedidos) {
  const g = new Map();
  for (const p of pedidos || []) {
    const cat = Object.prototype.hasOwnProperty.call(CATEGORIAS_SOLICITACAO, p.categoria) ? p.categoria : "outros";
    if (!g.has(cat)) g.set(cat, []);
    g.get(cat).push(p);
  }
  const peso = (u) => PESO_URGENCIA[u] ?? 1;
  return [...g.entries()]
    .map(([categoria, itens]) => ({
      categoria,
      rotulo: rotuloCategoria(categoria),
      itens: itens.sort((a, b) => peso(a.urgencia) - peso(b.urgencia) ||
        String(a.data || "9999").localeCompare(String(b.data || "9999")) ||
        String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""))),
    }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}
