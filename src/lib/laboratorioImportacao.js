// Importação da planilha PROTOCOLO DE ENTRADAS DE AMOSTRAS (.xlsx) para a
// coleção lab_entradas. Lê o arquivo NO NAVEGADOR (um .xlsx é um ZIP de XML;
// fflate abre o ZIP) e devolve registros limpos — o servidor só insere os que
// ainda não existem, então importar de novo a mesma planilha não duplica.
//
// A planilha foi preenchida à mão por meses: data com ";" no lugar de ":",
// "202614:03" sem espaço, "sim"/"SIM"/"sím", nomes juntos com vírgula. Aqui tudo
// vira campo estruturado. O que não dá para ler com segurança NÃO é inventado:
// fica em `pendencias` com o texto original para a equipe revisar na tela.

import { unzipSync, strFromU8 } from "fflate";
import { contarAmostras } from "./laboratorioEntradas.js";

const ANO_MIN = 2024, ANO_MAX = 2027;
const TIPOS = { AGUA: "ÁGUA", ALIMENTO: "ALIMENTO", EFLUENTE: "EFLUENTE", SOLO: "SOLO", AR: "AR", CQ: "CQ", "CONTROLE DE QUALIDADE": "CQ" };
const NOMES = { "ANA CLAUDIA": "ANA CLÁUDIA", THAYNA: "THAYNÁ", VITORIA: "VICTORIA" };
// Colunas (A=0) que guardam data na planilha.
const COLS_DATA = new Set([2, 8, 9, 12, 13, 15]);

const semAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const dois = (n) => String(n).padStart(2, "0");

/* ------------------------------------------------------------- leitura do .xlsx */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const desescapar = (s) => s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e]);
const textos = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1])).join("");

function colunaDe(ref) {
  const letras = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// Devolve as linhas da PRIMEIRA aba: { linha, valores[] } com string | number | null.
export function lerXlsx(bytes) {
  const zip = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const ler = (nome) => (zip[nome] ? strFromU8(zip[nome]) : "");
  const compartilhadas = [...ler("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textos(m[1]));
  const wb = ler("xl/workbook.xml");
  const rid = (wb.match(/<sheet\b[^>]*\br:id="([^"]+)"/) || [])[1];
  const rels = ler("xl/_rels/workbook.xml.rels");
  const alvo = rid && (rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`)) || [])[1];
  const caminho = alvo ? `xl/${alvo.replace(/^\/?xl\//, "").replace(/^\//, "")}` : "xl/worksheets/sheet1.xml";
  const folha = ler(caminho) || ler("xl/worksheets/sheet1.xml");
  if (!folha) throw new Error("Não encontrei a aba da planilha dentro do arquivo.");
  // Comentários de célula (notas do Excel/Google): viram observação na importação.
  const pasta = caminho.slice(0, caminho.lastIndexOf("/") + 1), arqFolha = caminho.slice(caminho.lastIndexOf("/") + 1);
  const relsFolha = ler(`${pasta}_rels/${arqFolha}.rels`);
  const alvoCom = (relsFolha.match(/Target="([^"]*comments\d*\.xml)"/) || [])[1];
  const comentarios = {};
  if (alvoCom) {
    const cam = alvoCom.startsWith("/") ? alvoCom.slice(1) : new URL(alvoCom, `http://x/${pasta}`).pathname.slice(1);
    for (const m of ler(cam).matchAll(/<comment\b[^>]*\bref="[A-Z]+(\d+)"[^>]*>([\s\S]*?)<\/comment>/g)) {
      let t = textos(m[2]);
      if (t.includes("Comment:")) t = t.slice(t.indexOf("Comment:") + 8);
      t = t.replace(/Reply:/g, "·").replace(/\s+/g, " ").trim();
      if (t) comentarios[m[1]] = comentarios[m[1]] ? `${comentarios[m[1]]} · ${t}` : t;
    }
  }
  const linhas = [];
  for (const m of folha.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const valores = [];
    for (const c of m[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], corpo = c[2] || "";
      const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      if (!ref) continue;
      const tipo = (attrs.match(/\bt="([^"]+)"/) || [])[1];
      const v = (corpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let valor = null;
      if (tipo === "s") valor = compartilhadas[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = textos(corpo);
      else if (tipo === "str" || tipo === "e") valor = v == null ? "" : desescapar(v);
      else if (tipo === "b") valor = v === "1" ? "TRUE" : "FALSE";
      else if (v != null && v !== "") valor = Number(v);
      valores[colunaDe(ref)] = valor;
    }
    linhas.push({ linha: Number(m[1]), valores, comentario: comentarios[m[1]] || "" });
  }
  return linhas;
}

/* ------------------------------------------------------------- normalização */
const texto = (v) => (v == null ? "" : String(typeof v === "number" && Number.isInteger(v) ? v : v).replace(/\s+/g, " ").trim());

export function lista(v, mapa = {}) {
  const t = texto(v).toUpperCase();
  if (!t || ["NA", "N/A", "-"].includes(t)) return [];
  const saida = [];
  for (let p of t.split(/\s*(?:,|\/|;|\+|\bE\b)\s*/)) {
    p = p.replace(/^[ .]+|[ .]+$/g, "");
    if (!p) continue;
    const chave = semAcento(p);
    p = mapa[chave] || NOMES[chave] || p;
    if (!saida.includes(p)) saida.push(p);
  }
  return saida;
}

export function simNao(v) {
  const t = semAcento(texto(v).toUpperCase());
  if (["SIM", "SM", "S"].includes(t)) return true;
  if (["NAO", "N"].includes(t)) return false;
  return null;
}

const montar = (a, m, d, h = 0, mi = 0) => {
  const dt = new Date(Date.UTC(a, m - 1, d, h, mi));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return `${a}-${dois(m)}-${dois(d)}T${dois(h)}:${dois(mi)}`;
};
const anoOk = (iso) => { const a = Number(iso.slice(0, 4)); return a >= ANO_MIN && a <= ANO_MAX; };

// Número de série do Excel (dias desde 30/12/1899) → "AAAA-MM-DDTHH:MM", hora arredondada ao minuto.
function deSerie(n) {
  const ms = Math.round((n * 86400) / 60) * 60000;
  const d = new Date(Date.UTC(1899, 11, 30) + ms);
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}T${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
}

/** Valor de célula de data → "AAAA-MM-DDTHH:MM" ou "" (ilegível vira pendência com o original). */
export function lerData(v, campo, pend) {
  if (v == null || texto(v) === "") return "";
  if (typeof v === "number") {
    if (Number.isInteger(v) && /^\d{8}(\d{4})?$/.test(String(v))) return lerData(String(v), campo, pend); // 26082026 · 260320261545
    if (v > 0 && v < 1) { pend.push(`${campo}: só hora, sem data`); return ""; }
    if (v > 20000 && v < 2958466) {
      const iso = deSerie(v);
      if (anoOk(iso)) return iso;
      pend.push(`${campo}: ano ${iso.slice(0, 4)} fora do esperado (${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)})`);
      return "";
    }
    pend.push(`${campo}: “${texto(v)}” não pôde ser lido`);
    return "";
  }
  const t = texto(v);
  let s = t.replace(/;/g, ":").replace(/!/g, "1").replace(/-/g, "/");
  s = s.replace(/^(\d{2})(\d{2})(\d{4})/, "$1/$2/$3"); // 26032026 15:00
  if (/^\d{1,2}:\d{2}\/\d{4}/.test(s)) s = s.replace(":", "/"); // 10:07/2026
  s = s.replace(/^(\d{1,2})\/(\d{2}):?(\d{4})/, "$1/$2/$3"); // 28/05;2026 · 05/052026
  s = s.replace(/^(\d{2})(\d{2})\/(\d{4})/, "$1/$2/$3"); // 1205/2026
  s = s.replace(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*/, "$1/$2/"); // 31/ 08 / 2026
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*:?\s*(?:(\d{1,2})\s*:?\s*(\d{2}))?/);
  if (m) {
    const iso = montar(Number(m[3]), Number(m[2]), Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
    if (iso && anoOk(iso)) return iso;
  }
  pend.push(`${campo}: “${t}” não pôde ser lido`);
  return "";
}

/** Linhas cruas da planilha → registros de lab_entradas. Pula cabeçalho (linhas 1–2) e linhas vazias. */
export function converterPlanilha(linhas, { arquivo = "planilha.xlsx" } = {}) {
  const regs = [];
  for (const { linha, valores, comentario = "" } of linhas) {
    if (linha < 3) continue;
    const r = Array.from({ length: 17 }, (_, i) => {
      const v = valores[i];
      return COLS_DATA.has(i) || i === 14 ? v ?? null : v == null ? null : texto(v);
    });
    if (!r.some((v) => texto(v))) continue;
    const pend = [];
    const os = texto(r[0]);
    const amostras = texto(r[1]);
    let obs = texto(r[10]);
    if (["NA", "N/A"].includes(obs.toUpperCase())) obs = "";
    const cancelada = texto(r[15]).toUpperCase().includes("CANCEL") || /\bcancelad/i.test(obs);
    let lib15 = r[15];
    if (typeof lib15 === "string" && !/\d/.test(lib15)) {
      if (texto(lib15).toUpperCase() !== "CANCELADA") obs = obs ? `${obs} · ${texto(lib15)}` : texto(lib15);
      lib15 = null;
    }
    if (comentario) obs = obs ? `${obs} · Comentário na planilha: ${comentario}` : `Comentário na planilha: ${comentario}`;
    const libNum = typeof r[14] === "number";
    let liberadoEm = lerData(lib15, "Data de liberação", pend);
    if (libNum && !liberadoEm) liberadoEm = lerData(r[14], "Data de liberação", pend);
    let fq = r[13];
    let finalizado = simNao(r[11]);
    if (texto(fq).toUpperCase() === "SIM") { finalizado = true; fq = null; }
    const reg = {
      id: `labent-imp-${String(linha).padStart(5, "0")}`,
      os, amostras, qtdAmostras: contarAmostras(amostras),
      recebidoEm: lerData(r[2], "Data de recebimento", pend),
      recebidoPor: lista(r[3]),
      tipos: lista(r[4], TIPOS),
      parametroImediato: simNao(r[5]),
      origem: lista(r[6]),
      retiradoPor: lista(r[7]),
      retiradaLabEm: lerData(r[8], "Retirada laboratório", pend),
      retiradaComercialEm: lerData(r[9], "Retirada comercial", pend),
      observacao: obs,
      finalizadoLab: finalizado,
      finalizadoMbEm: lerData(r[12], "Finalização MB", pend),
      finalizadoFqEm: lerData(fq, "Finalização FQ", pend),
      liberadoCliente: libNum ? true : simNao(r[14]),
      liberadoEm,
      descartado: semAcento(texto(r[16]).toLowerCase()).startsWith("desc"),
      descartadoEm: "",
      cancelada,
      pendencias: pend,
      importacao: { planilha: arquivo, linha },
    };
    if (!os) pend.push("OS em branco na planilha");
    if (!reg.recebidoEm && !pend.some((p) => p.startsWith("Data de recebimento"))) pend.push("Data de recebimento em branco");
    if (reg.recebidoEm && reg.liberadoEm && reg.liberadoEm.slice(0, 10) < reg.recebidoEm.slice(0, 10)) pend.push("Data de liberação anterior ao recebimento");
    regs.push(reg);
  }
  return regs;
}
