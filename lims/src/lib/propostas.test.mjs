import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroProposta, precoUnitario, totalProposta, exibicao, criarRevisao, copiarProposta, aceitarProposta, erroEtapa1, adicionarItem, podeEditar, proximoNumero } from "./propostas.js";

const base = () => ({
  id: 1, num: 957, ano: 2026, ver: 0, status: "Salvo", exib: "Valor total COM Outros custos",
  itens: [{ sid: 5, qtd: 4, params: ["CRL", "PH", "TUR"] }], outros: 150, revs: [], docs: [], aceite: null,
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

test("cópia ganha número novo, versão 0 e status Copia sem levar histórico", () => {
  const lista = [base(), { ...base(), id: 7, num: 960 }];
  const c = copiarProposta({ ...base(), revs: [{ ver: 1 }], views: 9 }, lista, "Ana", "2026-11-04", "2026-12-04");
  assert.equal(c.id, 8);
  assert.equal(c.num, 961);
  assert.equal(c.ver, 0);
  assert.equal(c.status, "Copia");
  assert.deepEqual(c.revs, []);
  assert.equal(c.views, 0);
  assert.equal(proximoNumero([]), 1);
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

test("adicionar serviço só com os parâmetros marcados", () => {
  const p = adicionarItem(base(), 1, 3, new Set(["PH", "EC", "XX"]));
  assert.deepEqual(p.itens.at(-1), { sid: 1, qtd: 3, params: ["PH", "EC"] });
  assert.throws(() => adicionarItem(base(), 1, 1, new Set()), /parâmetro/);
});
