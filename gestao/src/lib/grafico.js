// Dados do slide de gráfico livre. Uma linha por item: "Rótulo | valor" ou,
// com várias séries, uma primeira linha de cabeçalho: "Mês | Micro | FQ".
// Números no jeito brasileiro (1.234,5) ou com ponto decimal.

export function numeroBR(t) {
  let s = String(t ?? "").trim().replace(/[R$%\s]/g, "");
  if (!s) return null;
  if (/,\d+$/.test(s) || /\.\d{3}(,|$)/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Devolve { series: [nome], rotulos: [r], valores: [[v por série]] } */
export function lerDados(texto) {
  const ls = String(texto || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => l.split("|").map((c) => c.trim()));
  if (!ls.length) return { series: [], rotulos: [], valores: [] };
  let series = ["Valor"];
  let corpo = ls;
  if (ls[0].length > 1 && ls[0].slice(1).every((c) => numeroBR(c) == null)) { series = ls[0].slice(1); corpo = ls.slice(1); }
  const n = Math.max(1, series.length, ...corpo.map((l) => l.length - 1));
  while (series.length < n) series.push(`Série ${series.length + 1}`);
  const linhas = corpo.filter((l) => l.slice(1).some((c) => numeroBR(c) != null));
  return {
    series,
    rotulos: linhas.map((l) => l[0]),
    valores: linhas.map((l) => series.map((_, k) => numeroBR(l[k + 1]) ?? 0)),
  };
}

export const fmtNum = (v) => (Math.abs(v) >= 1000 ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
