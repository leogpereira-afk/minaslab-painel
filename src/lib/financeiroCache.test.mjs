import test from 'node:test';
import assert from 'node:assert/strict';
import { respostaDelta } from '../../supabase/functions/_shared/financeiro-delta.mjs';
import { aplicarDelta, sincronizarCopia } from './financeiroCache.js';

test('primeira consulta e retorno sem alterações não retransmitem lançamentos', async () => {
 const itens=[{id:'a',valor:10,baixas:[]}];
 const primeira=await respostaDelta(itens,{});
 const copia=aplicarDelta(undefined,primeira);
 const segunda=await respostaDelta(itens,copia.hashes);
 assert.deepEqual(segunda.itens,[]);
 assert.deepEqual(aplicarDelta(copia,segunda).itens,itens);
});
test('incorpora novos, editados, baixas relacionadas e excluídos sem duplicar',async()=>{
 const anterior=aplicarDelta(undefined,await respostaDelta([{id:'a',baixas:[]},{id:'b',valor:5}],{}));
 const atuais=[{id:'a',baixas:[{id:1,valor:2}]},{id:'c',valor:7}];
 const delta=await respostaDelta(atuais,anterior.hashes);
 assert.deepEqual(aplicarDelta(anterior,delta).itens,atuais);
 assert.deepEqual(aplicarDelta(aplicarDelta(anterior,delta),delta).itens,atuais);
});
test('ordem de propriedades ou de baixas não gera transferência desnecessária',async()=>{
 const a=await respostaDelta([{id:'a',baixas:[{id:1},{id:2}],valor:3}],{});
 const b=await respostaDelta([{valor:3,baixas:[{id:2},{id:1}],id:'a'}],a.hashes);
 assert.equal(b.itens.length,0);
});
test('lista vazia remove todos os registros salvos e resposta incompleta é recusada',async()=>{
 const anterior={itens:[{id:'a'}],hashes:{a:'x'}};
 assert.deepEqual(aplicarDelta(anterior,await respostaDelta([],anterior.hashes)).itens,[]);
 assert.throws(()=>aplicarDelta(anterior,{itens:[],cobertura:{completa:false}}));
 assert.throws(()=>aplicarDelta(anterior,{delta:true,itens:[],hashes:{b:'x'},cobertura:{completa:true,registros:1}}));
});
test('falha parcial não altera a cópia anterior',async()=>{
 const anterior={listas:{recebimentosListar:{itens:[{id:'a'}],hashes:{a:'1'}}}};
 const original=JSON.stringify(anterior);
 await assert.rejects(()=>sincronizarCopia(anterior,async action=>{
  if(action==='despesasListar')throw new Error('sem rede');
  return respostaDelta([],{});
 }));
 assert.equal(JSON.stringify(anterior),original);
});
test('servidor antigo retorna lista completa sem misturar hashes antigos',()=>{
 assert.deepEqual(aplicarDelta({itens:[{id:'velho'}],hashes:{velho:'a'}},{itens:[{id:'novo'}],cobertura:{completa:true,registros:1}}),{itens:[{id:'novo'}],hashes:{}});
});
