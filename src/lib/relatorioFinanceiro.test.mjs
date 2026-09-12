import test from 'node:test';
import assert from 'node:assert/strict';
import { montarRelatorioFinanceiro as montar, periodoAnterior, periodoValido, variacaoFinanceira, notasRelatorio, celulaCsvFinanceiro } from './relatorioFinanceiro.js';
const filtro = { empresa: 'e1', conta: 'c1', de: '2026-09-01', ate: '2026-09-30', hoje: '2026-09-12' };
const mov = (id, valor, tipo = 'CREDITO', mais = {}) => ({ id, empresa_id: 'e1', conta_bancaria_id: 'c1', data_movimento: '2026-09-01', tipo, valor, conciliado: true, ...mais });
const titulo = (id, mais = {}) => ({ id, empresa_id: 'e1', conta_bancaria_id: 'c1', data_vencimento: '2026-09-01', valor_original: 100, valor_previsto: 100, valor_pendente: 40, valor_pago: 60, valor_recebido: 60, status: 'PARCIAL', ...mais });
test('o filtro de empresa e conta é idêntico para banco, títulos, categorias e PDF', () => {
  const fora = [{ empresa_id:'e2' }, { conta_bancaria_id:'c2' }, { data_vencimento:'2026-08-31', data_movimento:'2026-08-31' }];
  const r = montar({ ...filtro, movimentos:[mov('m',5), ...fora.map((x,i)=>mov(`x${i}`,900,'CREDITO',x))], recebimentos:[titulo('r'), ...fora.map((x,i)=>titulo(`r${i}`,x))], despesas:[titulo('d'), ...fora.map((x,i)=>titulo(`d${i}`,x))] });
  assert.equal(r.banco.entradas,5); assert.equal(r.receber.length,1); assert.equal(r.pagar.length,1); assert.equal(r.categorias[0].total,100);
});
test('consolidado preserva empresas e contas, inclusive títulos sem conta', () => {
  const r=montar({...filtro,empresa:'',conta:'',despesas:[titulo('1'),titulo('2',{empresa_id:'e2',conta_bancaria_id:null})]});
  assert.equal(r.pagarResumo.total,200); assert.equal(r.pagar.length,2);
});
test('cancelados ficam no detalhe, mas não inflacionam totais, vencidos ou categorias', () => {
  const r=montar({...filtro,despesas:[titulo('a'),titulo('b',{status:'CANCELADO',valor_original:9000})]});
  assert.equal(r.pagar.length,2); assert.equal(r.pagarResumo.total,100); assert.equal(r.pagarResumo.vencido,40); assert.equal(r.pagarResumo.cancelados,1); assert.equal(r.categorias[0].registros,1);
});
test('somatórios monetários trabalham em centavos e ignoram movimentos de tipo ou valor inválido', () => {
  const r=montar({...filtro,movimentos:[mov('a',0.1),mov('b',0.2),mov('c',-0.1,'DEBITO'),mov('d',100,'OUTRO'),mov('e',null)]});
  assert.equal(r.banco.entradas,0.3); assert.equal(r.banco.liquido,0.2); assert.equal(r.banco.invalidos,2); assert.equal(r.meses[0].liquido,0.2); assert.equal(r.bancos.length,5);
});
test('datas ausentes/ilegais são sinalizadas e o vencimento não é substituído se inválido', () => {
  const r=montar({...filtro,recebimentos:[titulo('a',{data_vencimento:null,data_lancamento:'2026-09-03'}),titulo('b',{data_vencimento:'2026-02-30',data_lancamento:'2026-09-03'}),titulo('c',{conta_bancaria_id:null})]});
  assert.equal(r.receber.length,1); assert.equal(r.qualidade.semData,1); assert.equal(r.qualidade.semVencimento,1); assert.equal(r.qualidade.semConta,1);
  assert.ok(notasRelatorio(r).some(n=>n.includes('fora do filtro bancário')));
});
test('vencido usa situação atual, sem tratar título de hoje ou futuro como atraso', () => {
  const r=montar({...filtro,recebimentos:[titulo('a'),titulo('b',{data_vencimento:'2026-09-12'}),titulo('c',{data_vencimento:'2026-09-20'})]});
  assert.equal(r.receberResumo.pendente,120); assert.equal(r.receberResumo.vencido,40);
});
test('comparação usa janela anterior de igual tamanho inclusive virada de ano e ano bissexto', () => {
  assert.deepEqual(periodoAnterior('2026-01-01','2026-01-31'),{de:'2025-12-01',ate:'2025-12-31'});
  assert.deepEqual(periodoAnterior('2024-03-01','2024-03-01'),{de:'2024-02-29',ate:'2024-02-29'});
  assert.deepEqual(periodoAnterior('2026-09-01','2026-09-30'),{de:'2026-08-02',ate:'2026-08-31'});
});
test('sem base anterior não produz percentual fictício e base zero não divide por zero', () => {
  assert.equal(variacaoFinanceira(100,0,0),null);
  assert.deepEqual(variacaoFinanceira(100,0,2),{valor:100,percentual:null});
  assert.deepEqual(variacaoFinanceira(-50,-100,2),{valor:50,percentual:50});
});
test('datas futuras deixam o período em aberto e avisam que a comparação está suspensa', () => {
  const r=montar({...filtro});
  assert.equal(r.periodoEmAberto,true);
  assert.ok(notasRelatorio(r).some(n=>n.includes('variação percentual fica suspensa')));
  assert.equal(montar({...filtro,ate:'2026-09-12'}).periodoEmAberto,false);
});
test('validação recusa períodos invertidos, incompletos e dias impossíveis', () => {
  for (const [de,ate] of [['2026-02-30','2026-03-10'],['2026-09-20','2026-09-01'],['','2026-09-01'],['2925-01-01','2925-12-31']]) { assert.equal(periodoValido(de,ate),false); assert.throws(()=>montar({de,ate})); }
});
test('CSV preserva aspas/quebras e impede fórmulas em texto externo', () => {
  assert.equal(celulaCsvFinanceiro('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
  assert.equal(celulaCsvFinanceiro(' \t+cmd'),'"\' \t+cmd"');
  assert.equal(celulaCsvFinanceiro(-30),'"-30"');
  assert.equal(celulaCsvFinanceiro('Nome\ncom "aspas"'),'"Nome\ncom ""aspas"""');
});
