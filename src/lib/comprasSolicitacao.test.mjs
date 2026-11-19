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
