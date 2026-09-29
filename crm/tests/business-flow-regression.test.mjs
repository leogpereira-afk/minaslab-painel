import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const leadDetail = read('src/pages/LeadDetalhe/LeadDetalhe.tsx')
const atendimentos = read('src/pages/Atendimentos/AtendimentosInbox.tsx')
const propostas = read('src/pages/Propostas/Propostas.tsx')
const contratos = read('src/pages/Contratos/Contratos.tsx')
const ordens = read('src/pages/OrdensServico/OrdensServicoPainel.tsx')
const coletas = read('src/pages/Coletas/Coletas.tsx')
const tarefas = read('src/pages/Tarefas/Tarefas.tsx')
const posVenda = read('src/pages/PosVenda/PosVenda.tsx')

test('Atendimento -> Oportunidade mantém conversão automática e rollback seguro', () => {
  assert.ok(leadDetail.includes("supabase.from('oportunidades').insert"), 'Criação de oportunidade ausente')
  assert.ok(leadDetail.includes("status:'CONVERTIDO'"), 'Atendimento não é marcado como CONVERTIDO após criar oportunidade')
  assert.ok(leadDetail.includes("supabase.from('oportunidades').delete().eq('id',opportunityId)"), 'Rollback da oportunidade ausente quando a atualização do atendimento falha')
  assert.ok(leadDetail.includes("tipo:'CONVERSAO'"), 'Conversão não registra histórico/timeline')
})

test('Atendimentos preserva vínculo entre lead, cliente e histórico comercial', () => {
  assert.ok(atendimentos.includes("cliente_convertido_id:clientId"), 'Vínculo do lead com o cliente convertido ausente')
  assert.ok(atendimentos.includes("tipo:'CONVERSAO'"), 'Conversão em cliente não registra interação')
  assert.ok(atendimentos.includes("supabase.from('interacoes').insert"), 'Timeline de Atendimentos não está persistindo interações')
})

test('conversão na caixa de Atendimentos reverte cliente se o vínculo falhar', () => {
  assert.match(atendimentos, /from\('clientes'\)\.delete\(\)\.eq\('id',clientId\)/)
  assert.match(atendimentos, /rollbackError/)
  assert.match(atendimentos, /historyError/)
})

test('Propostas preservam os vínculos comerciais e analíticos essenciais', () => {
  assert.ok(propostas.includes('oportunidade_id:form.oportunidade_id||null'), 'Proposta perdeu vínculo com oportunidade')
  assert.ok(propostas.includes('cliente_id:form.cliente_id||null'), 'Proposta perdeu vínculo com cliente')
  assert.ok(propostas.includes("supabase.from('proposta_laboratorios')"), 'Vínculo com laboratórios parceiros ausente')
  assert.ok(propostas.includes("supabase.from('proposta_grupos')"), 'Vínculo com escopo analítico ausente')
})

test('Contrato -> OS mantém cardinalidade operacional e referência da proposta', () => {
  assert.ok(contratos.includes('proposta_origem_referencia'), 'Contrato perdeu referência da proposta de origem')
  assert.ok(ordens.includes('contrato_id:form.contrato_id||null'), 'OS perdeu vínculo opcional com contrato')
  assert.ok(ordens.includes('cliente_id'), 'OS deixou de exigir/vincular cliente')
  assert.ok(ordens.includes("supabase.rpc('crm_ordens_servico_resumo')"), 'Resumo operacional das OS deixou de usar a fonte consolidada')
})

test('Coletas aceitam OS ou Proposta, preservam referência livre e sincronizam Agenda', () => {
  assert.ok(coletas.includes('numero_os_referencia'), 'Referência textual de OS ausente')
  assert.ok(coletas.includes('numero_proposta_referencia'), 'Referência textual de proposta ausente')
  assert.ok(coletas.includes("Informe uma Ordem de Serviço ou o Número da Proposta"), 'Validação OS ou Proposta deixou de existir')
  assert.ok(coletas.includes("supabase.from('agendamentos')"), 'Coleta deixou de sincronizar com agendamentos')
  assert.ok(coletas.includes("supabase.functions.invoke('google-calendar-sync'"), 'Sincronização com Google Agenda ausente')
})

test('Tarefas continuam permitindo conclusão individual por responsável', () => {
  assert.ok(tarefas.includes("supabase.from('tarefa_responsaveis').update"), 'Conclusão individual não atualiza tarefa_responsaveis')
  assert.ok(tarefas.includes(".eq('usuario_id',profile.id)"), 'Conclusão individual não está limitada ao usuário responsável')
  assert.ok(tarefas.includes("status:'CONCLUIDA'"), 'Status individual CONCLUIDA ausente')
  assert.ok(tarefas.includes('Concluir minha parte'), 'Ação de conclusão individual ausente da interface')
})

test('Pós-venda mantém recorrência, histórico e criação de agendamento', () => {
  assert.ok(posVenda.includes("supabase.from('recorrencias_clientes')"), 'Recorrências de clientes ausentes')
  assert.ok(posVenda.includes("supabase.from('recorrencias_historico').insert"), 'Histórico de recorrência deixou de ser gravado')
  assert.ok(posVenda.includes("supabase.from('agendamentos').insert"), 'Pós-venda deixou de criar agendamentos')
  assert.ok(posVenda.includes("status:'AGENDADO'"), 'Agendamento do pós-venda não atualiza status para AGENDADO')
})
