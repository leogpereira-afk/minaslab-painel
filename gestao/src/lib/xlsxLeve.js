// Leitor mínimo de .xlsx no navegador (sem biblioteca): o arquivo é um ZIP
// com XMLs; descompacta com DecompressionStream e lê as planilhas como linhas.
// Devolve { nomeDaAba: [[célula, ...], ...] } com números, textos ou null.

async function inflar(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function lerZip(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  // Fim do diretório central: assinatura 0x06054b50 perto do fim do arquivo.
  let fim = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error("O arquivo não parece ser uma planilha .xlsx.");
  const total = dv.getUint16(fim + 10, true);
  let p = dv.getUint32(fim + 16, true);
  const arquivos = {};
  const dec = new TextDecoder();
  for (let k = 0; k < total; k++) {
    const metodo = dv.getUint16(p + 10, true);
    const tamC = dv.getUint32(p + 20, true);
    const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = dec.decode(u8.subarray(p + 46, p + 46 + nLen));
    const lnLen = dv.getUint16(local + 26, true), lxLen = dv.getUint16(local + 28, true);
    const ini = local + 30 + lnLen + lxLen;
    const dados = u8.subarray(ini, ini + tamC);
    arquivos[nome] = async () => dec.decode(metodo === 0 ? dados : await inflar(dados));
    p += 46 + nLen + xLen + cLen;
  }
  return arquivos;
}

const xml = (t) => new DOMParser().parseFromString(t, "application/xml");
const filhos = (el, nome) => Array.from(el.getElementsByTagName(nome));
const colNum = (ref) => { const l = ref.replace(/\d+/g, ""); let n = 0; for (const c of l) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

export async function lerXlsx(arquivo) {
  const zip = await lerZip(await arquivo.arrayBuffer());
  const pegar = async (n) => (zip[n] ? zip[n]() : null);
  const strings = [];
  const ss = await pegar("xl/sharedStrings.xml");
  if (ss) for (const si of filhos(xml(ss), "si")) strings.push(filhos(si, "t").map((t) => t.textContent).join(""));
  const wb = xml(await pegar("xl/workbook.xml"));
  const rels = xml(await pegar("xl/_rels/workbook.xml.rels"));
  const alvo = {};
  for (const r of filhos(rels, "Relationship")) alvo[r.getAttribute("Id")] = r.getAttribute("Target");
  const abas = {};
  for (const s of filhos(wb, "sheet")) {
    const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    let caminho = alvo[rid] || "";
    caminho = caminho.startsWith("/") ? caminho.slice(1) : `xl/${caminho.replace(/^\.\//, "")}`;
    const txt = await pegar(caminho);
    if (!txt) continue;
    const linhas = [];
    for (const row of filhos(xml(txt), "row")) {
      const linha = [];
      for (const c of filhos(row, "c")) {
        const t = c.getAttribute("t");
        const v = c.getElementsByTagName("v")[0]?.textContent;
        let val = null;
        if (t === "s") val = strings[Number(v)] ?? null;
        else if (t === "inlineStr") val = filhos(c, "t").map((x) => x.textContent).join("");
        else if (t === "str" || t === "e") val = v ?? null;
        else if (t === "b") val = v === "1";
        else if (v != null && v !== "") val = Number(v);
        linha[colNum(c.getAttribute("r"))] = val;
      }
      linhas[Number(row.getAttribute("r")) - 1] = linha;
    }
    abas[s.getAttribute("name")] = Array.from(linhas, (l) => (l ? Array.from(l, (x) => (x === undefined ? null : x)) : []));
  }
  return abas;
}
