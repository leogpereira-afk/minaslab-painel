import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const coletas = read('src/pages/Coletas/Coletas.tsx')
const posVenda = read('src/pages/PosVenda/PosVenda.tsx')

test('coleta reverte agendamento interno se o vínculo falhar', () => {
  assert.ok(coletas.includes("await supabase.from('agendamentos').delete().eq('id',agenda)"))
  assert.ok(coletas.includes('agendamento interno foi revertido'))
})

test('coleta pendente pode reprocessar Google Agenda usando o mesmo agendamento', () => {
  assert.ok(coletas.includes('async function retrySync'))
  assert.ok(coletas.includes('Tentar sincronizar novamente'))
  assert.ok(coletas.includes('O mesmo agendamento interno foi preservado para nova tentativa'))
})

test('pós-venda reutiliza agendamento existente em vez de duplicar', () => {
  assert.ok(posVenda.includes('let agendaId=selected.agendamento_id'))
  assert.ok(posVenda.includes("supabase.from('agendamentos').update(schedulePayload).eq('id',agendaId)"))
})

test('pós-venda reverte agendamento novo se o vínculo da recorrência falhar', () => {
  assert.ok(posVenda.includes("if(created)await supabase.from('agendamentos').delete().eq('id',agendaId)"))
  assert.ok(posVenda.includes('O agendamento foi revertido porque não foi possível vinculá-lo à recorrência'))
})
