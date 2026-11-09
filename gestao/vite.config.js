import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH vem do workflow de publicação (ex.: /gestao/). Em dev, raiz.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  server: { port: 5176, open: false },
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
