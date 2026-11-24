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

/* PRODUTO DO ESTOQUE (Léo, 19/11/2026): em "Solicitar material" o colaborador
   ESCOLHE o produto da lista do Estoque — digitar é só para buscar. O item leva o
   produtoId, e o nome, a unidade e a categoria vêm do cadastro (o servidor relê).
   Produto que ainda não está cadastrado pode ser escrito à parte ("não está na lista"). */
export const CATEGORIA_DO_ESTOQUE = { reagente: "laboratorio", vidraria: "laboratorio", epi: "epi", papelaria: "papelaria", peca: "manutencao", outro: "outros" };
export const categoriaDoProdutoEstoque = (c) => CATEGORIA_DO_ESTOQUE[c] || "outros";

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
    const produtoId = txt(bruto?.produtoId, 80);
    itens.push({
      ...(produtoId ? { produtoId } : {}),
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

/* Quem recebe o aviso de solicitação nova: QUEM TRATA COMPRAS — Compras
   inteiro, Estoque ou Ordens de compra liberados na tela Acessos (o
   responsável pelo controle). A aba Pedidos sozinha NÃO conta: a Ana libera
   Pedidos para todos (é por ela que se pede material), e o aviso iria para a
   casa inteira. Se ninguém tratar, a direção — aviso que não chega a ninguém
   é pedido parado sem ninguém saber. */
export function destinatariosSolicitacao(contas, autor) {
  const ativas = (contas || []).filter((c) => c && c.ativo === true && c.usuario && c.usuario !== autor);
  const responsaveis = ativas.filter((c) => {
    const p = Array.isArray(c.paginas_consulta) ? c.paginas_consulta : [];
    return c.papel === "equipe" && p.includes("__matriz_v1") && ["compras", "compras/estoque", "compras/ordens"].some((x) => p.includes(x));
  });
  const lista = responsaveis.length ? responsaveis : ativas.filter((c) => c.papel === "direcao");
  return [...new Set(lista.map((c) => c.usuario))];
}

/* PRAZO DOS PEDIDOS (Ana, 24/11/2026): quem trata compras diz ATÉ QUE DIA o
   ciclo aceita pedido de material. A data é escolhida a cada ciclo (não é dia
   fixo do mês) e pode ser prorrogada, antecipada ou apagada a qualquer hora.
   O dia escolhido ainda aceita pedido; no dia seguinte, o envio BLOQUEIA — na
   tela e no servidor. Sem data, pedido aberto como sempre foi. */
export const PRAZO_COLECAO = "compras_config";
export const PRAZO_ID = "prazo-pedidos";

// "AAAA-MM-DD" de verdade (30/02 não passa), "" para "sem prazo", null se inválida.
export function normalizarPrazo(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

export const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

// { temPrazo, aberto, ate, dias } — dias que faltam (0 = hoje é o último dia; negativo = fechou).
export function situacaoPrazo(ate, hojeISO) {
  const a = normalizarPrazo(ate);
  if (!a) return { temPrazo: false, aberto: true, ate: "", dias: null };
  const dias = Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${String(hojeISO).slice(0, 10)}T00:00:00Z`)) / 86400000);
  return { temPrazo: true, aberto: dias >= 0, ate: a, dias };
}

export function textoPrazo(s) {
  if (!s?.temPrazo) return "";
  if (!s.aberto) return `Os pedidos de material fecharam em ${dataBR(s.ate)}. Fale com quem cuida de compras se precisar de algo.`;
  if (s.dias === 0) return `Hoje (${dataBR(s.ate)}) é o último dia para pedir material neste ciclo.`;
  if (s.dias === 1) return `Pedidos de material até amanhã, ${dataBR(s.ate)}.`;
  return `Pedidos de material até ${dataBR(s.ate)} (faltam ${s.dias} dias).`;
}

/* Quem DEFINE o prazo: quem trata compras (Compras inteiro, Estoque ou Ordens
   em Acessos) e a direção. A aba Pedidos sozinha não basta — a Ana libera
   Pedidos para todos, e aí qualquer um prorrogaria o próprio prazo. */
export function trataCompras({ papel, permissoes }) {
  if (papel === "direcao" || papel === "maquina") return true;
  if (papel !== "equipe") return false;
  const p = Array.isArray(permissoes) ? permissoes : [];
  if (!p.includes("__matriz_v1")) return true;
  return ["compras", "compras/estoque", "compras/ordens"].some((x) => p.includes(x));
}

/* FLUXO (Ana, 24/11/2026): Solicitar → Pedidos (aprovar) → fila "Aguardando ordem"
   → Ordem de compra (juntar por fornecedor) → ordem Comprada → Chegou: dar entrada.
   O aprovado não avança mais por botão em Pedidos: quem conduz é a ordem. */
export const aguardandoOrdem = (c) => c.status === "aprovada" && !c.ordemId;
// Entra numa ordem só o que já foi aprovado (ou pedido antigo já em cotação/comprado).
const ENTRA_EM_ORDEM = new Set(["aprovada", "cotando", "comprada"]);
export const podeEntrarEmOrdem = (c) => !c.ordemId && ENTRA_EM_ORDEM.has(c.status);
// Criar a ordem põe o aprovado "Em cotação"; marcar a ordem Comprada põe "Comprada".
// Nunca rebaixa nem ressuscita: recebido e recusado ficam como estão.
export const statusAoCriarOrdem = (c) => (c.status === "aprovada" ? "cotando" : c.status);
export const statusAoComprarOrdem = (c) => (c.status === "aprovada" || c.status === "cotando" ? "comprada" : c.status);

// Situações que quem compra pode dar a vários de uma vez. "recebida" fica de
// fora: chegar passa pela conferência de quantidade (entrada no estoque).
export const SITUACOES_LOTE = ["cotando", "comprada", "cancelada"];
export const ROTULO_SITUACAO = { solicitada: "Solicitada", aprovada: "Aprovada", cotando: "Em cotação", comprada: "Comprada", recebida: "Recebida", cancelada: "Recusada" };
export const ANDAMENTO = ["solicitada", "aprovada", "cotando", "comprada", "recebida"];

/* APROVAÇÃO (Léo, 19/11/2026): quem trata compras aprova cada item e diz QUANTO
   foi aprovado (pode ser menos que o pedido). "Não aprovar" é a recusa, com motivo.
   A quantidade aprovada passa a ser a quantidade do pedido (é ela que vai para a
   ordem de compra e para o recebimento); a pedida fica guardada em
   quantidadeSolicitada/qtdeSolicitada, só na primeira aprovação — reaprovar
   ajusta a aprovada sem perder o que foi pedido. */
export const PODE_APROVAR = new Set(["solicitada", "aprovada"]);

// Número da quantidade em texto livre ("2 cx", "1,5 litro") — pedido antigo não tem `quantidade`.
export function numeroDaQuantidade(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = String(v ?? "").replace(/\./g, "").match(/(\d+(?:,\d+)?)/) || String(v ?? "").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Unidade do pedido: a gravada ou, no pedido antigo, o que vem depois do número ("2 cx" → "cx").
const unidadeDoPedido = (c) => c.unidade || String(c.qtde ?? "").replace(/^[\s\d.,]+/, "").trim();

export function quantidadePedida(c) {
  const n = Number.isFinite(Number(c.quantidadeSolicitada)) && c.quantidadeSolicitada !== "" && c.quantidadeSolicitada != null
    ? Number(c.quantidadeSolicitada)
    : Number.isFinite(Number(c.quantidade)) && c.quantidade !== "" && c.quantidade != null ? Number(c.quantidade) : numeroDaQuantidade(c.qtde);
  return n;
}

/* Confere a lista [{ id, quantidade }] da aprovação. Quantidade tem de ser > 0
   (zero não é aprovar: é "Não aprovar", que pede o motivo). */
export function normalizarAprovacao(lista) {
  const itens = [];
  const erros = [];
  const vistos = new Set();
  for (const b of Array.isArray(lista) ? lista : []) {
    const id = String(b?.id ?? "").trim();
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const q = Number(String(b?.quantidade ?? "").replace(",", "."));
    if (!Number.isFinite(q) || q <= 0 || q > 100000) { erros.push("Quantidade aprovada inválida (use “Não aprovar” para recusar)."); continue; }
    itens.push({ id, quantidade: Math.round(q * 1000) / 1000 });
  }
  if (itens.length > 200) erros.push("No máximo 200 itens por vez.");
  return { itens, erros };
}

// Registro aprovado: guarda a pedida (só na primeira vez) e troca a quantidade pela aprovada.
export function aplicarAprovacao(c, quantidade, por, em) {
  const unidade = unidadeDoPedido(c);
  const pedida = quantidadePedida(c);
  const jaGuardada = c.qtdeSolicitada !== undefined && c.qtdeSolicitada !== null && c.qtdeSolicitada !== "";
  return {
    ...c,
    status: "aprovada",
    ...(jaGuardada ? {} : { qtdeSolicitada: c.qtde || textoQuantidade(pedida, unidade), quantidadeSolicitada: pedida }),
    quantidade,
    qtde: textoQuantidade(quantidade, unidade),
    aprovadoPor: por,
    aprovadoEm: em,
  };
}

// "aprovado 5 de 10 caixas" quando mudou; vazio quando aprovou o que foi pedido.
export function textoAprovacao(c) {
  if (!c || !c.qtdeSolicitada) return "";
  const pedida = quantidadePedida(c);
  const aprovada = Number(c.quantidade);
  if (pedida != null && Number.isFinite(aprovada) && pedida === aprovada) return "";
  return `aprovado ${c.qtde} (pedido ${c.qtdeSolicitada})`;
}

// A frase do aviso para quem pediu. Um aviso por pessoa, mesmo que mude cinco itens dela.
export function avisoMudanca(itens, status, motivo = "") {
  const rot = ROTULO_SITUACAO[status] || status;
  const nomes = itens.map((i) => i.item).filter(Boolean);
  const titulo = itens.length === 1
    ? `Sua solicitação: ${nomes[0] || "item"} — ${rot}`
    : `Sua solicitação: ${itens.length} itens — ${rot}`;
  const lista = nomes.length > 1 ? nomes.slice(0, 5).join(", ") + (nomes.length > 5 ? "…" : "") : "";
  // Na aprovação, quem pediu precisa saber QUANTO foi aprovado — sobretudo se veio menos.
  const quantos = status === "aprovada"
    ? itens.map((i) => (itens.length > 1 ? `${i.item}: ${i.qtde || "?"}` : `Aprovado: ${i.qtde || "?"}`) + (i.qtdeSolicitada && textoAprovacao(i) ? ` (pedido ${i.qtdeSolicitada})` : "")).slice(0, 5).join(" · ")
    : "";
  const corpo = [status === "aprovada" ? quantos : lista, status === "cancelada" && motivo ? `Motivo: ${motivo}` : ""].filter(Boolean).join(" · ");
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
