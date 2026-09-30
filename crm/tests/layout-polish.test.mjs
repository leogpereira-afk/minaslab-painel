import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('header global permanece compacto e usa a cor grafite da marca', async () => {
  const source = await read('src/layouts/Sidebar.tsx')
  assert.match(source, /flex h-16 items-center/)
  assert.match(source, /className="h-10 w-44 object-contain/)
  assert.match(source, /hidden h-11 items-stretch bg-\[#2B444E\]/)
  assert.match(source, /top-16 max-h-\[calc\(100vh-4rem\)\]/)
})

test('navbar ativa não usa linha inferior por pseudo-elemento', async () => {
  const source = await read('src/layouts/Sidebar.tsx')
  assert.doesNotMatch(source, /after:bottom-0/)
  assert.doesNotMatch(source, /after:h-0\.5/)
  assert.doesNotMatch(source, /after:bg-\[#30C8B3\]/)
  assert.match(source, /bg-white\/10 text-\[#30C8B3\]/)
})

test('Card reutilizável possui estrutura comum de cabeçalho e corpo', async () => {
  const source = await read('src/components/ui/DesignSystem.tsx')
  assert.match(source, /export function Card\(/)
  assert.match(source, /export function CardHeader\(/)
  assert.match(source, /export function CardBody\(/)
})

test('camada final padroniza cards e bordas neutras', async () => {
  const source = await read('src/design-system-layout-polish.css')
  assert.match(source, /--radius-card:8px/)
  assert.match(source, /--structural-border:#e2e8f0/)
  assert.match(source, /--focus-border:#cbd5e1/)
  assert.match(source, /\.ds-card:not\(\.p-0\)\{padding:16px\}/)
  assert.match(source, /border-color:var\(--structural-border\) !important/)
  assert.match(source, /:where\(input,select,textarea\)\{[\s\S]*border-color:var\(--structural-border\) !important/)
  assert.match(source, /\[data-page="Oportunidades"\] \.ds-card/)
  assert.match(source, /border-color:var\(--focus-border\) !important/)
})

test('contornos estruturais de qualquer página são neutralizados', async () => {
  const source = await read('src/design-system-layout-polish.css')
  assert.match(source, /:where\(section,article,div,header,footer,aside,nav,table,thead,tbody,tr,th,td,fieldset\)/)
  assert.match(source, /\[style\*="border"\]/)
  assert.match(source, /\.divide-y/)
  assert.match(source, /\.divide-x/)
  assert.match(source, /\[role="tablist"\]/)
})

test('bordas e rings frios são neutralizados globalmente', async () => {
  const source = await read('src/design-system-layout-polish.css')
  assert.match(source, /\[class\*="border-blue-"\]/)
  assert.match(source, /\[class\*="border-sky-"\]/)
  assert.match(source, /\[class\*="border-cyan-"\]/)
  assert.match(source, /\[class\*="border-indigo-"\]/)
  assert.match(source, /\[class\*="border-teal-"\]/)
  assert.match(source, /\[class\*="border-\[var\(--brand-"\]/)
  assert.match(source, /\[data-page="Atendimentos"\][\s\S]*border-color:var\(--structural-border\) !important/)
  assert.match(source, /\[class\*="ring-blue-"\]/)
  assert.match(source, /\[class\*="ring-teal-"\]/)
  assert.match(source, /--tw-ring-color:var\(--structural-border\) !important/)
  assert.match(source, /#root \[class\*="border-blue-"\]/)
  assert.match(source, /\[role="dialog"\] \[class\*="border-blue-"\]/)
})

test('foco acessível usa somente contorno cinza neutro', async () => {
  const source = await read('src/design-system-layout-polish.css')
  assert.match(source, /outline-color:#94a3b8 !important/)
  assert.match(source, /box-shadow:0 0 0 3px var\(--focus-ring\) !important/)
  assert.doesNotMatch(source, /border-color:var\(--brand-500\) !important/)
})

test('refinamento visual é carregado depois das camadas anteriores', async () => {
  const source = await read('src/main.tsx')
  const phase8 = source.indexOf("./design-system-phase8.css")
  const polish = source.indexOf("./design-system-layout-polish.css")
  assert.ok(phase8 >= 0 && polish > phase8)
})
