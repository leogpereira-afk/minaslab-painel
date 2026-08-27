// Escritor de .xlsx SEM dependencia nenhuma. Um .xlsx e um ZIP de XML: aqui
// montamos os XMLs a mao e o ZIP byte a byte. O molde e o leitor xlsx-lite do
// RH da Impresilk, lido de tras para frente (la o ZIP e desmontado, aqui e
// montado).
//
// Por que .xlsx e nao CSV: dinheiro em CSV chega como TEXTO no Excel
// brasileiro (o separador decimal briga com o do arquivo) e coluna de texto
// nao soma. Somar e a primeira coisa que se faz com a planilha baixada.
//
// As entradas do ZIP vao "stored" (metodo 0, sem compressao). Relatorio de
// tela tem dezenas de linhas, nao milhares — comprimir custaria escrever um
// deflate a mao para economizar alguns KB.

import { dataLonga, ymdLocal } from "./format.js";

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// O XML 1.0 nao aceita caracteres de controle. Um deles, vindo de um campo
// colado de PDF, mata o arquivo inteiro do mesmo jeito que um "&" solto. A
// peneira e por CODIGO do caractere, nao por expressao regular: byte de
// controle escrito literal no fonte e invisivel e some no primeiro editor.
function tirarControle(s) {
  let saida = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp >= 32 || cp === 9 || cp === 10 || cp === 13) saida += ch;
  }
  return saida;
}

// Tira os acentos que a decomposicao NFD deixou soltos (U+0300 a U+036F).
function tirarAcentos(s) {
  let saida = "";
  for (const ch of s.normalize("NFD")) {
    const cp = ch.codePointAt(0);
    if (cp < 0x300 || cp > 0x36f) saida += ch;
  }
  return saida;
}

// Um "&" no nome de um orgao corrompe o arquivo INTEIRO — o Excel recusa
// abrir, sem dizer onde. Escapar nao e capricho, e o que faz o arquivo existir.
function escaparXml(v) {
  return tirarControle(String(v))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function letraColuna(i) {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// Ausente e ausente: null, undefined e string so com espaco nao viram celula.
// Zero NUMERICO passa: zero registrado e um dado, e sumiria se fosse
// confundido com falta.
function semRegistro(v) {
  if (v === null || v === undefined) return true;
  return typeof v === "string" && v.trim() === "";
}

// "AAAA-MM-DD" vira "dd/mm/aaaa" como TEXTO. Data em xlsx e um numero de
// serie contado a partir de 1900, com a pegadinha do ano bissexto falso;
// texto legivel nunca vira dia errado.
function textoDeData(v) {
  const legivel = dataLonga(String(v));
  return /^\d{2}\/\d{2}\/\d{4}$/.test(legivel) ? legivel : String(v);
}

function celulaTexto(ref, texto, estilo) {
  const s = estilo ? ` s="${estilo}"` : "";
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escaparXml(texto)}</t></is></c>`;
}

function celula(ref, valor, tipo) {
  // Celula sem dado fica VAZIA. Nunca 0: num relatorio de dinheiro, "R$ 0"
  // afirma que a proposta valia zero, e o que houve foi ninguem ter informado.
  if (semRegistro(valor)) return `<c r="${ref}"/>`;

  if (tipo === "dinheiro" || tipo === "numero") {
    const n = typeof valor === "number" ? valor : Number(valor);
    if (Number.isFinite(n)) {
      const s = tipo === "dinheiro" ? ' s="2"' : "";
      return `<c r="${ref}"${s}><v>${n}</v></c>`;
    }
    // Veio sujeira num campo de numero: vai como texto para a pessoa VER o
    // que esta gravado, em vez de o valor sumir da planilha.
    return celulaTexto(ref, valor);
  }

  if (tipo === "data") return celulaTexto(ref, textoDeData(valor));
  return celulaTexto(ref, valor);
}

// Largura estimada pelo maior conteudo — sem isso toda coluna de dinheiro
// nasce mostrando "####" e a pessoa acha que a planilha veio quebrada.
function larguraColuna(col, linhas) {
  let maior = String(col.rotulo ?? "").length;
  for (const l of linhas) {
    const v = l[col.chave];
    if (semRegistro(v)) continue;
    // Dinheiro ganha folga: o dado 1234.5 aparece como "R$ 1.234,50".
    const tam =
      col.tipo === "data" ? 10 : String(v).length + (col.tipo === "dinheiro" ? 5 : 0);
    if (tam > maior) maior = tam;
  }
  return Math.min(48, Math.max(10, maior + 2));
}

// Nome de aba do Excel: no maximo 31 caracteres e sem : \ / ? * [ ].
function nomeAba(titulo) {
  const limpo = String(titulo || "Dados")
    .replace(/[:\\/?*[\]]/g, " ")
    .trim()
    .slice(0, 31)
    .trim();
  return limpo || "Dados";
}

function folha({ colunas, linhas, titulo }) {
  const ultima = letraColuna(colunas.length - 1);
  const linhaCab = titulo ? 2 : 1;
  const ultimaLinha = linhaCab + linhas.length;

  const partes = [];
  if (titulo) partes.push(`<row r="1">${celulaTexto("A1", titulo, 1)}</row>`);
  partes.push(
    `<row r="${linhaCab}">${colunas
      .map((c, i) => celulaTexto(`${letraColuna(i)}${linhaCab}`, c.rotulo ?? c.chave, 1))
      .join("")}</row>`
  );
  linhas.forEach((l, n) => {
    const r = linhaCab + 1 + n;
    partes.push(
      `<row r="${r}">${colunas
        .map((c, i) => celula(`${letraColuna(i)}${r}`, l[c.chave], c.tipo))
        .join("")}</row>`
    );
  });

  const cols = colunas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${larguraColuna(c, linhas)}" customWidth="1"/>`)
    .join("");

  // Cabecalho congelado e autofiltro: quem baixa a planilha vai ordenar e
  // filtrar antes de qualquer outra coisa.
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="A1:${ultima}${ultimaLinha}"/>` +
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="${linhaCab}" topLeftCell="A${linhaCab + 1}" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${partes.join("")}</sheetData>` +
    `<autoFilter ref="A${linhaCab}:${ultima}${ultimaLinha}"/>` +
    `</worksheet>`
  );
}

// s="0" normal, s="1" cabecalho em negrito, s="2" dinheiro em reais.
const ESTILOS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="${TIPO_XLSX}.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const RELS_RAIZ =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const RELS_PASTA =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

const pasta = (aba) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
  `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  `<sheets><sheet name="${escaparXml(aba)}" sheetId="1" r:id="rId1"/></sheets>` +
  `</workbook>`;

// ---- ZIP a mao -------------------------------------------------------------

let TABELA_CRC = null;
function tabelaCrc() {
  if (TABELA_CRC) return TABELA_CRC;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  TABELA_CRC = t;
  return t;
}

// CRC-32 de verdade: entrada com CRC errado o Excel recusa como "arquivo
// danificado", sem dizer qual parte.
function crc32(bytes) {
  const t = tabelaCrc();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Data/hora no formato DOS (dois uint16) que o cabecalho do ZIP exige.
function carimboDos(d) {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    data: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function zipar(arquivos) {
  const { hora, data } = carimboDos(new Date());
  const codificador = new TextEncoder();
  const blocos = [];
  const central = [];
  let posicao = 0;

  for (const a of arquivos) {
    const nome = codificador.encode(a.nome);
    const dados = codificador.encode(a.texto);
    const crc = crc32(dados);

    const local = new Uint8Array(30 + nome.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // nome do arquivo em UTF-8
    lv.setUint16(8, 0, true); // stored, sem compressao
    lv.setUint16(10, hora, true);
    lv.setUint16(12, data, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dados.length, true);
    lv.setUint32(22, dados.length, true);
    lv.setUint16(26, nome.length, true);
    local.set(nome, 30);

    const dir = new Uint8Array(46 + nome.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, hora, true);
    dv.setUint16(14, data, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, dados.length, true);
    dv.setUint32(24, dados.length, true);
    dv.setUint16(28, nome.length, true);
    dv.setUint32(42, posicao, true);
    dir.set(nome, 46);

    blocos.push(local, dados);
    central.push(dir);
    posicao += local.length + dados.length;
  }

  const inicioCentral = posicao;
  const tamanhoCentral = central.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22);
  const fv = new DataView(fim.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, arquivos.length, true);
  fv.setUint16(10, arquivos.length, true);
  fv.setUint32(12, tamanhoCentral, true);
  fv.setUint32(16, inicioCentral, true);

  const todos = [...blocos, ...central, fim];
  const saida = new Uint8Array(todos.reduce((s, b) => s + b.length, 0));
  let off = 0;
  for (const b of todos) {
    saida.set(b, off);
    off += b.length;
  }
  return saida;
}

// ---- porta de entrada ------------------------------------------------------

// Devolve os bytes do .xlsx. Sem nenhuma API de navegador — e por aqui que o
// teste entra.
export function planilhaBytes({ colunas, linhas, titulo }) {
  const cols = Array.isArray(colunas) ? colunas : [];
  const dados = Array.isArray(linhas) ? linhas : [];
  if (cols.length === 0) throw new Error("Planilha sem colunas: nada a escrever.");
  return zipar([
    { nome: "[Content_Types].xml", texto: CONTENT_TYPES },
    { nome: "_rels/.rels", texto: RELS_RAIZ },
    { nome: "xl/workbook.xml", texto: pasta(nomeAba(titulo)) },
    { nome: "xl/_rels/workbook.xml.rels", texto: RELS_PASTA },
    { nome: "xl/styles.xml", texto: ESTILOS },
    { nome: "xl/worksheets/sheet1.xml", texto: folha({ colunas: cols, linhas: dados, titulo }) },
  ]);
}

// Nome do arquivo: "<nome>-AAAA-MM-DD.xlsx" com o dia LOCAL. toISOString aqui
// devolveria o dia de AMANHA depois das 21h no Brasil, e a pessoa acabaria com
// dois arquivos do mesmo dia carimbados com dias diferentes.
export function nomeArquivo(nome) {
  const base = tirarAcentos(String(nome || "planilha"))
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${base || "planilha"}-${ymdLocal(new Date())}.xlsx`;
}

// Monta o .xlsx e dispara o download. Devolve o nome do arquivo gerado, para
// quem quiser dizer no aviso o que foi baixado.
export function baixarPlanilha({ nome, colunas, linhas, titulo }) {
  const bytes = planilhaBytes({ colunas, linhas, titulo });
  const arquivo = nomeArquivo(nome);
  const url = URL.createObjectURL(new Blob([bytes], { type: TIPO_XLSX }));
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revogar no mesmo tique cancela o download no Safari: o navegador ainda nao
  // leu o blob quando a URL some.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return arquivo;
}
