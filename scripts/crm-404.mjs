#!/usr/bin/env node
// Gera dist/404.html para o GitHub Pages servindo DOIS SPAs no mesmo site:
//   /minaslab-painel/       → painel (React Router com basename)
//   /minaslab-painel/crm/   → CRM MinasLab (build separado em dist/crm)
//
// O Pages não tem rewrite de servidor: qualquer subpágina aberta direto
// (refresh, favorito, link) cai no 404.html da RAIZ. Antes ele era só uma cópia
// do index do painel — um refresh em /crm/clientes/123 abria o painel, não o
// CRM. Agora o 404.html continua sendo o painel, mas com um script no topo do
// <head> que, se o caminho for do CRM, redireciona para
// /minaslab-painel/crm/?__rota=/clientes/123 — o index do CRM restaura a rota
// com history.replaceState antes do React Router montar.
//
// Uso: node scripts/crm-404.mjs [pasta-dist] [base]
//   base padrão: BASE_PATH do ambiente, ou "/".
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] || "dist";
let base = process.argv[3] || process.env.BASE_PATH || "/";
if (!base.startsWith("/")) base = "/" + base;
if (!base.endsWith("/")) base += "/";

const indexPainel = join(dist, "index.html");
const indexCrm = join(dist, "crm", "index.html");

if (!existsSync(indexPainel)) {
  console.error(`crm-404: ${indexPainel} não existe — rode o build do painel antes.`);
  process.exit(1);
}
if (!existsSync(indexCrm)) {
  console.error(`crm-404: ${indexCrm} não existe — rode o build do CRM (crm/) antes.`);
  process.exit(1);
}

const prefixoCrm = base + "crm";
const script = `<script>
(function () {
  var prefixo = ${JSON.stringify(prefixoCrm)};
  var p = window.location.pathname;
  if (p !== prefixo && p.indexOf(prefixo + "/") !== 0) return;
  var rota = p.slice(prefixo.length) || "/";
  var busca = window.location.search.replace(/^\\?/, "");
  window.location.replace(
    prefixo + "/?__rota=" + encodeURIComponent(rota) + (busca ? "&" + busca : "") + window.location.hash
  );
})();
</script>`;

const html = readFileSync(indexPainel, "utf8");
if (!/<head[^>]*>/i.test(html)) {
  console.error("crm-404: <head> não encontrado no index do painel.");
  process.exit(1);
}
const saida = html.replace(/<head[^>]*>/i, (tag) => `${tag}\n${script}`);
writeFileSync(join(dist, "404.html"), saida);
console.log(`crm-404: ${join(dist, "404.html")} gerado (painel + desvio para ${prefixoCrm}/).`);
