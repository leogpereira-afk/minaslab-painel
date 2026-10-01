// Regras de cadastro da Gestão de Estoque herdadas do sistema antigo (salvarNovoInsumo,
// salvarOuAtualizarFornecedor, salvarClassificacaoFornecedor). Funções puras, para testar.
const txt = (v) => (v == null ? "" : String(v).trim());
const up = (v) => txt(v).toUpperCase();

// ---- Produto Base ----
export const CAMPOS_OBRIGATORIOS_PRODUTO = [
  ["produto", "Produto / nome comercial"], ["fornecedorAtual", "Fornecedor atual"], ["grupo", "Grupo"], ["unidade", "Unidade"], ["setor", "Setor"],
];
// Devolve os rótulos dos campos obrigatórios que estão vazios (vazio = nada bloqueado).
export function faltasProdutoBase(p) {
  const faltas = CAMPOS_OBRIGATORIOS_PRODUTO.filter(([k]) => !txt(p[k])).map(([, r]) => r);
  if (txt(p.qtdMinima) === "" || !Number.isFinite(Number(p.qtdMinima)) || Number(p.qtdMinima) < 0) faltas.push("Quantidade mínima (0 ou mais)");
  return faltas;
}
// Legado: fornecedor, grupo, produto, especificação e setor sempre em MAIÚSCULAS.
export function normalizarProdutoBase(p) {
  return { ...p, produto: up(p.produto), especificacao: up(p.especificacao), grupo: up(p.grupo), setor: up(p.setor),
    fornecedorAtual: up(p.fornecedorAtual ?? p.fornecedor), fornecedor: up(p.fornecedorAtual ?? p.fornecedor) };
}
export const produtoAtivo = (p) => String(p?.statusQuantidade || p?.statusQtd || p?.status || "ATIVO").toUpperCase() !== "INATIVO";

// ---- Fornecedor ----
// Legado: nome, endereço e tipo em MAIÚSCULAS; e-mail e site em minúsculas.
export function normalizarFornecedor(f) {
  const o = { ...f };
  for (const k of ["nome", "endereco", "tipoFornecedor", "tipo"]) if (o[k] != null) o[k] = up(o[k]);
  for (const k of ["email", "website"]) if (o[k] != null) o[k] = txt(o[k]).toLowerCase();
  return o;
}
// última avaliação + 6 meses, mantendo o dia (ou o último dia do mês). Só para SEMESTRAL com qualificação.
export function proximaAvaliacao(ultimaIso, requer, periodicidade) {
  if (up(requer) !== "SIM" || up(periodicidade) !== "SEMESTRAL") return "";
  const m = txt(ultimaIso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const ano = Number(m[1]), mes = Number(m[2]) - 1, dia = Number(m[3]);
  const alvo = new Date(Date.UTC(ano, mes + 6, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}
// Mesmos estados do legado (calcularStatusReavaliacaoFornecedor_).
export function statusReavaliacao(status, requer, periodicidade, proximaIso, hojeIso) {
  if (up(status) !== "ATIVO" || up(requer) !== "SIM" || up(periodicidade) !== "SEMESTRAL") return "NÃO SE APLICA";
  const p = txt(proximaIso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) return "NÃO CONFIGURADA";
  if (hojeIso >= p) return "VENCIDA";
  const limite = new Date(Date.parse(hojeIso + "T00:00:00Z") + 30 * 86400000).toISOString().slice(0, 10);
  return p <= limite ? "REAVALIAR EM BREVE" : "EM DIA";
}
// "Salvar classificação": recalcula próxima avaliação e status no ato de gravar (como o servidor antigo).
export function classificarFornecedor(f, hojeIso) {
  const requer = up(f.requerQualificacao || "SIM"), period = up(f.periodicidade || "SEMESTRAL"), status = up(f.status || "ATIVO");
  const proxima = proximaAvaliacao(f.dataUltimaAvaliacao, requer, period);
  return { ...f, status, requerQualificacao: requer, periodicidade: period, relacaoMinaslab: up(f.relacaoMinaslab || "FORNECEDOR"), tipoFornecedor: up(f.tipoFornecedor),
    dataProximaAvaliacao: proxima, statusReavaliacao: statusReavaliacao(status, requer, period, proxima, hojeIso) };
}
