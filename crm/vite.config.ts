import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// O CRM não depende de @types/node; declara só o que o config usa.
declare const process: { env: Record<string, string | undefined> }

// Dentro do painel, o CRM é publicado em /crm/ (https://www.minaslab.online/crm/).
// O site mora na RAIZ de https://www.minaslab.online desde 06/11/2026. O workflow ainda manda o
// caminho antigo (/minaslab-painel/...) e não pode ser editado por aqui: o prefixo antigo é descartado.
// Sem CRM_BASE_PATH (dev local), o CRM roda na raiz.
export default defineConfig({
  base: (process.env.CRM_BASE_PATH || '/').replace(/^\/minaslab-painel(?=\/)/, ''),
  plugins: [react(), tailwindcss()],
})
