import test from 'node:test';
import assert from 'node:assert/strict';
import { leituraPonto, situacaoPonto } from './pontoLeitura.js';
import { cfgDoPonto } from './rh/ponto.js';
const jornada = cfgDoPonto({}).jornada;
const pessoas = [{id:'a',nome:'Ana'},{id:'b',nome:'Bruno'}];
const datas = ['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12','2026-09-13'];
function ler(diasA = [], diasB = []) {
  const porPessoa = new Map([['a',{dias:new Map(diasA.map(d=>[d.data,d]))}],['b',{dias:new Map(diasB.map(d=>[d.data,d]))}]]);
  return leituraPonto({pessoas,datas,porPessoa,hoje:'2026-09-12',jornada});
}
const dia = {data:'2026-09-08',trackedMin:602,pausaMin:60,pausaPagaMin:0,trabalhadoMin:482};
test('leitura distingue lacunas de zero e não cria faltas nem dados futuros',()=>{
  const r=ler([dia,{...dia,data:'2026-09-13'}]);
  assert.equal(r.registros.length,1);assert.equal(r.diasComDados,1);
  assert.equal(r.diasUteisSemDados.length,4);assert.equal(r.porDia[0].folhaMin,null);
  assert.equal(r.porDia.at(-1).futuro,true);assert.equal(r.porDia.at(-1).folhaMin,null);
  assert.equal(r.equipe[1].folhaMin,null);assert.equal(r.resumo.folhaMin,542);
  assert.equal(r.lacunas.length,9);assert.equal(r.porDia[1].parcial,true);
});
test('diferença da origem não vira pendência de batida; total e escala usam a mesma base',()=>{
  const r=ler([dia],[dia]);
  assert.equal(r.divergencias.length,2);assert.equal(r.pendentes.length,0);
  assert.equal(r.escalaDia,1084);assert.equal(r.escalaPessoa,542);
  assert.equal(r.resumo.folhaMin, r.equipe.reduce((s,p)=>s+p.folhaMin,0));
});
test('intervalo ausente e zero ficam a conferir; ausência conhecida e registro de zero mantêm significado',()=>{
  const r=ler([{...dia,pausaMin:null}], [{...dia,pausaMin:0}]);
  assert.equal(r.pendentes.length,2);assert.equal(r.resumo.folhaMin,602);
  const ausente=ler([{data:dia.data,ausencia:{tipo:'atestado'},entrada:'',saida:''}]);
  assert.equal(ausente.pendentes.length,0);
  assert.equal(ausente.equipe[0].pendentes,0);
  assert.equal(situacaoPonto({emAberto:true,ausencia:{tipo:'atestado'}},dia.data,'2026-09-12',jornada),'Em aberto');
  const zero=ler([{data:dia.data,trackedMin:0,pausaMin:0,pausaPagaMin:0,trabalhadoMin:0}]);
  assert.equal(zero.resumo.folhaMin,0);assert.equal(zero.porDia[1].folhaMin,0);
});
