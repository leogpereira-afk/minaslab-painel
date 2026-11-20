// ml-email — o e-mail dentro do painel (Léo, 16/11/2026).
//
// Cada pessoa conecta as PRÓPRIAS caixas (Hostinger ou Gmail) e lê, responde, encaminha, move e
// exclui pelo painel. Tudo é feito direto na caixa (IMAP/SMTP): o webmail e o celular mostram o
// mesmo, inclusive o que foi enviado (fica em "Enviados", com a assinatura).
//
// Segurança:
// - crachá do painel conferido a cada chamada e conta lida AO VIVO (ml_contas ativa);
// - cada um só enxerga as próprias caixas (ml_email_contas.usuario = crachá);
// - a senha da caixa fica cifrada (AES-256-GCM, chave no Vault: ml_email_chave, presa ao id da
//   conta) e nunca volta para o navegador.
//
// Ações: naoLidas · inicio · contaSalvar · contaApagar · pastas · listar · ler · conversa · anexo · agir · enviar
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  SERVIDORES, ErroEmail, comImap, listarPastas, listarMensagens, lerMensagem, lerConversa, baixarAnexo, agir, smtp,
  guardarEnviado, marcarRespondida, anexosDoOriginal, naoLidasEntrada, type Credencial, type AcaoMensagem,
} from "../_shared/email-cliente.ts";
import { deBase64, paraBase64, emailValido, lerEnderecos, montarMensagem, textoDeHtml } from "../_shared/email-texto.mjs";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY")!;
const J = Deno.env.get("ML_JWT_SECRET") ?? "";
const SITE = (Deno.env.get("PAINEL_URL") || "https://www.minaslab.online").replace(/\/$/, "");
const sb = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder(), dec = new TextDecoder();
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const txt = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const uuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(txt(v)) ? txt(v) : null;
const inteiro = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };
const LIMITE_ANEXOS = 18 * 1024 * 1024; // soma dos anexos de um envio (Gmail aceita 25 MB com a codificação)

function b64u(s: string) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return deBase64(s); }
async function crachaDoPainel(req: Request) {
  const t = txt(req.headers.get("authorization"), 4000).replace(/^Bearer\s+/i, "");
  if (!t || !J) return null;
  const p = t.split(".");
  if (p.length !== 3) return null;
  try {
    const k = await crypto.subtle.importKey("raw", enc.encode(J), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify("HMAC", k, b64u(p[2]), enc.encode(`${p[0]}.${p[1]}`))) return null;
    const x = JSON.parse(dec.decode(b64u(p[1])));
    if (x.sis !== "minaslab" || (typeof x.exp === "number" && x.exp < Math.floor(Date.now() / 1000))) return null;
    return x;
  } catch { return null; }
}

// ---------------------------------------------------------------- cifra da senha
let chaveCache: CryptoKey | null = null;
async function chave() {
  if (chaveCache) return chaveCache;
  const { data, error } = await sb.rpc("ml_email_chave");
  if (error || !data) throw new Error("Chave do e-mail indisponível no servidor.");
  chaveCache = await crypto.subtle.importKey("raw", deBase64(String(data)), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return chaveCache;
}
async function cifrar(senha: string, id: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(id) }, await chave(), enc.encode(senha)));
  const o = new Uint8Array(12 + c.length); o.set(iv); o.set(c, 12);
  return `v1:${paraBase64(o)}`;
}
async function decifrar(cifra: string, id: string) {
  const u = deBase64(cifra.replace(/^v1:/, ""));
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12), additionalData: enc.encode(id) }, await chave(), u.slice(12)));
}

// ---------------------------------------------------------------- assinatura
// Cargo do RH: ficha (rh_pessoas) com o mesmo nome do login ou com o e-mail da caixa.
async function cargoDoRh(nome: string, emails: string[]) {
  const { data, error } = await sb.from("ml_registros").select("registro").eq("colecao", "rh_pessoas").eq("apagado", false);
  if (error || !data) return "";
  const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const fichas = data.map((d) => d.registro as Record<string, unknown>).filter((r) => !r.desligadoEm && r.ativo !== false);
  const porEmail = fichas.find((r) => emails.includes(norm(r.email)));
  const porNome = fichas.find((r) => norm(r.nome) && norm(r.nome) === norm(nome));
  return txt((porEmail || porNome)?.cargo, 120);
}

// Logo e selo da assinatura vão DENTRO do e-mail (cid:), para aparecerem mesmo quando o
// programa do destinatário bloqueia imagens de fora.
const IMAGENS_ASSINATURA = [
  { cid: "ml-logo@minaslab", arquivo: "assinatura-logo.png", nome: "minaslab.png" },
  { cid: "ml-selo@minaslab", arquivo: "assinatura-selo-crl1943.png", nome: "acreditacao-crl1943.png" },
];
const cacheImagens = new Map<string, Uint8Array>();
async function imagensDaAssinatura(html: string) {
  const out: { cid: string; tipo: string; nome: string; bytes: Uint8Array }[] = [];
  for (const i of IMAGENS_ASSINATURA) {
    if (!html.includes(`cid:${i.cid}`)) continue;
    let bytes = cacheImagens.get(i.arquivo);
    if (!bytes) {
      try {
        const r = await fetch(`${SITE}/email/${i.arquivo}`);
        if (r.ok) { bytes = new Uint8Array(await r.arrayBuffer()); cacheImagens.set(i.arquivo, bytes); }
      } catch { /* sem imagem: cai no link público abaixo */ }
    }
    if (bytes) out.push({ cid: i.cid, tipo: "image/png", nome: i.nome, bytes });
  }
  // Imagem que não deu para embutir vira link do site.
  let h = html;
  for (const i of IMAGENS_ASSINATURA) if (!out.some((o) => o.cid === i.cid)) h = h.split(`cid:${i.cid}`).join(`${SITE}/email/${i.arquivo}`);
  return { html: h, inline: out };
}

// ---------------------------------------------------------------- contas
type ContaEmail = { id: string; usuario: string; email: string; provedor: string; nome_exibicao: string | null; senha_cifra: string; assinatura_ativa: boolean; cargo_assinatura: string | null; ordem: number; ultimo_erro: string | null };
const publica = (c: ContaEmail) => ({ id: c.id, email: c.email, provedor: c.provedor, nomeExibicao: c.nome_exibicao, assinaturaAtiva: c.assinatura_ativa, cargoAssinatura: c.cargo_assinatura, ultimoErro: c.ultimo_erro });
const provedorDe = (email: string, pedido: unknown) => {
  const p = txt(pedido, 20);
  if (p === "gmail" || p === "hostinger") return p;
  return /@(gmail|googlemail)\.com$/i.test(email) ? "gmail" : "hostinger";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const cracha = await crachaDoPainel(req);
  if (!cracha) return json({ erro: "Sua sessão expirou. Entre de novo.", semSessao: true }, 401);
  const usuario = txt(cracha.sub, 80);
  let contaAtual: ContaEmail | null = null;
  try {
    const { data: conta, error: erroConta } = await sb.from("ml_contas").select("ativo,nome").eq("usuario", usuario).maybeSingle();
    if (erroConta) throw erroConta;
    if (!conta || conta.ativo !== true) return json({ erro: "Esta conta foi desativada.", semSessao: true }, 401);
    const nomePessoa = txt(conta.nome, 120) || usuario;

    const body = await req.json().catch(() => ({}));
    const acao = txt(body.acao, 40);

    const minhas = async () => {
      const { data, error } = await sb.from("ml_email_contas").select("*").eq("usuario", usuario).order("ordem").order("criado_em");
      if (error) throw error;
      return (data ?? []) as ContaEmail[];
    };
    const pegarConta = async (id: unknown) => {
      const i = uuid(id);
      if (!i) throw new ErroEmail("Escolha uma caixa de e-mail.");
      const { data, error } = await sb.from("ml_email_contas").select("*").eq("id", i).eq("usuario", usuario).maybeSingle();
      if (error) throw error;
      if (!data) throw new ErroEmail("Caixa de e-mail não encontrada.");
      contaAtual = data as ContaEmail;
      return contaAtual;
    };
    const credencial = async (c: ContaEmail): Promise<Credencial> => ({ servidor: SERVIDORES[c.provedor], provedor: c.provedor, email: c.email, senha: await decifrar(c.senha_cifra, c.id) });
    const pasta = () => { const p = txt(body.pasta, 400); if (!p) throw new ErroEmail("Escolha a pasta."); return p; };

    // Bolinha do menu: não lidas da Caixa de entrada de TODAS as caixas da pessoa.
    // Caixa com problema de acesso não derruba a conta das outras.
    if (acao === "naoLidas") {
      const contas = await minhas();
      if (!contas.length) return json({ ok: true, total: 0, semCaixas: true, porCaixa: [] });
      const porCaixa = await Promise.all(contas.map(async (c) => {
        try {
          const n = await comImap(await credencial(c), (imap) => naoLidasEntrada(imap));
          return { id: c.id, email: c.email, naoLidas: n };
        } catch {
          return { id: c.id, email: c.email, naoLidas: 0, erro: true };
        }
      }));
      return json({ ok: true, total: porCaixa.reduce((s, x) => s + x.naoLidas, 0), porCaixa });
    }

    if (acao === "inicio") {
      const contas = await minhas();
      const cargo = await cargoDoRh(nomePessoa, contas.map((c) => c.email.toLowerCase()));
      return json({ ok: true, usuario, nome: nomePessoa, cargo, contas: contas.map(publica) });
    }

    if (acao === "contaSalvar") {
      const d = body.conta ?? {};
      const id = uuid(d.id);
      const atual = id ? await pegarConta(id) : null;
      const email = txt(d.email ?? atual?.email, 200).toLowerCase();
      if (!emailValido(email)) return json({ erro: "Confira o endereço de e-mail." }, 400);
      const provedor = provedorDe(email, d.provedor ?? atual?.provedor);
      const senha = String(d.senha ?? "").replace(provedor === "gmail" ? /\s+/g : /^$/, "");
      if (atual && email !== atual.email && !senha) return json({ erro: "Ao trocar o endereço, digite a senha da nova caixa." }, 400);
      if (!atual && !senha) return json({ erro: provedor === "gmail" ? "Cole a senha de app do Gmail." : "Digite a senha do e-mail." }, 400);
      if (!atual) {
        const { data: ja } = await sb.from("ml_email_contas").select("id").eq("usuario", usuario).eq("email", email).maybeSingle();
        if (ja) return json({ erro: "Essa caixa já está conectada." }, 400);
      }
      // Confere login de leitura (IMAP) e de envio (SMTP) antes de guardar.
      if (senha) {
        const cred: Credencial = { servidor: SERVIDORES[provedor], provedor, email, senha };
        await comImap(cred, async () => {});
        await smtp(cred);
      }
      const novoId = atual?.id ?? crypto.randomUUID();
      const registro: Record<string, unknown> = {
        id: novoId, usuario, email, provedor,
        nome_exibicao: txt(d.nomeExibicao, 120) || null,
        assinatura_ativa: d.assinaturaAtiva !== false,
        cargo_assinatura: txt(d.cargoAssinatura, 120) || null,
        atualizado_em: new Date().toISOString(),
        ultimo_erro: senha ? null : atual?.ultimo_erro ?? null,
      };
      if (senha) registro.senha_cifra = await cifrar(senha, novoId);
      if (!atual) { const c = await minhas(); registro.ordem = c.length; }
      const { error } = atual ? await sb.from("ml_email_contas").update(registro).eq("id", novoId).eq("usuario", usuario) : await sb.from("ml_email_contas").insert(registro);
      if (error) throw error;
      const c = await pegarConta(novoId);
      return json({ ok: true, conta: publica(c) });
    }

    if (acao === "contaApagar") {
      const c = await pegarConta(body.id);
      const { error } = await sb.from("ml_email_contas").delete().eq("id", c.id).eq("usuario", usuario);
      if (error) throw error;
      return json({ ok: true });
    }

    if (acao === "pastas") {
      const c = await pegarConta(body.conta);
      const pastas = await comImap(await credencial(c), (imap) => listarPastas(imap, true));
      if (c.ultimo_erro) await sb.from("ml_email_contas").update({ ultimo_erro: null }).eq("id", c.id);
      return json({ ok: true, pastas });
    }

    if (acao === "listar") {
      const c = await pegarConta(body.conta);
      const f = body.filtro ?? {};
      const r = await comImap(await credencial(c), (imap) => listarMensagens(imap, c.provedor, pasta(), inteiro(body.pagina) || 1, {
        busca: txt(f.busca, 200), naoLidas: f.naoLidas === true, comAnexo: f.comAnexo === true, estrela: f.estrela === true,
      }));
      return json({ ok: true, ...r });
    }

    if (acao === "ler") {
      const c = await pegarConta(body.conta);
      const uid = inteiro(body.uid);
      if (!uid) return json({ erro: "Mensagem inválida." }, 400);
      const m = await comImap(await credencial(c), (imap) => lerMensagem(imap, pasta(), uid, body.marcarLida !== false));
      return json({ ok: true, mensagem: m });
    }

    if (acao === "conversa") {
      const c = await pegarConta(body.conta);
      const mensagens = await comImap(await credencial(c), (imap) => lerConversa(imap, pasta(), txt(body.assunto, 500)));
      return json({ ok: true, mensagens });
    }

    if (acao === "anexo") {
      const c = await pegarConta(body.conta);
      const uid = inteiro(body.uid), indice = Number(body.indice);
      if (!uid || !Number.isInteger(indice) || indice < 0) return json({ erro: "Anexo inválido." }, 400);
      const a = await comImap(await credencial(c), (imap) => baixarAnexo(imap, pasta(), uid, indice));
      return json({ ok: true, anexo: a });
    }

    if (acao === "agir") {
      const c = await pegarConta(body.conta);
      const acoes: AcaoMensagem[] = ["lido", "naoLido", "estrela", "semEstrela", "mover", "excluir", "arquivar", "spam"];
      const a = txt(body.tipo, 20) as AcaoMensagem;
      if (!acoes.includes(a)) return json({ erro: "Ação inválida." }, 400);
      const uids = (Array.isArray(body.uids) ? body.uids : []).map(inteiro).filter(Boolean).slice(0, 500);
      await comImap(await credencial(c), (imap) => agir(imap, pasta(), uids, a, txt(body.destino, 400) || undefined));
      return json({ ok: true });
    }

    if (acao === "enviar") {
      const c = await pegarConta(body.conta);
      const lista = (v: unknown) => (Array.isArray(v) ? v.map((x) => txt(x, 320)).join(",") : txt(v, 5000));
      const para = lerEnderecos(lista(body.para)), cc = lerEnderecos(lista(body.cc)), cco = lerEnderecos(lista(body.cco));
      const todos = [...para, ...cc, ...cco];
      if (!para.length) return json({ erro: "Coloque pelo menos um destinatário em \"Para\"." }, 400);
      const ruim = todos.find((e) => !emailValido(e.email));
      if (ruim) return json({ erro: `Confira o endereço: ${ruim.email}` }, 400);
      if (todos.length > 100) return json({ erro: "No máximo 100 destinatários por mensagem." }, 400);
      const assunto = txt(body.assunto, 300);
      const htmlPedido = String(body.html ?? "").slice(0, 2_000_000);
      if (!assunto && !textoDeHtml(htmlPedido)) return json({ erro: "Escreva o assunto ou a mensagem." }, 400);

      const anexos: { nome: string; tipo: string; bytes: Uint8Array }[] = [];
      let total = 0;
      for (const a of (Array.isArray(body.anexos) ? body.anexos : []).slice(0, 30)) {
        const bytes = deBase64(String(a?.base64 ?? ""));
        total += bytes.length;
        if (total > LIMITE_ANEXOS) return json({ erro: "Os anexos passam de 18 MB. Envie por link do Google Drive." }, 400);
        anexos.push({ nome: txt(a?.nome, 200) || "anexo", tipo: txt(a?.tipo, 120) || "application/octet-stream", bytes });
      }
      const origem = body.origem && typeof body.origem === "object" ? { pasta: txt(body.origem.pasta, 400), uid: inteiro(body.origem.uid), modo: txt(body.origem.modo, 20) } : null;
      const cred = await credencial(c);
      const dominio = c.email.split("@")[1] || "minaslab.online";
      const { html, inline } = await imagensDaAssinatura(htmlPedido);
      const referencias = (Array.isArray(body.referencias) ? body.referencias : []).map((x: unknown) => txt(x, 300)).filter((x: string) => /^<[^<>\s]+>$/.test(x)).slice(-20);
      const inReplyTo = /^<[^<>\s]+>$/.test(txt(body.inReplyTo, 300)) ? txt(body.inReplyTo, 300) : undefined;

      await comImap(cred, async (imap) => {
        if (origem?.uid && origem.pasta && origem.modo === "encaminhar" && body.anexosOriginais === true) {
          for (const a of await anexosDoOriginal(imap, origem.pasta, origem.uid)) {
            total += a.bytes.length;
            if (total > LIMITE_ANEXOS) throw new ErroEmail("Os anexos passam de 18 MB. Envie por link do Google Drive.");
            anexos.push(a);
          }
        }
        const mensagem = montarMensagem({
          de: { nome: txt(c.nome_exibicao, 120) || nomePessoa, email: c.email },
          para, cc, assunto,
          html, texto: textoDeHtml(html.replace(/<img[^>]*>/gi, "")),
          messageId: `<${crypto.randomUUID()}@${dominio}>`,
          inReplyTo, referencias: inReplyTo && !referencias.includes(inReplyTo) ? [...referencias, inReplyTo] : referencias,
          inline, anexos,
        });
        await smtp(cred, { de: c.email, destinos: todos.map((e) => e.email), mensagem });
        // O Gmail já guarda em "Enviados" sozinho; a Hostinger não — guardamos a cópia lá.
        if (c.provedor !== "gmail") { try { await guardarEnviado(imap, mensagem); } catch { /* enviado mesmo assim */ } }
        if (origem?.uid && origem.pasta && origem.modo === "responder") { try { await marcarRespondida(imap, origem.pasta, origem.uid); } catch { /* ok */ } }
      });
      return json({ ok: true });
    }

    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    if (e instanceof ErroEmail) {
      if (e.tipo === "login" && contaAtual) await sb.from("ml_email_contas").update({ ultimo_erro: e.message }).eq("id", (contaAtual as ContaEmail).id);
      return json({ erro: e.message, tipo: e.tipo }, e.tipo === "login" ? 400 : 502);
    }
    console.error("ml-email", e);
    return json({ erro: "Não consegui completar agora. Tente de novo em instantes." }, 500);
  }
});
