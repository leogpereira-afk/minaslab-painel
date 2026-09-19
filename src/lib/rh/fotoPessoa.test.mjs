import test from 'node:test';
import assert from 'node:assert/strict';
import { validarArquivoFoto, fotoValida } from './fotoPessoa.js';
import { nomesAtuais } from './referenciasPessoa.js';
test('foto aceita somente imagens suportadas até 5 MB e miniatura local limitada', () => {
  for (const type of ['image/jpeg','image/png','image/webp']) assert.doesNotThrow(()=>validarArquivoFoto({type,size:100}));
  for (const arquivo of [{type:'image/svg+xml',size:100},{type:'image/jpeg',size:6000000},{type:'image/png',size:0}]) assert.throws(()=>validarArquivoFoto(arquivo));
  assert.equal(fotoValida('https://externo/foto.jpg'),false);
  assert.equal(fotoValida('data:image/svg+xml;base64,AAAA'),false);
  assert.equal(fotoValida('data:image/jpeg;base64,AAAA'),true);
  assert.equal(fotoValida('data:image/jpeg;base64,'+'A'.repeat(150000)),false);
});
test('vínculos mostram nome atual pelo ID e preservam registro sem pessoa, sem mutar histórico', () => {
  const registros=[{pessoaId:'1',pessoaNome:'Antigo'},{pessoaId:'2',pessoaNome:'Histórico'}];
  assert.deepEqual(nomesAtuais(registros,[{id:'1',nome:'Atual'}]).map(r=>r.pessoaNome),['Atual','Histórico']);
  assert.equal(registros[0].pessoaNome,'Antigo');
  assert.equal(nomesAtuais([{responsavelId:'1',responsavelNome:'Antigo'}],[{id:'1',nome:'Atual'}],'responsavelId','responsavelNome')[0].responsavelNome,'Atual');
});
