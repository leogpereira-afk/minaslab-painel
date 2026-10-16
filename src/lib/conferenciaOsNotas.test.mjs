import test from 'node:test';
import assert from 'node:assert/strict';
import { conferirOsNotas } from './conferenciaOsNotas.js';
const E = 'mlab', OUTRA = 'minas';
const os = (n, nf, cli, v, mais = {}) => ({ id: n, empresa_id: E, os_numero: n, numero_nf: nf, cliente: cli, valor_faturar: v, status_faturamento: 'FATURADO', ...mais });
const nota = (nf, dest, v, mais = {}) => ({ id: 'n' + nf, empresa_id: E, tipo: 'SAIDA', numero_nf: nf, nome_destinatario: dest, valor_total: v, status_fiscal: 'AUTORIZADA', data_emissao: '2026-10-01', ...mais });
const rec = (nf) => ({ id: 'r' + nf, numero_nf: nf, status: 'PAGO' });
const get = (r, id) => r.itens.find((i) => i.id === id);
test('tudo certo: OS, nota e recebimento batem', () => {
  const r = conferirOsNotas({ empresaId: E, servicos: [os('OS1', '122', 'A', 225)], notas: [nota('122', 'A', 225)], recebimentos: [rec('122')] });
  assert.equal(r.erros, 0); assert.equal(get(r, 'numeracao').quantidade, 121); assert.equal(r.osComNota, 1);
});
test('OS com NF inexistente (caso NF 4/5/10) vira erro', () => {
  const r = conferirOsNotas({ empresaId: E, servicos: [os('OS795', '4', 'Flamboyant', 289.98)], notas: [], recebimentos: [] });
  assert.equal(get(r, 'os-sem-nota').quantidade, 1); assert.equal(get(r, 'os-sem-nota').severidade, 'erro');
});
test('NF emitida por outra empresa (caso 906) é atenção, não erro', () => {
  const r = conferirOsNotas({ empresaId: E, servicos: [os('OS1434', '906', 'Jesse', 240)], notas: [{ ...nota('906', 'Jesse', 240), empresa_id: OUTRA }], nomeOutras: { [OUTRA]: 'MinasLab' } });
  assert.equal(get(r, 'os-sem-nota').quantidade, 0); assert.equal(get(r, 'os-nota-outra-empresa').quantidade, 1); assert.match(get(r, 'os-nota-outra-empresa').lista[0].texto, /MinasLab/);
});
test('nota cancelada: OS que aponta para ela é erro', () => {
  const r = conferirOsNotas({ empresaId: E, servicos: [os('OS1', '7', 'A', 10)], notas: [nota('7', 'A', 10, { status_fiscal: 'CANCELADA' })] });
  assert.equal(get(r, 'os-nota-cancelada').quantidade, 1);
});
test('nota da M Lab lançada como ENTRADA (caso NF 88) é detectada', () => {
  const r = conferirOsNotas({ empresaId: E, servicos: [], notas: [{ ...nota('88', 'Paulo', 530), tipo: 'ENTRADA', nome_emitente: 'M LAB SERVICOS LTDA' }] });
  assert.equal(get(r, 'nota-entrada-errada').quantidade, 1);
});
test('repasse da MinasLab sem OS não conta como nota sem OS; nota avulsa conta', () => {
  const r = conferirOsNotas({ empresaId: E, servicos: [], notas: [nota('131', 'MINASLAB LTDA', 5800), nota('200', 'Avulso', 100)] });
  assert.equal(get(r, 'nota-sem-os').quantidade, 1); assert.match(get(r, 'nota-sem-os').lista[0].texto, /NF 200/);
});
test('valor da nota diferente da soma das OS (agrupadas somam)', () => {
  const r = conferirOsNotas({ empresaId: E, servicos: [os('A', '93', 'Napoles', 300), os('B', '93', 'Napoles', 330)], notas: [nota('93', 'Napoles', 680)] });
  assert.equal(get(r, 'nota-valor-difere').quantidade, 1); assert.equal(get(r, 'nota-valor-difere').valor, 50);
  const ok = conferirOsNotas({ empresaId: E, servicos: [os('A', '93', 'N', 300), os('B', '93', 'N', 380)], notas: [nota('93', 'N', 680)] });
  assert.equal(get(ok, 'nota-valor-difere').quantidade, 0);
});
test('buracos na numeração e nota sem recebimento', () => {
  const r = conferirOsNotas({ empresaId: E, servicos: [], notas: [nota('1', 'A', 1), nota('2', 'B', 2), nota('5', 'C', 5)], recebimentos: [rec('1'), rec('2')] });
  assert.deepEqual(get(r, 'numeracao').lista.map((x) => x.texto), ['NF 3', 'NF 4']);
  assert.deepEqual(get(r, 'nota-sem-recebimento').lista.map((x) => x.texto.slice(0, 4)), ['NF 5']);
});
test('número com zeros à esquerda e texto casa com a nota', () => {
  const r = conferirOsNotas({ empresaId: E, servicos: [os('A', 'NF 0122', 'A', 225)], notas: [nota('122', 'A', 225)] });
  assert.equal(get(r, 'os-sem-nota').quantidade, 0);
});
