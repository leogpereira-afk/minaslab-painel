import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Coletas reutiliza o mesmo agendamento interno ao ressincronizar', async () => {
  const source = await read('src/pages/Coletas/Coletas.tsx')
  assert.match(source, /let agenda=coleta\.agendamento_id/)
  assert.match(source, /google-calendar-sync'.*agendamento_id:agenda/s)
  assert.match(source, /async function retrySync\(r:Row\)/)
  assert.match(source, /await syncCalendar\(r\.id\)/)
})

test('Coletas remove agendamento novo quando o vínculo com a coleta falha', async () => {
  const source = await read('src/pages/Coletas/Coletas.tsx')
  assert.match(source, /agendamentos'\)\.delete\(\)\.eq\('id',agenda\)/)
  assert.match(source, /agendamento interno foi revertido/)
})

test('Pós-venda reutiliza agendamento existente da recorrência', async () => {
  const source = await read('src/pages/PosVenda/PosVenda.tsx')
  assert.match(source, /selected\.agendamento_id/)
  assert.match(source, /agendamentos'\)\.update\(/)
  assert.match(source, /agendamentos'\)\.insert\(/)
})

test('Agenda sincroniza pelo identificador persistido e possui timeout controlado', async () => {
  const source = await read('src/pages/Agenda/AgendaLista.tsx')
  assert.match(source, /withTimeout/)
  assert.match(source, /google-calendar-sync'.*agendamento_id: id/s)
  assert.match(source, /Agendamento salvo no CRM/)
})

test('Tela de integrações não anuncia integrações ativas como apenas conceituais', async () => {
  const source = await read('src/pages/Importacoes/Integracoes.tsx')
  assert.match(source, /Google Agenda[\s\S]*ATIVA NO CRM/)
  assert.match(source, /ChatPro[\s\S]*WEBHOOK EXISTENTE/)
  assert.match(source, /auditoria pendente/i)
  assert.match(source, /IntegrationHealth/)
})

test('Painel de saúde identifica pendências sem criar outro agendamento', async () => {
  const source = await read('src/pages/Importacoes/IntegrationHealth.tsx')
  assert.match(source, /external_calendar_id/)
  assert.match(source, /google-calendar-sync'.*agendamento_id: row\.id/s)
  assert.match(source, /O mesmo agendamento foi preservado para nova tentativa/)
  assert.doesNotMatch(source, /from\('agendamentos'\)\s*\.insert/)
})

test('Painel de saúde exige permissão de escrita para reprocessamento', async () => {
  const source = await read('src/pages/Importacoes/IntegrationHealth.tsx')
  assert.match(source, /hasPermission\('crm\.write'\)/)
  assert.match(source, /hasPermission\('admin\.manage'\)/)
  assert.match(source, /if \(!canRetry \|\| retryingId\) return/)
})
