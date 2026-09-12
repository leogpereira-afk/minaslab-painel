// Exercita os handlers reais da página com dados em memória. A extração evita
// importar React/JSX ou simular um segundo algoritmo de recebimento no teste.
// Nenhum serviço do aplicativo é importado e nenhuma chamada de rede é feita.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync(new URL("../pages/Compras.jsx", import.meta.url), "utf8");
const inicio = pagina.indexOf("  // ---- recebimento (pedido -> estoque)");
const fim = pagina.indexOf("  const acoes =", inicio);
assert.ok(inicio >= 0 && fim > inicio, "bloco de recebimento da página não encontrado");
const bloco = pagina.slice(inicio, fim);
const inicioOrdem = pagina.indexOf("  const receberOrdem =");
const fimOrdem = pagina.indexOf("  const removerOrdem =", inicioOrdem);
assert.ok(inicioOrdem >= 0 && fimOrdem > inicioOrdem, "handler receberOrdem não encontrado");

function cenario({ falhar, extras = [], movs = [], ordemExiste = true } = {}) {
  const pedidos = [
    { id: "p1", item: "Frasco", status: "comprada", ordemId: "oc1" },
    { id: "p2", item: "Papel", status: "comprada", ordemId: "oc1" },
    ...extras,
  ];
  const dados = {
    pedidos,
    ordens: ordemExiste ? [{ id: "oc1", numero: "42", status: "enviada" }] : [],
    produtos: [{ id: "pr1", nome: "Frasco" }, { id: "pr2", nome: "Papel" }],
    movs,
  };
  // O snapshot da tela fica separado do servidor simulado: salvar não atualiza
  // dados antes da recarga, como acontece na página real.
  const persistido = structuredClone(dados);
  const chamadas = [];
  const avisos = [];
  const ocupacao = [];
  const modais = [];
  let recargas = 0;
  const salvar = async (colecao, registro) => {
    chamadas.push({ colecao, registro: structuredClone(registro) });
    if (falhar?.(colecao, registro)) throw new Error("falha simulada");
    const chave = { compras: "pedidos", ordens: "ordens", estoque_mov: "movs", produtos: "produtos" }[colecao];
    const salvo = { ...registro, id: registro.id || `novo-${chamadas.length}` };
    const indice = persistido[chave].findIndex((x) => x.id === salvo.id);
    if (indice < 0) persistido[chave].push(salvo);
    else persistido[chave][indice] = salvo;
    return salvo;
  };
  const entradaDe = (id) => dados.movs.find((m) => m.pedidoId === id && m.tipo === "entrada");
  const env = {
    dados, salvar, entradaDe, temEntrada: (id) => !!entradaDe(id),
    desdeQuando: (m) => m?.data || "data não registrada",
    recebendo: { ordemId: "oc1", pedidoIds: ["p1", "p2"] },
    setSalvando: (v) => ocupacao.push(v), setAviso: (v) => avisos.push(v),
    setRecebendo: (v) => modais.push(v), recarregar: () => { recargas += 1; },
    ymdLocal: () => "2026-09-06", avisarErro: (texto) => avisos.push({ tipo: "erro", texto }),
    STATUS_PEDIDO: { comprada: { rotulo: "Comprada" } },
    COL_PEDIDOS: "compras", COL_PRODUTOS: "produtos", COL_MOV: "estoque_mov", COL_ORDENS: "ordens",
    gravar: async (colecao, registro, texto) => {
      await salvar(colecao, registro);
      avisos.push({ tipo: "ok", texto });
    },
  };
  const handlers = new Function(...Object.keys(env), `${bloco}\n${pagina.slice(inicioOrdem, fimOrdem)}\nreturn { confirmarRecebimento, soMarcarRecebida, receberOrdem };`)(...Object.values(env));
  const linhas = [{ pedidoId: "p1", produtoId: "pr1", quantidade: 2 }, { pedidoId: "p2", produtoId: "pr2", quantidade: 3 }];
  return { ...handlers, dados, persistido, chamadas, avisos, ocupacao, modais, linhas, recargas: () => recargas };
}

for (const fluxo of ["confirmarRecebimento", "soMarcarRecebida"]) {
  test(`${fluxo}: falha de item mantém OC pendente e preserva gravações confirmadas`, async () => {
    const c = cenario({ falhar: (col, r) => col === "compras" && r.id === "p2" });
    await c[fluxo](c.linhas);
    assert.equal(c.persistido.ordens[0].status, "enviada");
    assert.equal(c.chamadas.filter((x) => x.colecao === "ordens").length, 0);
    assert.equal(c.persistido.pedidos[0].status, "recebida");
    assert.equal(c.persistido.pedidos[1].status, "comprada");
    assert.equal(c.persistido.movs.length, fluxo === "confirmarRecebimento" ? 2 : 0);
    assert.equal(c.avisos.at(-1).tipo, "erro");
    assert.match(c.avisos.at(-1).texto, /OC 42.*pendente/i);
    assert.match(c.avisos.at(-1).texto, /já salvos.*preservados/i);
    assert.deepEqual(c.ocupacao, [true, false]);
    assert.equal(c.recargas(), 1);
  });

  test(`${fluxo}: êxito integral conclui OC somente depois dos itens`, async () => {
    const c = cenario();
    await c[fluxo](c.linhas);
    assert.equal(c.persistido.ordens[0].status, "recebida");
    assert.ok(c.persistido.pedidos.every((p) => p.status === "recebida"));
    assert.equal(c.chamadas.at(-1).colecao, "ordens");
    assert.equal(c.chamadas.filter((x) => x.colecao === "ordens").length, 1);
    assert.equal(c.persistido.movs.length, fluxo === "confirmarRecebimento" ? 2 : 0);
    assert.equal(c.avisos.at(-1).tipo, "ok");
  });

  test(`${fluxo}: item pendente fora do modal impede concluir a ordem inteira`, async () => {
    const c = cenario({ extras: [{ id: "p3", item: "Reagente", status: "comprada", ordemId: "oc1" }] });
    await c[fluxo](c.linhas);
    assert.equal(c.persistido.ordens[0].status, "enviada");
    assert.equal(c.persistido.pedidos[0].status, "recebida");
    assert.equal(c.persistido.pedidos[1].status, "recebida");
    assert.equal(c.persistido.pedidos[2].status, "comprada");
    assert.equal(c.avisos.at(-1).tipo, "erro");
    assert.match(c.avisos.at(-1).texto, /OC 42.*pendente/i);
  });

  test(`${fluxo}: itens já recebidos, cancelados e com entrada anterior não bloqueiam êxito`, async () => {
    const c = cenario({
      extras: [
        { id: "p3", status: "recebida", ordemId: "oc1" },
        { id: "p4", status: "cancelada", ordemId: "oc1" },
        { id: "p5", status: "comprada", ordemId: "oc1" },
        { id: "outra", status: "comprada", ordemId: "oc2" },
      ],
      movs: [{ id: "antigo", pedidoId: "p5", tipo: "entrada", quantidade: 5 }],
    });
    await c[fluxo](c.linhas);
    assert.equal(c.persistido.ordens[0].status, "recebida");
    assert.deepEqual(c.persistido.movs[0], c.dados.movs[0]);
    assert.equal(c.chamadas.filter((x) => x.registro.pedidoId === "p5").length, 0);
  });

  test(`${fluxo}: ordem removida não produz confirmação enganosa`, async () => {
    const c = cenario({ ordemExiste: false });
    await c[fluxo](c.linhas);
    assert.equal(c.persistido.ordens.length, 0);
    assert.equal(c.avisos.at(-1).tipo, "erro");
    assert.match(c.avisos.at(-1).texto, /ordem.*não.*lista/i);
    assert.equal(c.persistido.pedidos[0].status, "recebida");
  });

  test(`${fluxo}: falha ao gravar OC preserva todos os itens e informa pendência`, async () => {
    const c = cenario({ falhar: (col) => col === "ordens" });
    await c[fluxo](c.linhas);
    assert.equal(c.persistido.ordens[0].status, "enviada");
    assert.ok(c.persistido.pedidos.every((p) => p.status === "recebida"));
    assert.match(c.avisos.at(-1).texto, /OC 42.*pendente/i);
  });
}

test("falha na entrada do estoque não marca o pedido nem conclui a OC", async () => {
  const c = cenario({ falhar: (col, r) => col === "estoque_mov" && r.pedidoId === "p2" });
  await c.confirmarRecebimento(c.linhas);
  assert.equal(c.persistido.movs.length, 1);
  assert.equal(c.persistido.pedidos[1].status, "comprada");
  assert.equal(c.persistido.ordens[0].status, "enviada");
  assert.match(c.avisos.at(-1).texto, /OC 42.*pendente/i);
});

test("receberOrdem só dispensa o modal quando não resta item sem confirmação", async () => {
  const c = cenario({ movs: [{ id: "antigo", pedidoId: "p1", tipo: "entrada" }] });
  await c.receberOrdem("oc1");
  assert.deepEqual(c.modais.at(-1), { pedidoIds: ["p2"], ordemId: "oc1" });
  assert.equal(c.persistido.ordens[0].status, "enviada");
  assert.equal(c.chamadas.length, 0);
  c.dados.pedidos[1].status = "recebida";
  await c.receberOrdem("oc1");
  assert.equal(c.persistido.ordens[0].status, "recebida");
  assert.equal(c.chamadas.length, 1);
  assert.equal(c.chamadas[0].colecao, "ordens");
});
