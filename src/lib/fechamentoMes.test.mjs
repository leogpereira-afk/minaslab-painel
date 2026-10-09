import test from 'node:test';
import assert from 'node:assert/strict';
import { montarFechamento, fimDoMes } from './fechamentoMes.js';
const mov = (id, valor, descricao, mais = {}) => ({ id, tipo: 'CREDITO', valor, descricao, data_movimento: '2026-10-05', conta_bancaria_id: 'c', conciliado: false, conciliacoes: [], ...mais });
const rec = (id, nf, cliente, previsto, mais = {}) => ({ id, numero_nf: nf, cliente, valor_previsto: previsto, valor_recebido: 0, valor_conciliado: 0, status: 'VENCIDO', data_vencimento: '2026-10-02', ...mais });
const get = (f, id) => f.itens.find((i) => i.id === id);
test('fim do mês', () => { assert.equal(fimDoMes('2026-02'), '2026-02-28'); assert.equal(fimDoMes('2026-10'), '2026-10-31'); });
test('tudo conciliado e sem pontas soltas: em ordem', () => {
  const f = montarFechamento({ mes: '2026-10', hoje: '2026-11-02', movimentos: [mov('a', 100, 'x', { conciliado: true, conciliacoes: [{ valor_movimento: 100 }] })], receber: [rec('r', '1', 'A', 100, { status: 'PAGO', valor_recebido: 100, valor_conciliado: 100 })], pagar: [] });
  assert.equal(f.emOrdem, true); assert.equal(f.erros, 0); assert.equal(f.resumo.entradas.conciliado, 100);
});
test('pendente no mês fechado é erro; no mês corrente é atenção', () => {
  const base = { mes: '2026-10', movimentos: [mov('a', 300, 'x')], receber: [], pagar: [] };
  assert.equal(get(montarFechamento({ ...base, hoje: '2026-11-02' }), 'pendentes-mes').severidade, 'erro');
  assert.equal(get(montarFechamento({ ...base, hoje: '2026-10-20' }), 'pendentes-mes').severidade, 'atencao');
});
test('pendência de mês anterior sempre é erro', () => {
  const f = montarFechamento({ mes: '2026-10', hoje: '2026-10-20', movimentos: [mov('a', 50, 'x', { data_movimento: '2026-08-14' })], receber: [], pagar: [] });
  assert.equal(get(f, 'pendentes-antes').severidade, 'erro'); assert.equal(get(f, 'pendentes-antes').quantidade, 1);
});
test('título pago sem vínculo no banco aparece (caso NF 74) e quitado com vínculo não', () => {
  const f = montarFechamento({ mes: '2026-10', hoje: '2026-10-20', movimentos: [], receber: [rec('a', '74', 'WEMERSON', 360, { status: 'PAGO', valor_recebido: 360, valor_conciliado: 0, data_pagamento: '2026-08-17', origem: 'MANUAL' }), rec('b', '75', 'OK', 100, { status: 'PAGO', valor_recebido: 100, valor_conciliado: 100 })], pagar: [] });
  const i = get(f, 'pago-sem-banco'); assert.equal(i.quantidade, 1); assert.equal(i.valor, 360); assert.match(i.lista[0].texto, /NF 74/);
});
test('repasses da MinasLab do mês sem NF; os que fecham uma NF existente ficam fora', () => {
  const ms = [mov('a', 2117, 'Pix recebido de MINASLABBRASIL LTDA'), mov('b', 610.01, 'Pix recebido de MINASLABBRASIL LTDA'), mov('c', 5000, 'Pix recebido de MINASLABBRASIL LTDA', { data_movimento: '2026-09-03' }), mov('d', 800, 'Pix recebido de MINASLABBRASIL LTDA', { data_movimento: '2026-09-03' })];
  const f = montarFechamento({ mes: '2026-10', hoje: '2026-10-20', movimentos: ms, receber: [rec('t', '131', 'MINASLAB LTDA', 5800)], pagar: [] });
  const i = get(f, 'repasses'); assert.equal(i.quantidade, 2); assert.equal(i.valor, 2727.01);
});
test('movimento conciliado sem vínculo é erro, exceto se foi classificado (estorno/interno)', () => {
  const f = montarFechamento({ mes: '2026-10', hoje: '2026-10-20', movimentos: [mov('a', 100, 'x', { conciliado: true }), mov('b', 100, 'y', { conciliado: true, classificacao_bancaria: 'ESTORNO' })], receber: [], pagar: [] });
  assert.equal(get(f, 'sem-vinculo').quantidade, 1);
});
test('conciliação parcial e duplicados com pendência', () => {
  const f = montarFechamento({ mes: '2026-10', hoje: '2026-10-20', movimentos: [mov('a', 969.31, 'Boleto', { conciliacoes: [{ valor_movimento: 950 }] }), mov('b', 80, 'FRIGORIFICO'), mov('c', 80, 'FRIGORIFICO'), mov('d', 80, 'FRIGORIFICO', { data_movimento: '2026-10-06' })], receber: [], pagar: [] });
  assert.equal(get(f, 'parciais').quantidade, 1); assert.equal(get(f, 'duplicados').quantidade, 2);
});
