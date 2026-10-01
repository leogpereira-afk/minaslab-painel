// Carrega cada modelo de curso de docs/academy-cursos/*.json no banco isolado (PGlite)
// e confere que as regras do banco aceitam o conteúdo. A única pendência esperada
// de um rascunho recém-importado é o responsável pelo conteúdo.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_ENTRY).href);
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table public.ml_contas(usuario text primary key,nome text);`);
await db.exec(await readFile(new URL('../supabase/migrations/20261005120000_academy_fundacao.sql',import.meta.url),'utf8'));
const dir=new URL('../docs/academy-cursos/',import.meta.url);
let n=0;
for(const arq of (await readdir(dir)).filter(a=>a.endsWith('.json'))){
 const curso=JSON.parse(await readFile(new URL(arq,dir),'utf8'));
 const tid=(await db.query("select public.ml_ac_treinamento_criar('teste',$1,'gestao-tempo-desenvolvimento') v",[curso.titulo])).rows[0].v;
 const vid=(await db.query('select id from ml_ac_versoes where treinamento_id=$1',[tid])).rows[0].id;
 await db.query('select public.ml_ac_versao_salvar($1,$2,$3)',['teste',vid,JSON.stringify(curso)]);
 const pend=(await db.query('select public.ml_ac_problemas_versao($1) v',[vid])).rows[0].v;
 assert.deepEqual(pend,['Defina o responsável pelo conteúdo.'],`${arq}: ${pend.join(' | ')}`);
 const aulas=(await db.query('select count(*)::int c from ml_ac_aulas where versao_id=$1',[vid])).rows[0].c;
 console.log(`${arq}: ${curso.modulos.length} módulos, ${aulas} aulas — única pendência: responsável.`);n++;
}
assert.ok(n>0);
await db.close();
