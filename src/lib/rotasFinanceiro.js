// Finanças por página (pedido da Ana, 06/11/2026): qual liberação da tela Acessos
// abre cada rota do financeiro. É só o que a tela mostra; quem decide de verdade é
// o servidor (supabase/functions/_shared/acesso-financeiro.ts), página por página.

export const CHAVES_FINANCEIRO = [
  "financas/visao-geral",
  "financas/servicos-gerados",
  "financas/receber",
  "financas/pagar",
  "financas/bancos",
  "financas/conciliacao",
  "financas/notas",
  "financas/notas/emitir",
  "financas/notas/cancelar",
  "financas/notas/importar-historico",
  "financas/recibos",
  "financas/aplicacoes",
  "financas/socios",
  "financas/conferencia",
  "financas/fluxo-caixa",
  "financas/relatorios",
  "financas/clientes",
  "financas/configuracoes",
  "financas/configuracoes/categorias",
  "financas/configuracoes/contas",
  "financas/configuracoes/centros",
  "financas/configuracoes/formas",
  "financas/configuracoes/plano-contas",
  "financas/configuracoes/omie",
];

// Páginas de visão geral: leem todas as listas do financeiro (a cópia local).
export const PAGINAS_VISAO = ["financas/visao-geral", "financas/relatorios", "financas/fluxo-caixa", "financas/socios", "financas/aplicacoes", "financas/conferencia"];
// Quem tem alguma destas usa a cópia local das listas (financeiroCache).
export const PAGINAS_COM_LISTAS = [...PAGINAS_VISAO, "financas/receber", "financas/pagar", "financas/notas", "financas/bancos", "financas/conciliacao"];

const SECOES_CONFIG = ["categorias", "contas", "centros", "formas", "plano-contas", "omie"];
const CONFIG_TODAS = ["financas/configuracoes", ...SECOES_CONFIG.map((s) => `financas/configuracoes/${s}`)];

// Rota (depois de /financas) → liberações que a abrem (basta uma).
const ROTAS = {
  "": ["financas/visao-geral"],
  dashboard: ["financas/visao-geral"],
  "servicos-gerados": ["financas/servicos-gerados"],
  "contas-a-receber": ["financas/receber"],
  recebimentos: ["financas/receber"],
  "contas-a-pagar": ["financas/pagar"],
  despesas: ["financas/pagar"],
  "notas-fiscais": ["financas/notas"],
  "notas-fiscais/emitir": ["financas/notas/emitir"],
  "notas-fiscais/cancelar": ["financas/notas/cancelar"],
  "notas-fiscais/importar-historico": ["financas/notas/importar-historico"],
  clientes: ["financas/clientes"],
  recibos: ["financas/recibos"],
  conferencia: ["financas/conferencia"],
  aplicacoes: ["financas/aplicacoes"],
  socios: ["financas/socios"],
  relatorios: ["financas/relatorios"],
  "fluxo-caixa": ["financas/fluxo-caixa"],
  "movimentacao-conta": ["financas/bancos"],
  bancos: ["financas/bancos"],
  extrato: ["financas/bancos"],
  conciliacao: ["financas/conciliacao"],
  "conciliacao-mlab": ["financas/conciliacao"],
  "conciliacao-titulos": ["financas/conciliacao"],
  "fechamento-mlab": ["financas/conciliacao"],
  "plano-contas": ["financas/configuracoes/plano-contas"],
  configuracoes: CONFIG_TODAS,
};

// Ordem para escolher a primeira página que a pessoa pode abrir (a do menu).
const ORDEM = [
  "/financas", "/financas/servicos-gerados", "/financas/contas-a-receber", "/financas/contas-a-pagar",
  "/financas/movimentacao-conta", "/financas/conciliacao-mlab", "/financas/notas-fiscais",
  "/financas/notas-fiscais/emitir", "/financas/notas-fiscais/cancelar", "/financas/notas-fiscais/importar-historico",
  "/financas/aplicacoes", "/financas/socios", "/financas/conferencia", "/financas/fluxo-caixa",
  "/financas/relatorios", "/financas/clientes", "/financas/recibos", "/financas/configuracoes",
];

/** Liberações do financeiro que valem para a conta. Sem a matriz (__matriz_v1) só
 *  Serviços Gerados vale, como antes; o resto do financeiro exige a matriz. */
export function chavesFinanceiroLiberadas(paginas = []) {
  const lista = Array.isArray(paginas) ? paginas.map(String) : [];
  if (!lista.includes("__matriz_v1")) return lista.includes("financas/servicos-gerados") ? ["financas/servicos-gerados"] : [];
  return CHAVES_FINANCEIRO.filter((k) => lista.includes(k));
}

/** Liberações que abrem a rota (caminho com ou sem /financas no começo), ou null se desconhecida. */
export function chavesDaRota(caminho = "") {
  let r = String(caminho || "").split(/[?#]/)[0].replace(/\/+$/, "");
  if (r === "/financas" || r === "financas") r = "";
  else if (r.startsWith("/financas/")) r = r.slice("/financas/".length);
  else if (r.startsWith("financas/")) r = r.slice("financas/".length);
  else if (r.startsWith("/")) return null;
  if (Object.prototype.hasOwnProperty.call(ROTAS, r)) return ROTAS[r];
  if (r.startsWith("conciliacao-titulos/")) return ROTAS["conciliacao-titulos"];
  const secao = r.match(/^configuracoes\/([^/]+)$/)?.[1];
  if (secao && SECOES_CONFIG.includes(secao)) return [`financas/configuracoes/${secao}`];
  return null;
}

/** A conta (não direção) pode abrir esta rota do financeiro? */
export function podeAbrirRotaFinanceiro(caminho, paginas = []) {
  const chaves = chavesDaRota(caminho);
  if (!chaves) return false;
  const liberadas = chavesFinanceiroLiberadas(paginas);
  return chaves.some((k) => liberadas.includes(k));
}

/** Primeira rota do financeiro que a conta abre, ou null se nenhuma. */
export function primeiraRotaFinanceiro(paginas = []) {
  return ORDEM.find((r) => podeAbrirRotaFinanceiro(r, paginas)) || null;
}

/** Tem alguma página do financeiro liberada? (mostra Finanças no menu lateral) */
export const temFinanceiro = (paginas = []) => chavesFinanceiroLiberadas(paginas).length > 0;

/** Usa a cópia local das listas (Visão Geral, Receber, Pagar, Notas, Bancos, Conciliação...)? */
export const usaListasFinanceiro = (paginas = []) => chavesFinanceiroLiberadas(paginas).some((k) => PAGINAS_COM_LISTAS.includes(k));
