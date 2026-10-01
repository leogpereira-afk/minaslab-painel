// Relatórios da Gestão de Estoque — regras do sistema antigo (Apps Script) em funções puras, para testar.
// Legado: visualizarEstoqueCritico, "Produtos Vencidos" (prepararHTMLImpressao) e exportação da planilha.
import { zipSync, strToU8 } from "fflate";

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const txt = (v) => (v == null ? "" : String(v));

// Hoje no fuso do Brasil (AAAA-MM-DD).
export function hojeBR(agora = new Date()) {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Mesmos textos da coluna "Status validade" da planilha antiga.
export function statusValidade(validade, hoje = hojeBR()) {
  const v = txt(validade).trim();
  if (!v) return "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(v)) return "Erro verificar";
  const dias = Math.round((Date.parse(v.slice(0, 10) + "T00:00:00Z") - Date.parse(hoje + "T00:00:00Z")) / 86400000);
  return dias < 0 ? "Vencido" : dias < 30 ? "Vencimento em 30 dias" : "Dentro do prazo";
}

const saldoDe = (l) => num(l.totalAtual ?? l.qtdAtual);
const venceu = (l, hoje) => statusValidade(l.validade, hoje) === "Vencido";

// "Estoque crítico / Compras necessárias": CONSOLIDADO POR PRODUTO (como no legado).
// Disponível = soma dos saldos sem os lotes vencidos; o mínimo é o do primeiro lote do produto;
// entra na lista quando disponível <= mínimo. Mostra quanto falta e quanto saldo vencido foi ignorado.
export function estoqueCriticoPorProduto(lotes, hoje = hojeBR()) {
  const resumo = new Map();
  const ordenados = [...lotes].sort((a, b) => txt(a.codigoID || a.id).localeCompare(txt(b.codigoID || b.id), "pt-BR", { numeric: true }));
  for (const l of ordenados) {
    const nome = txt(l.produto).trim().toUpperCase();
    if (!nome) continue;
    const vencido = venceu(l, hoje), saldo = saldoDe(l);
    const disp = vencido ? 0 : saldo;
    const r = resumo.get(nome);
    if (!r) resumo.set(nome, { produto: nome, minimo: num(l.qtdMinima), unidade: txt(l.unidade), observacao: txt(l.observacao) || "-", disponivel: disp, vencidosIgnorados: vencido ? saldo : 0 });
    else { r.disponivel += disp; if (vencido) r.vencidosIgnorados += saldo; }
  }
  return [...resumo.values()]
    .filter((r) => r.disponivel <= r.minimo)
    .map((r) => ({ ...r, falta: Math.max(0, r.minimo - r.disponivel) }))
    .sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR"));
}

// "Produtos Vencidos": todos os lotes com status Vencido (como no legado, mesmo com saldo zerado).
export function lotesVencidos(lotes, hoje = hojeBR()) {
  return lotes.filter((l) => venceu(l, hoje));
}

export const COLUNAS_LOTE = [
  ["codigoID", "ID Sistema"], ["dataChegada", "Data de chegada"], ["notaFiscal", "Nota fiscal"], ["valorNF", "Valor NF"],
  ["fornecedor", "Fornecedor"], ["cnpj", "CNPJ"], ["grupo", "Grupo"], ["produto", "Produto"], ["referencia", "Especificação"],
  ["lote", "Lote"], ["unidade", "Unidade"], ["validade", "Validade"], ["conteudoKit", "Conteúdo do kit"], ["qtdKit", "Qtd. kits"],
  ["totalRecebido", "Qtd. total"], ["responsavel", "Responsável"], ["qtdMinima", "Qtd. mínima"], ["qtdRetirada", "Qtd. retirada"],
  ["totalAtual", "Saldo atual"], ["statusValidade", "Status validade"], ["observacao", "Observação"],
];
export const COLUNAS_MOVIMENTO = [
  ["codigoID", "ID lote"], ["criadoEm", "Data/hora"], ["produto", "Produto"], ["lote", "Lote"], ["tipo", "Tipo"], ["acao", "Ação"],
  ["quantidade", "Quantidade"], ["unidade", "Unidade"], ["responsavel", "Responsável"], ["atualizadoPor", "Registrado por"], ["observacao", "Observação"],
];
export const COLUNAS_PRODUTO = [["id", "ID"], ["produto", "Produto"], ["grupo", "Grupo"], ["especificacao", "Especificação"], ["unidade", "Unidade"], ["conteudoKit", "Conteúdo do kit"], ["qtdMinima", "Qtd. mínima"], ["fornecedor", "Fornecedor"], ["setor", "Setor"], ["statusQuantidade", "Status"]];
export const COLUNAS_FORNECEDOR = [["id", "ID"], ["nome", "Nome"], ["cnpj", "CNPJ"], ["tipoFornecedor", "Tipo"], ["status", "Status"], ["telefone", "Telefone"], ["email", "E-mail"], ["endereco", "Endereço"], ["responsavel", "Contato"]];
export const COLUNAS_PEDIDO = [["pedidoCodigo", "Pedido"], ["id", "Item"], ["dataPedido", "Data"], ["fornecedor", "Fornecedor"], ["produto", "Produto"], ["especificacao", "Especificação"], ["conteudoKit", "Conteúdo do kit"], ["quantidadeKits", "Qtd. kits"], ["valor", "Valor"], ["status", "Status"], ["observacao", "Observação"]];
export const COLUNAS_INSPECAO = [["idIr", "IR"], ["idPedido", "Pedido"], ["dataRecebimento", "Recebimento"], ["produto", "Produto"], ["fabricante", "Fabricante"], ["lote", "Lote"], ["validade", "Validade"], ["notaFinal", "Nota"], ["statusQualidade", "Parecer"], ["operador", "Operador"], ["observacoes", "Observações"]];

const valorCelula = (r, k) => (k === "codigoID" ? (r.codigoID ?? r.codigoAuto ?? r.id) : k === "pedidoCodigo" ? (r.pedidoCodigo ?? r.idPedido) : k === "idIr" ? (r.idIr ?? r.idIrOrigem) : r[k]);

// Linhas prontas (cabeçalho legível + dados) para tabela/CSV/Excel.
export function tabela(colunas, registros) {
  return [colunas.map(([, rotulo]) => rotulo), ...registros.map((r) => colunas.map(([k]) => valorCelula(r, k) ?? ""))];
}

// ---- Excel (.xlsx) sem biblioteca de planilha: pacote OOXML mínimo zipado com fflate ----
const semControle = (t) => [...t].filter((c) => { const k = c.charCodeAt(0); return k >= 32 || k === 9 || k === 10 || k === 13; }).join("");
const xml = (s) => semControle(txt(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const coluna = (i) => { let s = "", n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const nomeAba = (nome, usados) => {
  let base = txt(nome).replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Planilha", n = base, i = 2;
  while (usados.has(n.toLowerCase())) n = base.slice(0, 28) + " " + i++;
  usados.add(n.toLowerCase());
  return n;
};
function folha(linhas) {
  const largura = linhas[0] ? linhas[0].map((_, c) => Math.min(60, Math.max(10, ...linhas.slice(0, 200).map((l) => txt(l[c]).length + 2)))) : [];
  const cols = largura.length ? `<cols>${largura.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const dados = linhas.map((l, r) => `<row r="${r + 1}">${l.map((v, c) => {
    const ref = coluna(c) + (r + 1);
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    const t = txt(v);
    return t === "" ? "" : `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xml(t)}</t></is></c>`;
  }).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${dados}</sheetData></worksheet>`;
}
// abas: [{ nome, linhas: [[...cabeçalho], [...dados]] }] → Uint8Array do arquivo .xlsx
export function gerarXlsx(abas) {
  const usados = new Set(), lista = abas.map((a) => ({ nome: nomeAba(a.nome, usados), linhas: a.linhas }));
  const arquivos = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${lista.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${lista.map((a, i) => `<sheet name="${xml(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${lista.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${lista.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
  };
  lista.forEach((a, i) => { arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(folha(a.linhas)); });
  return zipSync(arquivos);
}

// CSV (UTF-8 com BOM, separador ;) a partir de linhas já legíveis.
export function gerarCsv(linhas) {
  const esc = (v) => '"' + txt(v).replaceAll('"', '""') + '"';
  return "﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n");
}
