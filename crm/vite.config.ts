import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dentro do painel, o CRM é publicado em /minaslab-painel/crm/ no GitHub Pages.
// O workflow define CRM_BASE_PATH; sem ele (dev local), o CRM roda na raiz.
export default defineConfig({
  base: process.env.CRM_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
})
