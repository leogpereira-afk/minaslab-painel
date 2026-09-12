import test from 'node:test';
import assert from 'node:assert/strict';
import { minutosTrabalhados, apurarCompetencia, apuracaoDoRelogio, intervaloNaoRegistrado } from './ponto.js';
const dia={data:'2026-09-08',entrada:'08:00',saida:'18:02',trackedMin:602,pausaMin:60,pausaPagaMin:0,trabalhadoMin:482,extraMin:0,extraDobroMin:0,origem:'jibble'};
test('MinasLab desconta somente intervalo registrado, preservando original',()=>{assert.equal(minutosTrabalhados(Object.freeze(dia)),542);assert.equal(dia.trabalhadoMin,482);});
test('intervalo ausente não usa folha antiga nem inventa uma hora',()=>{for(const p of [null,undefined,''])assert.equal(minutosTrabalhados({...dia,pausaMin:p}),null);});
test('zero não desconta pausa mas exige aviso de não registrada',()=>{assert.equal(minutosTrabalhados({...dia,pausaMin:0}),602);assert.equal(intervaloNaoRegistrado({...dia,pausaMin:0}),true);assert.equal(intervaloNaoRegistrado(dia),false);});
test('mesma regra no fechamento; extras antigas não são reaproveitadas',()=>{assert.equal(apuracaoDoRelogio(dia),null);const r=apurarCompetencia([dia]);assert.equal(r.folhaMin,542);assert.equal(r.normaisMin,540);});
test('dias em aberto e pausa inválida não entram nos totais',()=>{assert.equal(minutosTrabalhados({...dia,emAberto:true}),null);assert.equal(minutosTrabalhados({...dia,pausaMin:700}),null);assert.equal(minutosTrabalhados({...dia,pausaMin:-1}),null);});
test('pausa paga não é descontada da remuneração',()=>assert.equal(minutosTrabalhados({...dia,pausaPagaMin:15}),542));

test('jornada líquida é 9h de segunda a quinta e 8h sexta = 44h',()=>{
 const dias=['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11'].map((data,i)=>({...dia,data,trackedMin:i===4?540:600,trabalhadoMin:i===4?420:480}));
 const r=apurarCompetencia(dias);assert.equal(r.folhaMin,2640);assert.equal(r.normaisMin,2640);assert.equal(r.extrasMin,0);
});
test('sexta com 9h líquidas separa 8 normais e 1 extra mesmo se Jibble não marcou extra',()=>{
 const r=apurarCompetencia([{...dia,data:'2026-09-11',trackedMin:600,trabalhadoMin:540,extraMin:0}]);assert.equal(r.normaisMin,480);assert.equal(r.extrasMin,60);
});
