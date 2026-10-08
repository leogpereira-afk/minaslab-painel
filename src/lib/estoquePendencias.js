// Pendências de cadastro da Gestão de Estoque: tudo é CALCULADO dos dados que já estão na tela, então o aviso some sozinho
// quando alguém corrige o cadastro. Não grava nada e não decide nada: só aponta o que a equipe precisa conferir.
const txt = (v) => String(v ?? "").trim();
const up = (v) => txt(v).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
const digitos = (v) => txt(v).replace(/\D/g, "");
const ativo = (r) => up(r?.status ?? r?.statusQuantidade ?? r?.statusQtd ?? "ATIVO") !== "INATIVO";

const fornecedorRotulo = (f) => `${f.id || "—"} · ${txt(f.nome) || "sem nome"}`;

export function calcularPendencias({ fornecedores = [], produtos = [], pedidos = [], lotes = [] } = {}) {
  const grupos = [];
  const add = (chave, titulo, onde, itens) => { if (itens.length) grupos.push({ chave, titulo, onde, itens }); };

  const forn = fornecedores.filter(ativo);
  const porCnpj = {};
  for (const f of forn) { const d = digitos(f.cnpj); if (d && Number(d) !== 0) (porCnpj[d] ??= []).push(f); }
  add("cnpj-repetido", "Fornecedores com CNPJ repetido", "Fornecedores → editar o cadastro (corrigir o CNPJ ou unir os dois)",
    Object.values(porCnpj).filter((l) => l.length > 1).map((l) => ({ codigo: l.map((f) => f.id).join(" / "), texto: `${l.map((f) => txt(f.nome)).join(" / ")} — CNPJ ${txt(l[0].cnpj)}` })));
  add("sem-cnpj", "Fornecedores sem CNPJ", "Fornecedores → editar o cadastro e informar o CNPJ",
    forn.filter((f) => !digitos(f.cnpj) || Number(digitos(f.cnpj)) === 0).map((f) => ({ codigo: f.id, texto: fornecedorRotulo(f) })));
  add("sem-tipo", "Fornecedores sem tipo de fornecedor", "Fornecedores → Classificação → TIPO DE FORNECEDOR / PROVEDOR",
    forn.filter((f) => !txt(f.tipoFornecedor)).map((f) => ({ codigo: f.id, texto: fornecedorRotulo(f) })));

  const prod = produtos.filter(ativo);
  add("produto-sem-kit", "Produtos sem conteúdo do kit", "Produto Base → editar e informar o conteúdo do kit",
    prod.filter((p) => !(Number(p.conteudoKit) > 0)).map((p) => ({ codigo: p.id, texto: `${p.id} · ${txt(p.produto)}${txt(p.especificacao) ? " — " + txt(p.especificacao) : ""}` })));
  const porNome = {};
  for (const p of prod) (porNome[`${up(p.produto)}|${up(p.especificacao)}`] ??= []).push(p);
  add("produto-duplicado", "Produtos possivelmente duplicados", "Produto Base → conferir; inativar o que sobrar",
    Object.values(porNome).filter((l) => l.length > 1).map((l) => ({ codigo: l.map((p) => p.id).join(" / "), texto: `${txt(l[0].produto)}${txt(l[0].especificacao) ? " — " + txt(l[0].especificacao) : ""}` })));

  add("pedido-sem-lote", "Itens de pedido integrados sem lote ligado", "Pedidos de Compra → conferir o item e o lote correspondente",
    pedidos.filter((p) => up(p.status).includes("INTEGR") && !txt(p.loteId)).map((p) => ({ codigo: p.id, texto: `${p.id} · ${txt(p.produto)}` })));

  add("lote-negativo", "Lotes com saldo negativo", "Entrada de estoque → editar o lote (ou corrigir a saída)",
    lotes.filter((l) => Number(l.totalAtual ?? l.qtdAtual) < 0).map((l) => ({ codigo: l.codigoID || l.id, texto: `${l.codigoID || l.id} · ${txt(l.produto)} — saldo ${l.totalAtual ?? l.qtdAtual}` })));

  return { grupos, total: grupos.reduce((t, g) => t + g.itens.length, 0) };
}
