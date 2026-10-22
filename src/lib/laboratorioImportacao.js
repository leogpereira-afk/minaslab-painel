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
import { contarAmostras, casarPessoa } from "./laboratorioEntradas.js";

const ANO_MIN = 2024, ANO_MAX = 2027;
const TIPOS = { AGUA: "ÁGUA", ALIMENTO: "ALIMENTO", EFLUENTE: "EFLUENTE", SOLO: "SOLO", AR: "AR", CQ: "CQ", "CONTROLE DE QUALIDADE": "CQ" };
const NOMES = { "ANA CLAUDIA": "ANA CLÁUDIA", THAYNA: "THAYNÁ", VITORIA: "VICTORIA" };

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

/* ------------------------------------------------------------- colunas
   A planilha nova pode vir com colunas em outra ordem: cada coluna é achada
   pelo TÍTULO. Coluna sem título conhecido não se perde: vai para "extras".
   E toda célula preenchida fica guardada como estava em "original". */
const CAMPOS_TITULO = [
  ["recebidoPor", /RESPONSAVEL PELO RECEB|RECEBIDO POR|QUEM RECEBEU/],
  ["retiradoPor", /RESPONSAVEL PELA RETIRADA|RETIRADO POR|QUEM RETIROU/],
  ["retiradaComercialEm", /COMERCIAL/],
  ["retiradaLabEm", /RETIRADA.*LAB/],
  ["finalizadoMbEm", /FINALIZA.*\bMB\b|\bMB\b.*FINALIZA|MICROBIO/],
  ["finalizadoFqEm", /FINALIZA.*\bFQ\b|\bFQ\b.*FINALIZA|FISICO/],
  ["finalizadoLab", /FINALIZADO/],
  ["liberadoEm", /DATA.*LIBERA/],
  ["liberadoCliente", /L[IE]B[ER]*RADO|LIBERAD/],
  ["descartado", /DESCART/],
  ["recebidoEm", /DATA.*RECEB/],
  ["imediato", /IMEDIATO/],
  ["origem", /INTERNO|PROVEDOR/],
  ["tipos", /TIPO/],
  ["observacao", /OB[SE]/],
  ["amostras", /AMOSTRA/],
  ["os", /^(N[ºO°.]?\s*(DA\s*)?)?O\.?\s*S\.?$|ORDEM DE SERV|^\s*OS\b/],
];
const POSICAO_PADRAO = ["os", "amostras", "recebidoEm", "recebidoPor", "tipos", "imediato", "origem", "retiradoPor", "retiradaLabEm",
  "retiradaComercialEm", "observacao", "finalizadoLab", "finalizadoMbEm", "finalizadoFqEm", "liberadoCliente", "liberadoEm", "descartado"];
const CAMPOS_DATA_IMP = new Set(["recebidoEm", "retiradaLabEm", "retiradaComercialEm", "finalizadoMbEm", "finalizadoFqEm", "liberadoEm"]);

// Acha a linha de títulos (entre as 10 primeiras) e diz qual campo é cada coluna.
export function mapearColunas(linhas) {
  let melhor = null;
  for (const { linha, valores } of linhas.slice(0, 10)) {
    const mapa = {}, titulos = {};
    let achou = 0;
    valores.forEach((v, col) => {
      if (typeof v !== "string" || !v.trim()) return;
      const t = semAcento(v).toUpperCase().replace(/\s+/g, " ").trim();
      titulos[col] = v.trim();
      const campo = CAMPOS_TITULO.find(([c, re]) => re.test(t) && !Object.values(mapa).includes(c))?.[0];
      if (campo) { mapa[col] = campo; achou += 1; }
    });
    if (achou >= 4 && (!melhor || achou > melhor.achou)) melhor = { linha, mapa, titulos, achou };
  }
  if (!melhor) {
    // Sem títulos reconhecíveis: ordem da planilha original (A = OS … Q = descarte), dados a partir da linha 3.
    return { linhaTitulo: 2, mapa: Object.fromEntries(POSICAO_PADRAO.map((c, i) => [i, c])), titulos: {} };
  }
  // Planilha antiga: a coluna A (OS) vem com título "lixo". Se OS não foi achada e a coluna antes de "amostras" está livre, é ela.
  if (!Object.values(melhor.mapa).includes("os")) {
    const colAm = Number(Object.keys(melhor.mapa).find((k) => melhor.mapa[k] === "amostras"));
    if (Number.isFinite(colAm) && colAm > 0 && !melhor.mapa[colAm - 1]) melhor.mapa[colAm - 1] = "os";
  }
  return { linhaTitulo: melhor.linha, mapa: melhor.mapa, titulos: melhor.titulos };
}

const letra = (i) => { let s = ""; let n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; };
// Texto do jeito que a pessoa via na planilha (número de série de data vira dd/mm/aaaa hh:mm).
function comoNaPlanilha(v, ehData) {
  if (v == null) return "";
  if (typeof v === "number" && ehData && v > 20000 && v < 2958466) {
    const iso = deSerie(v);
    const h = iso.slice(11, 16);
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}${h !== "00:00" ? ` ${h}` : ""}`;
  }
  return texto(v);
}

/** Linhas cruas da planilha → registros de lab_entradas.
 *  contas: [{usuario, nome}] do sistema — nomes da planilha viram o nome da conta; sem conta, fica o nome da planilha. */
export function converterPlanilha(linhas, { arquivo = "planilha.xlsx", contas = [] } = {}) {
  const { linhaTitulo, mapa, titulos } = mapearColunas(linhas);
  const pessoas = (v) => lista(v).map((n) => casarPessoa(n, contas)?.nome || n).filter((n, i, a) => a.indexOf(n) === i);
  const regs = [];
  for (const { linha, valores, comentario = "" } of linhas) {
    if (linha <= linhaTitulo) continue;
    const c = {}; // campo → valor cru
    const original = {}, extras = {};
    valores.forEach((v, col) => {
      if (v == null || texto(v) === "") return;
      const campo = mapa[col];
      const titulo = titulos[col] || (campo === "os" ? "OS" : `Coluna ${letra(col)}`);
      original[titulo] = comoNaPlanilha(v, campo ? CAMPOS_DATA_IMP.has(campo) || campo === "liberadoCliente" : typeof v === "number" && v > 20000);
      if (campo) c[campo] = v; else extras[titulo] = original[titulo];
    });
    if (!Object.keys(original).length) continue;
    const pend = [];
    const os = texto(c.os);
    const amostras = texto(c.amostras);
    let obs = texto(c.observacao);
    if (["NA", "N/A", "-"].includes(obs.toUpperCase())) obs = "";
    const cancelada = texto(c.liberadoEm).toUpperCase().includes("CANCEL") || /\bcancelad/i.test(obs);
    let lib = c.liberadoEm;
    if (typeof lib === "string" && !/\d/.test(lib)) {
      if (texto(lib).toUpperCase() !== "CANCELADA") obs = obs ? `${obs} · ${texto(lib)}` : texto(lib);
      lib = null;
    }
    if (comentario) obs = obs ? `${obs} · Comentário na planilha: ${comentario}` : `Comentário na planilha: ${comentario}`;
    const libNum = typeof c.liberadoCliente === "number";
    let liberadoEm = lerData(lib, "Data de liberação", pend);
    if (libNum && !liberadoEm) liberadoEm = lerData(c.liberadoCliente, "Data de liberação", pend);
    let fq = c.finalizadoFqEm;
    let finalizado = simNao(c.finalizadoLab);
    if (texto(fq).toUpperCase() === "SIM") { finalizado = true; fq = null; }
    const libTxt = semAcento(texto(c.liberadoCliente).toLowerCase());
    const reg = {
      id: `labent-imp-${String(linha).padStart(5, "0")}`,
      os, amostras, qtdAmostras: contarAmostras(amostras),
      recebidoEm: lerData(c.recebidoEm, "Data de recebimento", pend),
      recebidoPor: pessoas(c.recebidoPor),
      tipos: lista(c.tipos, TIPOS),
      parametroImediato: simNao(c.imediato),
      origem: lista(c.origem),
      retiradoPor: pessoas(c.retiradoPor),
      retiradaLabEm: lerData(c.retiradaLabEm, "Retirada laboratório", pend),
      retiradaComercialEm: lerData(c.retiradaComercialEm, "Retirada comercial", pend),
      observacao: obs,
      finalizadoLab: finalizado,
      finalizadoMbEm: lerData(c.finalizadoMbEm, "Finalização MB", pend),
      finalizadoFqEm: lerData(fq, "Finalização FQ", pend),
      liberadoCliente: libNum || libTxt.startsWith("desc") ? true : simNao(c.liberadoCliente),
      liberadoEm,
      descartado: semAcento(texto(c.descartado).toLowerCase()).startsWith("desc") || simNao(c.descartado) === true,
      descartadoEm: "",
      cancelada,
      pendencias: pend,
      importacao: { planilha: arquivo, linha, original, ...(Object.keys(extras).length ? { extras } : {}) },
    };
    if (!os) pend.push("OS em branco na planilha");
    if (!reg.recebidoEm && !pend.some((p) => p.startsWith("Data de recebimento"))) pend.push("Data de recebimento em branco");
    if (reg.recebidoEm && reg.liberadoEm && reg.liberadoEm.slice(0, 10) < reg.recebidoEm.slice(0, 10)) pend.push("Data de liberação anterior ao recebimento");
    regs.push(reg);
  }
  return regs;
}
