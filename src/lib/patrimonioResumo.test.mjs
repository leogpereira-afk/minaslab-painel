import test from 'node:test';
import assert from 'node:assert/strict';
import {calcPatrimonio,idadeEmAnos} from './calc/patrimonio.js';
test('patrimônio soma ativos, mantém baixados no histórico e não perde bens sem setor',()=>{
 const r=calcPatrimonio({a:{valor:300,situacao:'uso',setorSigla:'LAB',dataAquisicao:'2025-02-01'},b:{valor:900,situacao:'baixado',setorSigla:'LAB'},c:{valor:100,situacao:'reserva',setorSigla:'EXT',dataAquisicao:'2026-01-01'}},{lab:{sigla:'LAB'}},'2026-09-19');
 assert.equal(r.kpis.valor,400);assert.equal(r.kpis.quantos,2);assert.equal(r.kpis.noAno,100);assert.equal(r.baixados.length,1);assert.equal(r.semSetor[0].id,'c');
});
test('valor não informado não vira avaliação inventada',()=>{const r=calcPatrimonio({a:{valor:null},b:{valor:NaN}},{},'2026-09-19');assert.equal(r.kpis.valor,0);assert.equal(r.kpis.semValor,2);});
test('idade desconhecida ou futura permanece sem idade',()=>{assert.equal(idadeEmAnos('', '2026-09-19'),null);assert.equal(idadeEmAnos('2027-01-01','2026-09-19'),null);});
