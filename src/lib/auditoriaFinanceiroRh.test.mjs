import test from 'node:test';
import assert from 'node:assert/strict';
import { resumoTitulos,filtrarRecebimentos } from '../../supabase/functions/_shared/financeiro-resumo.mjs';
import { hojeFinanceiro,liquidoBanco } from './financeiroCivil.js';
import { criarControleConsulta } from './ultimaConsulta.js';
import { montarGestao } from './rh/gestao.js';

test('cancelados ficam identificados fora dos totais, sem perder o histórico',()=>{
 const linhas=[{valor_previsto:100,valor_recebido:40,valor_pendente:60,status:'PARCIAL'},{valor_previsto:900,valor_recebido:10,valor_pendente:0,status:'CANCELADO'}];
 assert.deepEqual(resumoTitulos(linhas,'recebimentos'),{previsto:100,recebido:40,pendente:60,cancelados:1,valorCancelado:900});
 assert.equal(linhas.length,2);
 assert.equal(resumoTitulos([{valor_original:90,status:'CANCELADA'}],'despesas').total,0);
});
test('filtro de pago inclui registro além da primeira página e aceita status legado do filtro',()=>{
 const itens=Array.from({length:60},(_,i)=>({id:i,status:i===50?'PAGO':'A RECEBER'}));
 assert.deepEqual(filtrarRecebimentos(itens,{status:'PAGO'}).map(x=>x.id),[50]);
 assert.deepEqual(filtrarRecebimentos(itens,{status:'RECEBIDO'}).map(x=>x.id),[50]);
 assert.equal(filtrarRecebimentos(itens,{status:'PARCIAL'}).length,0);
});
test('filtro combina cliente, empresa e valor sem distinguir acento',()=>{
 const itens=[{cliente:'João',empresa:{nome:'MinasLab'},valor_previsto:1234.56,status:'PAGO'}];
 assert.equal(filtrarRecebimentos(itens,{cliente:'joao',empresa:'minas',previsto:'1.234,56'}).length,1);
});
test('dia financeiro permanece no Brasil após 21h e atravessa ano corretamente',()=>{
 assert.equal(hojeFinanceiro(new Date('2026-09-20T00:30:00Z')),'2026-09-19');
 assert.equal(hojeFinanceiro(new Date('2027-01-01T02:59:00Z')),'2026-12-31');
 assert.equal(hojeFinanceiro(new Date('2027-01-01T03:00:00Z')),'2027-01-01');
});
test('movimento líquido inclui classificados e rejeita tipos inválidos',()=>{
 assert.equal(liquidoBanco([{tipo:'CREDITO',valor:100,classificacao_bancaria:'TRANSFERENCIA'},{tipo:'DEBITO',valor:30},{tipo:'INVALIDO',valor:200}]),70);
});
test('resposta anterior e resposta após desmontagem não podem substituir a consulta atual',()=>{
 const controle=criarControleConsulta(),antiga=controle.iniciar(),nova=controle.iniciar();
 assert.equal(antiga(),false);assert.equal(nova(),true);controle.cancelar();assert.equal(nova(),false);
});
test('decisão de experiência não registrada continua como conferência documental',()=>{
 const pessoa={id:'a',nome:'Pessoa teste',ativo:true,admissao:'2024-01-01',tipoContrato:'CLT'};
 const g=montarGestao({pessoas:[pessoa]},'2026-09-19');
 const alerta=g.pendencias.find(x=>x.titulo==='Conferir registro da decisão de experiência');
 assert.equal(alerta.nivel,'informacao');assert.equal(g.experiencias.length,0);
 const resolvido=montarGestao({pessoas:[{...pessoa,experienciaDecididaEm:'2024-03-30'}]},'2026-09-19');
 assert.equal(resolvido.pendencias.some(x=>x.categoria==='experiencia'),false);
});
