// Visualizar anexo do E-mail antes de baixar: decide como mostrar cada tipo e lê, sem
// biblioteca nova, o conteúdo de planilhas (.xlsx) e documentos do Word (.docx) — os dois
// são um .zip com XML dentro (fflate já está no projeto).
import { unzipSync, strFromU8 } from "fflate";

const EXT = (nome) => (String(nome || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";

// "pdf" | "imagem" | "texto" | "planilha" | "documento" | null (sem visualização)
export function tipoPrevia(nome, mime = "") {
  const e = EXT(nome), t = String(mime).toLowerCase();
  if (e === "pdf" || t === "application/pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(e) || /^image\/(png|jpe?g|gif|webp|bmp|svg)/.test(t)) return "imagem";
  if (["txt", "csv", "xml", "json", "log", "md", "ofx", "ret", "rem"].includes(e) || /^text\//.test(t) || /(json|xml)$/.test(t)) return "texto";
  if (e === "xlsx" || e === "xlsm" || t.includes("spreadsheetml")) return "planilha";
  if (e === "docx" || t.includes("wordprocessingml")) return "documento";
  return null;
}

// Tipo certo para o navegador mostrar (o servidor às vezes manda application/octet-stream).
export function mimeDaPrevia(nome, mime) {
  const e = EXT(nome);
  if (e === "pdf") return "application/pdf";
  if (e === "svg") return "image/svg+xml";
  if (["png", "gif", "webp", "bmp"].includes(e)) return `image/${e}`;
  if (["jpg", "jpeg"].includes(e)) return "image/jpeg";
  return mime || "application/octet-stream";
}

const ent = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const textosT = (xml) => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => ent(m[1])).join("");

// Texto de um arquivo pequeno (decodifica UTF-8; se não for, Latin-1, comum em CSV de banco).
export function textoDe(bytes, max = 400_000) {
  const b = bytes.subarray(0, max);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(b); } catch { return new TextDecoder("latin1").decode(b); }
}

const colNum = (ref) => [...ref.replace(/\d+/g, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

// .xlsx → [{ nome, linhas: [[célula, …], …], cortada }]
export function lerXlsx(bytes, { maxLinhas = 500, maxColunas = 40 } = {}) {
  const z = unzipSync(bytes, { filter: (f) => f.name.startsWith("xl/") && f.name.endsWith(".xml") || f.name.endsWith(".rels") });
  const ler = (n) => (z[n] ? strFromU8(z[n]) : "");
  const compartilhadas = [...ler("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textosT(m[1]));
  const rels = Object.fromEntries([...ler("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map(([r]) => [
    (r.match(/\bId="([^"]+)"/) || [])[1], (r.match(/\bTarget="([^"]+)"/) || [])[1],
  ]));
  const abas = [...ler("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)].map(([s]) => ({
    nome: ent((s.match(/\bname="([^"]*)"/) || [])[1] || "Planilha"),
    alvo: rels[(s.match(/\br:id="([^"]+)"/) || [])[1]] || "",
  }));
  return abas.map(({ nome, alvo }) => {
    const caminho = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, "")}`;
    const xml = ler(caminho);
    const linhas = [];
    let cortada = false;
    for (const [, corpo] of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (linhas.length >= maxLinhas) { cortada = true; break; }
      const linha = [];
      for (const [, attrs, dentro = ""] of corpo.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
        const i = ref ? colNum(ref) : linha.length;
        if (i >= maxColunas) continue;
        const t = (attrs.match(/\bt="([^"]+)"/) || [])[1];
        const v = ent((dentro.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || "");
        let valor = t === "s" ? compartilhadas[+v] ?? "" : t === "inlineStr" ? textosT(dentro) : t === "b" ? (v === "1" ? "VERDADEIRO" : "FALSO") : v;
        if (!t && /^-?\d+\.\d{6,}$/.test(valor)) valor = String(+(+valor).toFixed(6));
        while (linha.length < i) linha.push("");
        linha[i] = valor;
      }
      linhas.push(linha);
    }
    return { nome, linhas, cortada };
  }).filter((a) => a.linhas.length || a.nome);
}

// .docx → parágrafos de texto
export function lerDocx(bytes) {
  const z = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
  const xml = z["word/document.xml"] ? strFromU8(z["word/document.xml"]) : "";
  return [...xml.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)].map(([, p = ""]) =>
    [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>/g)]
      .map((m) => (m[2] ? (m[2] === "tab" ? "\t" : "\n") : ent(m[1]))).join(""));
}
