// email-atendimento: a caixa de e-mail da Hostinger dentro de Atendimentos.
//
// Ações (corpo { acao, ... }):
//   testar   confere a conexão e o login (IMAP e SMTP), sem ler mensagens
//   buscar   lê a entrada e os enviados (IMAP) desde a última leitura e grava em email_mensagens
//   enviar   { lead_id, para, cc?, assunto, texto, responder_a?, anexo? } envia por SMTP e
//            guarda uma cópia em "Enviados" (o webmail continua mostrando tudo)
//
// Acesso da caixa nos segredos das funções: HOSTINGER_EMAIL_USUARIO e HOSTINGER_EMAIL_SENHA
// (opcional HOSTINGER_EMAIL_NOME = nome que aparece no "De:").
// Quem chama: rotina (x-rotina-token, conferido no cofre) ou usuário logado do CRM;
// enviar exige a permissão crm.write.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";
import PostalMime from "https://esm.sh/postal-mime@2.4.4";

const IMAP_HOST = "imap.hostinger.com", IMAP_PORT = 993;
const SMTP_HOST = "smtp.hostinger.com", SMTP_PORT = 465;
const BUCKET_ANEXOS = "email-anexos", BUCKET_ENVIO = "chatpro-envios";
// O servidor de funções limita o tempo de CPU por chamada: poucos e-mails completos por rodada.
const MAX_POR_RODADA = 60, MAX_COMPLETOS = 6, MAX_BYTES = 8 * 1024 * 1024; // completos por pasta
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, x-rotina-token, apikey, x-client-info" };

function fromJson(name: string): string { try { return JSON.parse(Deno.env.get(name) ?? "{}")["default"] ?? ""; } catch { return ""; } }
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEY = Deno.env.get("SB_SECRET_KEY") || fromJson("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const enc = new TextEncoder(), dec = new TextDecoder();

// ---------------- IMAP mínimo (LOGIN, LIST, SELECT, UID SEARCH/FETCH, APPEND) ----------------
type Resposta = { linhas: string[]; literais: Uint8Array[]; ok: boolean; status: string };
class Imap {
  // Buffer que cresce dobrando (e-mails com anexos grandes não viram cópias quadráticas).
  private buf = new Uint8Array(1 << 16);
  private ini = 0;
  private fim = 0;
  private n = 0;
  private constructor(private c: Deno.TlsConn) {}
  static async abrir() {
    const i = new Imap(await Deno.connectTls({ hostname: IMAP_HOST, port: IMAP_PORT }));
    await i.linha(); // saudação
    return i;
  }
  private async mais() {
    if (this.buf.length - this.fim < 1 << 15) {
      const usado = this.fim - this.ini;
      const novo = usado * 2 + (1 << 16) > this.buf.length ? new Uint8Array(Math.max(this.buf.length * 2, usado + (1 << 17))) : this.buf;
      novo.set(this.buf.subarray(this.ini, this.fim), 0);
      this.buf = novo; this.ini = 0; this.fim = usado;
    }
    const lido = await Promise.race([this.c.read(this.buf.subarray(this.fim)), new Promise<null>((_, r) => setTimeout(() => r(new Error("IMAP sem resposta")), 30000))]);
    if (lido === null) throw new Error("IMAP fechou a conexão");
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
  // Envia um comando e lê até a resposta marcada; literais {n} são lidos inteiros.
  async cmd(comando: string, continuar?: () => Promise<void>): Promise<Resposta> {
    const tag = `A${++this.n}`;
    await this.c.write(enc.encode(`${tag} ${comando}\r\n`));
    const linhas: string[] = [], literais: Uint8Array[] = [];
    for (;;) {
      let l = await this.linha();
      if (l.startsWith("+") && continuar) { await continuar(); continue; }
      // Junta as partes de uma resposta com literal: "... {123}" + bytes + resto da linha.
      while (/\{\d+\}$/.test(l)) {
        const qtd = Number(l.match(/\{(\d+)\}$/)![1]);
        literais.push(await this.bytes(qtd));
        l = l.replace(/\{\d+\}$/, `{#${literais.length - 1}}`) + await this.linha();
      }
      if (l.startsWith(tag + " ")) {
        const status = l.slice(tag.length + 1);
        return { linhas, literais, ok: status.startsWith("OK"), status };
      }
      linhas.push(l);
    }
  }
  async escrever(b: Uint8Array) { await this.c.write(b); }
  fechar() { try { this.c.close(); } catch { /* já fechada */ } }
}
const aspas = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

async function pastas(imap: Imap) {
  const r = await imap.cmd('LIST "" "*"');
  const nomes = r.linhas.filter((l) => l.startsWith("* LIST")).map((l) => {
    const flags = (l.match(/^\* LIST \(([^)]*)\)/)?.[1] || "").toLowerCase();
    const nome = (l.match(/"([^"]*)"\s*$/)?.[1] ?? l.split(" ").pop() ?? "").replace(/^"|"$/g, "");
    return { nome, flags };
  });
  const enviados = nomes.find((p) => p.flags.includes("\\sent"))?.nome
    || nomes.find((p) => /^(inbox[./])?(sent|enviad)/i.test(p.nome))?.nome || "";
  return { enviados };
}

// ---------------- SMTP mínimo (TLS 465, AUTH LOGIN) ----------------
async function smtpEnviar(usuario: string, senha: string, de: string, destinos: string[], mensagem: Uint8Array) {
  const c = await Deno.connectTls({ hostname: SMTP_HOST, port: SMTP_PORT });
  let buf = "";
  const ler = async (): Promise<string> => {
    // Lê até a última linha da resposta ("250 ..." sem hífen).
    for (;;) {
      const linhas = buf.split("\r\n");
      for (let i = 0; i < linhas.length - 1; i++) if (/^\d{3} /.test(linhas[i])) { const r = linhas.slice(0, i + 1).join("\n"); buf = linhas.slice(i + 1).join("\r\n"); return r; }
      const p = new Uint8Array(4096);
      const n = await Promise.race([c.read(p), new Promise<null>((_, r) => setTimeout(() => r(new Error("SMTP sem resposta")), 30000))]);
      if (n === null) throw new Error("SMTP fechou a conexão");
      buf += dec.decode(p.subarray(0, n));
    }
  };
  const passo = async (linha: string | null, esperado: string) => {
    if (linha !== null) await c.write(enc.encode(linha + "\r\n"));
    const r = await ler();
    if (!r.split("\n").pop()!.startsWith(esperado)) throw new Error(`SMTP: ${r.split("\n").pop()}`);
  };
  try {
    await passo(null, "220");
    await passo("EHLO crm.minaslab", "250");
    await passo("AUTH LOGIN", "334");
    await passo(btoa(usuario), "334");
    await passo(btoa(senha), "235");
    await passo(`MAIL FROM:<${de}>`, "250");
    for (const d of destinos) await passo(`RCPT TO:<${d}>`, "25");
    await passo("DATA", "354");
    await c.write(mensagem);
    await passo("\r\n.", "250");
    try { await c.write(enc.encode("QUIT\r\n")); } catch { /* ok */ }
  } finally { try { c.close(); } catch { /* ok */ } }
}

// ---------------- Montagem de mensagem (MIME) ----------------
const b64 = (bytes: Uint8Array) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const quebra76 = (s: string) => s.replace(/.{1,76}/g, (m) => m + "\r\n");
const cab = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(enc.encode(s))}?=`);
function montar(o: { de: string; nomeDe: string; para: string[]; cc: string[]; assunto: string; texto: string; messageId: string; inReplyTo?: string; refs?: string[]; anexo?: { nome: string; tipo: string; bytes: Uint8Array } }) {
  const h = [
    `From: ${o.nomeDe ? `${cab(o.nomeDe)} <${o.de}>` : o.de}`,
    `To: ${o.para.join(", ")}`,
    ...(o.cc.length ? [`Cc: ${o.cc.join(", ")}`] : []),
    `Subject: ${cab(o.assunto)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: ${o.messageId}`,
    ...(o.inReplyTo ? [`In-Reply-To: ${o.inReplyTo}`] : []),
    ...(o.refs?.length ? [`References: ${o.refs.join(" ")}`] : []),
    "MIME-Version: 1.0",
  ];
  const corpoTexto = ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", quebra76(b64(enc.encode(o.texto)))].join("\r\n");
  let corpo: string;
  if (o.anexo) {
    const lim = `----=_crm_${crypto.randomUUID()}`;
    h.push(`Content-Type: multipart/mixed; boundary="${lim}"`);
    corpo = [
      "", `--${lim}`, corpoTexto,
      `--${lim}`, `Content-Type: ${o.anexo.tipo || "application/octet-stream"}; name="${cab(o.anexo.nome)}"`, "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${cab(o.anexo.nome)}"`, "", quebra76(b64(o.anexo.bytes)), `--${lim}--`, "",
    ].join("\r\n");
    return enc.encode(h.join("\r\n") + "\r\n" + corpo);
  }
  return enc.encode(h.join("\r\n") + "\r\n" + corpoTexto);
}

// Corta o histórico citado ("Em ... escreveu:", "-----Original Message-----", linhas com ">").
function semCitacao(t: string) {
  const linhas = t.replace(/\r/g, "").split("\n");
  const corte = linhas.findIndex((l, i) => /^\s*(Em .{4,200} escreveu:|On .{4,200} wrote:|-{2,}\s*(Original Message|Mensagem original)\s*-{2,}|De: .+|From: .+)\s*$/i.test(l) && i > 0);
  const base = (corte > 0 ? linhas.slice(0, corte) : linhas).filter((l) => !/^\s*>/.test(l));
  return base.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
const deHtml = (h: string) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const nomeArquivo = (n: string) => (n || "anexo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]+/g, "_").slice(-90);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
  if (req.method !== "POST") return json(405, { ok: false, erro: "use POST" });
  if (!SUPABASE_URL || !SECRET_KEY) return json(503, { ok: false, erro: "ambiente do servidor incompleto" });
  const sb = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } });

  let deRotina = false, usuarioId = "";
  const rotina = req.headers.get("x-rotina-token") || "";
  if (rotina) { const { data } = await sb.rpc("ml_chatpro_conferir_rotina", { p_token: rotina }); deRotina = data === true; }
  if (!deRotina) {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (jwt) { const { data } = await sb.auth.getUser(jwt); usuarioId = data?.user?.id || ""; }
  }
  if (!deRotina && !usuarioId) return json(401, { ok: false, erro: "não autorizado" });

  let corpo: any = {};
  try { corpo = await req.json(); } catch { corpo = {}; }
  const acao = txt(corpo?.acao) || "buscar";

  const usuario = txt(Deno.env.get("HOSTINGER_EMAIL_USUARIO")), senha = Deno.env.get("HOSTINGER_EMAIL_SENHA") || "";
  const nomeDe = txt(Deno.env.get("HOSTINGER_EMAIL_NOME")) || "MinasLab";
  if (!usuario || !senha) return json(200, { ok: false, configurado: false, erro: "A caixa de e-mail ainda não foi configurada no servidor." });

  // ---------- enviar ----------
  if (acao === "enviar") {
    if (!deRotina) {
      const { data } = await sb.rpc("crm_usuario_tem_permissao", { p_usuario: usuarioId, p_permissao: "crm.write" });
      if (data !== true) return json(403, { ok: false, erro: "Seu usuário não tem permissão para enviar e-mails." });
    }
    const valido = (e: string) => /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(e);
    const lista = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(/[,;]/)).map((x) => txt(x).toLowerCase()).filter(Boolean);
    const para = lista(corpo?.para), cc = lista(corpo?.cc);
    const assunto = txt(corpo?.assunto).slice(0, 300), texto = String(corpo?.texto ?? "").slice(0, 50000);
    const leadId = txt(corpo?.lead_id);
    if (!para.length || ![...para, ...cc].every(valido)) return json(200, { ok: false, erro: "Confira os endereços de e-mail." });
    if (!assunto || !texto.trim()) return json(200, { ok: false, erro: "Preencha o assunto e a mensagem." });

    // Resposta: encadeia com o e-mail original.
    let inReplyTo: string | undefined, refs: string[] = [];
    const responderA = txt(corpo?.responder_a);
    if (responderA) {
      const { data: orig } = await sb.from("email_mensagens").select("message_id,referencias").eq("message_id", responderA).maybeSingle();
      if (orig) { inReplyTo = orig.message_id; refs = [...(orig.referencias || []), orig.message_id].slice(-20); }
    }
    let anexo: { nome: string; tipo: string; bytes: Uint8Array } | undefined;
    const caminho = txt(corpo?.anexo);
    if (caminho) {
      if (caminho.includes("..")) return json(400, { ok: false, erro: "Anexo inválido." });
      const { data: blob, error } = await sb.storage.from(BUCKET_ENVIO).download(caminho);
      if (error || !blob) return json(200, { ok: false, erro: "Não encontrei o anexo enviado." });
      anexo = { nome: caminho.split("/").pop()!.replace(/^\d+-/, ""), tipo: blob.type, bytes: new Uint8Array(await blob.arrayBuffer()) };
    }
    const dominio = usuario.split("@")[1] || "minaslab.net";
    const messageId = `<crm.${crypto.randomUUID()}@${dominio}>`;
    const mensagem = montar({ de: usuario, nomeDe, para, cc, assunto, texto, messageId, inReplyTo, refs, anexo });
    try { await smtpEnviar(usuario, senha, usuario, [...para, ...cc], mensagem); }
    catch (e) { return json(200, { ok: false, erro: `O servidor de e-mail recusou o envio (${String((e as Error).message || e).slice(0, 160)}).` }); }

    // Cópia em "Enviados" para o webmail mostrar (se falhar, o e-mail já foi).
    let pasta = "";
    try {
      const imap = await Imap.abrir();
      if ((await imap.cmd(`LOGIN ${aspas(usuario)} ${aspas(senha)}`)).ok) {
        pasta = (await pastas(imap)).enviados;
        if (pasta) await imap.cmd(`APPEND ${aspas(pasta)} (\\Seen) {${mensagem.length}}`, async () => { await imap.escrever(mensagem); await imap.escrever(enc.encode("\r\n")); });
      }
      await imap.cmd("LOGOUT").catch(() => null); imap.fechar();
    } catch { /* ignora */ }

    const { data: reg } = await sb.rpc("email_registrar", { p: {
      caixa: usuario, pasta: pasta || "Enviados (CRM)", message_id: messageId, in_reply_to: inReplyTo ?? null, referencias: refs,
      direcao: "SENT", de_email: usuario, de_nome: nomeDe, para, cc, assunto, texto, texto_resumido: texto,
      anexos: anexo ? [{ nome: anexo.nome, tipo: anexo.tipo, tamanho: anexo.bytes.length, caminho: `${BUCKET_ENVIO}:${caminho}` }] : [],
      recebido_em: new Date().toISOString(), lead_id: leadId || null, enviado_por: usuarioId || null,
    } });
    return json(200, { ok: true, enviado: true, registro: reg });
  }

  // ---------- testar / buscar ----------
  let imap: Imap;
  try { imap = await Imap.abrir(); } catch (e) { return json(200, { ok: false, erro: `Sem conexão com o e-mail: ${String(e).slice(0, 120)}` }); }
  const login = await imap.cmd(`LOGIN ${aspas(usuario)} ${aspas(senha)}`);
  if (!login.ok) { imap.fechar(); return json(200, { ok: false, erro: "Usuário ou senha do e-mail recusados pela Hostinger." }); }
  const { enviados } = await pastas(imap);
  if (acao === "testar") { await imap.cmd("LOGOUT").catch(() => null); imap.fechar(); return json(200, { ok: true, caixa: usuario, pasta_enviados: enviados || null }); }

  // Leitura em duas frentes por pasta:
  //  1) novos: UIDs acima do maior já lido (ordem crescente) — chegam em até 5 minutos;
  //  2) histórico: do maior para o menor, até achar e-mails com mais de 30 dias (pela data do e-mail;
  //     a data interna do IMAP não serve: caixas migradas têm milhares de e-mails "recentes").
  const inicio = Date.now(), LIMITE_MS = 100_000, HISTORICO_DIAS = 30;
  const resultado: Record<string, unknown> = {};
  const lerUids = (r: Resposta) => (r.linhas.find((l) => l.startsWith("* SEARCH")) || "").replace("* SEARCH", "").trim().split(/\s+/).map(Number).filter((n) => n > 0);

  // Lê e grava um e-mail. "antigo" = data do e-mail fora da janela do histórico.
  let completos = 0;
  const processar = async (pasta: string, validade: number, uid: number, noHistorico: boolean): Promise<{ status: "ok" | "antigo" | "erro" | "pausa"; novo?: boolean }> => {
    // Primeiro só o cabeçalho (barato): data e Message-ID decidem se precisa baixar o resto.
    const cab = await imap.cmd(`UID FETCH ${uid} (RFC822.SIZE BODY.PEEK[HEADER.FIELDS (MESSAGE-ID DATE)])`);
    const cabTxt = cab.literais[0] ? dec.decode(cab.literais[0]).replace(/\r?\n[ \t]+/g, " ") : "";
    const idCab = cabTxt.match(/^message-id:\s*(<[^>]+>)/im)?.[1] || "";
    const dataCab = cabTxt.match(/^date:\s*(.+)$/im)?.[1]?.trim();
    const dCab = dataCab ? new Date(dataCab) : null;
    if (noHistorico && dCab && !isNaN(dCab.getTime()) && Date.now() - dCab.getTime() > HISTORICO_DIAS * 864e5) return { status: "antigo" };
    if (idCab) {
      const { data: jaCab } = await sb.from("email_mensagens").select("id,html").eq("message_id", idCab).maybeSingle();
      if (jaCab && (jaCab.html || noHistorico === false)) return { status: "ok" };
    }
    if (completos >= MAX_COMPLETOS) return { status: "pausa" };
    completos++;
    const tam = cab;
    const tamanho = Number(tam.linhas.join(" ").match(/RFC822\.SIZE (\d+)/)?.[1] || 0);
    const r = await imap.cmd(`UID FETCH ${uid} (INTERNALDATE ${tamanho > MAX_BYTES ? "BODY.PEEK[HEADER]" : "BODY.PEEK[]"})`);
    const bruto = r.literais[0];
    if (!bruto) return { status: "ok" };
    const internal = r.linhas.join(" ").match(/INTERNALDATE "([^"]+)"/)?.[1];
    const m: any = await PostalMime.parse(bruto);
    const quando = m.date && !isNaN(new Date(m.date).getTime()) ? new Date(m.date) : internal ? new Date(internal) : new Date();
    if (noHistorico && Date.now() - quando.getTime() > HISTORICO_DIAS * 864e5) return { status: "antigo" };
    const cabecalhos = new Map<string, string>((m.headers || []).map((h: any) => [String(h.key).toLowerCase(), String(h.value)]));
    let de = txt(m.from?.address).toLowerCase(), deNome = txt(m.from?.name) || null;
    // Formulário do site: chega "de" um endereço da MinasLab com o visitante no corpo
    // ("De: Nome email@..."). Currículos ("Trabalhe no Minaslab") não viram atendimento.
    let formularioRh = false;
    const proprio = /@([a-z0-9-]+\.)*minaslab\./i.test(de);
    if (proprio && pasta === "INBOX") {
      const corpoForm = txt(m.text) || deHtml(m.html || "");
      const v = corpoForm.match(/^\s*De:\s*(.*?)\s*<?([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>?\s*$/im);
      formularioRh = /trabalhe|curr[ií]culo|vaga/i.test(txt(m.subject));
      const resp = txt(m.replyTo?.[0]?.address).toLowerCase();
      if (v && !/minaslab\./i.test(v[2])) { de = v[2].toLowerCase(); deNome = txt(v[1]) || deNome; }
      else if (resp && !/minaslab\./i.test(resp)) { de = resp; deNome = txt(m.replyTo?.[0]?.name) || deNome; }
    }
    const automatica = formularioRh || /no-?reply|mailer-daemon|postmaster|notifica|newsletter/i.test(de)
      || (cabecalhos.get("auto-submitted") || "no").toLowerCase() !== "no"
      || /bulk|list|junk/i.test(cabecalhos.get("precedence") || "") || cabecalhos.has("list-unsubscribe");
    const texto = (txt(m.text) || deHtml(m.html || "")) + (tamanho > MAX_BYTES ? "\n\n[E-mail grande demais para trazer ao CRM; abra no webmail.]" : "");
    const messageId = txt(m.messageId) || `<sem-id.${uid}.${validade}@${pasta}>`;
    // Já gravado: só completa o html (se faltar), sem reenviar anexos.
    const { data: ja } = await sb.from("email_mensagens").select("id,html").eq("message_id", messageId).maybeSingle();
    if (ja) {
      if (!ja.html && m.html) await sb.rpc("email_registrar", { p: { message_id: messageId, html: String(m.html).slice(0, 400000) } });
      return { status: "ok" };
    }
    const anexos: unknown[] = [];
    for (const a of (m.attachments || []) as any[]) {
      if (a.disposition === "inline" && a.contentId && /^image\//.test(a.mimeType || "")) continue; // assinatura/logo
      const bytes = new Uint8Array(a.content as ArrayBuffer);
      if (!bytes.length || bytes.length > 20 * 1024 * 1024) continue;
      const cam = `${validade}/${uid}/${nomeArquivo(a.filename || "anexo")}`;
      const up = await sb.storage.from(BUCKET_ANEXOS).upload(cam, bytes, { contentType: a.mimeType || "application/octet-stream", upsert: true });
      if (!up.error) anexos.push({ nome: a.filename || "anexo", tipo: a.mimeType, tamanho: bytes.length, caminho: `${BUCKET_ANEXOS}:${cam}` });
    }
    const direcao = pasta === "INBOX" ? "RECEIVED" : "SENT";
    // E-mail antigo: só cria atendimento para remetente já cadastrado.
    const historico = Date.now() - quando.getTime() > 2 * 864e5;
    const { data: reg, error } = await sb.rpc("email_registrar", { p: {
      caixa: usuario, pasta, uid, message_id: messageId, in_reply_to: txt(m.inReplyTo) || null,
      referencias: txt(m.references).split(/\s+/).filter(Boolean),
      direcao, de_email: de, de_nome: deNome,
      para: (m.to || []).map((x: any) => x.address).filter(Boolean), cc: (m.cc || []).map((x: any) => x.address).filter(Boolean),
      assunto: txt(m.subject), texto, texto_resumido: semCitacao(texto), html: m.html ? String(m.html).slice(0, 400000) : null, anexos, automatica, historico,
      recebido_em: quando.toISOString(),
    } });
    if (error) return { status: "erro" };
    return { status: "ok", novo: Boolean((reg as any)?.atendimento_novo) };
  };

  for (const pasta of ["INBOX", enviados].filter(Boolean)) {
    const chave = `${usuario}|${pasta}`;
    const sel = await imap.cmd(`EXAMINE ${aspas(pasta)}`);
    if (!sel.ok) { resultado[pasta] = { erro: sel.status }; continue; }
    const validade = Number(sel.linhas.join(" ").match(/UIDVALIDITY (\d+)/)?.[1] || 0);
    const { data: est } = await sb.from("email_estado").select("uidvalidity,ultimo_uid,piso_uid,historico_ok").eq("chave", chave).maybeSingle();
    const mesma = !!est && Number(est.uidvalidity) === validade;
    let ultimo = mesma ? Number(est!.ultimo_uid) : 0;
    let piso = mesma && est!.piso_uid != null ? Number(est!.piso_uid) : null;
    let historicoOk = mesma ? Boolean(est!.historico_ok) : false;
    let gravados = 0, novos = 0, erros = 0, lidos = 0;
    completos = 0;
    const porRodada = MAX_POR_RODADA;

    // Primeira vez: o histórico começa do e-mail mais novo e desce.
    if (ultimo === 0) {
      const todos = lerUids(await imap.cmd("UID SEARCH ALL"));
      const topo = todos.length ? Math.max(...todos) : 0;
      ultimo = topo; piso = topo + 1; historicoOk = topo === 0;
    }

    // 1) Novos.
    const novosUids = lerUids(await imap.cmd(`UID SEARCH UID ${ultimo + 1}:*`)).filter((u) => u > ultimo).sort((a, b) => a - b);
    for (const uid of novosUids) {
      if (lidos >= porRodada || Date.now() - inicio > LIMITE_MS) break;
      try { const r = await processar(pasta, validade, uid, false); lidos++; if (r.status === "pausa") break; if (r.status === "erro") { erros++; break; } gravados++; if (r.novo) novos++; ultimo = uid; }
      catch { erros++; break; }
    }

    // 2) Histórico (mais novo -> mais antigo), pulando o que já está gravado com html.
    let restanteHistorico = 0;
    if (!historicoOk && piso != null && piso > 1) {
      const abaixo = lerUids(await imap.cmd(`UID SEARCH UID 1:${piso - 1}`)).filter((u) => u < piso!).sort((a, b) => b - a);
      const { data: ja } = await sb.from("email_mensagens").select("uid").eq("pasta", pasta).not("html", "is", null).in("uid", abaixo.slice(0, 600));
      const prontos = new Set((ja ?? []).map((x: any) => Number(x.uid)));
      let parou = false;
      for (const uid of abaixo) {
        if (lidos >= porRodada || Date.now() - inicio > LIMITE_MS) break;
        if (prontos.has(uid)) { piso = uid; continue; }
        try {
          const r = await processar(pasta, validade, uid, true); lidos++;
          if (r.status === "pausa") break;
          if (r.status === "antigo") { historicoOk = true; parou = true; break; }
          if (r.status === "erro") { erros++; break; }
          gravados++; if (r.novo) novos++; piso = uid;
        } catch { erros++; break; }
      }
      if (!parou && abaixo.length && piso === abaixo[abaixo.length - 1]) historicoOk = true;
      if (!abaixo.length) historicoOk = true;
      restanteHistorico = historicoOk ? 0 : abaixo.filter((u) => u < (piso ?? 0)).length;
    } else historicoOk = true;

    await sb.from("email_estado").upsert({ chave, uidvalidity: validade, ultimo_uid: ultimo, piso_uid: piso, historico_ok: historicoOk, atualizado_em: new Date().toISOString(), ultimo_erro: erros ? "falha ao ler uma mensagem" : null });
    resultado[pasta] = { novos_na_caixa: novosUids.length, gravados, atendimentos_novos: novos, erros, historico_concluido: historicoOk, historico_restante: restanteHistorico };
  }
  await imap.cmd("LOGOUT").catch(() => null); imap.fechar();
  return json(200, { ok: true, caixa: usuario, pastas: resultado });
});
