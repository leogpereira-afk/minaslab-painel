import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O site mora na RAIZ de https://www.minaslab.online desde 06/11/2026. O workflow ainda manda o
// caminho antigo (/minaslab-painel/...) e não pode ser editado por aqui: o prefixo antigo é descartado.
export default defineConfig({
  base: (process.env.BASE_PATH || "/").replace(/^\/minaslab-painel(?=\/)/, ""),
  plugins: [react()],
  server: { port: 5175, open: false },
  /* target es2022: os navegadores da casa entendem tudo disso nativo — o
     transpile para sintaxe antiga so inflava o bundle com helpers. */
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
