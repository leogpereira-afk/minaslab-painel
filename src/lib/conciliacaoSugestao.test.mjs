import test from 'node:test';
import assert from 'node:assert/strict';
import { numerosNF, sugerirTitulos, sugerirLotes, restanteMovimento } from './conciliacaoSugestao.js';
const mov = (id, valor, descricao, mais = {}) => ({ id, tipo: 'CREDITO', valor, descricao, data_movimento: '2026-10-05', conciliacoes: [], ...mais });
const rec = (id, nf, cliente, previsto, mais = {}) => ({ id, numero_nf: nf, cliente, valor_previsto: previsto, valor_conciliado: 0, status: 'VENCIDO', data_vencimento: '2026-10-02', ...mais });
test('extrai número da NF de descrições comuns do banco', () => {
  assert.deepEqual(numerosNF('NF 130 25 051026'), ['130']);
  assert.deepEqual(numerosNF('DOC. NF 122 FAT. 16691011'), ['122']);
  assert.deepEqual(numerosNF('NF: 74/2026'), ['74']);
  assert.deepEqual(numerosNF('Pix recebido de FULANO'), []);
});
test('NF na descrição + valor igual vira a primeira sugestão e é exata', () => {
  const titulos = [rec('a', '122', 'Edifício Dr. José Estevam', 225), rec('b', '121', 'EDIFICIO MEDICAL CENTER', 310), rec('c', '130', 'Villa Di Toscana', 470)];
  const s = sugerirTitulos(mov('m', 225, 'DOC. NF 122 FAT. 16691011'), titulos);
  assert.equal(s[0].titulo.id, 'a'); assert.equal(s[0].exato, true); assert.ok(s[0].motivos.includes('NF 122 na descrição'));
});
test('banco acima do título: sugere com diferença positiva (juros/multa)', () => {
  const s = sugerirTitulos(mov('m', 969.31, 'Ref. Liq. Boleto Comp Externo'), [rec('a', '9', 'X', 950, { data_vencimento: '2026-10-06' })]);
  assert.equal(s.length, 1); assert.equal(s[0].diferenca, 19.31); assert.equal(s[0].exato, false);
});
test('movimento já conciliado em parte só sugere o restante; título quitado ou cancelado fica de fora', () => {
  const m = mov('m', 260, 'Pix recebido de INSTITUTO', { conciliacoes: [{ valor_movimento: 220 }] });
  assert.equal(restanteMovimento(m), 40);
  const s = sugerirTitulos(m, [rec('a', '1', 'INSTITUTO', 40), rec('b', '2', 'Y', 40, { valor_conciliado: 40 }), rec('c', '3', 'Z', 40, { status: 'CANCELADO' })]);
  assert.deepEqual(s.map(x => x.titulo.id), ['a']);
});
test('valor sem relação nenhuma não gera sugestão (sem ruído)', () => {
  assert.deepEqual(sugerirTitulos(mov('m', 5000, 'Pix recebido de ALGUEM'), [rec('a', '5', 'Outro', 310)]), []);
});
test('débito procura despesa pelo valor_original', () => {
  const d = { id: 'd', fornecedor: 'POSTO JOAO ALVES', valor_original: 400, valor_conciliado: 0, status: 'A PAGAR', data_vencimento: '2026-06-02' };
  const s = sugerirTitulos({ id: 'm', tipo: 'DEBITO', valor: 400, descricao: 'TRANSF ENVIADA PIX', data_movimento: '2026-06-02', conciliacoes: [] }, [d]);
  assert.equal(s[0].exato, true);
});
test('lote: dois pix somados fecham uma NF (5.000 + 800 = 5.800)', () => {
  const lotes = sugerirLotes([mov('a', 5000, 'Pix MINASLABBRASIL'), mov('b', 800, 'Pix MINASLABBRASIL'), mov('c', 225, 'x')], [rec('t', '131', 'MINASLAB LTDA', 5800)]);
  assert.equal(lotes.length, 1); assert.deepEqual(lotes[0].movimentos.map(m => m.id), ['a', 'b']); assert.equal(lotes[0].valor, 5800);
});
test('lote não aparece se um movimento sozinho já fecha o título', () => {
  assert.deepEqual(sugerirLotes([mov('a', 300, 'x'), mov('b', 100, 'y'), mov('c', 200, 'z')], [rec('t', '1', 'W', 300)]), []);
});
import { sugerirTodos } from './conciliacaoSugestao.js';
test('NF citada por um movimento fica reservada para ele e some das sugestões dos outros', () => {
  const titulos = [rec('a', '122', 'Edifício Dr. José', 225)];
  const r = sugerirTodos([mov('x', 225, 'Pix recebido de MINASLABBRASIL LTDA'), mov('y', 225, 'DOC. NF 122 FAT. 1')], titulos, []);
  assert.deepEqual(r.get('x'), []);
  assert.equal(r.get('y')[0].titulo.id, 'a');
});
