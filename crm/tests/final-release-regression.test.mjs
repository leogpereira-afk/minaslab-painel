import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('rotas críticas do CRM permanecem publicadas', async () => {
  const routes = await read('src/routes/AppRoutes.tsx')
  for (const route of ['/dashboard','/atendimentos','/clientes','/oportunidades','/pipeline','/propostas','/contratos','/ordens-servico','/coletas','/agenda','/tarefas','/pos-venda/visao-geral','/inteligencia','/relatorios','/integracoes']) {
    assert.match(routes, new RegExp(route.replaceAll('/', '\\/')))
  }
})

test('recuperação de senha usa a URL oficial em produção e bloqueia localhost configurado', async () => {
  const auth = await read('src/config/auth.ts')
  const forgot = await read('src/pages/ForgotPassword/ForgotPassword.tsx')
  assert.match(auth, /https:\/\/crm-minaslab-2\.vercel\.app/)
  assert.match(auth, /isLocalUrl\(configuredAppUrl\)/)
  assert.match(auth, /productionAppUrl/)
  assert.match(forgot, /redirectTo: getPasswordResetUrl\(\)/)
})

test('layout principal mantém proteção por autenticação e permissões', async () => {
  const routes = await read('src/routes/AppRoutes.tsx')
  assert.match(routes, /<ProtectedRoute\/?>/)
  assert.match(routes, /PermissionRoute anyOf=\{\['crm\.read'/)
  assert.match(routes, /PermissionRoute anyOf=\{\['operational\.read'/)
  assert.match(routes, /PermissionRoute anyOf=\{\['admin\.manage'/)
})

test('design system permanece carregado na aplicação', async () => {
  const main = await read('src/main.tsx')
  assert.match(main, /index\.css/)
  assert.match(main, /design-system-phase2\.css/)
  assert.match(main, /design-system-commercial-pages\.css/)
})

test('integrações expõem observabilidade sem criar novo registro no reprocessamento', async () => {
  const integrations = await read('src/pages/Importacoes/Integracoes.tsx')
  const health = await read('src/pages/Importacoes/IntegrationHealth.tsx')
  assert.match(integrations, /IntegrationHealth/)
  assert.match(health, /Ressincronizar/)
  assert.match(health, /agendamento_id: row\.id/)
  assert.doesNotMatch(health, /from\('agendamentos'\)\s*\.insert/)
})
