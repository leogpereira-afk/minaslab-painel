import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarClientes } from './buscaClientes.js';
const base = [
  { id: '1', nome: 'Laboratório São João Ltda', nome_fantasia: 'Lab SJ', cnpj_cpf: '12.345.678/0001-90', ativo: true },
  { id: '2', nome: 'Posto Ipiranga', cnpj_cpf: '98765432000100' },
  { id: '3', nome: 'Antigo Fornecedor', ativo: false },
  { id: '4', nome: 'Mesclado SA', mesclado_para: '1' },
  { id: '5', nome: 'Sao Paulo Reagentes', id_omie: '777' },
];
test('busca sem acento e sem diferença de maiúscula, por qualquer palavra', () => {
  assert.deepEqual(buscarClientes(base, 'sao joao').itens.map(c => c.id), ['1']);
  assert.deepEqual(buscarClientes(base, 'SÃO').itens.map(c => c.id), ['1', '5']);
});
test('acha por nome fantasia, CNPJ (com ou sem pontuação) e ID Omie', () => {
  assert.deepEqual(buscarClientes(base, 'lab sj').itens.map(c => c.id), ['1']);
  assert.deepEqual(buscarClientes(base, '12.345.678').itens.map(c => c.id), ['1']);
  assert.deepEqual(buscarClientes(base, '987654').itens.map(c => c.id), ['2']);
  assert.deepEqual(buscarClientes(base, '777').itens.map(c => c.id), ['5']);
});
test('inativos e mesclados nunca aparecem; sem termo lista os ativos', () => {
  assert.deepEqual(buscarClientes(base, '').itens.map(c => c.id), ['1', '2', '5']);
  assert.equal(buscarClientes(base, 'antigo').total, 0);
  assert.equal(buscarClientes(base, 'mesclado').total, 0);
});
test('limite corta a lista mas informa o total', () => {
  const muitos = Array.from({ length: 20 }, (_, i) => ({ id: String(i), nome: `Cliente ${i}` }));
  const r = buscarClientes(muitos, 'cliente', 8);
  assert.equal(r.itens.length, 8); assert.equal(r.total, 20);
});
