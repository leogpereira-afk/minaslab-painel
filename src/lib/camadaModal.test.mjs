import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ativarCamada} from './camadaModal.js';

// DOM mínimo para exercitar a pilha e eventos; o navegador real verifica layout.
function ambiente() {
  const anterior=globalThis.document;
  const eventos=new Set();
  let doc;
  const el=(nome,pai=null)=>({nome,pai,inert:false,isConnected:true,filhos:[],focus(){doc.activeElement=this;},closest(){let p=this;while(p){if(p.inert)return p;p=p.pai;}return null;},getClientRects(){return [1];},querySelector(){return null;},querySelectorAll(){return this.filhos;}});
  const root=el('root'),principal=el('principal',root),origem=el('abrir',root);
  doc={body:{style:{overflow:'auto'}},activeElement:origem,getElementById:id=>id==='root'?root:principal,addEventListener:(_,fn)=>eventos.add(fn),removeEventListener:(_,fn)=>eventos.delete(fn)};
  globalThis.document=doc;
  const janela=nome=>{const panel=el(nome);panel.filhos=[el('fechar',panel),el('salvar',panel)];return panel;};
  return {doc,root,principal,origem,janela,eventos,tecla(key,shiftKey=false){const e={key,shiftKey,prevenido:false,preventDefault(){this.prevenido=true;},stopImmediatePropagation(){}};for(const fn of eventos)fn(e);return e;},restaurar(){globalThis.document=anterior;}};
}

test('janela bloqueia fundo e rolagem; ao fechar restaura estado e foco',()=>{
 const a=ambiente();const j=a.janela('ficha');const fechar=ativarCamada(j,()=>{});
 try{assert.equal(a.root.inert,true);assert.equal(a.doc.body.style.overflow,'hidden');assert.equal(a.doc.activeElement,j.filhos[0]);}
 finally{fechar();}
 assert.equal(a.root.inert,false);assert.equal(a.doc.body.style.overflow,'auto');assert.equal(a.doc.activeElement,a.origem);assert.equal(a.eventos.size,0);a.restaurar();
});
test('Tab e Shift+Tab circulam apenas nos controles da janela',()=>{
 const a=ambiente(),j=a.janela('ficha'),fechar=ativarCamada(j,()=>{});
 try{assert.equal(a.tecla('Tab',true).prevenido,true);assert.equal(a.doc.activeElement,j.filhos[1]);assert.equal(a.tecla('Tab').prevenido,true);assert.equal(a.doc.activeElement,j.filhos[0]);}
 finally{fechar();a.restaurar();}
});
test('janela sem controles permanece navegável sem escapar ao fundo',()=>{
 const a=ambiente(),j=a.janela('vazia');j.filhos=[];const fechar=ativarCamada(j,()=>{});
 try{assert.equal(a.doc.activeElement,j);assert.equal(a.tecla('Tab').prevenido,true);assert.equal(a.doc.activeElement,j);}
 finally{fechar();a.restaurar();}
});
test('Escape fecha só a última janela; pai continua bloqueando a página',()=>{
 const a=ambiente(),pai=a.janela('pai'),filha=a.janela('filha');let p=0,f=0;
 const fecharPai=ativarCamada(pai,()=>p++);const fecharFilha=ativarCamada(filha,()=>f++);
 try{a.tecla('Escape');assert.equal(p,0);assert.equal(f,1);assert.equal(pai.inert,true);fecharFilha();assert.equal(pai.inert,false);assert.equal(a.root.inert,true);a.tecla('Escape');assert.equal(p,1);}
 finally{fecharPai();a.restaurar();}
});
test('desmontagem do pai primeiro não libera a página sob a filha',()=>{
 const a=ambiente(),pai=a.janela('pai'),filha=a.janela('filha');const f1=ativarCamada(pai,()=>{}),f2=ativarCamada(filha,()=>{});
 f1();assert.equal(a.root.inert,true);assert.equal(a.doc.body.style.overflow,'hidden');f2();assert.equal(a.root.inert,false);assert.equal(a.doc.body.style.overflow,'auto');a.restaurar();
});
test('se o botão original foi desmontado, foco retorna ao conteúdo',()=>{
 const a=ambiente(),j=a.janela('ficha'),fechar=ativarCamada(j,()=>{});a.origem.isConnected=false;fechar();assert.equal(a.doc.activeElement,a.principal);a.restaurar();
});
test('preserva um fundo que já estava inerte antes da janela',()=>{
 const a=ambiente();a.root.inert=true;const fechar=ativarCamada(a.janela('ficha'),()=>{});fechar();assert.equal(a.root.inert,true);a.restaurar();
});
test('retorna ao acionador mesmo quando autoFocus mudou o foco antes do efeito',()=>{
 const a=ambiente(),j=a.janela('conta');a.doc.activeElement=j.filhos[1];
 const fechar=ativarCamada(j,()=>{},a.origem);j.filhos.forEach(el=>{el.isConnected=false;});
 fechar();assert.equal(a.doc.activeElement,a.origem);a.restaurar();
});
