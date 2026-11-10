// Markdown simples das respostas do Assistente, convertido em BLOCOS (sem HTML cru: nada de innerHTML).
// Suporta: títulos (#), listas (- * 1.), citações (>), blocos de código (```), tabelas (| a | b |),
// e no texto: **negrito**, *itálico*, `código` e [link](https://...). Links só http(s).

export function blocosMarkdown(md) {
  const linhas = String(md ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocos = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (/^```/.test(l.trim())) {
      const corpo = [];
      i++;
      while (i < linhas.length && !/^```/.test(linhas[i].trim())) corpo.push(linhas[i++]);
      i++;
      blocos.push({ tipo: "codigo", texto: corpo.join("\n") });
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const t = /^(#{1,6})\s+(.*)$/.exec(l);
    if (t) { blocos.push({ tipo: "titulo", nivel: t[1].length, texto: t[2].trim() }); i++; continue; }
    if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(l)) { blocos.push({ tipo: "linha" }); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const tab = [];
      while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) tab.push(linhas[i++]);
      const celulas = (s) => s.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const ehSep = (s) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(s);
      const cab = celulas(tab[0]);
      const corpo = tab.slice(ehSep(tab[1] ?? "") ? 2 : 1).filter((s) => !ehSep(s)).map(celulas);
      blocos.push({ tipo: "tabela", cabecalho: cab, linhas: corpo });
      continue;
    }
    if (/^\s*>/.test(l)) {
      const corpo = [];
      while (i < linhas.length && /^\s*>/.test(linhas[i])) corpo.push(linhas[i++].replace(/^\s*>\s?/, ""));
      blocos.push({ tipo: "citacao", texto: corpo.join(" ") });
      continue;
    }
    const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
    if (item.test(l)) {
      const ordenada = /^\s*\d+[.)]/.test(l);
      const itens = [];
      while (i < linhas.length && (item.test(linhas[i]) || (/^\s{2,}\S/.test(linhas[i]) && itens.length))) {
        const m = item.exec(linhas[i]);
        if (m) itens.push(m[2]); else itens[itens.length - 1] += " " + linhas[i].trim();
        i++;
      }
      blocos.push({ tipo: ordenada ? "numerada" : "lista", itens });
      continue;
    }
    const par = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,6}\s|```|\s*>|\s*([-*+]|\d+[.)])\s|\s*\|.*\|\s*$)/.test(linhas[i])) par.push(linhas[i++].trim());
    blocos.push({ tipo: "paragrafo", texto: par.join(" ") });
  }
  return blocos;
}

/** Pedaços de uma linha: [{tipo:"texto"|"negrito"|"italico"|"codigo"|"link", texto, url?}]. */
export function trechosInline(s) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\)|\*[^*\s][^*]*\*)/g;
  let ult = 0, m;
  const str = String(s ?? "");
  while ((m = re.exec(str))) {
    if (m.index > ult) out.push({ tipo: "texto", texto: str.slice(ult, m.index) });
    const t = m[0];
    if (t.startsWith("**") || t.startsWith("__")) out.push({ tipo: "negrito", texto: t.slice(2, -2) });
    else if (t.startsWith("`")) out.push({ tipo: "codigo", texto: t.slice(1, -1) });
    else if (t.startsWith("[")) out.push({ tipo: "link", texto: t.slice(1, t.indexOf("](")), url: m[2] });
    else out.push({ tipo: "italico", texto: t.slice(1, -1) });
    ult = m.index + t.length;
  }
  if (ult < str.length) out.push({ tipo: "texto", texto: str.slice(ult) });
  return out;
}
