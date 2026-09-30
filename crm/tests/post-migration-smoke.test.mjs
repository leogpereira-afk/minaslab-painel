import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const routes = read('src/routes/AppRoutes.tsx')
const main = read('src/main.tsx')
const auth = read('src/config/auth.ts')
const forgotPassword = read('src/pages/ForgotPassword/ForgotPassword.tsx')
const phase8 = read('src/design-system-phase8.css')

test('rotas críticas do CRM continuam registradas', () => {
  const criticalRoutes = [
    '/login', '/forgot-password', '/reset-password', '/dashboard', '/atendimentos',
    '/pipeline', '/clientes', '/oportunidades', '/propostas', '/tarefas', '/contratos',
    '/ordens-servico', '/coletas', '/agenda', '/catalogo', '/amostras-parametros',
    '/pos-venda/visao-geral', '/inteligencia', '/relatorios', '/configuracoes', '/auditoria',
  ]

  for (const route of criticalRoutes) {
    assert.match(routes, new RegExp(`path=\\"${route.replaceAll('/', '\\/')}\\"`), `Rota ausente: ${route}`)
  }
})

test('todos os módulos importados pelo roteador existem no repositório', () => {
  const imports = [...routes.matchAll(/from ['"](\.\.\/[^'"]+)['"]/g)].map(match => match[1])
  assert.ok(imports.length > 20, 'Quantidade inesperadamente baixa de módulos no roteador')

  for (const importPath of imports) {
    const base = resolve(root, 'src/routes', importPath)
    const candidates = [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')]
    assert.ok(candidates.some(existsSync), `Import do roteador não resolvido: ${importPath}`)
  }
})

test('todas as camadas aprovadas do Design System são carregadas', () => {
  for (const css of [
    './index.css',
    './design-system-phase2.css',
    './design-system-commercial-pages.css',
    './design-system-phase5.css',
    './design-system-phase6.css',
    './design-system-phase7.css',
    './design-system-phase8.css',
  ]) {
    assert.ok(main.includes(`import '${css}'`), `Camada visual não carregada: ${css}`)
  }
})

test('auditoria visual mantém legibilidade mínima e proteção de layout', () => {
  assert.match(phase8, /\.text-\\\[9px\\\]/)
  assert.match(phase8, /\.text-\\\[10px\\\]/)
  assert.match(phase8, /font-size:\s*11px\s*!important/)
  assert.match(phase8, /\.ds-page[\s\S]*max-width:\s*100%/)
  assert.match(phase8, /focus-visible/)
})

test('recuperação de senha usa URL de produção e redirect explícito', () => {
  assert.ok(auth.includes("https://crm-minaslab-2.vercel.app"), 'URL oficial de produção ausente da configuração de autenticação')
  assert.ok(auth.includes('isLocalUrl(configuredAppUrl)'), 'Proteção contra VITE_APP_URL local ausente')
  assert.ok(auth.includes('/reset-password'), 'Destino de redefinição de senha ausente')
  assert.ok(forgotPassword.includes('redirectTo: getPasswordResetUrl()'), 'Fluxo de recuperação não usa redirect explícito')
})

test('rotas protegidas continuam dentro do AppLayout e PermissionRoute', () => {
  assert.ok(routes.includes('<Route element={<ProtectedRoute/>}>'), 'ProtectedRoute removido do fluxo principal')
  assert.ok(routes.includes('<Route element={<AppLayout/>}>'), 'AppLayout removido do fluxo protegido')
  assert.ok(routes.includes('PermissionRoute anyOf='), 'Controles de permissão removidos das rotas')
})
