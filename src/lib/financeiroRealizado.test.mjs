import test from 'node:test';
import assert from 'node:assert/strict';
import { realizadoTitulo } from '../../supabase/functions/_shared/financeiro-realizado.mjs';

// O valor pago de um título manual vem de dois lugares: as baixas (Dar baixa) e as conciliações com o banco
// (o banco de dados grava valor_conciliado). Recalcular só pelas baixas, como antes, zerava as 268 notas da
// M Lab pagas por conciliação na primeira edição.
test('nota paga só por conciliação continua paga ao recalcular (caso das 268 notas da M Lab)', () => {
  assert.deepEqual(realizadoTitulo({ baixas: [], conciliado: 300, dataAtual: '2026-11-17' }), { realizado: 300, data: '2026-11-17' });
});
test('baixa em dinheiro, sem banco (NF 74)', () => {
  assert.deepEqual(realizadoTitulo({ baixas: [{ valor: 360, data_pagamento: '2026-08-17' }], conciliado: 0, dataAtual: null }), { realizado: 360, data: '2026-08-17' });
});
test('baixa e conciliação do mesmo dinheiro não somam em dobro (NF 93: 680 + 680)', () => {
  assert.deepEqual(realizadoTitulo({ baixas: [{ valor: 680, data_pagamento: '2026-09-11' }], conciliado: 680, dataAtual: '2026-09-11' }), { realizado: 680, data: '2026-09-11' });
});
test('várias baixas: soma e fica com a data da última; sem nada, zero', () => {
  assert.deepEqual(realizadoTitulo({ baixas: [{ valor: 100, data_pagamento: '2026-10-01' }, { valor: '50.5', data_pagamento: '2026-10-20' }], conciliado: 0 }), { realizado: 150.5, data: '2026-10-20' });
  assert.deepEqual(realizadoTitulo({ baixas: [], conciliado: 0 }), { realizado: 0, data: null });
});
