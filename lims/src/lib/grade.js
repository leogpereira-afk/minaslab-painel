// Regras da grade estilo DataTables (a mesma do GerenciaLab): pesquisa geral,
// filtro por coluna, ordenação e paginação. Puro, sem React, para ter teste.
//
// Uma coluna é { t: título, v: (linha) => valor para ordenar,
//   fv?: (linha) => texto que a pesquisa enxerga (padrão: v),
//   filtro?: true | "lista" }.

import { semAcento } from "./formato.js";

const texto = (col, linha) => String((col.fv || col.v)(linha) ?? "");

export function pesquisar(linhas, colunas, termo) {
  const q = semAcento(termo).trim();
  if (!q) return linhas;
  return linhas.filter((l) => colunas.some((c) => semAcento(texto(c, l)).includes(q)));
}

// filtros: { [índiceDaColuna]: texto }. Coluna "lista" compara o valor inteiro;
// "Todos" ou vazio não filtra.
export function filtrarColunas(linhas, colunas, filtros) {
  const ativos = Object.entries(filtros || {}).filter(([, f]) => f && f !== "Todos");
  if (!ativos.length) return linhas;
  return linhas.filter((l) => ativos.every(([i, f]) => {
    const c = colunas[i];
    if (!c) return true;
    if (c.filtro === "lista") return texto(c, l) === f;
    return semAcento(texto(c, l)).includes(semAcento(f).trim());
  }));
}

export function ordenar(linhas, coluna, sentido = "asc") {
  if (!coluna) return linhas;
  const fator = sentido === "desc" ? -1 : 1;
  return [...linhas].sort((a, b) => {
    const x = coluna.v(a), y = coluna.v(b);
    if (typeof x === "number" && typeof y === "number") return (x - y) * fator;
    return String(x ?? "").localeCompare(String(y ?? ""), "pt-BR", { numeric: true }) * fator;
  });
}

// Botões da paginação: primeira, última e vizinhas da atual; o resto vira "…".
export function paginar(total, pagina, porPagina) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const atual = Math.min(Math.max(0, pagina), paginas - 1);
  const botoes = [];
  for (let p = 0; p < paginas; p++) {
    if (paginas > 7 && p > 1 && p < paginas - 2 && Math.abs(p - atual) > 1) {
      if (botoes[botoes.length - 1] !== "…") botoes.push("…");
      continue;
    }
    botoes.push(p);
  }
  const de = total ? atual * porPagina + 1 : 0;
  const ate = Math.min(total, (atual + 1) * porPagina);
  return { paginas, atual, botoes, de, ate, inicio: atual * porPagina, fim: atual * porPagina + porPagina };
}

// Planilha das linhas visíveis (CSV com ";" e BOM, que o Excel em português
// abre direto). Usa o texto que a tela mostra (fv) quando existe.
export function paraCSV(linhas, colunas, sep = ";") {
  const cel = (s) => { const t = String(s ?? "").replace(/\r?\n/g, " "); return /[";,]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const corpo = [colunas.map((c) => cel(c.t)), ...linhas.map((l) => colunas.map((c) => cel((c.fv || c.v)(l))))];
  return "﻿" + corpo.map((r) => r.join(sep)).join("\r\n");
}
