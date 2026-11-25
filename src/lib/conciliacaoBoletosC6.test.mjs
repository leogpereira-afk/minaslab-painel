import test from 'node:test';
import assert from 'node:assert/strict';
import { sugerirBoletosC6, depositosBoletoSemC6 } from './conciliacaoBoletosC6.js';

// Valores do relatório de boletos do C6 (25/11/2026) e do extrato da M Lab: o C6 credita num lançamento só
// ("Ref. Liq. Boleto Comp Externo") os boletos pagos com a mesma data de crédito.
const DESC = 'Ref. Liq. Boleto Comp Externo';
const mov = (id, valor, data, mais = {}) => ({ id, tipo: 'CREDITO', valor, descricao: DESC, data_movimento: data, conciliacoes: [], ...mais });
const rec = (id, nf, previsto, credito, liquidacao, mais = {}) => ({
  id, numero_nf: nf, cliente: `Cliente ${nf}`, valor_previsto: previsto, valor_conciliado: 0, status: 'VENCIDO',
  c6_status: 'PAGO', c6_data_credito: credito, c6_valor_liquidacao: liquidacao, ...mais,
});
const ids = (s) => s.itens.map((x) => x.titulo.id).sort();

test('depósito de 13/11: dois boletos com juros de atraso fecham o banco no centavo', () => {
  const receber = [rec('155', '155', 310, '2026-11-13', 316.30), rec('151', '151', 345, '2026-11-13', 352.78), rec('156', '156', 310, '2026-11-09', 310)];
  const r = sugerirBoletosC6([mov('m', 669.08, '2026-11-13')], receber);
  const s = r.get('m');
  assert.deepEqual(ids(s), ['151', '155']);
  assert.deepEqual(s.itens.map((x) => [x.titulo.id, x.restante, x.liquidacao, x.juros]).sort(), [['151', 345, 352.78, 7.78], ['155', 310, 316.3, 6.3]]);
});

test('depósito de 17/11: as notas 161 e 163 (e não outra de 300 vencida no mesmo dia)', () => {
  const receber = [rec('161', '161', 300, '2026-11-17', 300), rec('163', '163', 300, '2026-11-17', 300), rec('x', '159', 300, null, null, { c6_status: null })];
  assert.deepEqual(ids(sugerirBoletosC6([mov('m', 600, '2026-11-17')], receber).get('m')), ['161', '163']);
});

test('um boleto sozinho com juros (18/11: 306,27 para a NF 162 de 300)', () => {
  const s = sugerirBoletosC6([mov('m', 306.27, '2026-11-18')], [rec('162', '162', 300, '2026-11-18', 306.27)]).get('m');
  assert.deepEqual(ids(s), ['162']);
  assert.equal(s.itens[0].juros, 6.27);
});

test('dois créditos no mesmo dia: cada um fica com os boletos que fecham o seu valor', () => {
  const receber = [rec('a', '1', 300, '2026-06-08', 300), rec('b', '2', 140, '2026-06-08', 140), rec('c', '3', 310, '2026-06-08', 310)];
  const r = sugerirBoletosC6([mov('m1', 300, '2026-06-08'), mov('m2', 450, '2026-06-08')], receber);
  assert.deepEqual(ids(r.get('m1')), ['a']);
  assert.deepEqual(ids(r.get('m2')), ['b', 'c']);
});

test('não sugere quando a soma não fecha, nem com boleto já conciliado, cancelado ou de outro dia', () => {
  const receber = [
    rec('a', '1', 300, '2026-11-17', 300),
    rec('b', '2', 300, '2026-11-17', 300, { valor_conciliado: 300 }),
    rec('c', '3', 300, '2026-11-17', 300, { c6_status: 'CANCELADO' }),
    rec('d', '4', 300, '2026-11-16', 300),
  ];
  assert.equal(sugerirBoletosC6([mov('m', 600, '2026-11-17')], receber).has('m'), false);
  assert.equal(sugerirBoletosC6([mov('m', 300, '2026-11-17', { tipo: 'DEBITO' })], receber).has('m'), false, 'só créditos');
});

test('sem liquidação no relatório, usa o valor da nota', () => {
  const s = sugerirBoletosC6([mov('m', 300, '2026-11-17')], [rec('a', '1', 300, '2026-11-17', null)]).get('m');
  assert.equal(s.itens[0].liquidacao, 300);
  assert.equal(s.itens[0].juros, 0);
});

test('aviso: depósito de boleto pendente sem relatório C6 que o explique', () => {
  const movs = [mov('m1', 600, '2026-11-17'), mov('m2', 520, '2026-11-20'), mov('m3', 100, '2026-11-20', { descricao: 'Pix recebido de FULANO' })];
  const receber = [rec('161', '161', 300, '2026-11-17', 300), rec('163', '163', 300, '2026-11-17', 300)];
  const sugestoes = sugerirBoletosC6(movs, receber);
  assert.deepEqual(depositosBoletoSemC6(movs, sugestoes).map((m) => m.id), ['m2']);
});

test('PIX comum de mesmo valor no mesmo dia não pega o boleto; boleto pago por QR Code pega (16/11: NF 168)', () => {
  const receber = [rec('168', '168', 560, '2026-11-16', 560)];
  const pix = mov('p', 560, '2026-11-16', { descricao: 'Pix recebido de FULANO' });
  assert.equal(sugerirBoletosC6([pix], receber).has('p'), false);
  const qr = mov('q', 560, '2026-11-16', { descricao: 'Pix qr code recebido de ALVARO' });
  assert.deepEqual(ids(sugerirBoletosC6([pix, qr], receber).get('q')), ['168']);
});
