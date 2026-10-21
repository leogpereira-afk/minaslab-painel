import test from 'node:test';
import assert from 'node:assert/strict';
import { autorizar, validarPedido, EMISSOR } from '../../supabase/functions/ml-marketing/acesso.mjs';
import { detalharFortemais } from '../../supabase/functions/ml-marketing/marketing-fortemais.mjs';
import { formatarMetrica, periodoDaFonte } from './marketing.mjs';
const agora = Date.parse('2026-01-15T12:00:00Z');
const token = claims => 'Bearer eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ sub: 'teste', sis: 'minaslab', papel: 'direcao', exp: agora / 1000 + 3600, ...claims })).toString('base64url') + '.assinaturaParaTeste';
const resposta = (contas, status = 200) => async (url, init) => {
  assert.equal(url, EMISSOR); assert.equal(init.redirect, 'error'); assert.deepEqual(JSON.parse(init.body), { action: 'contasListar' });
  return new Response(JSON.stringify({ contas }), { status });
};
const conta = { usuario: 'teste', papel: 'direcao', ativo: true };
test('marketing valida assinatura no emissor e exige direção ativa no cadastro atual', async () => {
  assert.deepEqual(await autorizar(token(), resposta([conta]), agora), { usuario: 'teste' });
  for (const atual of [{ ...conta, ativo: false }, { ...conta, papel: 'equipe' }, { ...conta, usuario: 'outra' }]) await assert.rejects(autorizar(token(), resposta([atual]), agora), e => e.status === 403);
  await assert.rejects(autorizar(token(), resposta([]), agora), e => e.status === 403);
});
test('token forjado, vencido, de outro sistema e falha de rede não abrem a fonte', async () => {
  await assert.rejects(autorizar(token(), resposta([conta], 401), agora), e => e.status === 401);
  await assert.rejects(autorizar(token({ exp: agora / 1000 }), resposta([conta]), agora), e => e.status === 401);
  await assert.rejects(autorizar(token({ sis: 'outro' }), resposta([conta]), agora), e => e.status === 401);
  await assert.rejects(autorizar(token(), async () => { throw Error('offline'); }, agora), e => e.status === 503);
  await assert.rejects(autorizar(null, () => { throw Error('não deve chamar'); }, agora), e => e.status === 401);
});
test('gateway não aceita outra empresa, endpoint arbitrário ou ação OAuth', () => {
  for (const body of [{ action: 'painel', empresa: 'domo' }, { action: 'coletar', fonte: 'https://exemplo.invalid' }, { action: 'inicio' }, { action: 'vincular', fonte: 'ga4', ativo: '' }]) assert.throws(() => validarPedido(body));
  assert.equal(validarPedido({ action: 'painel' }).action, 'painel');
});
const periodo = { inicio: '2026-01-01', fim: '2026-01-10', completo: true, metricas: { usuarios: 0, sessoes: 12 }, tabelas: {}, serie: [] };
const bruto = { empresa: 'minaslab', identidade: { site: 'https://minaslab.net' }, estado: 'ok', coletadoEm: '2026-01-15T11:00:00Z', periodos: [periodo], token: 'nunca-expor' };
test('projeção aceita somente identidade MinasLab e remove campos não permitidos', () => {
  const montar = valor => detalharFortemais([{ chave: 'leo_marketing_minaslab_direto_ga4', valor }], agora, 'minaslab').fontes[0];
  const f = montar(bruto);
  assert.equal(f.periodos[0].metricas.usuarios, 0); assert.equal(f.periodos[0].metricas.novos_usuarios, null);
  assert.equal(JSON.stringify(f).includes('nunca-expor'), false);
  assert.equal(montar({ ...bruto, empresa: 'domo' }).estado, 'vinculo_divergente');
  assert.equal(montar({ ...bruto, identidade: { site: 'https://exemplo.invalid' } }).periodos.length, 0);
});
test('zero confirmado difere de ausência e números não são somados entre períodos', () => {
  assert.equal(formatarMetrica('usuarios', 0), '0');
  for (const x of [null, undefined, NaN, '0']) assert.equal(formatarMetrica('usuarios', x), '—');
  assert.equal(formatarMetrica('ctr', 0.125), '12,5%');
  const fonte = { estado: 'ok', periodos: [{ id: 'a', ...periodo }, { id: 'b', ...periodo, metricas: { usuarios: 15 } }] };
  assert.equal(periodoDaFonte(fonte, 'a').metricas.usuarios, 0);
  assert.equal(periodoDaFonte(fonte, 'b').metricas.usuarios, 15);
  assert.equal(periodoDaFonte({ ...fonte, estado: 'vinculo_divergente' }), null);
});

import { criarHandler } from '../../supabase/functions/ml-marketing/handler.mjs';
import { ErroAcesso } from '../../supabase/functions/ml-marketing/acesso.mjs';
import { FalhaDireta } from '../../supabase/functions/ml-marketing/marketing-direto.mjs';
const req = (body, origin = 'https://leogpereira-afk.github.io') => new Request('https://exemplo.invalid/marketing', { method: 'POST', headers: { origin, authorization: token(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('handler nega acesso antes de consultar o banco ou provedores', async () => {
  let chamadas = 0;
  const handler = criarHandler({ verificar: async () => { throw new ErroAcesso(403, 'Sem acesso'); }, direto: { status: () => chamadas++ }, lerFontes: () => chamadas++ });
  assert.equal((await handler(req({ action: 'painel' }))).status, 403); assert.equal(chamadas, 0);
});
test('handler consulta somente leitura, projeta MinasLab e não inicia coleta', async () => {
  let coletas = 0;
  const handler = criarHandler({ agora: () => agora, verificar: async () => ({}), direto: { status: async () => ({ provedores: {} }), coletar: () => coletas++ }, lerFontes: async () => [{ chave: 'leo_marketing_minaslab_direto_ga4', valor: bruto }] });
  const r = await handler(req({ action: 'painel' })), d = await r.json();
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(d.empresa, 'minaslab'); assert.equal(d.fontes[0].periodos[0].metricas.usuarios, 0); assert.equal(coletas, 0);
  assert.equal((await handler(req({ action: 'painel' }, 'https://outro.invalid'))).status, 403);
});
test('coleta fica restrita ao canal e erros do provedor são tratados sem detalhes secretos', async () => {
  const handler = criarHandler({ verificar: async () => ({}), lerFontes: async () => [], direto: { coletar: async f => { assert.equal(f, 'instagram'); throw new FalhaDireta('temporario'); } } });
  const r = await handler(req({ action: 'coletar', fonte: 'instagram' }));
  assert.equal(r.status, 422); assert.equal((await r.json()).codigo, 'temporario');
  assert.equal((await handler(req({ action: 'coletar', fonte: 'linkedin' }))).status, 400);
});
