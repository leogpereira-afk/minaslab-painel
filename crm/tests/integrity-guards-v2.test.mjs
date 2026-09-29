import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const leadDetail = read('src/pages/LeadDetalhe/LeadDetalhe.tsx')
const collections = read('src/pages/Coletas/Coletas.tsx')

test('criação de cliente a partir do atendimento possui rollback se o vínculo falhar', () => {
  assert.ok(leadDetail.includes("supabase.from('clientes').delete().eq('id',newClientId)"), 'Rollback do cliente criado não encontrado')
  assert.ok(leadDetail.includes('revertido com segurança'), 'Mensagem de rollback seguro ausente')
})

test('conversão de atendimento para oportunidade continua com rollback', () => {
  assert.ok(leadDetail.includes("supabase.from('oportunidades').delete().eq('id',opportunityId)"), 'Rollback da oportunidade removido')
})

test('falha de Google Agenda preserva a coleta salva no CRM e informa erro', () => {
  assert.ok(collections.includes('Coleta salva no CRM, mas não foi sincronizada com o Google Agenda.'), 'Proteção de persistência da coleta removida')
})

test('histórico de contratos pode repetir número encerrado, mas não dois ativos', () => {
  const migration = read('database/migrations/20260913_contratos_active_number_unique_guard.sql')
  assert.match(migration, /create unique index if not exists contratos_numero_ativo_unique_idx/i)
  assert.match(migration, /upper\(coalesce\(status,''\)\)='ATIVO'/i)
  assert.match(migration, /deleted_at is null/i)
})
