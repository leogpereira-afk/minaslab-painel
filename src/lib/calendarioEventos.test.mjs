import test from 'node:test';
import assert from 'node:assert/strict';
import { montarEventos } from './calendarioEventos.js';
import { escopoEquipe } from './rh/escopoEquipe.js';
const base = () => ({compromissos:[],licitacoes:[],manutencoes:[],quadro:[],ferias:[],vencimentos:[]});

test('calendário liga nascimento e vencimento às datas do RH e reflete edição', () => {
  const dados=base();
  dados.quadro=[{id:'p',nome:'Pessoa',ativo:true,dataNascimento:'1990-09-20'}];
  dados.vencimentos=[{id:'doc',pessoaId:'p',pessoaNome:'Pessoa',tipo:'NR-35',vence:'2026-09-21'}];
  let eventos=montarEventos(dados,'2026-09-19',[2026]);
  assert.ok(eventos.some(e=>e.origem==='aniversarios'&&e.dia==='2026-09-20'));
  assert.ok(eventos.some(e=>e.origem==='vencimentos'&&e.dia==='2026-09-21'&&e.texto.includes('NR-35')));
  dados.vencimentos[0].vence='2026-10-21';
  eventos=montarEventos(dados,'2026-09-19',[2026]);
  assert.ok(!eventos.some(e=>e.dia==='2026-09-21'));
  assert.ok(eventos.some(e=>e.dia==='2026-10-21'));
});

test('não inventa datas e repete aniversário no ano consultado, sem desligados ou proprietária', () => {
  const equipe=escopoEquipe({pessoas:[
    {id:'p',nome:'Pessoa',ativo:true,dataNascimento:'1992-02-29'},
    {id:'s',nome:'Sem data',ativo:true},
    {id:'d',nome:'Desligado',ativo:false,dataNascimento:'1990-09-20'},
    {id:'o',nome:'LIDYANE ALVES OLIVEIRA',ativo:true,dataNascimento:'1990-09-20'},
  ],vencimentos:[{pessoaId:'o',vence:'2026-09-20'},{pessoaId:'p',tipo:'Sem data'}]});
  const eventos=montarEventos({...base(),quadro:equipe.pessoas,vencimentos:equipe.vencimentos},'2026-09-19',[2026,2027]);
  assert.deepEqual(eventos.map(e=>e.dia),['2026-02-28','2027-02-28']);
});

test('férias preservam início e excluem o retorno; cancelamento não entra na agenda', () => {
  const dados={...base(),ferias:[{status:'marcada',inicio:'2026-09-20',retorno:'2026-09-22',pessoaNome:'Pessoa'},{status:'cancelada',inicio:'2026-09-23',retorno:'2026-09-24'}]};
  assert.deepEqual(montarEventos(dados,'2026-09-19').map(e=>e.dia),['2026-09-20','2026-09-21']);
});
