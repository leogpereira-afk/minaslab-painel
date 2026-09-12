import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dataDe,resultadoDe,tipoDe,rotuloTipo,metaResultado} from './rhExamesApresentacao.js';

test('ficha e lista reconhecem data e rótulos de registros legados sem mudá-los',()=>{
 const legado={realizadoEm:'2026-08-13',tipo:'mudanca-de-funcao',resultado:'apto-com-restricao'};
 const antes=structuredClone(legado);
 assert.equal(dataDe(legado),'2026-08-13');
 assert.equal(rotuloTipo(tipoDe(legado)),'Mudança de função');
 assert.equal(metaResultado(resultadoDe(legado)).rotulo,'Apto com restrição');
 assert.equal(metaResultado(resultadoDe(legado)).chip,'chip-warn');
 assert.deepEqual(legado,antes);
});
test('data canônica prevalece e ausência de resultado nunca vira apto',()=>{
 assert.equal(dataDe({data:'2026-09-01',realizadoEm:'2026-08-13'}),'2026-09-01');
 assert.equal(dataDe({}),'');
 assert.equal(metaResultado(resultadoDe({})).rotulo,'resultado sem registro');
 assert.equal(metaResultado(resultadoDe({resultado:'aguardando'})).rotulo,'Aguardando laudo');
});
test('tipo e resultado fora da lista continuam identificáveis',()=>{
 assert.equal(rotuloTipo(tipoDe({tipo:'avaliacao_especial'})),'avaliacao_especial');
 assert.equal(metaResultado(resultadoDe({resultado:'reavaliar'})).rotulo,'reavaliar (fora da lista)');
});
