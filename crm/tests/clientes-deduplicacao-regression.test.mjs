import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('clientes normalizam CPF/CNPJ no banco e impedem duplicidade ativa', async () => {
  const migration = await read('database/migrations/20260914_clientes_deduplicacao_documento.sql')
  assert.match(migration,/normalize_cpf_cnpj/)
  assert.match(migration,/trg_clientes_sync_documento_normalizado/)
  assert.match(migration,/create unique index if not exists clientes_cpf_cnpj_normalizado_active_unique_idx/i)
  assert.match(migration,/having count\(\*\) > 1/i)
})

test('consolidação preserva os vínculos principais antes de desativar duplicado', async () => {
  const migration = await read('database/migrations/20260914_clientes_deduplicacao_documento.sql')
  for (const table of ['agendamentos','atendimentos','contatos','contratos','enderecos','interacoes','leads','oportunidades','ordens_servico','propostas','tarefas']) {
    assert.match(migration,new RegExp(`update public\\.${table}`))
  }
  assert.match(migration,/set deleted_at=now\(\), ativo=false/)
})
