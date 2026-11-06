import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH vem do workflow de publicação. Em dev, raiz.
// O site mora na RAIZ de https://www.minaslab.online desde 06/11/2026. O workflow ainda manda o
// caminho antigo (/minaslab-painel/...) e não pode ser editado por aqui: o prefixo antigo é descartado.
export default defineConfig({
  base: (process.env.BASE_PATH || "/").replace(/^\/minaslab-painel(?=\/)/, ""),
  plugins: [react()],
  // CSS próprio, sem Tailwind: não herdar o postcss.config.js do painel (pasta acima).
  css: { postcss: {} },
  server: { port: 5177, open: false },
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
