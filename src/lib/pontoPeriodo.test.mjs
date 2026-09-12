import test from 'node:test';
import assert from 'node:assert/strict';
import { periodoPonto, moverPeriodo, composicaoIntervalo, resumirDias } from './pontoPeriodo.js';
test('semana atravessa mês e ano de segunda a domingo',()=>assert.deepEqual(periodoPonto('semana','2027-01-01'),{de:'2026-12-28',ate:'2027-01-03'}));
test('mês bissexto e avanço sem saltar fevereiro',()=>{assert.equal(periodoPonto('mes','2028-02-10').ate,'2028-02-29');assert.equal(moverPeriodo('mes','2026-01-31',1),'2026-02-28');});
test('trabalho exclui pausas pagas e não pagas; folha conserva pausa paga',()=>{const r=composicaoIntervalo({trackedMin:600,pausaMin:60,pausaPagaMin:15,trabalhadoMin:540});assert.equal(r.efetivoMin,525);assert.equal(r.folhaMin,540);assert.equal(r.diferencaMin,0);});
test('intervalo desconhecido não vira zero e folha não é descontada de novo',()=>{const r=composicaoIntervalo({entrada:'08:00',saida:'18:00',pausaMin:null,trabalhadoMin:480});assert.equal(r.efetivoMin,null);assert.equal(r.folhaMin,null);});
test('intervalo maior que a presença não produz hora negativa',()=>{const r=composicaoIntervalo({trackedMin:30,pausaMin:60,trabalhadoMin:0});assert.equal(r.efetivoMin,null);assert.equal(r.invalido,true);});
test('dia em aberto não fecha total',()=>{const r=composicaoIntervalo({trackedMin:600,pausaMin:60,trabalhadoMin:0,emAberto:true});assert.equal(r.folhaMin,null);assert.equal(r.efetivoMin,null);});
test('resumo sinaliza total parcial sem transformar ausente em zero',()=>{const r=resumirDias([{trabalhadoMin:480,pausaMin:60,trackedMin:540},{emAberto:true}]);assert.equal(r.folhaMin,480);assert.equal(r.pendentes,1);assert.equal(resumirDias([]).folhaMin,null);});

test('caso observado: 10h02 menos 1h difere 1h da folha importada',()=>{const d={trackedMin:602,pausaMin:60,pausaPagaMin:0,trabalhadoMin:482};const c=composicaoIntervalo(d);assert.equal(c.efetivoMin,542);assert.equal(c.folhaMin,542);assert.equal(c.diferencaMin,60);assert.equal(resumirDias([d]).divergencias,1);});
test('pausa paga explicitamente ausente impede afirmar trabalho efetivo',()=>{assert.equal(composicaoIntervalo({trackedMin:600,pausaMin:60,pausaPagaMin:null,trabalhadoMin:540}).efetivoMin,null);});
