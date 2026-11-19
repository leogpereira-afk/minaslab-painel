import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarItens, gerePedidos, destinatariosSolicitacao, agruparPorCategoria, avisoMudanca,
  textoQuantidade, normalizarUrgencia, MAX_ITENS,
} from "../../supabase/functions/_shared/compras-solicitacao.mjs";

test("itens: linha em branco some, produto em maiúsculas, categoria e unidade conferidas", () => {
  const { itens, erros } = normalizarItens([
    { produto: "  luva   nitrílica ", detalhes: "tamanho M", categoria: "epi", quantidade: "2", unidade: "caixa" },
    { produto: "", quantidade: 3 },
    { produto: "perfex", categoria: "inventada", quantidade: "1,5", unidade: "tonel" },
  ]);
  assert.deepEqual(erros, []);
  assert.equal(itens.length, 2);
  assert.deepEqual(itens[0], { produto: "LUVA NITRÍLICA", detalhes: "tamanho M", categoria: "epi", quantidade: 2, unidade: "caixa" });
  assert.equal(itens[1].categoria, "outros");
  assert.equal(itens[1].unidade, "unidade");
  assert.equal(itens[1].quantidade, 1.5);
});

test("itens: quantidade zero, negativa ou vazia é erro, não pedido", () => {
  const { itens, erros } = normalizarItens([{ produto: "a", quantidade: 0 }, { produto: "b", quantidade: -2 }, { produto: "c", quantidade: "" }]);
  assert.equal(itens.length, 0);
  assert.equal(erros.length, 3);
});

test("itens: teto por solicitação", () => {
  const muitos = Array.from({ length: MAX_ITENS + 1 }, (_, i) => ({ produto: `p${i}`, quantidade: 1 }));
  assert.equal(normalizarItens(muitos).erros.length, 1);
});

test("quem gere pedidos: direção, Compras inteiro ou aba Pedidos; o resto só pede", () => {
  assert.equal(gerePedidos({ papel: "direcao", permissoes: [] }), true);
  assert.equal(gerePedidos({ papel: "equipe", permissoes: ["__matriz_v1", "compras"] }), true);
  assert.equal(gerePedidos({ papel: "equipe", permissoes: ["__matriz_v1", "compras/pedidos"] }), true);
  assert.equal(gerePedidos({ papel: "equipe", permissoes: ["__matriz_v1", "compras/estoque"] }), false);
  assert.equal(gerePedidos({ papel: "equipe", permissoes: ["__matriz_v1"] }), false);
  assert.equal(gerePedidos({ papel: "equipe", permissoes: [] }), true); // conta antiga, sem matriz
  assert.equal(gerePedidos({ papel: "leitura", permissoes: [] }), false);
});

test("aviso de solicitação nova vai ao responsável; sem responsável, à direção; nunca a quem pediu", () => {
  const contas = [
    { usuario: "ana", papel: "direcao", ativo: true },
    { usuario: "thayna", papel: "equipe", ativo: true, paginas_consulta: ["__matriz_v1", "compras"] },
    { usuario: "brenda", papel: "equipe", ativo: true, paginas_consulta: ["__matriz_v1"] },
    { usuario: "velha", papel: "equipe", ativo: false, paginas_consulta: ["__matriz_v1", "compras"] },
  ];
  assert.deepEqual(destinatariosSolicitacao(contas, "brenda"), ["thayna"]);
  assert.deepEqual(destinatariosSolicitacao(contas, "thayna"), ["ana"]);
  assert.deepEqual(destinatariosSolicitacao(contas.filter((c) => c.usuario !== "thayna"), "brenda"), ["ana"]);
  // Pedidos liberado para todos (decisão da Ana) não faz de todos "quem trata compras".
  const comPedidos = [...contas, { usuario: "mariana", papel: "equipe", ativo: true, paginas_consulta: ["__matriz_v1", "compras/pedidos"] }];
  assert.deepEqual(destinatariosSolicitacao(comPedidos, "brenda"), ["thayna"]);
  assert.deepEqual(destinatariosSolicitacao([{ usuario: "x", papel: "equipe", ativo: true, paginas_consulta: ["__matriz_v1", "compras/ordens"] }], "brenda"), ["x"]);
});

test("lista de compras: agrupa por categoria, urgência alta primeiro, depois a mais antiga", () => {
  const g = agruparPorCategoria([
    { id: 1, categoria: "papelaria", urgencia: "baixa", data: "2026-11-01" },
    { id: 2, categoria: "epi", urgencia: "media", data: "2026-11-02" },
    { id: 3, categoria: "epi", urgencia: "alta", data: "2026-11-10" },
    { id: 4, categoria: "epi", urgencia: "media", data: "2026-11-01" },
    { id: 5, categoria: "??", data: "2026-11-01" },
  ]);
  assert.deepEqual(g.map((x) => x.rotulo), ["EPI", "Outros", "Papelaria"]);
  assert.deepEqual(g[0].itens.map((x) => x.id), [3, 4, 2]);
});

test("aviso para quem pediu: um por pessoa, com motivo na recusa", () => {
  assert.deepEqual(avisoMudanca([{ item: "POST-IT" }], "comprada"), { titulo: "Sua solicitação: POST-IT — Comprada", corpo: "" });
  const r = avisoMudanca([{ item: "A" }, { item: "B" }], "cancelada", "já tem no estoque");
  assert.equal(r.titulo, "Sua solicitação: 2 itens — Recusada");
  assert.equal(r.corpo, "A, B · Motivo: já tem no estoque");
});

test("quantidade em texto e urgência padrão", () => {
  assert.equal(textoQuantidade(2, "caixa"), "2 caixas");
  assert.equal(textoQuantidade(1, "rolo"), "1 rolo");
  assert.equal(textoQuantidade(1.5, "litro"), "1,5 litros");
  assert.equal(normalizarUrgencia("xpto"), "media");
});

test("aprovação: guarda a pedida só na primeira vez e troca pela aprovada", async () => {
  const m = await import("../../supabase/functions/_shared/compras-solicitacao.mjs");
  const pedido = { item: "LUVA", qtde: "10 caixas", quantidade: 10, unidade: "caixa", status: "solicitada" };
  const a = m.aplicarAprovacao(pedido, 5, "thayna", "2026-11-19T10:00:00Z");
  assert.equal(a.status, "aprovada");
  assert.equal(a.qtde, "5 caixas");
  assert.equal(a.qtdeSolicitada, "10 caixas");
  assert.equal(a.quantidadeSolicitada, 10);
  assert.equal(m.textoAprovacao(a), "aprovado 5 caixas (pedido 10 caixas)");
  const b = m.aplicarAprovacao(a, 10, "thayna", "2026-11-19T11:00:00Z");
  assert.equal(b.qtdeSolicitada, "10 caixas", "reaprovar não perde o pedido");
  assert.equal(m.textoAprovacao(b), "", "aprovou tudo: nada a destacar");
  const antigo = m.aplicarAprovacao({ item: "PAPEL", qtde: "2 cx" }, 1, "t", "x");
  assert.equal(antigo.qtde, "1 cx");
  assert.equal(antigo.qtdeSolicitada, "2 cx");
});

test("aprovação: quantidade tem de ser maior que zero; ids repetidos contam uma vez", async () => {
  const m = await import("../../supabase/functions/_shared/compras-solicitacao.mjs");
  assert.deepEqual(m.normalizarAprovacao([{ id: "a", quantidade: "2,5" }, { id: "a", quantidade: 9 }]).itens, [{ id: "a", quantidade: 2.5 }]);
  assert.equal(m.normalizarAprovacao([{ id: "b", quantidade: 0 }]).erros.length, 1);
  assert.equal(m.normalizarAprovacao([{ id: "c", quantidade: "x" }]).erros.length, 1);
  assert.ok(m.PODE_APROVAR.has("solicitada") && m.PODE_APROVAR.has("aprovada") && !m.PODE_APROVAR.has("comprada"));
  assert.deepEqual(m.ANDAMENTO.slice(0, 3), ["solicitada", "aprovada", "cotando"]);
});

test("aviso de aprovação diz quanto foi aprovado", async () => {
  const m = await import("../../supabase/functions/_shared/compras-solicitacao.mjs");
  const a = m.aplicarAprovacao({ item: "LUVA", qtde: "10 caixas", quantidade: 10, unidade: "caixa" }, 5, "t", "x");
  assert.deepEqual(m.avisoMudanca([a], "aprovada"), { titulo: "Sua solicitação: LUVA — Aprovada", corpo: "Aprovado: 5 caixas (pedido 10 caixas)" });
});
