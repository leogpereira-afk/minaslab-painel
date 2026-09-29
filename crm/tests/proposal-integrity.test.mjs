import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const proposals = readFileSync(resolve(root, 'src/pages/Propostas/Propostas.tsx'), 'utf8')

test('edição de proposta captura snapshot antes de alterar vínculos', () => {
  assert.ok(proposals.includes("supabase.from('propostas').select('oportunidade_id,oportunidade_referencia"), 'Snapshot da proposta anterior ausente')
  assert.ok(proposals.includes("supabase.from('proposta_laboratorios').select('laboratorio_id')"), 'Snapshot dos laboratórios ausente')
  assert.ok(proposals.includes("supabase.from('proposta_grupos').select('grupo_id')"), 'Snapshot dos escopos ausente')
})

test('falha nos vínculos reverte criação ou restaura edição', () => {
  assert.ok(proposals.includes('const rollback=async(reason:string)=>'), 'Rotina de rollback da proposta ausente')
  assert.ok(proposals.includes("supabase.from('propostas').delete().eq('id',proposalId)"), 'Rollback de proposta recém-criada ausente')
  assert.ok(proposals.includes('previousLabs.map(laboratorio_id=>({proposta_id:proposalId,laboratorio_id}))'), 'Restauração de laboratórios anteriores ausente')
  assert.ok(proposals.includes('previousScopes.map(grupo_id=>({proposta_id:proposalId,grupo_id}))'), 'Restauração de escopos anteriores ausente')
  assert.ok(proposals.includes("supabase.from('propostas').update({...previousProposal"), 'Restauração dos dados principais da proposta ausente')
})

test('laboratórios e escopos são gravados em sequência para detectar falha parcial', () => {
  const labInsert = proposals.indexOf("const il=await supabase.from('proposta_laboratorios').insert")
  const scopeInsert = proposals.indexOf("const ig=await supabase.from('proposta_grupos').insert")
  assert.ok(labInsert >= 0 && scopeInsert > labInsert, 'Ordem segura de gravação dos vínculos não encontrada')
  assert.ok(proposals.includes('if(il.error){await rollback(il.error.message)'), 'Falha de laboratório não dispara rollback')
  assert.ok(proposals.includes('if(ig.error){await rollback(ig.error.message)'), 'Falha de escopo não dispara rollback')
})
