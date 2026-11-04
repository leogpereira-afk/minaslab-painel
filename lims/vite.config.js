import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH vem do workflow de publicação (/minaslab-painel/lims/). Em dev, raiz.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  server: { port: 5177, open: false },
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
