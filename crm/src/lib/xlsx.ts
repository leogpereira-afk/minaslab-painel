export type XlsxParsedRow = Record<string, string>

export type XlsxParseResult = {
  headers: string[]
  rows: XlsxParsedRow[]
  sheetName: string
}

type ZipEntry = {
  name: string
  method: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minOffset = Math.max(0, bytes.length - 65_557)
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset
  }
  throw new Error('Arquivo .xlsx inválido: diretório ZIP não encontrado.')
}

function readZipDirectory(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEndOfCentralDirectory(bytes)
  const totalEntries = view.getUint16(eocd + 10, true)
  const centralOffset = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder('utf-8')
  const entries = new Map<string, ZipEntry>()
  let offset = centralOffset

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Arquivo .xlsx inválido: diretório ZIP corrompido.')
    }
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    entries.set(name, { name, method, compressedSize, uncompressedSize, localHeaderOffset })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function inflateRaw(data: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não oferece o descompactador necessário para ler .xlsx. Use um navegador atualizado ou exporte como CSV.')
  }
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  const input = new Blob([copy.buffer]).stream()
  const decompressed = input.pipeThrough(new DecompressionStream('deflate-raw' as never))
  return new Uint8Array(await new Response(decompressed).arrayBuffer())
}

async function extractZipEntry(bytes: Uint8Array, entry: ZipEntry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const offset = entry.localHeaderOffset
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error(`Arquivo .xlsx inválido: entrada ${entry.name} corrompida.`)
  const nameLength = view.getUint16(offset + 26, true)
  const extraLength = view.getUint16(offset + 28, true)
  const start = offset + 30 + nameLength + extraLength
  const compressed = bytes.subarray(start, start + entry.compressedSize)
  if (entry.method === 0) return compressed
  if (entry.method === 8) return inflateRaw(compressed)
  throw new Error(`O arquivo .xlsx usa compressão ZIP não suportada (método ${entry.method}).`)
}

function xml(text: string, label: string) {
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.getElementsByTagNameNS('*', 'parsererror').length || document.getElementsByTagName('parsererror').length) throw new Error(`Não foi possível interpretar ${label} do arquivo .xlsx.`)
  return document
}

function resolveZipPath(base: string, target: string) {
  if (target.startsWith('/')) return target.slice(1)
  const parts = base.split('/').slice(0, -1)
  for (const token of target.split('/')) {
    if (!token || token === '.') continue
    if (token === '..') parts.pop()
    else parts.push(token)
  }
  return parts.join('/')
}

function cellColumnIndex(reference: string | null) {
  const letters = (reference ?? '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? ''
  if (!letters) return -1
  let value = 0
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64
  return value - 1
}

function uniqueHeaders(values: string[]) {
  const used = new Map<string, number>()
  return values.map((raw, index) => {
    const base = raw.trim() || `COLUNA_${index + 1}`
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    return count === 0 ? base : `${base}_${count + 1}`
  })
}

function elementsByLocalName(root: Document | Element, name: string) {
  return Array.from(root.getElementsByTagNameNS('*', name))
}

function directChild(element: Element, localName: string) {
  return Array.from(element.children).find(child => child.localName === localName) ?? null
}

function allText(element: Element | null) {
  if (!element) return ''
  return elementsByLocalName(element, 't').map(item => item.textContent ?? '').join('')
}

function parseSharedStrings(document: Document) {
  return elementsByLocalName(document, 'si').map(item => allText(item))
}

function parseWorksheet(document: Document, sharedStrings: string[]): { headers: string[]; rows: XlsxParsedRow[] } {
  const matrix: string[][] = []
  for (const rowElement of elementsByLocalName(document, 'row')) {
    const row: string[] = []
    for (const cell of Array.from(rowElement.children).filter(child => child.localName === 'c')) {
      const column = cellColumnIndex(cell.getAttribute('r'))
      if (column < 0) continue
      const type = cell.getAttribute('t')
      const raw = directChild(cell, 'v')?.textContent ?? ''
      let value = raw
      if (type === 's') value = sharedStrings[Number(raw)] ?? ''
      else if (type === 'inlineStr') value = allText(directChild(cell, 'is'))
      else if (type === 'b') value = raw === '1' ? 'TRUE' : raw === '0' ? 'FALSE' : raw
      row[column] = value
    }
    matrix.push(row.map(value => value ?? ''))
  }

  const headerIndex = matrix.findIndex(row => row.some(value => value.trim() !== ''))
  if (headerIndex < 0) return { headers: [], rows: [] }
  const maxColumns = Math.max(...matrix.slice(headerIndex).map(row => row.length))
  const headerValues = Array.from({ length: maxColumns }, (_, index) => matrix[headerIndex][index] ?? '')
  const headers = uniqueHeaders(headerValues)
  const rows = matrix.slice(headerIndex + 1)
    .filter(row => row.some(value => (value ?? '').trim() !== ''))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
  return { headers, rows }
}

export async function parseXlsxFirstDataSheet(file: File): Promise<XlsxParseResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const entries = readZipDirectory(bytes)
  const decoder = new TextDecoder('utf-8')

  const sharedEntry = entries.get('xl/sharedStrings.xml')
  const sharedStrings = sharedEntry
    ? parseSharedStrings(xml(decoder.decode(await extractZipEntry(bytes, sharedEntry)), 'sharedStrings.xml'))
    : []

  const workbookEntry = entries.get('xl/workbook.xml')
  const relationshipsEntry = entries.get('xl/_rels/workbook.xml.rels')
  const candidates: Array<{ name: string; path: string }> = []

  if (workbookEntry && relationshipsEntry) {
    const workbook = xml(decoder.decode(await extractZipEntry(bytes, workbookEntry)), 'workbook.xml')
    const relationships = xml(decoder.decode(await extractZipEntry(bytes, relationshipsEntry)), 'workbook.xml.rels')
    const relationTargets = new Map<string, string>()
    for (const relationship of elementsByLocalName(relationships, 'Relationship')) {
      const id = relationship.getAttribute('Id')
      const target = relationship.getAttribute('Target')
      if (id && target) relationTargets.set(id, resolveZipPath('xl/workbook.xml', target))
    }
    for (const sheet of elementsByLocalName(workbook, 'sheet')) {
      const id = sheet.getAttribute('r:id') ?? sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
      const path = id ? relationTargets.get(id) : undefined
      if (path && entries.has(path)) candidates.push({ name: sheet.getAttribute('name') ?? 'Planilha', path })
    }
  }

  if (!candidates.length) {
    for (const name of Array.from(entries.keys()).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort()) {
      candidates.push({ name: name.split('/').pop()?.replace(/\.xml$/i, '') ?? 'Planilha', path: name })
    }
  }

  if (!candidates.length) throw new Error('O arquivo .xlsx não possui planilhas legíveis.')

  let firstNonEmpty: XlsxParseResult | null = null
  for (const candidate of candidates) {
    const entry = entries.get(candidate.path)
    if (!entry) continue
    const worksheet = xml(decoder.decode(await extractZipEntry(bytes, entry)), candidate.path)
    const parsed = parseWorksheet(worksheet, sharedStrings)
    if (parsed.headers.length) {
      const result = { ...parsed, sheetName: candidate.name }
      if (parsed.rows.length) return result
      firstNonEmpty ??= result
    }
  }

  if (firstNonEmpty) return firstNonEmpty
  throw new Error('Nenhuma planilha com cabeçalho legível foi encontrada no arquivo .xlsx.')
}
