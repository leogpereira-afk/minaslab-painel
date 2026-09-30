import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Ordens de Serviço usa paginação server-side e não reintroduz corte de 1000 registros', async () => {
  const source = await read('src/pages/OrdensServico/OrdensServico.tsx')
  assert.match(source, /rpc\('crm_ordens_servico_list'/)
  assert.doesNotMatch(source, /from\('ordens_servico'\)[\s\S]{0,400}\.limit\(1000\)/)
})

test('RPC de Ordens de Serviço preserva RLS e não multiplica amostras por parâmetros', async () => {
  const migration = await read('database/migrations/20260913_os_server_pagination_sample_counts_fix.sql')
  assert.doesNotMatch(migration, /security\s+definer/i)
  assert.match(migration, /sample_stats/i)
  assert.match(migration, /count\(distinct a\.id\)::integer as samples/i)
  assert.match(migration, /count\(distinct a\.id\) filter \(where a\.data_entrada is not null\)::integer as received/i)
  assert.match(migration, /count\(ap\.\*\)::integer as params/i)
  assert.match(migration, /grant execute[\s\S]*authenticated/i)
})

test('Propostas usa RPC server-side para lista, filtros, paginação e KPIs', async () => {
  const source = await read('src/pages/Propostas/Propostas.tsx')
  assert.match(source, /rpc\('crm_propostas_list'/)
  assert.match(source, /p_page:page/)
  assert.match(source, /p_page_size:PAGE_SIZE/)
  assert.match(source, /setStats\(/)
  assert.doesNotMatch(source, /fetchAll<Row>\([\s\S]{0,250}from\('propostas'\)/)
})

test('RPC de Propostas permanece SECURITY INVOKER e restringe execução a usuários autenticados', async () => {
  const migration = await read('database/migrations/20260913_propostas_server_pagination.sql')
  assert.doesNotMatch(migration, /security\s+definer/i)
  assert.match(migration, /revoke all[\s\S]*from public, anon/i)
  assert.match(migration, /grant execute[\s\S]*to authenticated, service_role/i)
})

test('Clientes usa RPC server-side para busca, filtros, paginação, contadores e KPIs', async () => {
  const source = await read('src/pages/Clientes/Clientes.tsx')
  assert.match(source, /rpc\('crm_clientes_list'/)
  assert.match(source, /p_query:query/)
  assert.match(source, /p_status:statusFilter/)
  assert.match(source, /p_segment:segmentFilter/)
  assert.match(source, /p_responsible:responsibleFilter/)
  assert.match(source, /p_page:page/)
  assert.match(source, /p_page_size:PAGE_SIZE/)
  assert.match(source, /setStats\(/)
  assert.doesNotMatch(source, /from\('clientes'\)[\s\S]{0,400}\.limit\(1000\)/)
  assert.doesNotMatch(source, /from\('interacoes'\)[\s\S]{0,300}\.limit\(5000\)/)
})

test('Backend paginado de Clientes fica versionado e protegido por RLS existente', async () => {
  const migration = await read('database/migrations/20260913_clientes_server_pagination.sql')
  assert.match(migration, /crm_clientes_list/)
  assert.doesNotMatch(migration, /security\s+definer/i)
  assert.match(migration, /interacoes_cliente_ocorrido_idx/)
  assert.match(migration, /grant execute[\s\S]*to authenticated, service_role/i)
})

test('Coletas usa RPC server-side para lista, filtros, paginação, KPIs e resumo', async () => {
  const source = await read('src/pages/Coletas/Coletas.tsx')
  assert.match(source, /rpc\('crm_coletas_list'/)
  assert.match(source, /p_query:debouncedQuery/)
  assert.match(source, /p_status:status/)
  assert.match(source, /p_period:period/)
  assert.match(source, /p_month:month/)
  assert.match(source, /p_collector:collector/)
  assert.match(source, /p_city:city/)
  assert.match(source, /p_page:page/)
  assert.match(source, /p_page_size:PAGE/)
  assert.doesNotMatch(source, /from\('coletas'\)[\s\S]{0,400}\.limit\(1000\)/)
  assert.doesNotMatch(source, /from\('clientes'\)\.select\('id,nome_fantasia,razao_social'\)/)
  assert.doesNotMatch(source, /from\('agendamentos'\)\.select\('id,external_calendar_id'\)/)
})

test('Backend paginado de Coletas preserva RLS e restringe execução', async () => {
  const migration = await read('database/migrations/20260913_coletas_server_pagination.sql')
  assert.match(migration, /crm_coletas_list/)
  assert.match(migration, /security invoker/i)
  assert.doesNotMatch(migration, /security\s+definer/i)
  assert.match(migration, /revoke all[\s\S]*from public, anon/i)
  assert.match(migration, /grant execute[\s\S]*to authenticated, service_role/i)
})

test('Dashboard usa uma agregação server-side e não carrega tabelas inteiras no navegador', async () => {
  const source = await read('src/pages/Dashboard/Dashboard.tsx')
  assert.match(source, /rpc\('crm_dashboard_executivo'/)
  assert.doesNotMatch(source, /fetchAll/)
  assert.doesNotMatch(source, /from\('ordens_servico'\)/)
  assert.doesNotMatch(source, /from\('atendimentos'\)/)
  assert.doesNotMatch(source, /from\('propostas'\)/)
})

test('Agregação do Dashboard preserva RLS e grants controlados', async () => {
  const migration = await read('database/migrations/20260913_dashboard_server_aggregation.sql')
  assert.match(migration, /crm_dashboard_executivo/)
  assert.match(migration, /security invoker/i)
  assert.doesNotMatch(migration, /security\s+definer/i)
  assert.match(migration, /revoke all[\s\S]*from public,anon/i)
  assert.match(migration, /grant execute[\s\S]*to authenticated,service_role/i)
})

test('Oportunidades usa RPC server-side para busca, filtros, paginação e KPIs', async () => {
  const source = await read('src/pages/Oportunidades/Oportunidades.tsx')
  assert.match(source, /rpc\('crm_oportunidades_list'/)
  assert.match(source, /p_query:query/)
  assert.match(source, /p_stage:stage/)
  assert.match(source, /p_status:status/)
  assert.match(source, /p_page:page/)
  assert.match(source, /p_page_size:TABLE_PAGE_SIZE/)
  assert.doesNotMatch(source, /fetchAll<Opp>/)
  assert.doesNotMatch(source, /from\('oportunidades'\)[\s\S]{0,300}\.range\(/)
})

test('Backend paginado de Oportunidades preserva RLS e grants controlados', async () => {
  const migration = await read('database/migrations/20260913_oportunidades_server_pagination.sql')
  assert.match(migration, /crm_oportunidades_list/)
  assert.match(migration, /security invoker/i)
  assert.doesNotMatch(migration, /security\s+definer/i)
  assert.match(migration, /revoke all[\s\S]*from public, anon/i)
  assert.match(migration, /grant execute[\s\S]*to authenticated, service_role/i)
})
