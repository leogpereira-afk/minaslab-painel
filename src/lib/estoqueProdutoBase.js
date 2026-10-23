// Produto Base com o mesmo nome mas especificações diferentes: o nome sozinho não identifica o cadastro.
const chave = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
const chaveEspecificacao = (v) => { const k = chave(v); return k === "GERAL" ? "" : k; };

// Acha o cadastro certo: pelo id, senão por nome + especificação. Se a especificação não for informada ou não bater,
// vale o único cadastro daquele nome, ou o primeiro ativo (comportamento antigo), nunca um de especificação diferente quando há igual.
export function acharProdutoBase(produtos, nome, especificacao = "", id = "") {
  const lista = Array.isArray(produtos) ? produtos : [];
  if (id) { const porId = lista.find((p) => p.id === id); if (porId) return porId; }
  const k = chave(nome);
  if (!k) return null;
  const mesmos = lista.filter((p) => chave(p.produto) === k);
  if (mesmos.length <= 1) return mesmos[0] || null;
  const esp = chaveEspecificacao(especificacao);
  const ativo = (p) => String(p.status ?? "ATIVO").toUpperCase() !== "INATIVO";
  const iguais = mesmos.filter((p) => chaveEspecificacao(p.especificacao) === esp);
  return iguais.find(ativo) || iguais[0] || mesmos.find(ativo) || mesmos[0];
}
