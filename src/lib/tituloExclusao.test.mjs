import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarExclusaoTitulo } from './tituloExclusao.js';

test('nota conciliada com o banco não pode ser excluída: pede para desfazer a conciliação', () => {
  const r = avaliarExclusaoTitulo({ cliente: 'EDIFICIO NAPOLES', valor_conciliado: 680, status: 'PAGO' }, 'REC');
  assert.equal(r.bloqueado, true);
  assert.match(r.mensagem, /conciliada com o banco \(R\$\s?680,00\)/);
  assert.match(r.mensagem, /Desfaça a conciliação/);
});
test('nota com baixa (sem banco) pede confirmação reforçada com o valor', () => {
  const r = avaliarExclusaoTitulo({ fornecedor: 'PADARIA', valor_conciliado: 0, valor_pago: 30, baixas: [{ valor: 30 }] }, 'DESP');
  assert.equal(r.bloqueado, false);
  assert.match(r.mensagem, /PADARIA/);
  assert.match(r.mensagem, /R\$\s?30,00 pago/);
  assert.match(r.mensagem, /deixa de contar/);
});
test('nota em aberto: confirmação simples', () => {
  const r = avaliarExclusaoTitulo({ cliente: 'FULANO', valor_conciliado: 0, valor_recebido: 0 }, 'REC');
  assert.deepEqual(r, { bloqueado: false, mensagem: 'Excluir o recebimento de FULANO?' });
});
