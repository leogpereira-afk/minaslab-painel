import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Importações lê CSV/XLSX, grava staging e chama processamento automático', async () => {
  const source = await read('src/pages/Importacoes/Importacoes.tsx')
  assert.match(source, /parseXlsxFirstDataSheet/)
  assert.match(source, /parseDelimited/)
  assert.match(source, /total_linhas:parsedRows\.length/)
  assert.match(source, /status:'STAGING'/)
  assert.match(source, /from\('importacao_linhas'\)\.insert/)
  assert.match(source, /rpc\('crm_process_importacao'/)
  assert.match(source, /Importando e validando/)
})

test('Parser CSV suporta quebra de linha dentro de campo entre aspas e normaliza cabeçalhos', async () => {
  const source = await read('src/pages/Importacoes/Importacoes.tsx')
  assert.match(source, /else if\(char==='\\n'&&!quoted\)pushRow\(\)/)
  assert.match(source, /normalize\('NFD'\)/)
  assert.match(source, /LABORATÓRIO e LABORATORIO são normalizados/)
})

test('Falha de processamento fica explícita', async () => {
  const source = await read('src/pages/Importacoes/Importacoes.tsx')
  assert.match(source, /status:'ERRO'/)
  assert.match(source, /erro_processamento:message/)
  assert.match(source, /setError\(message\)/)
})

test('Detalhe da importação informa claramente se deve reenviar ou não', async () => {
  const source = await read('src/pages/ImportacaoDetalhe/ImportacaoDetalhe.tsx')
  assert.match(source, /Importação não concluída — reenvie o arquivo/)
  assert.match(source, /Arquivo recebido — processamento pendente/)
  assert.match(source, /Importação aplicada com sucesso/)
  assert.match(source, /status==='STAGING'/)
  assert.match(source, /status==='APLICADA'/)
})

test('Modelo do histórico analítico inclui LABORATORIO', async () => {
  const source = await read('src/pages/Importacoes/Importacoes.tsx')
  assert.match(source, /SERVICO;LABORATORIO;PARAMETRO/)
})

test('Importador GerenciaLab reutiliza o mesmo fluxo corrigido', async () => {
  const source = await read('src/pages/Importacoes/GerenciaLabImportador.tsx')
  assert.match(source, /Importacoes as GerenciaLabImportador/)
})

test('Processador SQL cobre todos os modelos exibidos', async () => {
  const migration = await read('database/migrations/20260914_importacoes_processamento_completo.sql')
  for (const kind of ['GERENCIALAB_CLIENTES','GERENCIALAB_PROPOSTAS','GERENCIALAB_DASHBOARD','GERENCIALAB_CONTRATOS','CATALOGO_GERENCIALAB','GERENCIALAB_HISTORICO_ANALITICO','CRM_HISTORICO','CRM_ATENDIMENTOS']) assert.match(migration,new RegExp(kind))
  assert.match(migration,/has_permission\('imports\.manage'\)/)
  assert.match(migration,/APLICADA_PARCIAL/)
})

test('Banco protege clientes ativos contra CPF/CNPJ normalizado duplicado', async () => {
  const migration = await read('database/migrations/20260914_clientes_cpf_cnpj_active_unique_guard.sql')
  assert.match(migration, /create unique index if not exists clientes_cpf_cnpj_normalizado_active_unique_idx/i)
  assert.match(migration, /cpf_cnpj_normalizado/i)
  assert.match(migration, /deleted_at is null/i)
})
