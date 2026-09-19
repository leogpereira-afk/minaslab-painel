import test from 'node:test';
import assert from 'node:assert/strict';
import { dataCivil, montarGestao, movimentacaoPeriodo, filtrarPendencias, mesesParaRelatorio } from './gestao.js';
import { situacaoExperiencia } from './clt.js';
const hoje='2026-09-19';
const pessoa=(id,extra={})=>({id,nome:`Pessoa ${id}`,ativo:true,cpf:'12345678901',admissao:'2026-01-10',cargo:'Analista',salario:2000,tipoContrato:'CLT',...extra});
const base=(pessoas,extra={})=>({pessoas,ferias:[],feedbacks:[],exames:[],vencimentos:[],historico:[],...extra});

test('datas impossíveis não são normalizadas para outro mês',()=>{
  assert.equal(dataCivil('2026-02-31'),null);
  assert.equal(dataCivil('2026-13-01'),null);
  assert.ok(dataCivil('2024-02-29'));
  assert.equal(dataCivil('2026-02-29'),null);
});
test('quadro preserva a base da lista e expõe ativo com desligamento',()=>{
  const g=montarGestao(base([pessoa('a',{desligadoEm:'2026-09-01'}),pessoa('b',{ativo:false,desligadoEm:'2026-08-01',cpf:''})]),hoje);
  assert.equal(g.ativos.length,1);
  assert.ok(g.pendencias.some(p=>p.titulo==='Ativo com data de desligamento'));
  assert.ok(!g.pendencias.some(p=>p.pessoaId==='b'));
});
test('salário ausente não vira zero e desligado não entra no total atual',()=>{
  const g=montarGestao(base([pessoa('a',{salario:'1.200,50'}),pessoa('b',{salario:'',cpf:''}),pessoa('c',{ativo:false,salario:9000,desligadoEm:hoje,cpf:''})]),hoje);
  assert.deepEqual(g.salarios,{total:1200.5,informados:1,semRegistro:1});
  assert.equal(montarGestao(base([pessoa('a',{salario:''})]),hoje).salarios.total,null);
});
test('quadro por setor e vínculo inclui lacunas e fecha com o total',()=>{
  const g=montarGestao(base([pessoa('a',{setor:'Análises'}),pessoa('b',{setor:'',tipoContrato:'Freelancer',cpf:''})]),hoje);
  assert.equal(g.setores.reduce((s,x)=>s+x.quantidade,0),2);
  assert.ok(g.setores.some(g=>g.nome==='Sem registro'));
  assert.ok(g.contratos.some(g=>g.nome==='Freelancer'));
});
test('freelancer, PJ e estágio não recebem alertas de experiência por admissão recente',()=>{
  for(const tipoContrato of ['Freelancer','PJ','Estágio']) {
    const g=montarGestao(base([pessoa('a',{tipoContrato,admissao:'2026-07-01'})]),hoje);
    assert.equal(g.experiencias.length,0);
  }
  const g=montarGestao(base([pessoa('a',{admissao:'2026-07-01'})]),hoje);
  assert.equal(g.experiencias.length,1);
  assert.ok(g.pendencias.some(p=>p.categoria==='experiencia'));
});
test('experiência decidida não reaparece e admissão inválida não dispara regra de prazo',()=>{
  for(const extra of [{admissao:'2026-07-01',experienciaDecididaEm:'2026-09-01'},{admissao:'2026-02-31'}]) {
    assert.equal(montarGestao(base([pessoa('a',extra)]),hoje).experiencias.length,0);
  }
});
test('férias em curso contam pessoas únicas e retorno hoje encerra ausência',()=>{
  const ferias=[{id:'f1',pessoaId:'a',inicio:'2026-09-10',retorno:'2026-09-20',status:'marcada'},{id:'f2',pessoaId:'a',inicio:'2026-09-15',retorno:'2026-09-22',status:'marcada'},{id:'f3',pessoaId:'b',inicio:'2026-09-01',retorno:hoje,status:'marcada'}];
  const g=montarGestao(base([pessoa('a'),pessoa('b',{cpf:''})],{ferias}),hoje);
  assert.deepEqual(g.deFerias,['a']);
  assert.equal(g.pendencias.filter(p=>p.titulo==='Períodos de férias sobrepostos').length,1);
  assert.equal(g.proximasFerias.length,2);
});
test('férias canceladas não reservam ausência e ausência de histórico não afirma dívida',()=>{
  const g=montarGestao(base([pessoa('a',{admissao:'2020-01-01'})],{ferias:[{id:'f',pessoaId:'a',inicio:'2026-09-10',retorno:'2026-09-30',status:'cancelada'}]}),hoje);
  assert.equal(g.deFerias.length,0);
  const alerta=g.pendencias.find(p=>p.categoria==='ferias');
  assert.equal(alerta.nivel,'informacao');
  assert.match(alerta.detalhe,/não comprova saldo/);
});
test('exames reutilizam o radar vigente e não ressuscitam exame antigo vencido',()=>{
  const exames=[{id:'velho',pessoaId:'a'},{id:'novo',pessoaId:'a'}];
  const g=montarGestao(base([pessoa('a')],{exames}),hoje,{vigentes:[exames[1]],emRisco:[],semData:[]});
  assert.equal(g.pendencias.filter(p=>p.categoria==='exames').length,0);
});
test('validade desconhecida é lacuna, não exame vencido',()=>{
  const e={id:'e',pessoaId:'a',dias:null};
  const g=montarGestao(base([pessoa('a')]),hoje,{vigentes:[e],emRisco:[],semData:[e]});
  assert.ok(g.pendencias.some(p=>p.titulo==='Exame sem validade'));
  assert.ok(!g.pendencias.some(p=>p.titulo==='Exame vencido'));
});
test('vencimento de desligado não gera renovação, mas órfãos ficam visíveis',()=>{
  const g=montarGestao(base([pessoa('a',{ativo:false,desligadoEm:hoje})],{vencimentos:[{id:'v1',pessoaId:'a',vence:'2025-01-01'},{id:'v2',pessoaId:'inexistente',vence:'2025-01-01'}]}),hoje);
  assert.equal(g.pendencias.length,1);
  assert.equal(g.pendencias[0].titulo,'Registro sem pessoa localizada');
});
test('CPF repetido é conferência, sem unir fichas nem expor o CPF na descrição',()=>{
  const g=montarGestao(base([pessoa('a'),pessoa('b')]),hoje);
  const duplos=g.pendencias.filter(p=>p.titulo.includes('CPF repetido'));
  assert.equal(duplos.length,2);
  assert.ok(!JSON.stringify(duplos).includes('12345678901'));
  assert.equal(g.ativos.length,2);
});
test('relatório mensal inclui admissão e desligamento da mesma pessoa e respeita hoje',()=>{
  const ps=[pessoa('a',{admissao:'2026-09-01',desligadoEm:'2026-09-18',ativo:false}),pessoa('b',{admissao:'2026-09-30'}),pessoa('c',{admissao:'',ativo:false,desligadoEm:''})];
  const r=movimentacaoPeriodo(ps,'2026-09',hoje);
  assert.deepEqual(r.admissoes.map(p=>p.id),['a']);
  assert.deepEqual(r.desligamentos.map(p=>p.id),['a']);
  assert.equal(r.semAdmissao,1);assert.equal(r.semDesligamento,1);
  assert.equal(movimentacaoPeriodo(ps,'2026-10',hoje).admissoes.length,0);
});
test('lista e exportação compartilham filtros e busca sem acento',()=>{
  const ps=[{nome:'João',categoria:'cadastro',nivel:'erro',titulo:'Admissão',detalhe:''},{nome:'João',categoria:'ferias',nivel:'erro',titulo:'Datas',detalhe:''}];
  assert.deepEqual(filtrarPendencias(ps,{categoria:'cadastro',nivel:'erro',busca:'joao'}),[ps[0]]);
  assert.deepEqual(filtrarPendencias(ps,{busca:'não existe'}),[]);
});
test('motor não altera coleções de entrada e vazio não sugere salário ou regularidade',()=>{
  const b=base([pessoa('a')]);const antes=JSON.stringify(b);montarGestao(b,hoje);assert.equal(JSON.stringify(b),antes);
  const vazio=montarGestao(base([]),hoje);assert.equal(vazio.salarios.total,null);assert.equal(vazio.ativos.length,0);
});

test('seletor mensal inclui anos do histórico e não oferece futuro',()=>{
 const meses=mesesParaRelatorio([pessoa('a',{admissao:'2020-02-01'}),pessoa('b',{admissao:'2030-01-01'})],hoje);
 assert.equal(meses[0],'2026-09');assert.ok(meses.includes('2020-02'));assert.ok(!meses.includes('2030-01'));assert.ok(!meses.includes('2026-10'));
});

test('regra de experiência é igual na ficha, feedback e visão geral para não CLT',()=>{
 for(const tipoContrato of ['Freelancer','PJ','Estágio','Aprendiz','Prestador']) assert.equal(situacaoExperiencia(pessoa('a',{tipoContrato,admissao:'2026-07-01'}),dataCivil(hoje)),null);
});
