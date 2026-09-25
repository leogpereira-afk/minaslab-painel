// A UNICA porta de dados do painel: tudo passa por aqui e chega na Edge
// Function ml-sync. Nenhuma tela fala com o servidor por conta propria — um
// ponto de saida so e o que deixa conferir, num lugar so, que toda chamada
// leva o crachá e trata erro do mesmo jeito.

import { SYNC } from "../lib/api.js";
import { comCracha, mensagemDoStatus, getToken, aoMudarSessao } from "../lib/sessao.js";
import { novoId } from "../lib/format.js";

async function chamar(action, corpo = {}) {
  const resp = await comCracha(SYNC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...corpo }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro || mensagemDoStatus(resp.status));
  return body;
}

// Le a colecao INTEIRA, pagina a pagina (o servidor pagina no banco; "traz
// tudo de uma vez" tem teto de 1000 no PostgREST e mente sem avisar).
// Cursor composto (atualizado_em + id): registro que divide o instante com a
// fronteira da pagina nao pode sumir calado. Dedup por id: um registro editado
// no meio da varredura reapareceria no fim — vale a versao mais nova.
// Registros apagados (lapide) ficam de fora.
export async function listar(colecao) {
  const porId = new Map();
  let desde = "";
  let desdeId = "";
  for (;;) {
    const r = await chamar("list", { colecao, desde, desdeId, limite: 500 });
    for (const linha of r.itens || []) {
      porId.set(linha.id, linha);
    }
    if (!r.proximo) break;
    desde = r.proximo;
    desdeId = r.proximoId || "";
  }
  return [...porId.values()].filter((l) => !l.apagado).map((l) => l.registro);
}

// Grava e CONFERE O EFEITO: o servidor devolve o registro como ficou; "nao deu
// erro" nao e "gravou" (licao paga na Impresilk). Devolve o registro gravado.
export async function salvar(colecao, registro) {
  const reg = { ...registro };
  if (!reg.id) reg.id = novoId(colecao.slice(0, 3));
  if (!reg.criadoEm) reg.criadoEm = new Date().toISOString();
  const r = await chamar("upsert", { colecao, registro: reg });
  if (!r?.registro?.id) throw new Error("O servidor nao confirmou a gravacao. Recarregue e confira.");
  esquecerColecao(colecao);
  return r.registro;
}

export async function apagar(colecao, id) {
  const r = await chamar("delete", { colecao, id });
  if (!r?.ok) throw new Error("O servidor nao confirmou a exclusao.");
  esquecerColecao(colecao);
  return true;
}

/* ------------------------------------------------------------------ cache
   A LENTIDÃO FOI MEDIDA antes deste bloco existir (29/08/2026): 0,2s de ida e
   volta por chamada, rh_ponto_dia com 1.365 registros em 3 páginas SEQUENCIAIS
   (~2,1s), e cada volta à aba baixando TUDO de novo — 666 KB para descobrir
   que nada mudou.

   O desenho: o servidor mantém um número de versão por coleção (o rev, que o
   ml-sync já gravava a cada escrita e ninguém lia). Aqui a tela pergunta o rev
   (0,2s), compara com o que tem na memória e só baixa as coleções que MUDARAM
   — numa chamada só (listarVarias). Voltar à aba sem novidade custa a
   pergunta, não o download.

   A memória vive no módulo (some no F5 — de propósito: recomeçar do zero é o
   único estado que nunca mente) e o rev vem DA MESMA RESPOSTA que trouxe os
   dados, nunca de uma pergunta separada depois — senão uma escrita entre as
   duas chamadas carimbaria dados velhos como novos. */
const memoria = new Map(); // colecao -> { marca, dados }
let tokenCache = null;
let geracaoCache = 0;
aoMudarSessao(() => { memoria.clear(); tokenCache = null; geracaoCache += 1; });

export async function carregarColecoes(nomes) {
  const token = getToken();
  if (token !== tokenCache) { memoria.clear(); tokenCache = token; geracaoCache += 1; }
  const geracao = geracaoCache;
  const conferirSessao = () => {
    if (token !== getToken() || geracao !== geracaoCache) throw new Error("A sessão mudou durante a consulta. Abra a tela novamente.");
  };
  const rev = await chamar("rev").then((r) => r.rev?.porColecao ?? {}).catch(() => null);
  conferirSessao();
  // Sem rev (rede piscou), a resposta honesta é baixar tudo: cache sem
  // validação é dado velho fingindo ser novo.
  const desatualizadas = nomes.filter((n) => {
    if (rev === null) return true;
    const m = memoria.get(n);
    return !m || m.marca !== (rev[n] ?? 0);
  });

  let recusadas = [];
  if (desatualizadas.length) {
    const r = await chamar("listarVarias", { colecoes: desatualizadas });
    conferirSessao();
    recusadas = r.recusadas || [];
    for (const n of recusadas) memoria.delete(n);
    const porColecao = r.rev?.porColecao ?? {};
    for (const n of desatualizadas) {
      if (recusadas.includes(n)) continue;
      memoria.set(n, { marca: porColecao[n] ?? 0, dados: r.colecoes?.[n] ?? [] });
    }
  }

  const resultado = {};
  for (const n of nomes) resultado[n] = memoria.get(n)?.dados ?? [];
  return { ...resultado, _recusadas: recusadas };
}

/* Depois de GRAVAR, a coleção local está velha por definição: invalida para a
   próxima carga baixar de novo. Invalidar só a coleção tocada é o que faz o
   resto continuar instantâneo. */
export function esquecerColecao(colecao) {
  memoria.delete(colecao);
}

export const lerCfg = () => chamar("getCfg").then((r) => r.config || {});
export const salvarCfg = (config) => chamar("setCfg", { config });

export const estoqueFornecedorAvaliar = (fornecedorId, avaliacao) => chamar("estoqueFornecedorAvaliar", { fornecedorId, avaliacao }).then((r) => { if (!r?.ok) throw new Error("O servidor não confirmou a qualificação do fornecedor."); esquecerColecao("estoque_avaliacoes_fornecedor"); esquecerColecao("estoque_fornecedores"); return r; });\n\nexport const estoqueFapeUpload = (dados) => chamar("estoqueFapeUpload", dados).then((r) => { if (!r?.ok) throw new Error("O servidor não confirmou a FAPE."); esquecerColecao("estoque_fapes"); return r.fape; });

export const estoqueDocumentoUpload = (dados) => chamar("estoqueDocumentoUpload", dados).then((r) => { if (!r?.ok) throw new Error("O servidor não confirmou o documento."); esquecerColecao("estoque_documentos_fornecedor"); return r.documento; });
export const estoqueDocumentoUrl = (id) => chamar("estoqueDocumentoUrl", { id }).then((r) => r?.url || null);

export const estoqueSalvar = (colecao, registro) => chamar("estoqueSalvar", { colecao, registro }).then((r) => { if (!r?.ok || !r?.registro) throw new Error("O servidor não confirmou a gravação."); esquecerColecao(colecao); return r.registro; });

export const estoquePedidoSalvar = (pedidoCodigo, itens) => chamar("estoquePedidoSalvar", { pedidoCodigo, itens }).then((r) => { if (!r?.ok || !r?.pedidoCodigo) throw new Error("O servidor não confirmou o pedido de compra."); esquecerColecao("estoque_pedidos"); esquecerColecao("estoque_logs_compras"); return r; });

export const estoquePedidoStatus = (id, status, dataChegada = "") => chamar("estoquePedidoStatus", { id, status, dataChegada }).then((r) => { if (!r?.ok) throw new Error("O servidor não confirmou o status do pedido."); esquecerColecao("estoque_pedidos"); esquecerColecao("estoque_logs_compras"); return r; });\n\nexport const estoquePedidoExcluir = (ids) => chamar("estoquePedidoExcluir", { ids }).then((r) => { if (!r?.ok) throw new Error("O servidor não confirmou a exclusão do pedido."); esquecerColecao("estoque_pedidos"); return r; });

export const estoqueEntrada = (lote, movimento = {}) =>
  chamar("estoqueEntrada", { lote, movimento }).then((r) => {
    if (!r?.ok || !r?.lote) throw new Error("O servidor não confirmou a entrada de estoque.");
    esquecerColecao("estoque_lotes"); esquecerColecao("estoque_movimentos");
    return r;
  });

export const estoqueRetirada = (loteId, quantidade, dataAbertura = "", observacao = "") =>
  chamar("estoqueRetirada", { loteId, quantidade, dataAbertura, observacao }).then((r) => {
    if (!r?.ok || !r?.lote) throw new Error("O servidor não confirmou a retirada de estoque.");
    esquecerColecao("estoque_lotes"); esquecerColecao("estoque_movimentos");
    return r;
  });

// Quem trabalha aqui (id + nome), para os seletores de equipe (coletas,
// responsavel do compromisso). E uma porta ESTREITA de proposito: devolve so
// id, nome e apelido — a ficha completa do RH e assunto da direcao.
export const elenco = () => chamar("elenco").then((r) => r.pessoas || []);

// ---- Contas (so a direcao; o servidor confere) ----
export const contasListar = () => chamar("contasListar").then((r) => r.contas || []);
export const contaCriar = (dados) => chamar("contaCriar", dados);
export const contaSenha = (usuario, senha) => chamar("contaSenha", { usuario, senha });
export const contaAtiva = (usuario, ativo) => chamar("contaAtiva", { usuario, ativo });
export const contaPaginas = (usuario, paginas_consulta) => chamar("contaPaginas", { usuario, paginas_consulta });
// A propria pessoa troca a propria senha (qualquer papel).
export const trocarMinhaSenha = (senhaAtual, senhaNova) =>
  chamar("trocarSenha", { senhaAtual, senhaNova });

// -----------------------------------------------------------------------------
// Financeiro — Recebimentos
// -----------------------------------------------------------------------------
export const recebimentosListar = (empresaId = "") =>
  chamar("finRecebimentosListar", {
    empresaId,
    limite: 500,
  }).then((r) => r.recebimentos || []);

export const recebimentosOpcoes = () =>
  chamar("finRecebimentosOpcoes").then((r) => ({
    empresas: r.empresas || [],
    categorias: r.categorias || [],
    contas: r.contas || [],
  }));

export const recebimentoSalvar = async (registro) => {
  const r = await chamar("finRecebimentoSalvar", { registro });
  if (!r?.recebimento?.id) {
    throw new Error(
      "O servidor não confirmou a gravação do recebimento. Recarregue e confira."
    );
  }
  return r.recebimento;
};

export const recebimentoLiquidar = async (id, dataPagamento) => {
  const r = await chamar("finRecebimentoLiquidar", { id, dataPagamento });
  if (!r?.recebimento?.id) {
    throw new Error("O servidor não confirmou a baixa do recebimento.");
  }
  return r.recebimento;
};

export const recebimentoExcluir = async (id) => {
  const r = await chamar("finRecebimentoExcluir", { id });
  if (!r?.ok) {
    throw new Error("O servidor não confirmou a exclusão do recebimento.");
  }
  return true;
};

export const recebimentosImportar = async (empresaId, itens, origemArquivo) => {
  const r = await chamar("finRecebimentosImportar", {
    empresaId,
    itens,
    origemArquivo,
  });
  if (!r?.ok) {
    throw new Error("O servidor não confirmou a importação dos recebimentos.");
  }
  return r;
};


// -----------------------------------------------------------------------------
// RH + Ponto — extensões retrocompatíveis na mesma porta ml-sync
// -----------------------------------------------------------------------------
export const rhDocumentosListar = (filtros = {}) =>
  chamar("rhDocumentoListar", filtros).then((r) => r.documentos || []);

export const rhDocumentoUpload = (dados) =>
  chamar("rhDocumentoUpload", dados).then((r) => {
    if (!r?.documento?.id) throw new Error("O servidor não confirmou o upload do documento.");
    return r.documento;
  });

export const rhDocumentoUrl = (documentoId) =>
  chamar("rhDocumentoUrl", { documentoId }).then((r) => r.url || null);

export const rhDocumentoAtualizar = (documentoId, campos) =>
  chamar("rhDocumentoAtualizar", { documentoId, ...campos }).then((r) => {
    if (!r?.documento?.id) throw new Error("O servidor não confirmou a atualização do documento.");
    return r.documento;
  });

export const rhBancoListar = (filtros = {}) =>
  chamar("rhBancoListar", filtros).then((r) => ({
    movimentos: r.movimentos || [],
    saldoMinutos: r.saldoMinutos ?? null,
  }));

export const rhBancoRegistrar = (dados) =>
  chamar("rhBancoRegistrar", dados).then((r) => {
    if (!r?.movimento?.id) throw new Error("O servidor não confirmou o lançamento do banco de horas.");
    return r;
  });

export const rhFolhaBuscar = (pessoaId, competencia) =>
  chamar("rhFolhaBuscar", { pessoaId, competencia }).then((r) => r.folha || null);

export const rhFolhaSalvar = (dados) =>
  chamar("rhFolhaSalvar", dados).then((r) => {
    if (!r?.folha?.id) throw new Error("O servidor não confirmou a Folha de Ponto.");
    return r.folha;
  });

export const rhDocumentoExcluir = (documentoId) =>
  chamar("rhDocumentoExcluir", { documentoId }).then((r) => {
    if (!r?.ok) throw new Error("O servidor não confirmou a exclusão do documento.");
    return true;
  });

export const rhDocumentoConfirmarPreenchimento = (documentoId, pessoaId, dadosConfirmados) =>
  chamar("rhDocumentoConfirmarPreenchimento", { documentoId, pessoaId, dadosConfirmados }).then((r) => {
    if (!r?.pessoa?.id) throw new Error("O servidor não confirmou o preenchimento do cadastro.");
    return r;
  });
