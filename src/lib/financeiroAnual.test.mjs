import test from 'node:test';import assert from 'node:assert/strict';
import { periodoAnual,resumoAnual } from './financeiroAnual.js';
test('régua anual respeita ano inteiro, bissexto e dezembro',()=>{
 assert.deepEqual(periodoAnual(2026),{de:'2026-01-01',ate:'2026-12-31'});
 assert.equal(periodoAnual(2024,2).ate,'2024-02-29');
 assert.equal(periodoAnual(2026,2).ate,'2026-02-28');
 assert.equal(periodoAnual(2026,12).ate,'2026-12-31');
 assert.throws(()=>periodoAnual(2026,13));
});
test('12 meses, conta e ano isolados, soma em centavos',()=>{
 const m=(data_movimento,tipo,valor,conta_bancaria_id='a')=>({data_movimento,tipo,valor,conta_bancaria_id});
 const r=resumoAnual([m('2026-01-02','CREDITO',0.1),m('2026-01-03','CREDITO',0.2),m('2026-01-03','DEBITO',0.1),m('2025-01-02','CREDITO',100),m('2026-01-02','CREDITO',100,'b')],2026,'a');
 assert.equal(r.length,12);assert.equal(r[0].entradas,0.3);assert.equal(r[0].liquido,0.2);assert.equal(r[0].registros,3);assert.equal(r[1].registros,0);
});
