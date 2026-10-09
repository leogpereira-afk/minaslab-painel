import test from 'node:test';
import assert from 'node:assert/strict';
import { maiusculas, padronizarCliente } from './padraoCadastro.js';
test('maiúsculas com acento, sem espaços sobrando', () => {
  assert.equal(maiusculas('  condomínio   são joão '), 'CONDOMÍNIO SÃO JOÃO');
  assert.equal(maiusculas(null), '');
});
test('cliente: nomes e endereço em maiúsculas, e-mail em minúsculas, o resto intacto', () => {
  const r = padronizarCliente({ nome: 'caroline barbosa de souza', nome_fantasia: 'Lab da Carol', cnpj_cpf: '147.392.036-18', email: ' Carol@Email.COM ', cidade: 'montes claros', uf: 'mg', telefone: '(38) 9999-0000', ativo: true, id: 'x' });
  assert.deepEqual(r, { nome: 'CAROLINE BARBOSA DE SOUZA', nome_fantasia: 'LAB DA CAROL', cnpj_cpf: '147.392.036-18', email: 'carol@email.com', cidade: 'MONTES CLAROS', uf: 'MG', telefone: '(38) 9999-0000', ativo: true, id: 'x' });
});
test('campos ausentes ou não texto não quebram', () => {
  assert.deepEqual(padronizarCliente({ nome: 'a', numero: 12 }), { nome: 'A', numero: 12 });
  assert.equal(padronizarCliente(null), null);
});
