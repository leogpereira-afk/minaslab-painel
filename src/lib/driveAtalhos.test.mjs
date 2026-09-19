import test from 'node:test';
import assert from 'node:assert/strict';
import { analisarLinkDrive, validarAtalhoDrive, filtrarAtalhosDrive } from './driveAtalhos.js';

const base = { id: 'a', nome: ' Documentos ', url: 'https://drive.google.com/drive/folders/pasta123?resourcekey=chave', area: 'Laboratório', descricao: ' Ensaios e instruções ', destaque: true };

test('preserva a chave de acesso e identifica pastas do Drive', () => {
  const link = analisarLinkDrive(base.url);
  assert.equal(link.tipo, 'Pasta');
  assert.equal(link.url, base.url);
  assert.equal(link.chave, 'pasta:pasta123');
});

test('aceita links Google sem protocolo e identifica formatos', () => {
  for (const [url, tipo] of [['docs.google.com/spreadsheets/d/abc/edit', 'Planilha'], ['https://docs.google.com/document/d/abc/edit', 'Documento'], ['https://docs.google.com/presentation/d/abc/edit', 'Apresentação'], ['https://forms.gle/abc', 'Formulário']]) {
    assert.equal(analisarLinkDrive(url).tipo, tipo);
    assert.ok(analisarLinkDrive(url).url.startsWith('https://'));
  }
});

test('recusa scripts, hosts falsos, credenciais e protocolos inseguros', () => {
  for (const url of ['', 'javascript:alert(1)', 'data:text/html,oi', 'https://drive.google.com.exemplo.com/arquivo', 'https://drive.google.com@exemplo.com/', 'https://usuario:senha@drive.google.com/', 'https://drive.google.com:444/', 'http://drive.google.com/', 'https://exemplo.com']) assert.equal(analisarLinkDrive(url), null, url);
});

test('evita duplicação por variação de link para o mesmo arquivo', () => {
  const outro = { ...base, id: 'b', url: 'https://drive.google.com/open?id=abc' };
  assert.match(validarAtalhoDrive({ ...base, url: 'https://docs.google.com/document/d/abc/edit?usp=sharing' }, [outro]).erro, /já está/);
  assert.match(validarAtalhoDrive({ ...base, id: 'b', url: 'https://drive.google.com/drive/u/0/folders/pasta123' }, [base]).erro, /já está/);
});

test('permite atalhos para abas diferentes da mesma planilha', () => {
  const primeiro = { ...base, url: 'https://docs.google.com/spreadsheets/d/abc/edit#gid=1' };
  const segundo = { ...base, id: 'b', url: 'https://docs.google.com/spreadsheets/d/abc/edit?gid=2' };
  assert.ok(validarAtalhoDrive(segundo, [primeiro]).registro);
  assert.match(validarAtalhoDrive({ ...segundo, url: 'https://docs.google.com/spreadsheets/d/abc/edit?gid=1' }, [primeiro]).erro, /já está/);
});

test('edição do próprio atalho mantém id e limpa espaços', () => {
  const { registro } = validarAtalhoDrive(base, [base]);
  assert.equal(registro.id, 'a');
  assert.equal(registro.nome, 'Documentos');
  assert.equal(registro.descricao, 'Ensaios e instruções');
  assert.equal(registro.destaque, true);
});

test('formulário exige nome, link e área válidos', () => {
  for (const campos of [{ nome: ' ' }, { url: 'invalido' }, { area: 'inventada' }, { nome: 'x'.repeat(121) }, { descricao: 'x'.repeat(401) }]) assert.ok(validarAtalhoDrive({ ...base, ...campos }).erro);
});

test('busca sem acentos combina área, tipo e palavras; destaque é filtro independente', () => {
  const itens = [base, { ...base, id: 'b', nome: 'Compras', area: 'Compras', destaque: false, descricao: '' }];
  assert.deepEqual(filtrarAtalhosDrive(itens, { busca: 'laboratorio instrucoes pasta' }).map(i => i.id), ['a']);
  assert.deepEqual(filtrarAtalhosDrive(itens, { area: 'Compras' }).map(i => i.id), ['b']);
  assert.deepEqual(filtrarAtalhosDrive(itens, { destaques: true }).map(i => i.id), ['a']);
  assert.deepEqual(filtrarAtalhosDrive(itens, { area: 'Compras', destaques: true }), []);
});

test('ordena destaques antes dos demais sem alterar a lista original', () => {
  const itens = [{ ...base, id: 'b', nome: 'A', destaque: false }, { ...base, nome: 'Z' }];
  assert.deepEqual(filtrarAtalhosDrive(itens).map(i => i.id), ['a', 'b']);
  assert.deepEqual(itens.map(i => i.id), ['b', 'a']);
});
