// Cliente IMAP/SMTP do e-mail do painel (ml-email). Fala direto com a caixa (Hostinger ou Gmail):
// o que se faz aqui aparece igual no webmail e no celular, porque é a mesma caixa.
// Conexão curta: abre, faz uma coisa, fecha (a Edge Function não guarda conexão entre chamadas).
import PostalMime from "https://esm.sh/postal-mime@2.4.4";
import {
  aspas, conjuntoUids, deBase64, lerLinhaFetch, lerLinhaList, lerLinhaStatus, lerSearch, limparHtml,
  htmlDeTexto, organizarPastas, pastaDecodificar, paraBase64, resumoDaMensagem, lerEnderecos, dataIso,
} from "./email-texto.mjs";

const enc = new TextEncoder(), dec = new TextDecoder();

export type Servidor = { imapHost: string; imapPorta: number; smtpHost: string; smtpPorta: number; caCerts?: string[] };
export const SERVIDORES: Record<string, Servidor> = {
  hostinger: { imapHost: "imap.hostinger.com", imapPorta: 993, smtpHost: "smtp.hostinger.com", smtpPorta: 465 },
  gmail: { imapHost: "imap.gmail.com", imapPorta: 993, smtpHost: "smtp.gmail.com", smtpPorta: 465 },
};
export type Credencial = { servidor: Servidor; provedor: string; email: string; senha: string };

export class ErroEmail extends Error {
  constructor(msg: string, public tipo = "geral") { super(msg); }
}

// ---------------------------------------------------------------- IMAP
type Resposta = { linhas: string[]; literais: Uint8Array[]; ok: boolean; status: string };
const ESPERA = 30000;
function comPrazo<T>(p: Promise<T>, msg: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<T>((_, r) => { t = setTimeout(() => r(new ErroEmail(msg, "rede")), ESPERA); })]).finally(() => clearTimeout(t));
}

// Deno.Conn.write pode gravar só PARTE do buffer (o resto ficava para trás e o servidor
// esperava para sempre ou derrubava a conexão — foi o "Enviando…" eterno de 18/11/2026).
// Grava tudo, em pedaços, com prazo.
export async function gravarTudo(c: Deno.Conn, dados: Uint8Array) {
  let feito = 0;
  while (feito < dados.length) {
    const n = await comPrazo(c.write(dados.subarray(feito, Math.min(dados.length, feito + 65536))), "O servidor de e-mail parou de receber.");
    if (n <= 0) throw new ErroEmail("A conexão com o servidor de e-mail caiu.", "rede");
    feito += n;
  }
}
// Erros de rede/TLS (conexão derrubada no meio) viram mensagem clara.
export function erroDeRede(e: unknown, envio = false): never {
  if (e instanceof ErroEmail) throw e;
  const nome = (e as Error)?.name || "";
  if (/UnexpectedEof|ConnectionReset|BrokenPipe|ConnectionAborted|Interrupted|InvalidData/i.test(nome)) {
    throw new ErroEmail(envio ? "O servidor de envio derrubou a conexão no meio do envio. Tente de novo." : "A conexão com o servidor de e-mail caiu. Tente de novo.", "rede");
  }
  throw e;
}

export class Imap {
  private buf = new Uint8Array(1 << 16);
  private ini = 0;
  private fim = 0;
  private n = 0;
  capacidades = new Set<string>();
  private constructor(private c: Deno.TlsConn) {}

  static async abrir(s: Servidor) {
    let c: Deno.TlsConn;
    try {
      c = await comPrazo(Deno.connectTls({ hostname: s.imapHost, port: s.imapPorta, ...(s.caCerts ? { caCerts: s.caCerts } : {}) }), "O servidor de e-mail não respondeu.");
    } catch (e) {
      if (e instanceof ErroEmail) throw e;
      throw new ErroEmail("Não consegui conectar ao servidor de e-mail.", "rede");
    }
    const i = new Imap(c);
    const ola = await i.linha();
    i.lerCapacidades(ola);
    return i;
  }
  private lerCapacidades(l: string) {
    const m = l.match(/\[CAPABILITY ([^\]]+)\]/i) || l.match(/^\* CAPABILITY (.*)$/i);
    if (m) this.capacidades = new Set(m[1].toUpperCase().split(/\s+/));
  }
  private async mais() {
    if (this.buf.length - this.fim < 1 << 15) {
      const usado = this.fim - this.ini;
      const novo = usado * 2 + (1 << 16) > this.buf.length ? new Uint8Array(Math.max(this.buf.length * 2, usado + (1 << 17))) : this.buf;
      novo.set(this.buf.subarray(this.ini, this.fim), 0);
      this.buf = novo; this.ini = 0; this.fim = usado;
    }
    const lido = await comPrazo(this.c.read(this.buf.subarray(this.fim)), "O servidor de e-mail parou de responder.");
    if (lido === null) throw new ErroEmail("O servidor de e-mail fechou a conexão.", "rede");
    this.fim += lido;
  }
  private async linha(): Promise<string> {
    let de = this.ini;
    for (;;) {
      const i = this.buf.subarray(de, this.fim).indexOf(10);
      if (i >= 0) {
        const l = dec.decode(this.buf.subarray(this.ini, de + i)).replace(/\r$/, "");
        this.ini = de + i + 1; return l;
      }
      de = this.fim - this.ini; await this.mais(); de += this.ini;
    }
  }
  private async bytes(qtd: number): Promise<Uint8Array> {
    while (this.fim - this.ini < qtd) await this.mais();
    const r = this.buf.slice(this.ini, this.ini + qtd); this.ini += qtd; return r;
  }
  // Comando com literais: partes de texto intercaladas com bytes ({n} + espera o "+").
  async cmd(...partes: (string | Uint8Array)[]): Promise<Resposta> {
    const tag = `A${++this.n}`;
    const blocos: (string | Uint8Array)[] = [];
    let atual = `${tag} `;
    for (const p of partes) {
      if (typeof p === "string") atual += p;
      else { blocos.push(atual + `{${p.length}}\r\n`); blocos.push(p); atual = ""; }
    }
    blocos.push(atual + "\r\n");
    // Envia até o primeiro literal; cada literal espera o "+" do servidor.
    let i = 0;
    await gravarTudo(this.c, enc.encode(blocos[i++] as string));
    const linhas: string[] = [], literais: Uint8Array[] = [];
    for (;;) {
      let l = await this.linha();
      if (l.startsWith("+") && i < blocos.length) {
        await gravarTudo(this.c, blocos[i++] as Uint8Array);
        await gravarTudo(this.c, enc.encode(blocos[i++] as string));
        continue;
      }
      while (/\{\d+\}$/.test(l)) {
        const qtd = Number(l.match(/\{(\d+)\}$/)![1]);
        literais.push(await this.bytes(qtd));
        l = l.replace(/\{\d+\}$/, `{#${literais.length - 1}}`) + await this.linha();
      }
      if (l.startsWith(tag + " ")) {
        const status = l.slice(tag.length + 1);
        this.lerCapacidades(status);
        return { linhas, literais, ok: status.startsWith("OK"), status };
      }
      if (/^\* CAPABILITY /i.test(l)) this.lerCapacidades(l);
      linhas.push(l);
    }
  }
  async ok(...partes: (string | Uint8Array)[]) {
    const r = await this.cmd(...partes);
    if (!r.ok) throw new ErroEmail(`O servidor de e-mail recusou: ${r.status.replace(/^(NO|BAD)\s*/i, "").slice(0, 200)}`);
    return r;
  }
  async entrar(usuario: string, senha: string, provedor: string) {
    const r = await this.cmd("LOGIN ", enc.encode(usuario), " ", enc.encode(senha));
    if (!r.ok) {
      throw new ErroEmail(provedor === "gmail"
        ? "O Gmail recusou o login. Use a \"senha de app\" (16 letras) gerada na sua Conta Google, não a senha normal."
        : "Usuário ou senha do e-mail incorretos.", "login");
    }
    if (!this.capacidades.size || !r.status.includes("CAPABILITY")) {
      const c = await this.cmd("CAPABILITY");
      for (const l of c.linhas) this.lerCapacidades(l);
    }
  }
  tem(cap: string) { return this.capacidades.has(cap.toUpperCase()); }
  async sair() { try { await comPrazo(this.cmd("LOGOUT"), "saida"); } catch { /* ok */ } this.fechar(); }
  fechar() { try { this.c.close(); } catch { /* já fechada */ } }
}

export async function comImap<T>(cred: Credencial, fn: (imap: Imap) => Promise<T>): Promise<T> {
  const imap = await Imap.abrir(cred.servidor);
  try {
    await imap.entrar(cred.email, cred.senha, cred.provedor);
    return await fn(imap);
  } catch (e) { erroDeRede(e); } finally { await imap.sair(); }
}

// Nome da pasta no comando (literal quando não é ASCII simples).
const nomeCmd = (nome: string): (string | Uint8Array)[] => (/^[\x20-\x7e]*$/.test(nome) ? [aspas(nome)] : ["", enc.encode(nome)]);

// ---------------------------------------------------------------- operações
export async function listarPastas(imap: Imap, comContagem = true) {
  const r = await imap.ok('LIST "" "*"');
  const itens = r.linhas.map((l) => lerLinhaList(l, r.literais)).filter(Boolean) as { nome: string; delim: string; flags: string[] }[];
  // Gmail e outros também respondem ao "special-use"; o LIST normal do Gmail já traz \Sent etc.
  const pastas = organizarPastas(itens) as { id: string; rotulo: string; tipo: string | null; delim: string; total?: number; naoLidas?: number }[];
  if (comContagem) {
    for (const p of pastas) {
      if (p.tipo === "todos") continue; // contar "Todos os e-mails" do Gmail é lento e não ajuda
      const s = await imap.cmd("STATUS ", ...nomeCmd(p.id), " (MESSAGES UNSEEN)");
      const st = s.ok ? s.linhas.map((l) => lerLinhaStatus(l, s.literais)).find(Boolean) : null;
      if (st) { p.total = st.total; p.naoLidas = st.naoLidas; }
    }
  }
  return pastas;
}

async function pastaDoTipo(imap: Imap, tipo: string) {
  const pastas = await listarPastas(imap, false);
  return pastas.find((p) => p.tipo === tipo)?.id || null;
}

export async function selecionar(imap: Imap, pasta: string, soLeitura = false) {
  const r = await imap.cmd(soLeitura ? "EXAMINE " : "SELECT ", ...nomeCmd(pasta));
  if (!r.ok) throw new ErroEmail(`Não encontrei a pasta "${pastaDecodificar(pasta)}".`, "pasta");
  return r;
}

type Filtro = { busca?: string; naoLidas?: boolean; comAnexo?: boolean; estrela?: boolean };
async function buscarUids(imap: Imap, provedor: string, f: Filtro) {
  const partes: (string | Uint8Array)[] = ["UID SEARCH"];
  const busca = String(f.busca || "").trim().slice(0, 200);
  const utf8 = busca && !/^[\x20-\x7e]*$/.test(busca);
  if (utf8) partes.push(" CHARSET UTF-8");
  if (f.naoLidas) partes.push(" UNSEEN");
  if (f.estrela) partes.push(" FLAGGED");
  if (f.comAnexo) {
    if (provedor === "gmail") partes.push(' X-GM-RAW "has:attachment"');
    else partes.push(' HEADER Content-Type "multipart/mixed"');
  }
  if (busca) {
    if (provedor === "gmail") { partes.push(" X-GM-RAW ", ...(utf8 ? ["", enc.encode(busca)] : [aspas(busca)])); }
    else {
      const v = () => (utf8 ? ["", enc.encode(busca)] as (string | Uint8Array)[] : [aspas(busca)]);
      partes.push(" OR OR OR FROM ", ...v(), " TO ", ...v(), " SUBJECT ", ...v(), " BODY ", ...v());
    }
  }
  if (partes.length === 1 || (partes.length === 2 && utf8)) partes.push(" ALL");
  const r = await imap.ok(...partes);
  return lerSearch(r.linhas);
}

export async function listarMensagens(imap: Imap, provedor: string, pasta: string, pagina = 1, filtro: Filtro = {}, porPagina = 50) {
  await selecionar(imap, pasta, true);
  const uids = await buscarUids(imap, provedor, filtro);
  const p = Math.max(1, Math.floor(pagina));
  const fatia = uids.slice((p - 1) * porPagina, p * porPagina);
  if (!fatia.length) return { total: uids.length, pagina: p, porPagina, mensagens: [] };
  const r = await imap.ok(`UID FETCH ${conjuntoUids(fatia)} (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE CONTENT-TYPE)])`);
  const porUid = new Map<number, ReturnType<typeof resumoDaMensagem>>();
  for (const l of r.linhas) {
    const f = lerLinhaFetch(l, r.literais);
    if (f?.uid) porUid.set(f.uid, resumoDaMensagem(f));
  }
  const mensagens = fatia.map((u) => porUid.get(u)).filter(Boolean);
  return { total: uids.length, pagina: p, porPagina, mensagens };
}

const LIMITE_LEITURA = 30 * 1024 * 1024;
async function baixarBruto(imap: Imap, uid: number) {
  const r = await imap.ok(`UID FETCH ${uid} (UID FLAGS RFC822.SIZE)`);
  const f = r.linhas.map((l) => lerLinhaFetch(l, r.literais)).find((x) => x?.uid === uid);
  if (!f) throw new ErroEmail("Esta mensagem não está mais na pasta (foi movida ou excluída).", "sumiu");
  if (f.tamanho > LIMITE_LEITURA) throw new ErroEmail("Mensagem grande demais para abrir no painel (mais de 30 MB). Abra pelo webmail.", "grande");
  const c = await imap.ok(`UID FETCH ${uid} (UID BODY.PEEK[])`);
  const g = c.linhas.map((l) => lerLinhaFetch(l, c.literais)).find((x) => x?.uid === uid);
  const bruto = g?.corpos.find((x: { secao: string }) => x.secao === "")?.bytes;
  if (!bruto) throw new ErroEmail("Não consegui ler esta mensagem.");
  return { bruto, flags: f.flags as string[] };
}

type Anexo = { filename?: string | null; mimeType: string; content: ArrayBuffer | Uint8Array | string; contentId?: string; disposition?: string | null; related?: boolean };
const tamanhoDe = (c: Anexo["content"]) => (typeof c === "string" ? c.length : (c as ArrayBuffer).byteLength);
const bytesDe = (c: Anexo["content"]) => (typeof c === "string" ? enc.encode(c) : c instanceof Uint8Array ? c : new Uint8Array(c));
const ehInline = (a: Anexo) => !!a.contentId && (a.disposition === "inline" || a.related === true || !a.filename);

export async function lerMensagem(imap: Imap, pasta: string, uid: number, marcarLida = true) {
  await selecionar(imap, pasta, false);
  const { bruto, flags } = await baixarBruto(imap, uid);
  if (marcarLida && !flags.includes("\\seen")) await imap.cmd(`UID STORE ${uid} +FLAGS.SILENT (\\Seen)`);
  const m = await new PostalMime().parse(bruto);
  const anexos = (m.attachments || []) as Anexo[];
  let html = m.html ? limparHtml(m.html) : htmlDeTexto(m.text || "");
  // Imagens coladas no corpo (cid:) viram data: — até 4 MB no total, o resto fica sem imagem.
  let orcamento = 4 * 1024 * 1024;
  const embutidos = new Set<Anexo>();
  for (const a of anexos) {
    if (!a.contentId) continue;
    const cid = a.contentId.replace(/^<|>$/g, "");
    if (!html.includes(`cid:${cid}`)) continue;
    const t = tamanhoDe(a.content);
    if (t > orcamento) continue;
    orcamento -= t;
    html = html.split(`cid:${cid}`).join(`data:${a.mimeType};base64,${paraBase64(bytesDe(a.content))}`);
    embutidos.add(a);
  }
  const listaEnd = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((x: any) => x?.group ? x.group : [x]).filter((x: any) => x?.address).map((x: any) => ({ nome: x.name || "", email: String(x.address).toLowerCase() }));
  return {
    uid,
    lida: true,
    estrela: flags.includes("\\flagged"),
    assunto: m.subject || "",
    de: listaEnd(m.from)[0] || { nome: "", email: "" },
    para: listaEnd(m.to),
    cc: listaEnd(m.cc),
    responderPara: listaEnd(m.replyTo),
    data: m.date ? dataIso(m.date) : null,
    messageId: m.messageId || null,
    referencias: String(m.references || "").split(/\s+/).filter((x) => /^<.+>$/.test(x)),
    html,
    texto: m.text || "",
    anexos: anexos.map((a, i) => ({ indice: i, nome: a.filename || `anexo-${i + 1}`, tipo: a.mimeType, tamanho: tamanhoDe(a.content), oculto: embutidos.has(a) }))
      .filter((a) => !a.oculto).map(({ oculto: _o, ...a }) => a),
  };
}

export async function baixarAnexo(imap: Imap, pasta: string, uid: number, indice: number) {
  await selecionar(imap, pasta, true);
  const { bruto } = await baixarBruto(imap, uid);
  const m = await new PostalMime().parse(bruto);
  const a = (m.attachments || [])[indice] as Anexo | undefined;
  if (!a) throw new ErroEmail("Anexo não encontrado.");
  return { nome: a.filename || `anexo-${indice + 1}`, tipo: a.mimeType, base64: paraBase64(bytesDe(a.content)) };
}

// Anexos do original para "Encaminhar" (sem as imagens do corpo).
export async function anexosDoOriginal(imap: Imap, pasta: string, uid: number) {
  await selecionar(imap, pasta, true);
  const { bruto } = await baixarBruto(imap, uid);
  const m = await new PostalMime().parse(bruto);
  return ((m.attachments || []) as Anexo[]).filter((a) => !ehInline(a)).map((a, i) => ({ nome: a.filename || `anexo-${i + 1}`, tipo: a.mimeType, bytes: bytesDe(a.content) }));
}

export type AcaoMensagem = "lido" | "naoLido" | "estrela" | "semEstrela" | "mover" | "excluir" | "arquivar" | "spam";
export async function agir(imap: Imap, pasta: string, uids: number[], acao: AcaoMensagem, destino?: string) {
  const conj = conjuntoUids(uids);
  if (!conj) throw new ErroEmail("Nenhuma mensagem escolhida.");
  await selecionar(imap, pasta, false);
  const store = (op: string, flag: string) => imap.ok(`UID STORE ${conj} ${op}FLAGS.SILENT (${flag})`);
  if (acao === "lido") return void await store("+", "\\Seen");
  if (acao === "naoLido") return void await store("-", "\\Seen");
  if (acao === "estrela") return void await store("+", "\\Flagged");
  if (acao === "semEstrela") return void await store("-", "\\Flagged");

  const apagarDaqui = async () => {
    await store("+", "\\Deleted");
    if (imap.tem("UIDPLUS")) await imap.ok(`UID EXPUNGE ${conj}`); else await imap.ok("EXPUNGE");
  };
  const moverPara = async (alvo: string) => {
    if (alvo === pasta) return;
    if (imap.tem("MOVE")) { await imap.ok(`UID MOVE ${conj} `, ...nomeCmd(alvo)); return; }
    await imap.ok(`UID COPY ${conj} `, ...nomeCmd(alvo));
    await apagarDaqui();
  };
  if (acao === "mover") {
    if (!destino) throw new ErroEmail("Escolha a pasta de destino.");
    return void await moverPara(destino);
  }
  if (acao === "arquivar" || acao === "spam") {
    const alvo = await pastaDoTipo(imap, acao === "spam" ? "spam" : "arquivo");
    if (!alvo) throw new ErroEmail(acao === "spam" ? "Esta caixa não tem pasta de Spam." : "Esta caixa não tem pasta de Arquivo. Use \"Mover para…\".");
    return void await moverPara(alvo);
  }
  if (acao === "excluir") {
    const lixeira = await pastaDoTipo(imap, "lixeira");
    // Já na Lixeira (ou caixa sem Lixeira): exclui de vez. A tela pede confirmação antes.
    if (!lixeira || lixeira === pasta) return void await apagarDaqui();
    return void await moverPara(lixeira);
  }
  throw new ErroEmail("Ação desconhecida.");
}

export async function guardarEnviado(imap: Imap, mensagem: Uint8Array) {
  const enviados = await pastaDoTipo(imap, "enviados");
  if (!enviados) return false;
  await imap.ok("APPEND ", ...nomeCmd(enviados), " (\\Seen) ", mensagem);
  return true;
}

export async function marcarRespondida(imap: Imap, pasta: string, uid: number) {
  await selecionar(imap, pasta, false);
  await imap.cmd(`UID STORE ${uid} +FLAGS.SILENT (\\Answered)`);
}

// ---------------------------------------------------------------- SMTP (TLS direto, AUTH LOGIN/PLAIN)
export async function smtp(cred: Credencial, envio?: { de: string; destinos: string[]; mensagem: Uint8Array }) {
  const s = cred.servidor;
  let c: Deno.TlsConn;
  try {
    c = await comPrazo(Deno.connectTls({ hostname: s.smtpHost, port: s.smtpPorta, ...(s.caCerts ? { caCerts: s.caCerts } : {}) }), "O servidor de envio não respondeu.");
  } catch (e) {
    if (e instanceof ErroEmail) throw e;
    throw new ErroEmail("Não consegui conectar ao servidor de envio.", "rede");
  }
  let buf = "";
  const ler = async (): Promise<string> => {
    for (;;) {
      const linhas = buf.split("\r\n");
      for (let i = 0; i < linhas.length - 1; i++) if (/^\d{3} /.test(linhas[i])) { const r = linhas.slice(0, i + 1).join("\n"); buf = linhas.slice(i + 1).join("\r\n"); return r; }
      const p = new Uint8Array(8192);
      const n = await comPrazo(c.read(p), "O servidor de envio parou de responder.");
      if (n === null) throw new ErroEmail("O servidor de envio fechou a conexão.", "rede");
      buf += dec.decode(p.subarray(0, n));
    }
  };
  const passo = async (linha: string | null, esperado: string, erro?: ErroEmail) => {
    if (linha !== null) await gravarTudo(c, enc.encode(linha + "\r\n"));
    const r = await ler();
    const ultima = r.split("\n").pop()!;
    if (!ultima.startsWith(esperado)) throw erro || new ErroEmail(`O servidor de envio recusou: ${ultima.slice(0, 200)}`);
    return r;
  };
  const erroLogin = new ErroEmail(cred.provedor === "gmail"
    ? "O Gmail recusou o envio. Confira a \"senha de app\" da Conta Google."
    : "Usuário ou senha do e-mail incorretos (envio).", "login");
  try {
    await passo(null, "220");
    const ehlo = await passo("EHLO painel.minaslab", "250");
    if (/AUTH[ =][^\n]*PLAIN/i.test(ehlo)) {
      await passo(`AUTH PLAIN ${paraBase64(enc.encode(`\u0000${cred.email}\u0000${cred.senha}`))}`, "235", erroLogin);
    } else {
      await passo("AUTH LOGIN", "334", erroLogin);
      await passo(paraBase64(enc.encode(cred.email)), "334", erroLogin);
      await passo(paraBase64(enc.encode(cred.senha)), "235", erroLogin);
    }
    if (envio) {
      await passo(`MAIL FROM:<${envio.de}>`, "250");
      for (const d of envio.destinos) await passo(`RCPT TO:<${d}>`, "25", new ErroEmail(`O endereço ${d} foi recusado pelo servidor.`));
      await passo("DATA", "354");
      // Linhas que começam com "." ganham outro "." (RFC 5321 §4.5.2).
      const texto = dec.decode(envio.mensagem).replace(/\r\n\./g, "\r\n..");
      await gravarTudo(c, enc.encode(texto.endsWith("\r\n") ? texto : texto + "\r\n"));
      await passo(".", "250");
    }
    try { await gravarTudo(c, enc.encode("QUIT\r\n")); } catch { /* ok */ }
  } catch (e) { erroDeRede(e, true); } finally { try { c.close(); } catch { /* ok */ } }
}

export { lerEnderecos, deBase64 };
