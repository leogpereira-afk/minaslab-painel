import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarColecoes, esquecerColecao } from '../services/dados.js';
import { gravarSessao, sair } from './sessao.js';

test('cache não atravessa troca de usuário nem devolve coleção recusada', async () => {
 const antigoFetch=globalThis.fetch, antigoStorage=globalThis.localStorage;
 const itens=new Map(); globalThis.localStorage={getItem:k=>itens.get(k)||null,setItem:(k,v)=>itens.set(k,v),removeItem:k=>itens.delete(k)};
 let recusar=false;
 globalThis.fetch=async (_url, opcoes)=>{
  const {action}=JSON.parse(opcoes.body);
  const body=action==='rev'?{rev:{porColecao:{rh_pessoas:1}}}:{rev:{porColecao:{rh_pessoas:1}},colecoes:recusar?{}:{rh_pessoas:[{id:'privado'}]},recusadas:recusar?['rh_pessoas']:[]};
  return new Response(JSON.stringify(body),{status:200});
 };
 try {
  gravarSessao({token:'sessao-A',usuario:'direcao',papel:'direcao'});
  assert.equal((await carregarColecoes(['rh_pessoas'])).rh_pessoas.length,1);
  sair(); recusar=true;
  gravarSessao({token:'sessao-B',usuario:'leitura',papel:'leitura'});
  const dados=await carregarColecoes(['rh_pessoas']);
  assert.deepEqual(dados.rh_pessoas,[]);
  assert.deepEqual(dados._recusadas,['rh_pessoas']);
 } finally {esquecerColecao('rh_pessoas'); globalThis.fetch=antigoFetch;globalThis.localStorage=antigoStorage;}
});

test('resposta em trânsito da sessão antiga é descartada', async () => {
 const antigoFetch=globalThis.fetch, antigoStorage=globalThis.localStorage;
 const itens=new Map();globalThis.localStorage={getItem:k=>itens.get(k)||null,setItem:(k,v)=>itens.set(k,v),removeItem:k=>itens.delete(k)};
 let liberar, iniciou; const esperando=new Promise(r=>iniciou=r);
 globalThis.fetch=async (_url,o)=>{
  if(JSON.parse(o.body).action==='rev') return new Response(JSON.stringify({rev:{porColecao:{rh_pessoas:2}}}));
  iniciou(); return new Promise(r=>liberar=()=>r(new Response(JSON.stringify({colecoes:{rh_pessoas:[{id:'antigo'}]},rev:{porColecao:{rh_pessoas:2}}}))));
 };
 try {
  gravarSessao({token:'antigo',usuario:'antigo',papel:'direcao'});
  const pedido=carregarColecoes(['rh_pessoas']);
  await esperando; sair(); liberar();
  await assert.rejects(pedido,/sessão mudou/);
 } finally {esquecerColecao('rh_pessoas');globalThis.fetch=antigoFetch;globalThis.localStorage=antigoStorage;}
});
