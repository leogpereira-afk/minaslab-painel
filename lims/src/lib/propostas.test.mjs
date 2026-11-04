import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroProposta, precoUnitario, totalProposta, exibicao, criarRevisao, copiarProposta, aceitarProposta, erroEtapa1, itemDoPacote, podeEditar, chaveNumero, minimoNumero } from "./propostas.js";

const base = () => ({
  id: 1, num: 957, ano: 2026, ver: 0, status: "Salvo", exib: "Valor total COM Outros custos",
  itens: [{ qtd: 4, params: [{ id: "a", preco: 22 }, { id: "b", preco: 18 }, { id: "c", preco: 18 }] }], outros: 150, revs: [], docs: [], aceite: null,
});

test("número no formato do GerenciaLab", () => {
  assert.equal(numeroProposta(base()), "00000957/2026.0");
  assert.equal(numeroProposta({ num: 12, ano: 2027, ver: 3 }), "00000012/2027.3");
});

test("totais: soma dos parâmetros × amostras + outros custos", () => {
  assert.equal(precoUnitario(base().itens[0]), 22 + 18 + 18);
  assert.equal(totalProposta(base()), 58 * 4 + 150);
});

test("exibição de preços decide o que o cliente vê", () => {
  const p = base();
  assert.deepEqual(exibicao(p), { valores: true, outros: true, porParametro: false, total: 382 });
  assert.equal(exibicao({ ...p, exib: "Valor Total SEM Outros custos" }).total, 232);
  assert.equal(exibicao({ ...p, exib: "Valor total COM Outros custos COM valor parâmetros" }).porParametro, true);
  assert.deepEqual(exibicao({ ...p, exib: "Não Exibir Valores" }), { valores: false, outros: false, porParametro: false, total: null });
});

test("revisão sobe a versão, exige motivo e desfaz o aceite", () => {
  assert.throws(() => criarRevisao(base(), "  ", "Ana", "2026-11-04"), /motivo/);
  const r = criarRevisao({ ...base(), status: "Aceito", aceite: { nome: "X" } }, "Novo parâmetro", "Ana", "2026-11-04");
  assert.equal(r.ver, 1);
  assert.equal(r.status, "Revisado");
  assert.equal(r.aceite, null);
  assert.deepEqual(r.revs.at(-1), { ver: 1, motivo: "Novo parâmetro", em: "2026-11-04", por: "Ana" });
});

test("cópia ganha o número do servidor, versão 0 e status Copia sem levar histórico nem id", () => {
  const c = copiarProposta({ ...base(), id: "propostas-x", cod: 4, revs: [{ ver: 1 }], views: 9 }, 961, "Ana", "2026-11-04", "2026-12-04");
  assert.equal(c.id, undefined);
  assert.equal(c.cod, undefined);
  assert.equal(c.num, 961);
  assert.equal(c.ver, 0);
  assert.equal(c.status, "Copia");
  assert.deepEqual(c.revs, []);
  assert.equal(c.views, 0);
});

test("numeração continua do número inicial configurado", () => {
  assert.equal(chaveNumero(2026), "proposta:2026");
  assert.equal(minimoNumero({ numeroInicialProposta: 957 }), 956);
  assert.equal(minimoNumero({}), 0);
});

test("aceite exige nome e data; aceita não se edita", () => {
  assert.throws(() => aceitarProposta(base(), { data: "2026-11-04", nome: "" }), /quem aceitou/);
  const a = aceitarProposta(base(), { data: "2026-11-04", nome: " Carlos " });
  assert.equal(a.status, "Aceito");
  assert.equal(a.aceite.nome, "Carlos");
  assert.equal(podeEditar(a), false);
  assert.equal(podeEditar(base()), true);
});

test("Avançar da etapa 1 pede cliente e validade coerente", () => {
  assert.match(erroEtapa1({ criacao: "2026-11-04", validade: "2026-12-04" }), /cliente/);
  assert.match(erroEtapa1({ clienteId: 1, criacao: "2026-11-04", validade: "2026-11-01" }), /validade/);
  assert.equal(erroEtapa1({ clienteId: 1, criacao: "2026-11-04", validade: "2026-11-04", ciclo: "Faturado" }), "");
});

test("item do pacote copia parâmetros e preços da tabela, só os marcados", () => {
  const cat = {
    tabelas_preco: [{ id: "t1", nome: "Padrão", precos: { pH: 18, tur: 20 } }],
    parametros: [{ id: "pH", parametro: "pH", abreviacao: "pH", metodo: "m1", unidade: "u0", acreditado: "Sim", lq: "2" }, { id: "tur", parametro: "Turbidez", unidade: "u1" }, { id: "ec", parametro: "E. coli" }],
    metodos: [{ id: "m1", nome: "SMWW 4500-H+ B" }], unidades: [{ id: "u1", sigla: "uT" }],
    matrizes: [{ id: "x", nome: "Água tratada" }], legislacoes: [{ id: "l", nome: "Portaria GM/MS 888/2021" }],
  };
  const pac = { id: "pk", descricao: "Potabilidade", matriz: "x", legislacao: "l", tabelaPreco: "t1", parametros: ["pH", "tur", "ec"] };
  const it = itemDoPacote(pac, cat, 3, new Set(["pH", "ec"]));
  assert.equal(it.descricao, "Potabilidade");
  assert.equal(it.matriz, "Água tratada");
  assert.equal(it.legislacao, "Portaria GM/MS 888/2021");
  assert.deepEqual(it.params.map((p) => [p.id, p.preco, p.acred]), [["pH", 18, true], ["ec", 0, false]]);
  assert.equal(it.params[0].metodo, "SMWW 4500-H+ B");
  assert.equal(it.qtd, 3);
  assert.throws(() => itemDoPacote(pac, cat, 1, new Set()), /parâmetro/);
  assert.throws(() => itemDoPacote(null, cat, 1, new Set(["pH"])), /pacote/);
});
