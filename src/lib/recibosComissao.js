// Ponte Comissões (Gestão) -> Recibos (Finanças).
// O Gestão registra o pagamento da comissão (fechamento do mês) na coleção
// rh_comercial_comissoes; aqui o recibo de pagamento só LÊ esse registro e
// traz nome, valor, competência e a linha de detalhe. Nada é gravado de volta.
import { competenciaDe, numeroBR, somarItens } from "./recibos.js";

export const COLECAO_COMISSOES = "rh_comercial_comissoes";

const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;
const normalizar = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();

/** Mês da folha ("2026-10"): o informado no fechamento ou, nos antigos, o mês da data do pagamento. */
export const mesDaFolha = (p = {}) => (/^\d{4}-\d{2}$/.test(String(p.folha || "")) ? p.folha : String(p.pagoEm || "").slice(0, 7));

/** Pagamentos de comissão com valor, do mais recente para o mais antigo. */
export function pagamentosDeComissao(registros = []) {
  return registros
    .filter((r) => r && r.tipo === "pagamento" && Number(r.total) > 0)
    .sort((a, b) => mesDaFolha(b).localeCompare(mesDaFolha(a)) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

/** Valor por proposta (o pagamento guarda um item por proposta ou por linha da planilha). */
export function propostasDoPagamento(p = {}) {
  const porProposta = new Map();
  for (const i of p.itens || []) {
    const k = String(i.proposta || "—");
    const atual = porProposta.get(k) || { proposta: k, cliente: i.cliente || "", valor: 0 };
    atual.valor = arred(atual.valor + Number(i.valor || 0));
    porProposta.set(k, atual);
  }
  return [...porProposta.values()].filter((x) => x.valor !== 0);
}

/** Linhas que entram no recibo. Resumida: uma linha só. Detalhada: uma por proposta. */
export function itensDaComissao(p, { detalhar = false } = {}) {
  const props = propostasDoPagamento(p);
  const folha = competenciaDe(`${mesDaFolha(p)}-01`);
  if (detalhar && props.length) {
    return props.map((x) => ({ descricao: `Comissão 1% · proposta ${x.proposta}${x.cliente ? ` (${x.cliente})` : ""}`, valor: numeroBR(x.valor), tipo: "credito", comissaoId: p.id }));
  }
  const n = props.length;
  return [{ descricao: `Comissão de 1% sobre vendas faturadas${n ? ` (${n} proposta${n === 1 ? "" : "s"})` : ""}${folha ? ` – folha de ${folha}` : ""}`, valor: numeroBR(p.total), tipo: "credito", comissaoId: p.id }];
}

/** Pessoa do cadastro com o mesmo nome (exato ou, se for único, contendo todas as palavras). */
export function pessoaDoNome(pessoas = [], nome = "") {
  const alvo = normalizar(nome);
  if (!alvo) return null;
  const exata = pessoas.filter((pe) => normalizar(pe.nome) === alvo);
  if (exata.length === 1) return exata[0];
  const palavras = alvo.split(" ");
  const parecidas = pessoas.filter((pe) => { const n = ` ${normalizar(pe.nome)} `; return palavras.every((w) => n.includes(` ${w} `)); });
  return parecidas.length === 1 ? parecidas[0] : null;
}

/**
 * Aplica a comissão ao recibo de pagamento que está sendo montado.
 * - Nome/CPF/competência só são preenchidos se estiverem vazios (o recibo pode já ter salário etc.).
 * - A comissão entra como linha de detalhe; trazer o mesmo pagamento de novo substitui as linhas dele.
 * - O valor total é recalculado pela soma dos detalhes quando estava vazio ou batia com a soma anterior.
 */
export function aplicarComissao(d, p, { detalhar = false, pessoas = [] } = {}) {
  const antes = d.itens || [];
  const somaAntes = somarItens(antes);
  const itens = [...antes.filter((i) => i.comissaoId !== p.id), ...itensDaComissao(p, { detalhar })];
  const pe = pessoaDoNome(pessoas, d.nome?.trim() ? d.nome : p.nome);
  const valorVazio = !String(d.valor ?? "").trim();
  const valorEraSoma = !valorVazio && Math.abs(Number(String(d.valor).replace(/\./g, "").replace(",", ".")) - somaAntes) < 0.005;
  // Recibo só de comissão: a data é a do pagamento registrado e a frase "Referente…" fala da comissão.
  const soComissao = !antes.some((i) => !i.comissaoId);
  return {
    ...d,
    ...(soComissao ? {
      dataPagamento: /^\d{4}-\d{2}-\d{2}$/.test(String(p.pagoEm || "")) ? p.pagoEm : d.dataPagamento,
      referenteLivre: String(d.referenteLivre || "").trim() ? d.referenteLivre : "à comissão de 1% sobre as vendas faturadas, conforme abaixo:",
    } : {}),
    nome: d.nome?.trim() ? d.nome : (pe?.nome || p.nome || ""),
    cpf: String(d.cpf || "").trim() ? d.cpf : (pe?.cpf || ""),
    competencia: String(d.competencia || "").trim() ? d.competencia : competenciaDe(`${mesDaFolha(p)}-01`),
    itens,
    valor: valorVazio || valorEraSoma ? numeroBR(somarItens(itens)) : d.valor,
  };
}

/** Recibo onde cada pagamento de comissão já foi usado (pelas linhas de comissão gravadas no histórico). */
export function recibosPorComissao(historico = []) {
  const m = new Map();
  for (const h of historico) for (const i of h.dados?.itens || []) if (i.comissaoId && !m.has(i.comissaoId)) m.set(i.comissaoId, h);
  return m;
}
