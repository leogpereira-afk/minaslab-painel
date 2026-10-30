// Conversão do relatório bruto do GerenciaLab ("Relatório com Parâmetros" + planilha de OS)
// para o modelo de importação GERENCIALAB_HISTORICO_ANALITICO. Módulo puro (sem DOM) para
// poder ser reutilizado e testado fora do navegador.

export type SheetData = { sheetName: string; headers: string[]; rows: Array<Record<string, string>> }

export const HISTORICO_ANALITICO_COLUMNS = ['NUMERO_OS', 'CPF_CNPJ', 'CLIENTE', 'NUMERO_CONTRATO', 'DATA_OS', 'VALOR_OS', 'STATUS_OS', 'AMOSTRA', 'GRUPO', 'SERVICO', 'LABORATORIO', 'PARAMETRO', 'METODO', 'UNIDADE', 'LQ', 'LD'] as const

export type RelatorioConversion = {
  headers: string[]
  rows: Array<Record<string, string>>
  reportSheet: string
  osSheet: string | null
  totalSourceRows: number
  canceledRows: number
  canceledOs: number
  testClientRows: number
  rowsWithoutOsMatch: number
  warnings: string[]
}

const TEST_CLIENT_DOCUMENTS = new Set(['20044692000187', '52657257000114', '37243457800'])
const CANCELED_STATUS = new Set(['cancelada', 'processo de cancelamento'])

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  micro: 'µ', mu: 'μ', deg: '°', sup1: '¹', sup2: '²', sup3: '³', plusmn: '±', middot: '·', ordm: 'º', ordf: 'ª',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', times: '×', divide: '÷', permil: '‰',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  agrave: 'à', Agrave: 'À', acirc: 'â', ecirc: 'ê', ocirc: 'ô', Acirc: 'Â', Ecirc: 'Ê', Ocirc: 'Ô',
  atilde: 'ã', otilde: 'õ', Atilde: 'Ã', Otilde: 'Õ', ccedil: 'ç', Ccedil: 'Ç', uuml: 'ü', Uuml: 'Ü',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', sigma: 'σ', Sigma: 'Σ', omega: 'ω', Omega: 'Ω',
}

export function decodeHtmlEntities(value: string) {
  if (!value.includes('&')) return value
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body] ?? match
  })
}

export function normalizeHeaderKey(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Localiza a coluna pelo nome normalizado (igual) ou, se não houver, pelo prefixo normalizado. */
export function findHeader(headers: string[], label: string) {
  const wanted = normalizeHeaderKey(label)
  const keys = headers.map(normalizeHeaderKey)
  const exact = keys.indexOf(wanted)
  if (exact >= 0) return headers[exact]
  const prefixed = keys.findIndex(key => key.startsWith(wanted))
  return prefixed >= 0 ? headers[prefixed] : null
}

const REPORT_REQUIRED = ['Cliente', 'Ordem de serviço', 'Referência', 'Grupo', 'Serviço', 'Data de Entrada', 'Parâmetros', 'Método', 'LQ', 'LD', 'Unidade Medida', 'Laboratório']
const OS_SHEET_REQUIRED = ['Amostra Referência', 'Ordem de Serviço', 'CNPJ/CPF', 'Status Ordem serviço']

function hasAll(sheet: SheetData, labels: string[]) {
  return labels.every(label => findHeader(sheet.headers, label) !== null)
}

export function findRelatorioSheet(sheets: SheetData[]) {
  return sheets.find(sheet => hasAll(sheet, REPORT_REQUIRED)) ?? null
}

export function findOsSheet(sheets: SheetData[]) {
  return sheets.find(sheet => hasAll(sheet, OS_SHEET_REQUIRED)) ?? null
}

export function isGerenciaLabRelatorio(sheets: SheetData[]) {
  return findRelatorioSheet(sheets) !== null
}

function cellText(row: Record<string, string>, header: string | null) {
  if (!header) return ''
  const value = decodeHtmlEntities(String(row[header] ?? '')).trim()
  // Valores de erro de fórmula (ex.: #N/A de PROCV sem correspondência) são tratados como vazio.
  return /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!)$/i.test(value) ? '' : value
}

/** Número vindo do xlsx (ponto decimal) → texto com vírgula decimal. Texto não numérico é mantido. */
export function formatDecimal(value: string) {
  const text = value.trim()
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return text
  const number = Number(text)
  if (!Number.isFinite(number)) return text
  let formatted = String(Number(number.toPrecision(15)))
  if (/e/i.test(formatted)) formatted = number.toFixed(12).replace(/\.?0+$/, '')
  return formatted.replace('.', ',')
}

function pad(value: number) { return String(value).padStart(2, '0') }

/** Data de Entrada: mantém o texto 'dd/mm/aaaa hh:mm'; se vier como número serial do Excel, converte. */
export function formatDataEntrada(value: string) {
  const text = value.trim()
  if (!/^\d+(\.\d+)?$/.test(text)) return text
  const serial = Number(text)
  if (serial < 1 || serial > 2958465) return text
  const date = new Date(Math.round((serial - 25569) * 86400) * 1000)
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

/** 'dd/mm/aaaa hh:mm' → chave ordenável 'aaaammddhhmm' (vazio/inválido ordena por último). */
export function dataOsSortKey(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (!match) return '999999999999'
  const [, day, month, year, hour = '0', minute = '0'] = match
  return `${year}${pad(Number(month))}${pad(Number(day))}${pad(Number(hour))}${pad(Number(minute))}`
}

type OsInfo = { documento: string; status: string; contrato: string; total: string }

export function convertGerenciaLabRelatorio(sheets: SheetData[]): RelatorioConversion | null {
  const report = findRelatorioSheet(sheets)
  if (!report) return null
  const osSheet = findOsSheet(sheets.filter(sheet => sheet !== report))
  const warnings: string[] = []

  const byReferencia = new Map<string, OsInfo>()
  const byOs = new Map<string, OsInfo>()
  if (osSheet) {
    const h = {
      referencia: findHeader(osSheet.headers, 'Amostra Referência'),
      os: findHeader(osSheet.headers, 'Ordem de Serviço'),
      documento: findHeader(osSheet.headers, 'CNPJ/CPF'),
      status: findHeader(osSheet.headers, 'Status Ordem serviço'),
      contrato: findHeader(osSheet.headers, 'Contrato'),
      total: findHeader(osSheet.headers, 'Total Excel'),
    }
    for (const row of osSheet.rows) {
      const info: OsInfo = { documento: cellText(row, h.documento), status: cellText(row, h.status), contrato: cellText(row, h.contrato), total: cellText(row, h.total) }
      const referencia = cellText(row, h.referencia).toUpperCase()
      const os = cellText(row, h.os).toUpperCase()
      if (referencia && !byReferencia.has(referencia)) byReferencia.set(referencia, info)
      if (os && !byOs.has(os)) byOs.set(os, info)
    }
  } else {
    warnings.push('A planilha de ordens de serviço (com Amostra Referência, CNPJ/CPF e Status Ordem serviço) não foi encontrada no arquivo. CPF_CNPJ e STATUS_OS serão importados vazios.')
  }

  const h = {
    cliente: findHeader(report.headers, 'Cliente'),
    os: findHeader(report.headers, 'Ordem de serviço'),
    referencia: findHeader(report.headers, 'Referência'),
    grupo: findHeader(report.headers, 'Grupo'),
    servico: findHeader(report.headers, 'Serviço'),
    data: findHeader(report.headers, 'Data de Entrada'),
    parametro: findHeader(report.headers, 'Parâmetros'),
    metodo: findHeader(report.headers, 'Método'),
    lq: findHeader(report.headers, 'LQ'),
    ld: findHeader(report.headers, 'LD'),
    unidade: findHeader(report.headers, 'Unidade Medida'),
    laboratorio: findHeader(report.headers, 'Laboratório'),
    contrato: findHeader(report.headers, 'Contrato'),
    valor: findHeader(report.headers, 'Valor'),
  }

  const rows: Array<Record<string, string>> = []
  const canceledOs = new Set<string>()
  let canceledRows = 0
  let testClientRows = 0
  let rowsWithoutOsMatch = 0
  let totalSourceRows = 0

  for (const source of report.rows) {
    const numeroOs = cellText(source, h.os)
    const amostra = cellText(source, h.referencia)
    if (!numeroOs && !amostra && !cellText(source, h.parametro)) continue
    totalSourceRows += 1
    const info = osSheet ? (byReferencia.get(amostra.toUpperCase()) ?? byOs.get(numeroOs.toUpperCase())) : undefined
    if (osSheet && !info) rowsWithoutOsMatch += 1
    const status = info?.status ?? ''
    if (CANCELED_STATUS.has(normalizeHeaderKey(status))) {
      canceledRows += 1
      canceledOs.add(numeroOs)
      continue
    }
    const documento = info?.documento ?? ''
    if (TEST_CLIENT_DOCUMENTS.has(documento.replace(/\D/g, ''))) {
      testClientRows += 1
      continue
    }
    rows.push({
      NUMERO_OS: numeroOs,
      CPF_CNPJ: documento,
      CLIENTE: cellText(source, h.cliente),
      NUMERO_CONTRATO: cellText(source, h.contrato) || info?.contrato || '',
      DATA_OS: formatDataEntrada(cellText(source, h.data)),
      VALOR_OS: formatDecimal(cellText(source, h.valor) || info?.total || ''),
      STATUS_OS: status,
      AMOSTRA: amostra,
      GRUPO: cellText(source, h.grupo),
      SERVICO: cellText(source, h.servico),
      LABORATORIO: cellText(source, h.laboratorio),
      PARAMETRO: cellText(source, h.parametro),
      METODO: cellText(source, h.metodo),
      UNIDADE: cellText(source, h.unidade),
      LQ: formatDecimal(cellText(source, h.lq)),
      LD: formatDecimal(cellText(source, h.ld)),
    })
  }

  if (osSheet && rowsWithoutOsMatch > 0) warnings.push(`${rowsWithoutOsMatch.toLocaleString('pt-BR')} linha(s) sem correspondência na planilha de OS: CPF_CNPJ e STATUS_OS ficarão vazios nelas.`)

  return {
    headers: [...HISTORICO_ANALITICO_COLUMNS],
    rows,
    reportSheet: report.sheetName,
    osSheet: osSheet?.sheetName ?? null,
    totalSourceRows,
    canceledRows,
    canceledOs: canceledOs.size,
    testClientRows,
    rowsWithoutOsMatch,
    warnings,
  }
}

/**
 * Divide as linhas em partes de até `maxRows` sem separar a mesma OS entre partes.
 * As OS são ordenadas pela DATA_OS (ordem estável); uma OS maior que o limite fica sozinha numa parte.
 */
export function splitRowsByOs<T extends Record<string, string>>(rows: T[], maxRows: number, osKey = 'NUMERO_OS', dateKey = 'DATA_OS'): T[][] {
  if (rows.length <= maxRows) return [rows]
  const groups = new Map<string, { sortKey: string; order: number; rows: T[] }>()
  rows.forEach((row, index) => {
    const os = String(row[osKey] ?? '').trim().toUpperCase() || `__SEM_OS_${index}`
    const sortKey = dataOsSortKey(String(row[dateKey] ?? ''))
    const group = groups.get(os)
    if (group) {
      group.rows.push(row)
      if (sortKey < group.sortKey) group.sortKey = sortKey
    } else groups.set(os, { sortKey, order: groups.size, rows: [row] })
  })
  const ordered = Array.from(groups.values()).sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.order - b.order))
  const parts: T[][] = []
  let current: T[] = []
  for (const group of ordered) {
    if (current.length && current.length + group.rows.length > maxRows) {
      parts.push(current)
      current = []
    }
    for (const row of group.rows) current.push(row)
  }
  if (current.length) parts.push(current)
  return parts
}
