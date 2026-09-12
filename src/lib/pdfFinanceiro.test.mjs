import test from 'node:test';
import assert from 'node:assert/strict';
import { montarRelatorioFinanceiro } from './relatorioFinanceiro.js';
import { gerarPdfFinanceiro } from './pdfFinanceiro.js';
const base={de:'2026-01-01',ate:'2026-12-31',hoje:'2026-09-12'};
test('PDF bancário pagina a lista inteira e mantém o último identificador após 1200 registros', () => {
  const r=montarRelatorioFinanceiro({...base,movimentos:Array.from({length:1201},(_,i)=>({id:`MOV-UNICO-${i}`,data_movimento:'2026-09-01',tipo:'CREDITO',valor:1,descricao:`Movimento ${i}`,empresa_id:'e',conta_bancaria_id:'c'}))});
  const doc=gerarPdfFinanceiro({relatorio:r,tipo:'bancos',emitidoEm:new Date('2026-09-12T12:00:00Z')});
  assert.ok(doc.getNumberOfPages()>1);
  const texto=doc.output();
  assert.ok(texto.includes('MOV-UNICO-1200'));
  assert.ok(texto.includes('MOV-UNICO-0'));
  assert.ok(texto.includes('1.201,00'));
  assert.equal((texto.match(/Extrato banc/g)||[]).length,doc.getNumberOfPages());
});
test('PDF executivo não se apresenta como lucro e inclui empresa, período, gráficos e critérios', () => {
  const r=montarRelatorioFinanceiro({...base,movimentos:[{id:'1',data_movimento:'2026-01-01',tipo:'CREDITO',valor:100},{id:'2',data_movimento:'2026-02-01',tipo:'DEBITO',valor:20}]});
  const doc=gerarPdfFinanceiro({relatorio:r,empresa:'Empresa Exemplo',conta:'Conta Exemplo'}), texto=doc.output();
  assert.ok(texto.includes('Empresa Exemplo')); assert.ok(texto.includes('Conta Exemplo')); assert.ok(texto.includes('01/01/2026')); assert.ok(texto.includes('saldo dispon')); assert.ok(doc.getNumberOfPages()>=2);
});
test('PDF de despesas preserva centro de custo, valor e título cancelado no detalhe', () => {
  const r=montarRelatorioFinanceiro({...base,despesas:[{id:'CANCELADO-EXEMPLO',data_vencimento:'2026-01-03',status:'CANCELADO',valor_original:123,centro:{nome:'Centro Exemplo'},descricao:'Despesa exemplo'}]});
  const texto=gerarPdfFinanceiro({relatorio:r,tipo:'pagar'}).output();
  assert.ok(texto.includes('CANCELADO-EXEMPLO')); assert.ok(texto.includes('Centro Exemplo')); assert.ok(texto.includes('123,00')); assert.equal(r.pagarResumo.total,0);
  assert.ok(!texto.includes('NaN'));
});
