// Escala de higienização da cantina: lê a planilha "Calendário Escala"
// (uma aba por mês: linha com as datas, linha de baixo com o nome do
// responsável ou "FERIADO\nNome do feriado") e monta o calendário do slide.
// Função pura, com testes; quem lê o .xlsx é o xlsxLeve.

const MESES = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const p2 = (n) => String(n).padStart(2, "0");

/** Data do Excel (número de série) ou texto ISO → "AAAA-MM-DD". */
export function dataISO(v) {
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5);
    return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
  }
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Lê as abas do arquivo. Devolve { meses: { "AAAA-MM": { dias: {data: nome}, feriados: {data: nome} } }, tarefas: [...], rodape }.
 * Só guarda o dia na aba do PRÓPRIO mês (as abas repetem a semana de virada).
 */
export function lerEscala(abas) {
  const meses = {};
  let tarefas = [];
  let rodape = "";
  for (const [nomeAba, linhas] of Object.entries(abas)) {
    const idx = MESES.indexOf(norm(nomeAba).replace("Ç", "C"));
    if (idx < 0) continue;
    // Ano: o título "OUTUBRO 2026" ou a maioria das datas da aba.
    let ano = null;
    for (const l of linhas) for (const c of l || []) { const m = norm(c).match(new RegExp(`${MESES[idx]}\\s+(20\\d\\d)`)); if (m) ano = Number(m[1]); }
    for (let r = 0; r < linhas.length; r++) {
      const l = linhas[r] || [];
      const datas = l.map(dataISO);
      if (datas.filter(Boolean).length < 5) continue; // não é linha de datas
      const baixo = linhas[r + 1] || [];
      datas.forEach((d, k) => {
        if (!d) return;
        if (d.slice(5, 7) !== p2(idx + 1) || (ano && d.slice(0, 4) !== String(ano))) return; // dia de outro mês
        const v = String(baixo[k] ?? "").trim();
        if (!v) return;
        const alvo = (meses[d.slice(0, 7)] ??= { dias: {}, feriados: {} });
        const f = v.match(/^FERIADO\s*[\n\r]*\s*(.*)$/is);
        if (f) alvo.feriados[d] = f[1].replace(/\s+/g, " ").trim() || "Feriado";
        else alvo.dias[d] = v.replace(/\s+/g, " ").toUpperCase();
      });
    }
    if (!tarefas.length) {
      const ts = linhas.flat().filter((c) => typeof c === "string" && /^\s*✔/.test(c)).map((c) => c.replace(/^\s*✔\s*/, "").trim());
      if (ts.length) tarefas = ts;
    }
    if (!rodape) rodape = linhas.flat().find((c) => typeof c === "string" && /responsabilidade de todos/i.test(c)) || "";
  }
  return { meses, tarefas, rodape };
}

/** Meses que têm pelo menos um responsável preenchido. */
export const mesesComNomes = (escala) => Object.keys(escala?.meses || {}).filter((m) => Object.keys(escala.meses[m].dias).length).sort();

/** Semanas de segunda a sexta do mês: [[data|null × 5], ...]. */
export function semanasUteis(mes) {
  const [a, m] = mes.split("-").map(Number);
  const ult = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const semanas = [];
  let atual = null;
  for (let d = 1; d <= ult; d++) {
    const dt = new Date(Date.UTC(a, m - 1, d));
    const dow = dt.getUTCDay(); // 0 dom … 6 sáb
    if (dow === 0 || dow === 6) continue;
    if (!atual || dow === 1) { atual = [null, null, null, null, null]; semanas.push(atual); }
    atual[dow - 1] = `${a}-${p2(m)}-${p2(d)}`;
  }
  return semanas;
}
