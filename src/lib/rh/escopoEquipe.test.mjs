import test from 'node:test';
import assert from 'node:assert/strict';
import { ehProprietario, escopoEquipe } from './escopoEquipe.js';
import { montarGestao } from './gestao.js';

test('a Lidyane aparece no quadro do RH (decisão da direção em 21/10/2026); só sai quem vier marcado como proprietário', () => {
  assert.equal(ehProprietario({nome:'  Lidyane  Alves Oliveira '}),false);
  assert.equal(ehProprietario({nome:'Lidyane Outra Pessoa'}),false);
  const quadro=escopoEquipe({pessoas:[{id:'l',nome:'LIDYANE ALVES OLIVEIRA',ativo:true,cargo:'DIRETORA'},{id:'e',nome:'Equipe',ativo:true}]});
  assert.deepEqual(quadro.pessoas.map(p=>p.id),['l','e']);
  assert.deepEqual(quadro.gestoresForaDoQuadro,[]);
  assert.equal(ehProprietario({nome:'Funcionário',cargo:'Diretor',batePonto:false,salario:''}),false);
  assert.equal(ehProprietario({nome:'Outro proprietário',ehDirecao:true}),true);
});

test('todas as abas e indicadores excluem proprietária e preservam os dados originais', () => {
  const dados={pessoas:[{id:'dona',nome:'Proprietária de exemplo',ehDirecao:true,ativo:true},{id:'equipe',nome:'Pessoa da equipe',ativo:true,salario:2000}]};
  for(const c of ['ferias','feedbacks','exames','vencimentos','historico']) dados[c]=[{id:c+'1',pessoaId:'dona'},{id:c+'2',pessoaId:'equipe'},{id:c+'3',pessoaId:'realmente-ausente'}];
  const antes=JSON.stringify(dados), equipe=escopoEquipe(dados);
  assert.deepEqual(equipe.pessoas.map(p=>p.id),['equipe']);
  for(const c of ['ferias','feedbacks','exames','vencimentos','historico']) assert.deepEqual(equipe[c].map(r=>r.pessoaId),['equipe','realmente-ausente']);
  const gestao=montarGestao(equipe,'2026-09-19');
  assert.equal(gestao.ativos.length,1);
  assert.equal(gestao.salarios.total,2000);
  assert.ok(!gestao.pendencias.some(p=>p.pessoaId==='dona'||p.detalhe.includes('dona')));
  assert.equal(JSON.stringify(dados),antes);
});

test('proprietária continua sendo uma referência válida de gestão sem integrar o quadro', () => {
  const dados=escopoEquipe({pessoas:[{id:'dona',nome:'Proprietária de exemplo',ehDirecao:true,ativo:true},{id:'e1',nome:'Equipe',ativo:true,gestorId:'dona'},{id:'e2',nome:'Outra',ativo:true,gestorId:'inexistente'}]});
  const gestao=montarGestao(dados,'2026-09-19');
  assert.equal(gestao.ativos.length,2);
  assert.ok(!gestao.pendencias.some(p=>p.pessoaId==='e1' && p.titulo==='Gestor não localizado'));
  assert.ok(gestao.pendencias.some(p=>p.pessoaId==='e2' && p.titulo==='Gestor não localizado'));
});
