import test from 'node:test';
import assert from 'node:assert/strict';
import { caminhoFinanceiro, operacaoManual, baixasManuais, pendenciasFinanceiras } from './financeiroIntegridade.js';
import { lerTodasPaginas } from '../../supabase/functions/_shared/financeiro-paginacao.mjs';
test('período usa a mesma rota no desenvolvimento e no Pages',()=>{
 for (const base of ['', '/minaslab-painel']) assert.equal(caminhoFinanceiro(base+'/financas/contas-a-receber'),'/financas/contas-a-receber');
});
test('empresa usa capacidade cadastrada, sem depender da razão social',()=>{
 assert.equal(operacaoManual({nome:'M LAB SERVICOS LTDA',usa_omie:false}),true);
 assert.equal(operacaoManual({nome:'M Lab',usa_omie:true}),false);
 assert.equal(operacaoManual(undefined),false);
});
test('histórico pago entra uma vez; baixa e estorno não são recriados',()=>{
 const t={id:1,origem:'MANUAL',valor_pago:120,data_pagamento:'2026-09-10'};
 assert.deepEqual(baixasManuais(t,'valor_pago').map(b=>b.valor),[120]);
 assert.equal(baixasManuais({...t,baixas:[{valor:60,data_pagamento:'2026-09-10'}]},'valor_pago')[0].valor,60);
 assert.equal(baixasManuais({...t,baixas:[{valor:120,estornada:true}]},'valor_pago').length,0);
 assert.equal(baixasManuais({...t,origem:'OMIE'},'valor_pago').length,0);
 assert.equal(baixasManuais({...t,status:'CANCELADO'},'valor_pago').length,0);
 assert.equal(baixasManuais({...t,data_pagamento:null},'valor_pago')[0].data_pagamento,null);
});
test('conferência preserva parcelas e separa empresas',()=>{
 const registros=[{id:1,empresa_id:'a',numero_nf:'10',origem:'MANUAL'}, {id:2,empresa_id:'a',numero_nf:'10',origem:'OMIE'}, {id:3,empresa_id:'a',numero_nf:'10',origem:'OMIE'}, {id:4,empresa_id:'b',numero_nf:'10',origem:'MANUAL'}];
 const copia=JSON.stringify(registros);
 assert.equal(pendenciasFinanceiras(registros).filter(x=>x.motivo.startsWith('Documento')).length,3);
 assert.equal(JSON.stringify(registros),copia);
});
for(const total of [0,500,1000,1323,2450,6810]) test(`consulta completa com ${total} registros`,async()=>{
 const dados=Array.from({length:total},(_,id)=>({id}));
 const r=await lerTodasPaginas(async(a,b)=>({data:dados.slice(a,b+1)}));
 assert.deepEqual(r,dados);
});
test('falha na segunda página não entrega total parcial',async()=>{
 await assert.rejects(lerTodasPaginas(async(a)=>a?{error:{message:'Sem conexão'}}:{data:Array(500).fill({})}),/Sem conexão/);
});
