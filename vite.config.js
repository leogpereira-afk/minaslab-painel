import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O dominio www.minaslab.online e o ambiente de desenvolvimento usam a raiz.
// O workflow do Pages define BASE_PATH; sem ele, nada muda.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  server: { port: 5175, open: false },
  /* target es2022: os navegadores da casa entendem tudo disso nativo — o
     transpile para sintaxe antiga so inflava o bundle com helpers. */
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
