// Testa a migração de aprendizagem da Academy (fundação + aprendizagem) num
// PostgreSQL isolado (PGlite), sem tocar na produção.
// PGLITE_ENTRY aponta para uma instalação isolada de @electric-sql/pglite.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_ENTRY).href);
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table public.ml_contas(usuario text primary key,nome text);`);
for(const m of ['20261005120000_academy_fundacao','20261006120000_academy_aprendizagem'])
 await db.exec(await readFile(new URL(`../supabase/migrations/${m}.sql`,import.meta.url),'utf8'));
let checks=0;
const q=(sql,p=[])=>db.query(sql,p);
const rpc=async(fn,...args)=>(await q(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as v`,args)).rows[0].v;
const J=o=>JSON.stringify(o);
const ok=(c,m)=>{assert.ok(c,m);checks++;};
const rej=async(p,re)=>{await assert.rejects(p,re);checks++;};

const PESSOAS=[
 {id:'p1',nome:'Pessoa Um',setor:'Análises',cargo:'Analista'},
 {id:'p2',nome:'Pessoa Dois',setor:'Comercial',cargo:'Vendedor'},
 {id:'p3',nome:'Pessoa Três',setor:'Coleta',cargo:'Auxiliar'}];

// ---------- monta um treinamento com prova automática
const tid=await rpc('ml_ac_treinamento_criar','rh','Curso com prova','qualidade-iso17025');
const v1=(await q('select id from ml_ac_versoes where treinamento_id=$1',[tid])).rows[0].id;
await rpc('ml_ac_treinamento_meta','rh',tid,'qualidade-iso17025','p1');
const curso={titulo:'Curso com prova',descricao:'Descrição',modalidade:'automatica',notaMinima:70,maxTentativas:2,obrigatorio:true,prazoDias:30,validadeMeses:12,
 modulos:[{titulo:'M1',aulas:[{titulo:'A1',tipo:'texto',conteudo:{texto:'x'}},{titulo:'A2',tipo:'texto',conteudo:{texto:'y'}}]}],
 questoes:[
  {tipo:'multipla',enunciado:'Q1',feedback:'F1',opcoes:[{texto:'a',correta:true},{texto:'b'},{texto:'c'}]},
  {tipo:'vf',enunciado:'Q2',feedback:'F2',opcoes:[{texto:'Verdadeiro'},{texto:'Falso',correta:true}]},
  {tipo:'multiplas',enunciado:'Q3',feedback:'F3',opcoes:[{texto:'x',correta:true},{texto:'y',correta:true},{texto:'z'}]},
  {tipo:'multipla',enunciado:'Q4',feedback:'F4',opcoes:[{texto:'a'},{texto:'b',correta:true}]}]};
await rpc('ml_ac_versao_salvar','rh',v1,J(curso));

// ---------- regras de publicação da prova
const semQuestoes={...curso,questoes:[]};
await rpc('ml_ac_versao_salvar','rh',v1,J(semQuestoes));
ok((await rpc('ml_ac_problemas_versao',v1)).some(x=>/ao menos uma questão/.test(x)),'prova exige questão');
await rpc('ml_ac_versao_salvar','rh',v1,J({...curso,questoes:[{tipo:'multipla',enunciado:'Q',opcoes:[{texto:'a'},{texto:'b'}]}]}));
ok((await rpc('ml_ac_problemas_versao',v1)).some(x=>/exatamente 1 resposta correta/.test(x)),'exige gabarito');
await rpc('ml_ac_versao_salvar','rh',v1,J({...curso,questoes:[{tipo:'vf',enunciado:'Q',opcoes:[{texto:'V',correta:true},{texto:'F'},{texto:'T'}]}]}));
ok((await rpc('ml_ac_problemas_versao',v1)).some(x=>/exatamente 2 opções/.test(x)),'V/F com 2 opções');
await rpc('ml_ac_versao_salvar','rh',v1,J({...curso,notaMinima:'',maxTentativas:''}));
ok((await rpc('ml_ac_problemas_versao',v1)).some(x=>/nota mínima/.test(x))&&(await rpc('ml_ac_problemas_versao',v1)).some(x=>/limite de tentativas/.test(x)),'nota e tentativas');
await rpc('ml_ac_versao_salvar','rh',v1,J({...curso,modalidade:'gestor'}));
ok((await rpc('ml_ac_problemas_versao',v1)).some(x=>/avaliação do gestor ainda não/.test(x)),'gestor bloqueado');
await rpc('ml_ac_versao_salvar','rh',v1,J({...curso,modalidade:'nenhuma'}));
ok((await rpc('ml_ac_problemas_versao',v1)).some(x=>/não é "Prova automática"/.test(x)),'questões sem prova');
await rpc('ml_ac_versao_salvar','rh',v1,J(curso));
ok((await rpc('ml_ac_problemas_versao',v1)).length===0,'curso válido sem pendências');
ok((await q('select count(*)::int n from ml_ac_gabaritos where versao_id=$1',[v1])).rows[0].n===5,'gabaritos gravados');

// ---------- publicar, público e atribuições
await rpc('ml_ac_publico_salvar','rh',tid,J([{tipo:'setor',valor:'análises'},{tipo:'colaborador',valor:'p3'}]));
await rpc('ml_ac_versao_publicar','rh',v1);
ok(await rpc('ml_ac_atribuir',J(PESSOAS),tid)===2,'atribui p1 (setor, sem diferenciar maiúsculas) e p3 (nominal), não p2');
ok(await rpc('ml_ac_atribuir',J(PESSOAS),tid)===0,'idempotente');
const A=async(p,t=tid)=>(await q('select * from ml_ac_atribuicoes where pessoa_id=$1 and treinamento_id=$2',[p,t])).rows[0];
const a1=await A('p1');
ok(a1.obrigatorio&&a1.status==='pendente'&&a1.origem==='publico','atribuição obrigatória e pendente');
const hoje=(await q("select ((now() at time zone 'America/Sao_Paulo')::date + 30)::text d")).rows[0].d;
ok(a1.prazo_em instanceof Date?a1.prazo_em.toISOString().slice(0,10)===hoje:String(a1.prazo_em).slice(0,10)===hoje,'prazo = hoje + 30 dias');
ok((await q("select count(*)::int n from ml_ac_notificacoes where pessoa_id='p1' and tipo='ATRIBUICAO'")).rows[0].n===1,'notificação de atribuição');
ok(await A('p2')===undefined,'p2 fora do público não recebe');

// público 'todos' + grupo
const tid2=await rpc('ml_ac_treinamento_criar','rh','Curso simples','integracao');
const w1=(await q('select id from ml_ac_versoes where treinamento_id=$1',[tid2])).rows[0].id;
await rpc('ml_ac_treinamento_meta','rh',tid2,'integracao','p1');
await rpc('ml_ac_versao_salvar','rh',w1,J({titulo:'Curso simples',descricao:'d',modalidade:'nenhuma',modulos:[{titulo:'M',aulas:[{titulo:'A',tipo:'texto',conteudo:{texto:'t'}},{titulo:'B',tipo:'caso',conteudo:{enunciado:'e'}}]}]}));
await rpc('ml_ac_publico_salvar','rh',tid2,J([{tipo:'todos',valor:'todos'}]));
await rpc('ml_ac_versao_publicar','rh',w1);
ok(await rpc('ml_ac_atribuir',J(PESSOAS))===3,'todos recebem o curso simples');
const g=await rpc('ml_ac_grupo_salvar','rh',null,'Grupo X','',true,J(['p2']));
const tid3=await rpc('ml_ac_treinamento_criar','rh','Curso do grupo','integracao');
const x1=(await q('select id from ml_ac_versoes where treinamento_id=$1',[tid3])).rows[0].id;
await rpc('ml_ac_treinamento_meta','rh',tid3,'integracao','p1');
await rpc('ml_ac_versao_salvar','rh',x1,J({titulo:'Curso do grupo',descricao:'d',modalidade:'nenhuma',modulos:[{titulo:'M',aulas:[{titulo:'A',tipo:'texto',conteudo:{texto:'t'}}]}]}));
await rpc('ml_ac_publico_salvar','rh',tid3,J([{tipo:'grupo',valor:g}]));
await rpc('ml_ac_versao_publicar','rh',x1);
ok(await rpc('ml_ac_atribuir',J(PESSOAS),tid3)===1&&(await A('p2',tid3)),'grupo atribui só ao membro');

// ---------- aulas: progresso, retomada e isolamento
const aulas=(await q('select id from ml_ac_aulas where versao_id=$1 order by ordem',[v1])).rows.map(r=>r.id);
await rpc('ml_ac_aula_registrar','p1','p1',a1.id,aulas[0],false,null);
let a=await A('p1');
ok(a.status==='em_andamento'&&a.ultima_aula_id===aulas[0]&&a.iniciada_em,'abrir aula marca andamento e posição');
await rej(rpc('ml_ac_aula_registrar','p2','p2',a1.id,aulas[0],true,null),/não encontrado/);
await rej(rpc('ml_ac_aula_registrar','p1','p1',a1.id,'00000000-0000-0000-0000-000000000000',true,null),/não pertence/);
await rej(rpc('ml_ac_tentativa_iniciar','p1','p1',a1.id),/Conclua todas as aulas/);
await rpc('ml_ac_aula_registrar','p1','p1',a1.id,aulas[0],true,'minha resposta');
ok((await q('select resposta from ml_ac_progresso where atribuicao_id=$1 and aula_id=$2',[a1.id,aulas[0]])).rows[0].resposta==='minha resposta','resposta salva');
ok((await A('p1')).status==='em_andamento','ainda não concluído (falta aula e prova)');
await rej(rpc('ml_ac_certificado_emitir','p1','p1',a1.id,'Pessoa Um','Resp'),/só é emitido após cumprir/);
await rpc('ml_ac_aula_registrar','p1','p1',a1.id,aulas[1],true,null);
ok((await A('p1')).status==='em_andamento','aulas prontas mas prova pendente: não conclui');
await rej(rpc('ml_ac_certificado_emitir','p1','p1',a1.id,'Pessoa Um','Resp'),/só é emitido após cumprir/);

// ---------- prova: gabarito, nota no servidor, tentativas
const ini=await rpc('ml_ac_tentativa_iniciar','p1','p1',a1.id);
ok(ini.numero===1&&!ini.retomada,'tentativa 1');
ok((await rpc('ml_ac_tentativa_iniciar','p1','p1',a1.id)).retomada===true,'retoma a tentativa aberta');
await rej(rpc('ml_ac_tentativa_enviar','p2','p2',ini.tentativaId,J([])),/não encontrada/);
const Q=(await q('select id,ordem from ml_ac_questoes where versao_id=$1 order by ordem',[v1])).rows;
const op=async(qid,ordens)=>(await q('select id from ml_ac_opcoes where questao_id=$1 and ordem=any($2) order by ordem',[qid,ordens])).rows.map(r=>r.id);
// tentativa 1: acerta Q1 e Q2, erra Q3 (parcial) e Q4 → 50%
const r1=await rpc('ml_ac_tentativa_enviar','p1','p1',ini.tentativaId,J([
 {questaoId:Q[0].id,opcoes:await op(Q[0].id,[1])},{questaoId:Q[1].id,opcoes:await op(Q[1].id,[2])},
 {questaoId:Q[2].id,opcoes:await op(Q[2].id,[1])},{questaoId:Q[3].id,opcoes:await op(Q[3].id,[1])}]));
ok(r1.nota===50&&r1.aprovado===false&&r1.acertos===2&&r1.tentativasRestantes===1,'nota 50, reprovado, 1 tentativa restante');
ok(r1.detalhes.length===4&&r1.detalhes[2].correta===false&&r1.detalhes[0].correta===true,'detalhe por questão');
ok(!JSON.stringify(r1).includes('opcao')&&!('gabarito' in r1),'resposta da prova não revela o gabarito');
ok((await A('p1')).status==='em_andamento','reprovado não conclui');
await rej(rpc('ml_ac_tentativa_enviar','p1','p1',ini.tentativaId,J([])),/já foi enviada/);
await rej(q("update ml_ac_tentativas set nota=100,aprovado=true where id=$1",[ini.tentativaId]),/já enviada não pode ser alterada/);
await rej(q("delete from ml_ac_tentativas where id=$1",[ini.tentativaId]),/não podem ser apagadas/);
await rej(q("update ml_ac_respostas set correta=true where tentativa_id=$1",[ini.tentativaId]),/não podem ser alteradas/);
await rej(q("delete from ml_ac_respostas where tentativa_id=$1",[ini.tentativaId]),/não podem ser alteradas/);
await rej(q("delete from ml_ac_atribuicoes where id=$1",[a1.id]),/não podem ser apagadas/);
// tentativa 2: resposta inválida (opção de outra questão) e depois correta
const t2=await rpc('ml_ac_tentativa_iniciar','p1','p1',a1.id);
ok(t2.numero===2,'tentativa 2');
await rej(rpc('ml_ac_tentativa_enviar','p1','p1',t2.tentativaId,J([{questaoId:Q[0].id,opcoes:await op(Q[1].id,[1])}])),/inválida/);
const r2=await rpc('ml_ac_tentativa_enviar','p1','p1',t2.tentativaId,J([
 {questaoId:Q[0].id,opcoes:await op(Q[0].id,[1])},{questaoId:Q[1].id,opcoes:await op(Q[1].id,[2])},
 {questaoId:Q[2].id,opcoes:await op(Q[2].id,[1,2])},{questaoId:Q[3].id,opcoes:await op(Q[3].id,[2])}]));
ok(r2.nota===100&&r2.aprovado===true&&r2.tentativasRestantes===0,'nota 100 aprovado');
a=await A('p1');
ok(a.status==='concluida'&&a.concluida_em,'aprovação + aulas = concluído');
const vence=(await q("select valida_ate::text d from ml_ac_atribuicoes where id=$1",[a1.id])).rows[0].d;
ok(/^\d{4}-\d{2}-\d{2}$/.test(vence),'validade de 12 meses calculada');
await rej(rpc('ml_ac_tentativa_iniciar','p1','p1',a1.id),/já foi aprovado/);

// ---------- limite de tentativas (p3 reprova duas vezes)
const a3=await A('p3');
for(const id of aulas) await rpc('ml_ac_aula_registrar','p3','p3',a3.id,id,true,null);
for(let i=1;i<=2;i++){
 const t=await rpc('ml_ac_tentativa_iniciar','p3','p3',a3.id);
 const r=await rpc('ml_ac_tentativa_enviar','p3','p3',t.tentativaId,J([{questaoId:Q[0].id,opcoes:await op(Q[0].id,[2])}]));
 ok(r.nota===0&&!r.aprovado,`p3 reprova na tentativa ${i}`);
}
await rej(rpc('ml_ac_tentativa_iniciar','p3','p3',a3.id),/Limite de tentativas/);
ok((await q("select count(*)::int n from ml_ac_tentativas where atribuicao_id=$1",[a3.id])).rows[0].n===2,'não abre terceira tentativa');
await rej(rpc('ml_ac_certificado_emitir','p3','p3',a3.id,'Pessoa Três','R'),/só é emitido após cumprir/);
ok((await q("select count(*)::int n from ml_ac_notificacoes where pessoa_id='p3' and tipo='RESULTADO'")).rows[0].n===2,'notificação de resultado');

// ---------- certificado
const cid=await rpc('ml_ac_certificado_emitir','p1','p1',a1.id,'Pessoa Um','Responsável X');
ok(await rpc('ml_ac_certificado_emitir','p1','p1',a1.id,'Pessoa Um','Responsável X')===cid,'emissão idempotente');
const cert=(await q('select * from ml_ac_certificados where id=$1',[cid])).rows[0];
ok(/^ML-\d{4}-[0-9A-F]{8}$/.test(cert.codigo)&&cert.versao_numero===1&&cert.nota==100&&cert.responsavel_nome==='Responsável X','dados do certificado');
ok(cert.carga_horaria_min===null,'sem carga horária validada, não consta');
await rej(q("update ml_ac_certificados set pessoa_nome='X' where id=$1",[cid]),/não pode ser alterado/);
await rej(q("delete from ml_ac_certificados where id=$1",[cid]),/não pode ser alterado/);
await rej(rpc('ml_ac_certificado_emitir','p2','p2',a1.id,'Outro','R'),/não encontrado/);

// ---------- curso simples (sem prova): conclui só com as aulas
const simples=(await q("select * from ml_ac_atribuicoes where pessoa_id='p2' and versao_id=$1",[w1])).rows[0];
const aulasS=(await q('select id from ml_ac_aulas where versao_id=$1 order by ordem',[w1])).rows;
await rpc('ml_ac_aula_registrar','p2','p2',simples.id,aulasS[0].id,true,null);
ok((await q('select status from ml_ac_atribuicoes where id=$1',[simples.id])).rows[0].status==='em_andamento','metade das aulas: em andamento');
await rpc('ml_ac_aula_registrar','p2','p2',simples.id,aulasS[1].id,true,'estudo de caso');
ok((await q('select status from ml_ac_atribuicoes where id=$1',[simples.id])).rows[0].status==='concluida','todas as aulas: concluído');
await rej(rpc('ml_ac_tentativa_iniciar','p2','p2',simples.id),/não tem prova/);
// aula após concluir não altera a evidência
await rpc('ml_ac_aula_registrar','p2','p2',simples.id,aulasS[1].id,true,'tentando mudar');
ok((await q('select resposta from ml_ac_progresso where atribuicao_id=$1 and aula_id=$2',[simples.id,aulasS[1].id])).rows[0].resposta==='estudo de caso','evidência fechada após concluir');

// ---------- nova versão preserva o histórico de quem concluiu a anterior
const nv=await rpc('ml_ac_nova_versao','rh',tid);
ok((await q('select count(*)::int n from ml_ac_questoes where versao_id=$1',[nv])).rows[0].n===4,'questões copiadas');
ok((await q('select count(*)::int n from ml_ac_gabaritos where versao_id=$1',[nv])).rows[0].n===5,'gabaritos copiados');
await rpc('ml_ac_versao_salvar','rh',nv,J({...curso,titulo:'Curso com prova v2',questoes:curso.questoes.slice(0,2)}));
ok((await q('select count(*)::int n from ml_ac_questoes where versao_id=$1',[v1])).rows[0].n===4,'v1 mantém 4 questões após editar v2');
await rpc('ml_ac_versao_publicar','rh',nv);
const a1d=await A('p1');
ok(a1d.versao_id===v1&&a1d.status==='concluida','atribuição concluída continua apontando para a v1');
ok((await q('select count(*)::int n from ml_ac_tentativas where atribuicao_id=$1',[a1.id])).rows[0].n===2,'tentativas da v1 preservadas');
ok(await rpc('ml_ac_atribuir',J(PESSOAS),tid)===0,'publicar v2 não reatribui sozinha (reciclagem é decisão explícita)');
await rej(q('delete from ml_ac_questoes where versao_id=$1',[v1]),/publicada/);
await rej(q('update ml_ac_gabaritos set versao_id=versao_id where versao_id=$1',[v1]),/publicada/);

// ---------- catálogo/matrícula manual
const tid4=await rpc('ml_ac_treinamento_criar','rh','Curso aberto','sistemas-internos');
const y1=(await q('select id from ml_ac_versoes where treinamento_id=$1',[tid4])).rows[0].id;
await rpc('ml_ac_treinamento_meta','rh',tid4,'sistemas-internos','p1');
await rpc('ml_ac_versao_salvar','rh',y1,J({titulo:'Curso aberto',descricao:'d',modalidade:'nenhuma',modulos:[{titulo:'M',aulas:[{titulo:'A',tipo:'texto',conteudo:{texto:'t'}}]}]}));
await rpc('ml_ac_versao_publicar','rh',y1);
const m1=await rpc('ml_ac_matricular','p2',J(PESSOAS[1]),tid4);
ok(await rpc('ml_ac_matricular','p2',J(PESSOAS[1]),tid4)===m1,'matrícula idempotente');
ok((await q('select origem,obrigatorio from ml_ac_atribuicoes where id=$1',[m1])).rows[0].origem==='manual','origem manual, não obrigatória');
await rpc('ml_ac_publico_salvar','rh',tid4,J([{tipo:'setor',valor:'Coleta'}]));
await rej(rpc('ml_ac_matricular','p1',J(PESSOAS[0]),tid4),/não está disponível para o seu perfil/);

// ---------- o navegador não alcança nada
for(const role of ['anon','authenticated']){
 await db.exec(`set role ${role}`);
 for(const t of ['ml_ac_gabaritos','ml_ac_atribuicoes','ml_ac_tentativas','ml_ac_certificados','ml_ac_notificacoes'])
  await assert.rejects(q(`select * from public.${t}`),/permission denied/);
 await assert.rejects(rpc('ml_ac_tentativa_enviar','x','x','00000000-0000-0000-0000-000000000000','[]'),/permission denied/);
 await db.exec('reset role');checks+=6;
}
console.log(`${checks} verificações PostgreSQL da aprendizagem passaram (banco isolado, sem produção).`);
await db.close();
