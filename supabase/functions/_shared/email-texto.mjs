// Peças puras do e-mail do painel (ml-email): nomes de pasta, cabeçalhos, respostas do IMAP e
// montagem da mensagem (MIME). Sem rede e sem Deno: roda no Deno (Edge Function) e no Node (testes).

const enc = new TextEncoder();

// ---------------------------------------------------------------- base64
export function paraBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function deBase64(b64) {
  const b = atob(String(b64 || "").replace(/[^A-Za-z0-9+/=]/g, ""));
  const o = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i);
  return o;
}

// ---------------------------------------------------------------- UTF-7 modificado (RFC 3501 §5.1.3)
// Nome de pasta no IMAP: "Licita&AOcA9Q-es" = "Licitações".
export function pastaDecodificar(nome) {
  return String(nome).replace(/&([^-]*)-/g, (_, b) => {
    if (b === "") return "&";
    const bytes = deBase64(b.replace(/,/g, "/"));
    let s = "";
    for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return s;
  });
}
export function pastaCodificar(nome) {
  let out = "", buf = "";
  const fechar = () => {
    if (!buf) return;
    const bytes = new Uint8Array(buf.length * 2);
    for (let i = 0; i < buf.length; i++) { bytes[i * 2] = buf.charCodeAt(i) >> 8; bytes[i * 2 + 1] = buf.charCodeAt(i) & 255; }
    out += "&" + paraBase64(bytes).replace(/=+$/, "").replace(/\//g, ",") + "-";
    buf = "";
  };
  for (const ch of String(nome)) {
    const c = ch.charCodeAt(0);
    if (c >= 0x20 && c <= 0x7e && ch.length === 1) { fechar(); out += ch === "&" ? "&-" : ch; }
    else buf += ch;
  }
  fechar();
  return out;
}

// Texto entre aspas no comando IMAP.
export const aspas = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

// ---------------------------------------------------------------- cabeçalhos (RFC 5322 / 2047)
function decodificarBytes(bytes, charset) {
  try { return new TextDecoder(String(charset || "utf-8").toLowerCase()).decode(bytes); }
  catch { return new TextDecoder("latin1").decode(bytes); }
}
function qDecode(s) {
  const out = [];
  const t = s.replace(/_/g, " ");
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) { out.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2; }
    else out.push(...enc.encode(t[i]));
  }
  return new Uint8Array(out);
}
// "=?UTF-8?B?...?=" e "=?ISO-8859-1?Q?...?=" viram texto; palavras codificadas vizinhas se juntam.
export function decodificarPalavras(valor) {
  const s = String(valor ?? "").replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?)/g, "$1");
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, tipo, dado) => {
    const charset = cs.split("*")[0];
    const bytes = tipo.toUpperCase() === "B" ? deBase64(dado) : qDecode(dado);
    return decodificarBytes(bytes, charset);
  });
}

// Bloco de cabeçalhos (bytes ou texto) → { "from": "...", "subject": "..." } (nomes em minúsculas).
export function lerCabecalhos(bloco) {
  const texto = typeof bloco === "string" ? bloco : decodificarBytes(bloco, "utf-8");
  const linhas = texto.replace(/\r/g, "").split("\n");
  const r = {};
  let atual = null;
  for (const l of linhas) {
    if (/^[ \t]/.test(l) && atual) { r[atual] += " " + l.trim(); continue; }
    const m = l.match(/^([!-9;-~]+):\s*(.*)$/);
    if (m) { atual = m[1].toLowerCase(); r[atual] = r[atual] ? r[atual] : m[2]; }
    else atual = null;
  }
  for (const k of Object.keys(r)) r[k] = decodificarPalavras(r[k]).trim();
  return r;
}

// "Fulano <a@b.com>, b@c.com" → [{ nome, email }]
export function lerEnderecos(valor) {
  const s = String(valor ?? "");
  const partes = [];
  let atual = "", aspasAbertas = false, angulo = 0;
  for (const ch of s) {
    if (ch === '"') aspasAbertas = !aspasAbertas;
    if (!aspasAbertas && ch === "<") angulo++;
    if (!aspasAbertas && ch === ">") angulo = Math.max(0, angulo - 1);
    if (ch === "," && !aspasAbertas && angulo === 0) { partes.push(atual); atual = ""; continue; }
    atual += ch;
  }
  partes.push(atual);
  return partes.map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = p.match(/^(.*?)<([^>]+)>\s*$/);
    if (m) return { nome: m[1].trim().replace(/^"|"$/g, "").replace(/\\"/g, '"').trim(), email: m[2].trim().toLowerCase() };
    return { nome: "", email: p.replace(/^"|"$/g, "").trim().toLowerCase() };
  }).filter((e) => e.email.includes("@"));
}

export const emailValido = (e) => /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(String(e || ""));

// ---------------------------------------------------------------- respostas do IMAP
// "* LIST (\HasNoChildren \Sent) "/" "INBOX.Sent"" → { nome, delim, flags }
export function lerLinhaList(linha, literais = []) {
  const m = linha.match(/^\* (?:LIST|XLIST) \(([^)]*)\) (NIL|"(?:[^"\\]|\\.)*") (.*)$/i);
  if (!m) return null;
  const flags = m[1].toLowerCase().split(/\s+/).filter(Boolean);
  const delim = m[2].toUpperCase() === "NIL" ? "" : m[2].slice(1, -1).replace(/\\(.)/g, "$1");
  let nome = m[3].trim();
  const lit = nome.match(/^\{#(\d+)\}$/);
  if (lit) nome = new TextDecoder().decode(literais[Number(lit[1])]);
  else if (nome.startsWith('"')) nome = nome.slice(1, -1).replace(/\\(.)/g, "$1");
  return { nome, delim, flags };
}

// Tipo da pasta pelo "special-use" (RFC 6154) ou, na falta, pelo nome.
export function tipoDaPasta(nome, flags = []) {
  const f = flags.map((x) => x.toLowerCase());
  if (String(nome).toUpperCase() === "INBOX") return "entrada";
  if (f.includes("\\sent")) return "enviados";
  if (f.includes("\\drafts")) return "rascunhos";
  if (f.includes("\\trash")) return "lixeira";
  if (f.includes("\\junk")) return "spam";
  if (f.includes("\\flagged")) return "estrela";
  if (f.includes("\\all")) return "todos";
  if (f.includes("\\archive")) return "arquivo";
  // Pelo nome, só no primeiro nível (INBOX.Sent, [Gmail]/Spam): uma subpasta do usuário
  // chamada "Arquivo" ou "Enviados" (ex.: Boletos.Arquivo) é pasta comum, não a do sistema.
  const partes = pastaDecodificar(nome).toLowerCase().replace(/^inbox[./]/, "").replace(/^\[(gmail|google mail)\]\//, "").split(/[./]/);
  if (partes.length > 1) return null;
  const n = partes[0];
  if (/^(sent|enviad|itens enviados|sent items|sent messages)/.test(n)) return "enviados";
  if (/^(drafts?|rascunho)/.test(n)) return "rascunhos";
  if (/^(trash|lixeira|lixo|deleted|itens exclu|exclu)/.test(n)) return "lixeira";
  if (/^(junk|spam|lixo eletr)/.test(n)) return "spam";
  if (/^(archive|arquivo)/.test(n)) return "arquivo";
  return null;
}

const ORDEM_TIPO = { entrada: 0, estrela: 1, enviados: 2, rascunhos: 3, arquivo: 4, todos: 5, spam: 6, lixeira: 7 };
const ROTULO_TIPO = { entrada: "Caixa de entrada", estrela: "Com estrela", enviados: "Enviados", rascunhos: "Rascunhos", arquivo: "Arquivo", todos: "Todos os e-mails", spam: "Spam", lixeira: "Lixeira" };

// Lista do LIST → pastas para a tela (sistema primeiro, depois as do usuário em ordem alfabética).
export function organizarPastas(itens) {
  const usados = new Set();
  const pastas = [];
  for (const p of itens) {
    if (p.flags.includes("\\noselect") || p.flags.includes("\\nonexistent")) continue;
    let tipo = tipoDaPasta(p.nome, p.flags);
    if (tipo && usados.has(tipo)) tipo = null; // segunda "Sent" vira pasta comum
    if (tipo) usados.add(tipo);
    const decod = pastaDecodificar(p.nome);
    let rotulo = tipo ? ROTULO_TIPO[tipo] : decod;
    if (!tipo) {
      // Tira o prefixo "INBOX." (Hostinger) e "[Gmail]/" para mostrar só o nome.
      rotulo = decod.replace(/^INBOX[./]/i, "").replace(/^\[(Gmail|Google Mail)\]\//i, "");
    }
    pastas.push({ id: p.nome, rotulo, tipo, delim: p.delim });
  }
  return pastas.sort((a, b) => {
    const oa = a.tipo ? ORDEM_TIPO[a.tipo] : 50, ob = b.tipo ? ORDEM_TIPO[b.tipo] : 50;
    return oa - ob || a.rotulo.localeCompare(b.rotulo, "pt-BR");
  });
}

// "* STATUS "INBOX" (MESSAGES 12 UNSEEN 3)" → { nome, total, naoLidas }
export function lerLinhaStatus(linha, literais = []) {
  const m = linha.match(/^\* STATUS ("(?:[^"\\]|\\.)*"|\{#\d+\}|\S+) \((.*)\)\s*$/i);
  if (!m) return null;
  let nome = m[1];
  const lit = nome.match(/^\{#(\d+)\}$/);
  if (lit) nome = new TextDecoder().decode(literais[Number(lit[1])]);
  else if (nome.startsWith('"')) nome = nome.slice(1, -1).replace(/\\(.)/g, "$1");
  const num = (k) => Number((m[2].match(new RegExp(`${k} (\\d+)`, "i")) || [])[1] || 0);
  return { nome, total: num("MESSAGES"), naoLidas: num("UNSEEN") };
}

// "* SEARCH 1 5 9" (várias linhas possíveis) → [9, 5, 1] (mais novos primeiro)
export function lerSearch(linhas) {
  const uids = [];
  for (const l of linhas) {
    const m = l.match(/^\* (?:SEARCH|ESEARCH)\b(.*)$/i);
    if (m) for (const n of m[1].trim().split(/\s+/)) if (/^\d+$/.test(n)) uids.push(Number(n));
  }
  return [...new Set(uids)].sort((a, b) => b - a);
}

// "* 3 FETCH (UID 10 FLAGS (\Seen) INTERNALDATE "..." RFC822.SIZE 99 BODY[HEADER.FIELDS (...)] {#0})"
export function lerLinhaFetch(linha, literais = []) {
  if (!/^\* \d+ FETCH \(/i.test(linha)) return null;
  const uid = Number((linha.match(/\bUID (\d+)/i) || [])[1] || 0);
  const flags = ((linha.match(/\bFLAGS \(([^)]*)\)/i) || [])[1] || "").split(/\s+/).filter(Boolean).map((f) => f.toLowerCase());
  const data = (linha.match(/\bINTERNALDATE "([^"]+)"/i) || [])[1] || null;
  const tamanho = Number((linha.match(/\bRFC822\.SIZE (\d+)/i) || [])[1] || 0);
  const corpos = [...linha.matchAll(/\bBODY\[([^\]]*)\](?:<\d+>)? (?:\{#(\d+)\}|"((?:[^"\\]|\\.)*)"|NIL)/gi)].map((m) => ({
    secao: m[1].toUpperCase(),
    bytes: m[2] !== undefined ? literais[Number(m[2])] : m[3] !== undefined ? enc.encode(m[3]) : new Uint8Array(),
  }));
  return { uid, flags, data, tamanho, corpos };
}

// Data do INTERNALDATE ("17-Jul-2026 02:44:25 -0300") ou do cabeçalho Date → ISO.
const MESES = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
export function dataIso(s) {
  if (!s) return null;
  const m = String(s).match(/^\s*(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})/);
  if (m) {
    const ms = Date.UTC(+m[3], MESES[m[2].toLowerCase()], +m[1], +m[4], +m[5], +m[6]) - (m[7] === "-" ? -1 : 1) * ((+m[8]) * 60 + (+m[9])) * 60000;
    return new Date(ms).toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Monta a linha da lista a partir do FETCH de cabeçalhos.
export function resumoDaMensagem(f) {
  const cab = lerCabecalhos(f.corpos[0]?.bytes || "");
  const de = lerEnderecos(cab.from)[0] || { nome: "", email: "" };
  const tipo = (cab["content-type"] || "").toLowerCase();
  return {
    uid: f.uid,
    lida: f.flags.includes("\\seen"),
    estrela: f.flags.includes("\\flagged"),
    respondida: f.flags.includes("\\answered"),
    data: dataIso(cab.date) || dataIso(f.data),
    de,
    para: lerEnderecos(cab.to),
    assunto: cab.subject || "",
    temAnexo: /multipart\/(mixed|report)/.test(tipo),
    tamanho: f.tamanho,
  };
}

// Conjunto de UIDs para o comando: [5,6,7,9] → "5:7,9"
export function conjuntoUids(uids) {
  const v = [...new Set(uids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  const partes = [];
  for (let i = 0; i < v.length; i++) {
    let j = i;
    while (j + 1 < v.length && v[j + 1] === v[j] + 1) j++;
    partes.push(i === j ? `${v[i]}` : `${v[i]}:${v[j]}`);
    i = j;
  }
  return partes.join(",");
}

// ---------------------------------------------------------------- HTML recebido
// Tira script, eventos (onclick=...) e javascript: do HTML. A tela ainda mostra dentro de um
// iframe sem scripts; isto é a segunda camada.
export function limparHtml(html) {
  return String(html || "")
    .replace(/<(script|iframe|object|applet|noscript)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(script|iframe|object|embed|applet|form|meta|base|link|noscript)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|action)\s*=\s*(["']?)\s*(javascript|vbscript):[^"'>\s]*\2/gi, '$1="#"');
}
export function htmlDeTexto(texto) {
  const esc = String(texto || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="white-space:pre-wrap;font-family:inherit">${esc.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')}</div>`;
}
export function textoDeHtml(h) {
  return String(h || "").replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d|table)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------- montagem (MIME)
const quebra76 = (s) => s.replace(/.{1,76}/g, (m) => m + "\r\n");
export const cabecalhoCodificado = (s) => (/^[\x20-\x7e]*$/.test(String(s)) ? String(s) : `=?UTF-8?B?${paraBase64(enc.encode(String(s)))}?=`);
const enderecoCab = (e) => (e.nome ? `${cabecalhoCodificado(e.nome.replace(/"/g, ""))} <${e.email}>` : e.email);
const nomeParam = (n) => cabecalhoCodificado(String(n || "anexo").replace(/["\r\n]/g, ""));

// o = { de:{nome,email}, para:[], cc:[], assunto, texto, html, messageId, inReplyTo?, referencias?:[],
//       inline:[{cid, tipo, bytes, nome}], anexos:[{nome, tipo, bytes}], data? }
export function montarMensagem(o) {
  const limite = () => `----=_ml_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const h = [
    `From: ${enderecoCab(o.de)}`,
    `To: ${(o.para || []).map(enderecoCab).join(", ")}`,
    ...((o.cc || []).length ? [`Cc: ${o.cc.map(enderecoCab).join(", ")}`] : []),
    `Subject: ${cabecalhoCodificado(o.assunto || "")}`,
    `Date: ${(o.data || new Date()).toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: ${o.messageId}`,
    ...(o.inReplyTo ? [`In-Reply-To: ${o.inReplyTo}`] : []),
    ...((o.referencias || []).length ? [`References: ${o.referencias.join(" ")}`] : []),
    "MIME-Version: 1.0",
    "X-Mailer: MinasLab Painel",
  ];
  const parteTexto = ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", quebra76(paraBase64(enc.encode(o.texto || "")))].join("\r\n");
  const parteHtml = ["Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", quebra76(paraBase64(enc.encode(o.html || "")))].join("\r\n");
  const multi = (tipo, partes) => {
    const l = limite();
    return [`Content-Type: multipart/${tipo}; boundary="${l}"`, "", ...partes.flatMap((p) => [`--${l}`, p]), `--${l}--`, ""].join("\r\n");
  };
  let corpo = o.html ? multi("alternative", [parteTexto, parteHtml]) : parteTexto;
  const inline = (o.inline || []).filter((i) => i?.bytes?.length);
  if (inline.length) {
    corpo = multi("related", [corpo, ...inline.map((i) => [
      `Content-Type: ${i.tipo || "image/png"}; name="${nomeParam(i.nome || i.cid)}"`, "Content-Transfer-Encoding: base64",
      `Content-ID: <${i.cid}>`, `Content-Disposition: inline; filename="${nomeParam(i.nome || i.cid)}"`, "", quebra76(paraBase64(i.bytes)),
    ].join("\r\n"))]);
  }
  const anexos = (o.anexos || []).filter((a) => a?.bytes);
  if (anexos.length) {
    corpo = multi("mixed", [corpo, ...anexos.map((a) => [
      `Content-Type: ${a.tipo || "application/octet-stream"}; name="${nomeParam(a.nome)}"`, "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${nomeParam(a.nome)}"`, "", quebra76(paraBase64(a.bytes)),
    ].join("\r\n"))]);
  }
  return enc.encode(h.join("\r\n") + "\r\n" + corpo);
}

// "Re: " / "Enc: " sem acumular ("Re: Re: Re:").
// Assunto sem "Re:", "RES:", "Enc:", "Fwd:", "TR:" (repetidos) — é o que junta a conversa.
export function assuntoBase(assunto) {
  return String(assunto || "").replace(/^\s*((re|res|enc|fwd?|tr)\s*(\[\d+\])?\s*:\s*)+/i, "").replace(/\s+/g, " ").trim();
}
export const mesmaConversa = (a, b) => {
  const x = assuntoBase(a).toLowerCase(), y = assuntoBase(b).toLowerCase();
  return !!x && x === y;
};

export function assuntoResposta(assunto, modo) {
  const base = String(assunto || "").replace(/^\s*((re|res|enc|fwd?|tr)\s*:\s*)+/i, "");
  return (modo === "encaminhar" ? "Enc: " : "Re: ") + base;
}
