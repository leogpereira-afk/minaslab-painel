import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
let handler,verificacoes=0,dbCalls=0,authStatus=200;
globalThis.Deno={env:{get:()=> 'isolado'},serve:fn=>{handler=fn;}};
globalThis.__createClient=()=>({from(){dbCalls++;return {select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:[],error:null}),maybeSingle:async()=>({data:null,error:null})};}});
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response('{}',{status:authStatus});
let source=await readFile(new URL('../supabase/functions/ml-patrimonio/index.ts',import.meta.url),'utf8');
source=source.replace(/^import \{createClient\}[^\n]+/, 'const createClient=globalThis.__createClient;');
const {code}=await transform(source,{loader:'ts',format:'esm'});
await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const token=p=>'Bearer x.'+Buffer.from(JSON.stringify({sub:'teste',exp:Date.now()/1000+1000,sis:'minaslab',papel:'direcao',...p})).toString('base64url')+'.x';
async function request(auth,b={action:'listar',tipo:'bem'}){return handler(new Request('http://isolado',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},body:JSON.stringify(b)}));}
assert.equal((await request()).status,401);assert.equal(dbCalls,0);verificacoes++;
authStatus=401;assert.equal((await request(token({}))).status,401);assert.equal(dbCalls,0);verificacoes++;
authStatus=200;
for(const p of [{sis:'impresilk'},{papel:'equipe'},{papel:'leitura'},{exp:1},{exp:null}]){assert.equal((await request(token(p))).status,403);assert.equal(dbCalls,0);verificacoes++;}
const ok=await request(token({}));assert.equal(ok.status,200);assert.deepEqual(await ok.json(),{ok:true,valor:{}});verificacoes++;
assert.equal((await request(token({}),{action:'listar',tipo:'rh_pessoas'})).status,400);verificacoes++;
assert.equal((await request(token({}),{action:'foto:listar',bemId:'inexistente'})).status,404);verificacoes++;
authStatus=503;assert.equal((await request(token({}))).status,503);verificacoes++;
globalThis.fetch=originalFetch;
console.log(`${verificacoes} verificações da porta autenticada passaram com serviços simulados.`);
