import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararConferencia, pessoaNoFiltro, registroNoFiltro } from './pontoConferencia.js';
import { leituraPonto } from './pontoLeitura.js';
import { cfgDoPonto } from './rh/ponto.js';
const jornada=cfgDoPonto({}).jornada;
const pessoas=[{id:'a',nome:'Ana'},{id:'b',nome:'Bruno'},{id:'c',nome:'Carla'}];
const datas=['2026-09-08','2026-09-09'];
const registros=[{data:datas[0],entrada:'08:00',saida:'18:00',pausaMin:60,trackedMin:600},{data:datas[1],entrada:'08:00',emAberto:true}];
const porPessoa=new Map([['a',{dias:new Map(registros.map(d=>[d.data,d]))}],['b',{dias:new Map([[datas[0],{data:datas[0],ausencia:{tipo:'atestado'}}]])}]]);
const leitura=leituraPonto({pessoas,datas,porPessoa,hoje:'2026-09-09',jornada});
const r=prepararConferencia(leitura,jornada);
test('prioriza registros pendentes sem usar horas como ranking de pessoas',()=>{
  assert.deepEqual(r.equipe.map(l=>l.p.id),['a','c','b']);
  assert.equal(r.equipe[0].pendentes,1);
  assert.equal(r.equipe.find(l=>l.p.id==='c').folhaMin,null);
});
test('ausência justificada não vira pendência nem lacuna; lacuna não vira falta',()=>{
  const b=r.equipe.find(l=>l.p.id==='b');
  assert.equal(b.ausencias,1);assert.equal(b.pendentes,0);assert.equal(b.semDados,1);
  const c=r.equipe.find(l=>l.p.id==='c');assert.equal(c.ausencias,0);assert.equal(c.semDados,2);
});
test('filtros de pessoa e de dia levam às mesmas ocorrências',()=>{
  assert.deepEqual(r.equipe.filter(l=>pessoaNoFiltro(l,'pendentes')).map(l=>l.p.id),['a']);
  assert.equal(registroNoFiltro(leitura,pessoas[0],datas[0],'pendentes'),false);
  assert.equal(registroNoFiltro(leitura,pessoas[0],datas[1],'pendentes'),true);
  assert.equal(registroNoFiltro(leitura,pessoas[1],datas[0],'ausencias'),true);
  assert.equal(registroNoFiltro(leitura,pessoas[1],datas[0],'semDados'),false);
});
test('extras não são adicionadas de novo ao total considerado e ausência de apuração fica nula',()=>{
  const a=r.equipe.find(l=>l.p.id==='a');assert.equal(a.folhaMin,540);assert.equal(a.extrasMin,0);
  assert.equal(r.equipe.find(l=>l.p.id==='c').extrasMin,null);
});
test('dias futuros não entram nas pendências nem nas horas da conferência',()=>{
  const futuro=leituraPonto({pessoas,datas,porPessoa,hoje:'2026-09-07',jornada});
  const f=prepararConferencia(futuro,jornada);
  assert.equal(futuro.registros.length,0);assert.ok(f.equipe.every(p=>p.semDados===0&&p.pendentes===0&&p.folhaMin===null));
});
