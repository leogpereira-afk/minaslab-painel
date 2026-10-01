// Testa a migração da Academy num PostgreSQL isolado (PGlite), sem tocar na produção.
// PGLITE_ENTRY aponta para uma instalação isolada de @electric-sql/pglite.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_ENTRY).href);
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table public.ml_contas(usuario text primary key,nome text);
insert into public.ml_contas values('ana','Ana'),('leo','Léo');`);
await db.exec(await readFile(new URL('../supabase/migrations/20261005120000_academy_fundacao.sql',import.meta.url),'utf8'));
let checks=0;
const q=(sql,p=[])=>db.query(sql,p);
const rpc=async(fn,...args)=>(await q(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as v`,args)).rows[0].v;
const J=o=>JSON.stringify(o);
const ok=(c,m)=>{assert.ok(c,m);checks++;};

// categorias iniciais
ok((await q('select count(*)::int n from ml_ac_categorias')).rows[0].n===7,'7 categorias');

// criar treinamento → versão 1 em rascunho
const tid=await rpc('ml_ac_treinamento_criar','ana','Gestão do tempo','gestao-tempo-desenvolvimento');
const v1=(await q('select id,status,numero from ml_ac_versoes where treinamento_id=$1',[tid])).rows[0];
ok(v1.status==='rascunho'&&v1.numero===1,'versão 1 rascunho');
await assert.rejects(rpc('ml_ac_treinamento_criar','ana','ab','gestao-tempo-desenvolvimento'),/check/);checks++;
await assert.rejects(rpc('ml_ac_treinamento_criar','ana','Curso','categoria-inexistente'),/foreign key/);checks++;

// publicar vazio é barrado com lista de pendências
await assert.rejects(rpc('ml_ac_versao_publicar','ana',v1.id),/Não é possível publicar/);checks++;

const conteudo={titulo:'Gestão do tempo',descricao:'Organização do dia de trabalho.',modalidade:'nenhuma',obrigatorio:true,prazoDias:30,validadeMeses:12,
 modulos:[{titulo:'Fundamentos',aulas:[
  {titulo:'Introdução',tipo:'texto',conteudo:{texto:'Texto da aula.'}},
  {titulo:'Vídeo',tipo:'video',conteudo:{url:'https://exemplo.com/video'}},
  {titulo:'Caso',tipo:'caso',conteudo:{enunciado:'Analise o caso.'}}]}],
 materiais:[{titulo:'Apostila',url:'https://exemplo.com/a.pdf'}]};
await rpc('ml_ac_versao_salvar','ana',v1.id,J(conteudo));
ok((await q('select count(*)::int n from ml_ac_aulas where versao_id=$1',[v1.id])).rows[0].n===3,'3 aulas gravadas');

// sem responsável ainda não publica
let pend=await rpc('ml_ac_problemas_versao',v1.id);
ok(pend.some(x=>/responsável/.test(x)),'exige responsável');
await rpc('ml_ac_treinamento_meta','ana',tid,'gestao-tempo-desenvolvimento','pessoa-1');
ok((await rpc('ml_ac_problemas_versao',v1.id)).length===0,'sem pendências');

// links inseguros rejeitados na gravação
await assert.rejects(rpc('ml_ac_versao_salvar','ana',v1.id,J({...conteudo,materiais:[{titulo:'x',url:'javascript:alert(1)'}]})),/https/);checks++;
await assert.rejects(rpc('ml_ac_versao_salvar','ana',v1.id,J({...conteudo,modulos:[{titulo:'m',aulas:[{titulo:'a',tipo:'video',conteudo:{url:'http://x.com'}}]}]})),/https/);checks++;
// a gravação falha inteira: o conteúdo anterior continua
ok((await q('select count(*)::int n from ml_ac_aulas where versao_id=$1',[v1.id])).rows[0].n===3,'gravação atômica');

// modalidade com prova ainda não publica (etapas futuras)
await rpc('ml_ac_versao_salvar','ana',v1.id,J({...conteudo,modalidade:'automatica',notaMinima:70,maxTentativas:3}));
ok((await rpc('ml_ac_problemas_versao',v1.id)).some(x=>/ainda não estão disponíveis/.test(x)),'prova bloqueada');

// Qualidade: exige validação; qualquer edição a invalida; carga horária só vale validada
await rpc('ml_ac_versao_salvar','ana',v1.id,J({...conteudo,exigeQualidade:true,cargaHorariaMin:120}));
pend=await rpc('ml_ac_problemas_versao',v1.id);
ok(pend.some(x=>/Qualidade/.test(x)),'aguarda qualidade');
await rpc('ml_ac_versao_validar_qualidade','qual',v1.id,true);
ok((await rpc('ml_ac_problemas_versao',v1.id)).length===0,'validada');
await rpc('ml_ac_versao_salvar','ana',v1.id,J({...conteudo,exigeQualidade:true,cargaHorariaMin:120,notasVersao:'ajuste'}));
ok((await rpc('ml_ac_problemas_versao',v1.id)).some(x=>/Qualidade/.test(x)),'edição invalida validação');
await rpc('ml_ac_versao_validar_qualidade','qual',v1.id,false);
ok((await rpc('ml_ac_problemas_versao',v1.id)).some(x=>/Carga horária/.test(x)),'carga horária não validada');
await rpc('ml_ac_versao_salvar','ana',v1.id,J(conteudo));

// publicar
await rpc('ml_ac_versao_publicar','ana',v1.id);
ok((await q('select status from ml_ac_treinamentos where id=$1',[tid])).rows[0].status==='publicado','treinamento publicado');

// imutabilidade da versão publicada
await assert.rejects(q('update ml_ac_versoes set titulo=$2 where id=$1',[v1.id,'X']),/imutável/);checks++;
await assert.rejects(q('delete from ml_ac_versoes where id=$1',[v1.id]),/não pode ser apagada/);checks++;
await assert.rejects(q('update ml_ac_aulas set titulo=$2 where versao_id=$1',[v1.id,'X']),/publicada/);checks++;
await assert.rejects(q('delete from ml_ac_aulas where versao_id=$1',[v1.id]),/publicada/);checks++;
await assert.rejects(q("insert into ml_ac_materiais(versao_id,ordem,titulo,url) values($1,99,'x','https://x.com')",[v1.id]),/publicada/);checks++;
await assert.rejects(rpc('ml_ac_versao_salvar','ana',v1.id,J(conteudo)),/rascunho/);checks++;

// nova versão copia o conteúdo e não altera a anterior
const v2id=await rpc('ml_ac_nova_versao','ana',tid);
const v2=(await q('select numero,status from ml_ac_versoes where id=$1',[v2id])).rows[0];
ok(v2.numero===2&&v2.status==='rascunho','versão 2 rascunho');
ok((await q('select count(*)::int n from ml_ac_aulas where versao_id=$1',[v2id])).rows[0].n===3,'conteúdo copiado');
await assert.rejects(rpc('ml_ac_nova_versao','ana',tid),/rascunho/);checks++;
await rpc('ml_ac_versao_salvar','ana',v2id,J({...conteudo,titulo:'Gestão do tempo v2',modulos:[{titulo:'Novo',aulas:[{titulo:'Só uma',tipo:'texto',conteudo:{texto:'x'}}]}]}));
ok((await q('select count(*)::int n from ml_ac_aulas where versao_id=$1',[v1.id])).rows[0].n===3,'v1 intacta após editar v2');
ok((await q('select titulo from ml_ac_versoes where id=$1',[v1.id])).rows[0].titulo==='Gestão do tempo','título v1 preservado');

// publicar v2 substitui a v1 sem apagá-la
await rpc('ml_ac_versao_publicar','ana',v2id);
const st=(await q('select numero,status from ml_ac_versoes where treinamento_id=$1 order by numero',[tid])).rows;
ok(st[0].status==='substituida'&&st[1].status==='publicada','v1 substituída, v2 publicada');
ok((await q('select count(*)::int n from ml_ac_aulas where versao_id=$1',[v1.id])).rows[0].n===3,'v1 mantém aulas');

// público
await rpc('ml_ac_publico_salvar','ana',tid,J([{tipo:'setor',valor:'Comercial'},{tipo:'cargo',valor:'Analista'},{tipo:'setor',valor:'Comercial'}]));
ok((await q('select count(*)::int n from ml_ac_publico where treinamento_id=$1',[tid])).rows[0].n===2,'público sem duplicata');
await assert.rejects(rpc('ml_ac_publico_salvar','ana',tid,J([{tipo:'time',valor:'x'}])),/Público inválido/);checks++;

// grupos e vínculos
const gid=await rpc('ml_ac_grupo_salvar','ana',null,'Novos','',true,J(['p1','p2']));
ok((await q('select count(*)::int n from ml_ac_grupo_membros where grupo_id=$1',[gid])).rows[0].n===2,'membros');
await rpc('ml_ac_vinculo_salvar','leo','ana','pessoa-1');
await assert.rejects(rpc('ml_ac_vinculo_salvar','leo','leo','pessoa-1'),/duplicate key/);checks++;
await assert.rejects(rpc('ml_ac_vinculo_salvar','leo','fantasma','pessoa-9'),/foreign key/);checks++;
await rpc('ml_ac_vinculo_salvar','leo','ana','');
ok((await q('select count(*)::int n from ml_ac_vinculos')).rows[0].n===0,'vínculo removido');

// arquivar não apaga nada
await rpc('ml_ac_treinamento_arquivar','ana',tid);
ok((await q('select count(*)::int n from ml_ac_versoes where treinamento_id=$1',[tid])).rows[0].n===2,'versões preservadas');
ok((await q('select status from ml_ac_treinamentos where id=$1',[tid])).rows[0].status==='arquivado','arquivado');
await assert.rejects(rpc('ml_ac_treinamento_meta','ana',tid,'integracao',''),/arquivado/);checks++;

// auditoria imutável e preenchida
ok((await q('select count(*)::int n from ml_ac_eventos')).rows[0].n>=10,'eventos registrados');
await assert.rejects(q('update ml_ac_eventos set usuario=$1',['x']),/auditoria/);checks++;
await assert.rejects(q('delete from ml_ac_eventos'),/auditoria/);checks++;

// o navegador (anon/authenticated) não alcança nada
for(const role of ['anon','authenticated']){
 await db.exec(`set role ${role}`);
 await assert.rejects(q('select * from public.ml_ac_treinamentos'),/permission denied/);
 await assert.rejects(rpc('ml_ac_treinamento_criar','x','Curso inválido','integracao'),/permission denied/);
 await db.exec('reset role');checks+=2;
}
console.log(`${checks} verificações PostgreSQL da Academy passaram (banco isolado, sem produção).`);
await db.close();
