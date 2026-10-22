// ml-messenger — conversas individuais e grupos entre os usuários do painel.
//
// Quem entra: qualquer usuário ATIVO do painel (crachá conferido aqui + conta ativa conferida ao vivo).
// Privacidade: só os membros leem uma conversa. Nem a direção lê conversa dos outros.
// "Lida" é por posição: cada membro guarda a `seq` da última mensagem que já viu (lido_ate).
//
// Ações: reagir, enviar_arquivo, arquivo_url, foto_grupo, descricao, usuarios, conversas, contar, abrir_direta, criar_grupo, obter, enviar, membros, sair, renomear, silenciar, apagar_mensagem, editar_mensagem.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY")!;
const J = Deno.env.get("ML_JWT_SECRET") ?? "";
const sb = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder(), dec = new TextDecoder();
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const txt = (v: unknown) => String(v ?? "").trim();
const BUCKET_FOTOS = "ml-fotos-perfil";
const BUCKET_ARQUIVOS = "ml-arquivos";
const MAX_ANEXO_BYTES = 8 * 1024 * 1024;
// Tipos aceitos (pelo nome do arquivo; o tipo que o navegador diz não vale). Nada executável.
const TIPOS_ANEXO: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv", txt: "text/plain", xml: "application/xml", zip: "application/zip",
  // mensagens de voz (gravadas na tela; o navegador gera webm/ogg, o Safari gera m4a)
  webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav",
};
const MAX_AUDIO_SEG = 600;
const extensaoDe = (nome: string) => (nome.split(".").length > 1 ? nome.split(".").pop()!.toLowerCase() : "");
const nomeSeguro = (nome: string) => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(-80) || "arquivo";
const anexoDe = (m: any) => (m.anexo_caminho ? { nome: m.anexo_nome, tipo: m.anexo_tipo, tamanho: m.anexo_tamanho, duracao: m.anexo_duracao ?? null } : null);
const ehAudio = (tipo: unknown) => String(tipo ?? "").startsWith("audio/");
const dizDe = (m: any) => (m.anexo_caminho && ehAudio(m.anexo_tipo) ? `🎤 Mensagem de voz${m.anexo_duracao ? ` (${Math.floor(m.anexo_duracao / 60)}:${String(m.anexo_duracao % 60).padStart(2, "0")})` : ""}` : m.anexo_caminho ? `📎 ${m.anexo_nome}${txt(m.texto) ? ` — ${txt(m.texto)}` : ""}` : m.texto);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class Falha extends Error { constructor(public status: number, msg: string) { super(msg); } }
const erro = (status: number, msg: string): never => { throw new Falha(status, msg); };

function b64u(s: string) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }
async function crachaDoPainel(req: Request) {
  const t = txt(req.headers.get("authorization")).replace(/^Bearer\s+/i, "");
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

// ---------------------------------------------------------------- utilidades
const fatiar = <T,>(lista: T[], n = 150) => { const o: T[][] = []; for (let i = 0; i < lista.length; i += n) o.push(lista.slice(i, i + n)); return o; };
const unicos = (l: unknown[]) => [...new Set(l.map(txt).filter(Boolean))];
async function lerPorIds(tabela: string, coluna: string, ids: string[], cols = "*") {
  const out: any[] = [];
  for (const f of fatiar(ids)) {
    const { data, error } = await sb.from(tabela).select(cols).in(coluna, f);
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}
// Apaga o arquivo da foto anterior do grupo. Falha aqui não derruba a troca: sobra só um arquivo pequeno.
async function apagarFotoAntiga(endereco: unknown) {
  const marca = `/object/public/${BUCKET_FOTOS}/`;
  const t = txt(endereco);
  const i = t.indexOf(marca);
  if (i < 0) return;
  const { error } = await sb.storage.from(BUCKET_FOTOS).remove([t.slice(i + marca.length)]);
  if (error) console.error("apagarFotoAntiga", error);
}
const resumoTexto = (t: string) => { const s = txt(t).replace(/\s+/g, " "); return s.length > 140 ? `${s.slice(0, 137)}...` : s; };

type Ctx = { eu: string; nome: string; direcao: boolean; nomes: Map<string, string> };
async function carregarCtx(cracha: any): Promise<Ctx> {
  const { data: contas, error } = await sb.from("ml_contas").select("usuario,nome,papel,ativo");
  if (error) throw error;
  const nomes = new Map<string, string>();
  let mim: any = null;
  for (const c of contas ?? []) {
    if (c.ativo) nomes.set(c.usuario, txt(c.nome) || c.usuario);
    if (c.usuario === txt(cracha.sub)) mim = c;
  }
  if (!mim?.ativo) erro(401, "Sua conta do painel está inativa. Entre de novo.");
  return { eu: mim.usuario, nome: txt(mim.nome) || mim.usuario, direcao: mim.papel === "direcao", nomes };
}
const nomeDe = (c: Ctx, u: string) => c.nomes.get(u) ?? u;
function exigirUsuarios(c: Ctx, lista: string[]) {
  for (const u of lista) if (!c.nomes.has(u)) erro(400, `O usuário "${u}" não existe ou está inativo.`);
}

// ---------------------------------------------------------------- acesso à conversa
async function carregarConversa(c: Ctx, id: unknown) {
  const cid = txt(id);
  if (!UUID.test(cid)) erro(400, "Conversa inválida.");
  const { data: conv, error } = await sb.from("ml_conversas").select("*").eq("id", cid).eq("apagada", false).maybeSingle();
  if (error) throw error;
  if (!conv) erro(404, "Não encontrei essa conversa.");
  const { data: todos, error: e2 } = await sb.from("ml_conversa_membros").select("*").eq("conversa_id", cid);
  if (e2) throw e2;
  const ativos = (todos ?? []).filter((m: any) => !m.saiu_em);
  const meu = ativos.find((m: any) => m.usuario === c.eu);
  if (!meu) erro(403, "Você não participa desta conversa.");
  return { conv, membros: ativos, meu, admin: meu.papel === "admin" };
}
async function ultimaSeq(conversaId: string): Promise<number> {
  const { data, error } = await sb.from("ml_conversa_mensagens").select("seq").eq("conversa_id", conversaId).order("seq", { ascending: false }).limit(1);
  if (error) throw error;
  return Number(data?.[0]?.seq ?? 0);
}
async function mensagemSistema(conversaId: string, texto: string) {
  const { data, error } = await sb.from("ml_conversa_mensagens").insert({ conversa_id: conversaId, autor: null, tipo: "sistema", texto }).select("seq,criado_em").single();
  if (error) throw error;
  await sb.from("ml_conversas").update({ ultima_msg_em: data.criado_em, ultima_msg_texto: resumoTexto(texto), ultima_msg_autor: null }).eq("id", conversaId);
  return Number(data.seq);
}
async function avisarNoSino(c: Ctx, para: string[], n: { titulo: string; corpo?: string; conversaId: string }) {
  const rows = unicos(para).filter((u) => u !== c.eu && c.nomes.has(u)).map((usuario) => ({ usuario, tipo: "mensagens", titulo: n.titulo, corpo: n.corpo ?? "", link: `/mensagens?abrir=${n.conversaId}`, ref_tipo: "conversa", ref_id: n.conversaId }));
  if (!rows.length) return;
  const { error } = await sb.from("ml_notificacoes").insert(rows);
  if (error) console.error("notificacoes", error);
}

// ---------------------------------------------------------------- listas
async function minhasConversas(c: Ctx) {
  const { data: meus, error } = await sb.from("ml_conversa_membros").select("*").eq("usuario", c.eu);
  if (error) throw error;
  const ativas = (meus ?? []).filter((m: any) => !m.saiu_em);
  const ids = ativas.map((m: any) => m.conversa_id);
  const convs = (await lerPorIds("ml_conversas", "id", ids)).filter((x: any) => !x.apagada);
  const idsVivos = convs.map((x: any) => x.id);
  const membros = (await lerPorIds("ml_conversa_membros", "conversa_id", idsVivos)).filter((m: any) => !m.saiu_em);
  const meuPor = new Map<string, any>(ativas.map((m: any) => [m.conversa_id, m]));
  const minLido = ativas.length ? Math.min(...ativas.map((m: any) => Number(m.lido_ate))) : 0;
  // Mensagens de outros depois do ponto lido mais antigo; cada conversa confere o seu ponto.
  const novas: any[] = [];
  for (const f of fatiar(idsVivos)) {
    const { data, error: e2 } = await sb.from("ml_conversa_mensagens").select("conversa_id,seq,autor").in("conversa_id", f).eq("tipo", "mensagem").eq("apagada", false).gt("seq", minLido).limit(1000);
    if (e2) throw e2;
    novas.push(...(data ?? []).filter((m: any) => Number(m.seq) > minLido && m.autor !== c.eu));
  }
  const naoLidasPor = new Map<string, number>();
  for (const m of novas) if (Number(m.seq) > Number(meuPor.get(m.conversa_id)?.lido_ate ?? 0)) naoLidasPor.set(m.conversa_id, (naoLidasPor.get(m.conversa_id) ?? 0) + 1);
  return { convs, membros, meuPor, naoLidasPor };
}

async function listarConversas(c: Ctx) {
  const { convs, membros, meuPor, naoLidasPor } = await minhasConversas(c);
  const membrosPor = new Map<string, any[]>();
  for (const m of membros) membrosPor.set(m.conversa_id, [...(membrosPor.get(m.conversa_id) ?? []), m]);
  const nomes: Record<string, string> = {};
  const lista = convs.map((v: any) => {
    const ms = membrosPor.get(v.id) ?? [];
    const outro = v.tipo === "direta" ? v.chave_direta.split("|").find((u: string) => u !== c.eu) ?? c.eu : null;
    for (const m of ms) nomes[m.usuario] = nomeDe(c, m.usuario);
    if (outro) nomes[outro] = nomeDe(c, outro);
    if (v.ultima_msg_autor) nomes[v.ultima_msg_autor] = nomeDe(c, v.ultima_msg_autor);
    const meu = meuPor.get(v.id);
    return {
      id: v.id, tipo: v.tipo, titulo: v.tipo === "grupo" ? v.nome : nomeDe(c, outro), outro, foto: v.foto ?? null, membros: ms.map((m: any) => m.usuario),
      ultima: v.ultima_msg_em ? { texto: v.ultima_msg_texto, autor: v.ultima_msg_autor, em: v.ultima_msg_em } : null,
      naoLidas: naoLidasPor.get(v.id) ?? 0, silenciado: !!meu?.silenciado, criadoEm: v.criado_em,
    };
  });
  lista.sort((a, b) => String(b.ultima?.em ?? b.criadoEm).localeCompare(String(a.ultima?.em ?? a.criadoEm)));
  const total = lista.filter((x) => !x.silenciado).reduce((n, x) => n + x.naoLidas, 0);
  return { conversas: lista, nomes, eu: c.eu, totalNaoLidas: total };
}

async function contar(c: Ctx) {
  const { convs, meuPor, naoLidasPor } = await minhasConversas(c);
  const comNovas = convs.filter((v: any) => !meuPor.get(v.id)?.silenciado && (naoLidasPor.get(v.id) ?? 0) > 0);
  const total = comNovas.reduce((n: number, v: any) => n + (naoLidasPor.get(v.id) ?? 0), 0);
  // As conversas com novidade (até 5, a mais recente primeiro): a tela compara com a consulta anterior para tocar o som e avisar no navegador.
  const novas = comNovas.map((v: any) => {
    const outro = v.tipo === "direta" ? v.chave_direta.split("|").find((u: string) => u !== c.eu) ?? c.eu : null;
    return { id: v.id, tipo: v.tipo, titulo: v.tipo === "grupo" ? v.nome : nomeDe(c, outro as string), naoLidas: naoLidasPor.get(v.id) ?? 0, autor: v.ultima_msg_autor ? nomeDe(c, v.ultima_msg_autor) : "", texto: v.ultima_msg_texto ?? "", em: v.ultima_msg_em ?? "" };
  }).sort((a: any, b: any) => String(b.em).localeCompare(String(a.em))).slice(0, 5);
  return { totalNaoLidas: total, novas };
}

// ---------------------------------------------------------------- ações
async function usuarios(c: Ctx) {
  return { usuarios: [...c.nomes.entries()].map(([usuario, nome]) => ({ usuario, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), eu: c.eu };
}

async function abrirDireta(c: Ctx, b: any) {
  const com = txt(b.com);
  if (!com || com === c.eu) erro(400, "Escolha outra pessoa para conversar.");
  exigirUsuarios(c, [com]);
  const chave = [c.eu, com].sort().join("|");
  const { data: existente, error } = await sb.from("ml_conversas").select("id,apagada").eq("chave_direta", chave).maybeSingle();
  if (error) throw error;
  if (existente) {
    if (existente.apagada) await sb.from("ml_conversas").update({ apagada: false }).eq("id", existente.id);
    for (const usuario of [c.eu, com]) {
      const { error: e2 } = await sb.from("ml_conversa_membros").upsert({ conversa_id: existente.id, usuario, papel: "membro", saiu_em: null }, { onConflict: "conversa_id,usuario" });
      if (e2) throw e2;
    }
    return { ok: true, id: existente.id };
  }
  const { data: nova, error: e3 } = await sb.from("ml_conversas").insert({ tipo: "direta", chave_direta: chave, criador: c.eu }).select("id").single();
  if (e3) throw e3;
  const { error: e4 } = await sb.from("ml_conversa_membros").insert([{ conversa_id: nova.id, usuario: c.eu }, { conversa_id: nova.id, usuario: com }]);
  if (e4) throw e4;
  return { ok: true, id: nova.id };
}

async function criarGrupo(c: Ctx, b: any) {
  const nome = txt(b.nome).replace(/\s+/g, " ").slice(0, 80);
  if (!nome) erro(400, "Dê um nome para o grupo.");
  const outros = unicos(Array.isArray(b.membros) ? b.membros : []).filter((u) => u !== c.eu);
  if (!outros.length) erro(400, "Escolha pelo menos uma pessoa para o grupo.");
  exigirUsuarios(c, outros);
  const { data: nova, error } = await sb.from("ml_conversas").insert({ tipo: "grupo", nome, criador: c.eu }).select("id").single();
  if (error) throw error;
  const { error: e2 } = await sb.from("ml_conversa_membros").insert([{ conversa_id: nova.id, usuario: c.eu, papel: "admin" }, ...outros.map((usuario) => ({ conversa_id: nova.id, usuario, papel: "membro" }))]);
  if (e2) throw e2;
  const seq = await mensagemSistema(nova.id, `${nomeDe(c, c.eu)} criou o grupo "${nome}".`);
  await sb.from("ml_conversa_membros").update({ lido_ate: seq }).eq("conversa_id", nova.id); // o começo do grupo não conta como não lido
  await avisarNoSino(c, outros, { titulo: `Você foi adicionado ao grupo "${nome}"`, corpo: `por ${nomeDe(c, c.eu)}`, conversaId: nova.id });
  return { ok: true, id: nova.id };
}

// Reações da conversa agrupadas por mensagem: { [mensagem_id]: [{ emoji, usuarios: [...] }] }. Vai em toda consulta, para quem já tem as mensagens na tela ver as reações novas.
async function reacoesDaConversa(conversaId: string) {
  const { data, error } = await sb.from("ml_conversa_reacoes").select("mensagem_id,usuario,emoji,criado_em").eq("conversa_id", conversaId).order("criado_em", { ascending: true }).limit(2000);
  if (error) throw error;
  const out: Record<string, { emoji: string; usuarios: string[] }[]> = {};
  for (const r of data ?? []) {
    const lista = (out[r.mensagem_id] ??= []);
    const g = lista.find((x) => x.emoji === r.emoji);
    if (g) g.usuarios.push(r.usuario); else lista.push({ emoji: r.emoji, usuarios: [r.usuario] });
  }
  return out;
}

async function obter(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  const apos = Number(b.apos) || 0, antes = Number(b.antes) || 0;
  const q = sb.from("ml_conversa_mensagens").select("*").eq("conversa_id", a.conv.id);
  let mensagens: any[];
  let maisAntigas = false;
  if (apos > 0) {
    const { data, error } = await q.gt("seq", apos).order("seq", { ascending: true }).limit(500);
    if (error) throw error;
    mensagens = (data ?? []).filter((m: any) => Number(m.seq) > apos);
  } else {
    const { data, error } = await (antes > 0 ? q.lt("seq", antes) : q).order("seq", { ascending: false }).limit(81);
    if (error) throw error;
    let lista = data ?? [];
    if (lista.length > 80) { maisAntigas = true; lista = lista.slice(0, 80); }
    mensagens = lista.reverse();
  }
  const agoraServidor = new Date().toISOString();
  let alteradas: any[] = [];
  const desde = txt(b.desde);
  if (apos > 0 && desde && !Number.isNaN(Date.parse(desde))) {
    // Folga de 10 s para diferença de relógio; repetir uma alteração não faz mal (a tela troca pelo id).
    const de = new Date(Date.parse(desde) - 10000).toISOString();
    const { data, error } = await sb.from("ml_conversa_mensagens").select("*").eq("conversa_id", a.conv.id).gt("alterado_em", de).order("alterado_em", { ascending: true }).limit(200);
    if (error) throw error;
    alteradas = data ?? [];
  }
  // Abrir a conversa (do fim, não ao paginar para trás) marca tudo como lido.
  let lidoAte = Number(a.meu.lido_ate);
  if (!antes) {
    const ultima = await ultimaSeq(a.conv.id);
    if (ultima > lidoAte) {
      const { error } = await sb.from("ml_conversa_membros").update({ lido_ate: ultima }).eq("conversa_id", a.conv.id).eq("usuario", c.eu);
      if (error) throw error;
      lidoAte = ultima;
    }
  }
  const outro = a.conv.tipo === "direta" ? a.conv.chave_direta.split("|").find((u: string) => u !== c.eu) ?? c.eu : null;
  const nomes: Record<string, string> = {};
  for (const m of a.membros) nomes[m.usuario] = nomeDe(c, m.usuario);
  for (const m of mensagens) if (m.autor) nomes[m.autor] = nomeDe(c, m.autor);
  if (outro) nomes[outro] = nomeDe(c, outro);
  return {
    conversa: { id: a.conv.id, tipo: a.conv.tipo, titulo: a.conv.tipo === "grupo" ? a.conv.nome : nomeDe(c, outro as string), nome: a.conv.nome, outro, criador: a.conv.criador, foto: a.conv.foto ?? null, descricao: a.conv.descricao ?? "", criadoEm: a.conv.criado_em, silenciado: !!a.meu.silenciado },
    membros: a.membros.map((m: any) => ({ usuario: m.usuario, papel: m.papel, lidoAte: m.usuario === c.eu ? lidoAte : Number(m.lido_ate) })),
    mensagens: mensagens.map(mensagemDe),
    // Editadas ou apagadas desde a última consulta (quem está com a conversa aberta recebe sem reabrir).
    alteradas: alteradas.map(mensagemDe),
    agora: agoraServidor,
    reacoes: await reacoesDaConversa(a.conv.id),
    maisAntigas, nomes, eu: c.eu, pode: { gerir: a.admin, sair: a.conv.tipo === "grupo" },
  };
}

function mensagemDe(m: any) {
  return { seq: Number(m.seq), id: m.id, autor: m.autor, tipo: m.tipo, texto: m.apagada ? "" : m.texto, anexo: m.apagada ? null : anexoDe(m), apagada: m.apagada, criadoEm: m.criado_em, editadaEm: m.apagada ? null : m.editada_em ?? null };
}

// Editar a própria mensagem: o texto (ou a legenda do arquivo). Fica marcada como "editada";
// a primeira versão é guardada em texto_original (rastreabilidade).
async function editarMensagem(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  const mid = txt(b.mensagem_id);
  if (!UUID.test(mid)) erro(400, "Mensagem inválida.");
  const { data: m, error } = await sb.from("ml_conversa_mensagens").select("*").eq("id", mid).maybeSingle();
  if (error) throw error;
  if (!m || m.conversa_id !== a.conv.id || m.tipo !== "mensagem" || m.apagada) erro(404, "Não encontrei essa mensagem.");
  if (m.autor !== c.eu) erro(403, "Você só edita as suas próprias mensagens.");
  if (m.anexo_caminho && ehAudio(m.anexo_tipo)) erro(400, "Mensagem de voz não tem texto para editar.");
  const limite = m.anexo_caminho ? 1000 : 5000;
  const texto = String(b.texto ?? "").replace(/\r\n/g, "\n").trim().slice(0, limite);
  if (!texto && !m.anexo_caminho) erro(400, "Escreva a mensagem.");
  if (texto === m.texto) return { ok: true, mensagem: mensagemDe(m) };
  const agora = new Date().toISOString();
  const { data, error: e2 } = await sb.from("ml_conversa_mensagens")
    .update({ texto, editada_em: agora, alterado_em: agora, texto_original: m.texto_original ?? m.texto }).eq("id", mid).select("*").single();
  if (e2) throw e2;
  // Se era a última da conversa, a prévia da lista acompanha.
  const ultima = await ultimaSeq(a.conv.id);
  if (Number(m.seq) === ultima) await sb.from("ml_conversas").update({ ultima_msg_texto: resumoTexto(dizDe(data)) }).eq("id", a.conv.id);
  return { ok: true, mensagem: mensagemDe(data) };
}

async function enviar(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  const texto = String(b.texto ?? "").replace(/\r\n/g, "\n").trim().slice(0, 5000);
  if (!texto) erro(400, "Escreva a mensagem.");
  const { data, error } = await sb.from("ml_conversa_mensagens").insert({ conversa_id: a.conv.id, autor: c.eu, tipo: "mensagem", texto }).select("*").single();
  if (error) throw error;
  await sb.from("ml_conversas").update({ ultima_msg_em: data.criado_em, ultima_msg_texto: resumoTexto(texto), ultima_msg_autor: c.eu }).eq("id", a.conv.id);
  await sb.from("ml_conversa_membros").update({ lido_ate: Number(data.seq) }).eq("conversa_id", a.conv.id).eq("usuario", c.eu);
  return { ok: true, mensagem: { seq: Number(data.seq), id: data.id, autor: data.autor, tipo: data.tipo, texto: data.texto, anexo: null, apagada: false, criadoEm: data.criado_em } };
}

async function enviarArquivo(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  const nome = txt(b.nome).replace(/[\\/]/g, "_").slice(-150);
  if (!nome) erro(400, "O arquivo está sem nome.");
  const ext = extensaoDe(nome);
  const tipo = TIPOS_ANEXO[ext];
  if (!tipo) erro(400, `Não aceito arquivo .${ext || "sem extensão"}. Aceitos: PDF, imagens, Word, Excel, PowerPoint, CSV, TXT, XML e ZIP.`);
  const b64 = String(b.base64 ?? "").replace(/^data:[^;]+;base64,/, "");
  if (!b64) erro(400, "Escolha o arquivo.");
  let bytes: Uint8Array;
  try { const bin = atob(b64); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } catch { return erro(400, "Arquivo inválido."); }
  if (!bytes.length) erro(400, "O arquivo está vazio.");
  if (bytes.length > MAX_ANEXO_BYTES) erro(400, "O arquivo passa de 8 MB. Reduza ou divida.");
  const legenda = String(b.texto ?? "").replace(/\r\n/g, "\n").trim().slice(0, 1000);
  const duracaoBruta = Math.round(Number(b.duracao));
  const duracao = ehAudio(tipo) && Number.isFinite(duracaoBruta) && duracaoBruta > 0 ? Math.min(duracaoBruta, MAX_AUDIO_SEG) : null;
  if (ehAudio(tipo) && duracaoBruta > MAX_AUDIO_SEG) erro(400, "A mensagem de voz passa de 10 minutos.");
  const caminho = `conversas/${a.conv.id}/${crypto.randomUUID()}-${nomeSeguro(nome)}`;
  const { error: eUp } = await sb.storage.from(BUCKET_ARQUIVOS).upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (eUp) throw eUp;
  const { data, error } = await sb.from("ml_conversa_mensagens").insert({ conversa_id: a.conv.id, autor: c.eu, tipo: "mensagem", texto: legenda, anexo_nome: nome, anexo_tipo: tipo, anexo_tamanho: bytes.length, anexo_duracao: duracao, anexo_caminho: caminho }).select("*").single();
  if (error) { await sb.storage.from(BUCKET_ARQUIVOS).remove([caminho]); throw error; }
  await sb.from("ml_conversas").update({ ultima_msg_em: data.criado_em, ultima_msg_texto: resumoTexto(dizDe(data)), ultima_msg_autor: c.eu }).eq("id", a.conv.id);
  await sb.from("ml_conversa_membros").update({ lido_ate: Number(data.seq) }).eq("conversa_id", a.conv.id).eq("usuario", c.eu);
  return { ok: true, mensagem: { seq: Number(data.seq), id: data.id, autor: data.autor, tipo: data.tipo, texto: data.texto, anexo: anexoDe(data), apagada: false, criadoEm: data.criado_em } };
}

async function arquivoUrl(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id); // só membro baixa
  const mid = txt(b.mensagem_id);
  if (!UUID.test(mid)) erro(400, "Mensagem inválida.");
  const { data: m, error } = await sb.from("ml_conversa_mensagens").select("*").eq("id", mid).eq("conversa_id", a.conv.id).eq("apagada", false).maybeSingle();
  if (error) throw error;
  if (!m?.anexo_caminho) erro(404, "Não encontrei esse arquivo.");
  const { data, error: eUrl } = await sb.storage.from(BUCKET_ARQUIVOS).createSignedUrl(m.anexo_caminho, 300, b.baixar === true ? { download: m.anexo_nome } : undefined);
  if (eUrl || !data?.signedUrl) throw eUrl ?? new Error("Não consegui gerar o link do arquivo.");
  return { ok: true, url: data.signedUrl, nome: m.anexo_nome };
}

// Reagir com um emoji: clicar de novo tira. Uma pessoa pode usar vários emojis diferentes na mesma mensagem.
async function reagir(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  const mid = txt(b.mensagem_id);
  if (!UUID.test(mid)) erro(400, "Mensagem inválida.");
  const emoji = String(b.emoji ?? "").trim();
  if (!emoji || emoji.length > 16 || !/\p{Extended_Pictographic}/u.test(emoji) || /[A-Za-z0-9]{2,}/.test(emoji)) erro(400, "Escolha um emoji.");
  const { data: m, error } = await sb.from("ml_conversa_mensagens").select("id,conversa_id,tipo,apagada").eq("id", mid).maybeSingle();
  if (error) throw error;
  if (!m || m.conversa_id !== a.conv.id || m.tipo !== "mensagem" || m.apagada) erro(404, "Não encontrei essa mensagem.");
  const { data: ja, error: e2 } = await sb.from("ml_conversa_reacoes").select("mensagem_id").eq("mensagem_id", mid).eq("usuario", c.eu).eq("emoji", emoji).maybeSingle();
  if (e2) throw e2;
  if (ja) {
    const { error: e3 } = await sb.from("ml_conversa_reacoes").delete().eq("mensagem_id", mid).eq("usuario", c.eu).eq("emoji", emoji);
    if (e3) throw e3;
  } else {
    const { count, error: e4 } = await sb.from("ml_conversa_reacoes").select("emoji", { count: "exact", head: true }).eq("mensagem_id", mid).eq("usuario", c.eu);
    if (e4) throw e4;
    if ((count ?? 0) >= 10) erro(400, "Você já usou 10 reações nesta mensagem.");
    const { error: e5 } = await sb.from("ml_conversa_reacoes").insert({ mensagem_id: mid, conversa_id: a.conv.id, usuario: c.eu, emoji });
    if (e5) throw e5;
  }
  return { ok: true, reacoes: await reacoesDaConversa(a.conv.id) };
}

async function mudarMembros(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  if (a.conv.tipo !== "grupo") erro(400, "Só dá para mudar as pessoas de um grupo.");
  if (!a.admin) erro(403, "Só quem administra o grupo adiciona ou tira pessoas.");
  const adicionar = unicos(Array.isArray(b.adicionar) ? b.adicionar : []).filter((u) => u !== c.eu);
  const remover = unicos(Array.isArray(b.remover) ? b.remover : []).filter((u) => u !== c.eu);
  exigirUsuarios(c, adicionar);
  const quem = nomeDe(c, c.eu);
  const jaDentro = new Set(a.membros.map((m: any) => m.usuario));
  const novos = adicionar.filter((u) => !jaDentro.has(u));
  if (novos.length) {
    const seq = await ultimaSeq(a.conv.id);
    for (const usuario of novos) {
      const { error } = await sb.from("ml_conversa_membros").upsert({ conversa_id: a.conv.id, usuario, papel: "membro", entrou_em: new Date().toISOString(), lido_ate: seq, saiu_em: null }, { onConflict: "conversa_id,usuario" });
      if (error) throw error;
    }
    const s = await mensagemSistema(a.conv.id, `${quem} adicionou ${novos.map((u) => nomeDe(c, u)).join(", ")}.`);
    await sb.from("ml_conversa_membros").update({ lido_ate: s }).eq("conversa_id", a.conv.id).in("usuario", [c.eu]);
    await avisarNoSino(c, novos, { titulo: `Você foi adicionado ao grupo "${a.conv.nome}"`, corpo: `por ${quem}`, conversaId: a.conv.id });
  }
  const tirados = remover.filter((u) => jaDentro.has(u));
  if (tirados.length) {
    for (const usuario of tirados) {
      const { error } = await sb.from("ml_conversa_membros").update({ saiu_em: new Date().toISOString() }).eq("conversa_id", a.conv.id).eq("usuario", usuario);
      if (error) throw error;
    }
    const s = await mensagemSistema(a.conv.id, `${quem} retirou ${tirados.map((u) => nomeDe(c, u)).join(", ")} do grupo.`);
    await sb.from("ml_conversa_membros").update({ lido_ate: s }).eq("conversa_id", a.conv.id).eq("usuario", c.eu);
  }
  return { ok: true, adicionados: novos.length, retirados: tirados.length };
}

async function sair(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  if (a.conv.tipo !== "grupo") erro(400, "Conversa individual não tem como sair.");
  const { error } = await sb.from("ml_conversa_membros").update({ saiu_em: new Date().toISOString() }).eq("conversa_id", a.conv.id).eq("usuario", c.eu);
  if (error) throw error;
  const restantes = a.membros.filter((m: any) => m.usuario !== c.eu);
  if (!restantes.length) { await sb.from("ml_conversas").update({ apagada: true }).eq("id", a.conv.id); return { ok: true, encerrado: true }; }
  if (!restantes.some((m: any) => m.papel === "admin")) {
    const prox = [...restantes].sort((x: any, y: any) => String(x.entrou_em).localeCompare(String(y.entrou_em)))[0];
    await sb.from("ml_conversa_membros").update({ papel: "admin" }).eq("conversa_id", a.conv.id).eq("usuario", prox.usuario);
  }
  await mensagemSistema(a.conv.id, `${nomeDe(c, c.eu)} saiu do grupo.`);
  return { ok: true };
}

async function renomear(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  if (a.conv.tipo !== "grupo") erro(400, "Só grupos têm nome.");
  if (!a.admin) erro(403, "Só quem administra o grupo muda o nome.");
  const nome = txt(b.nome).replace(/\s+/g, " ").slice(0, 80);
  if (!nome) erro(400, "O nome não pode ficar vazio.");
  if (nome === a.conv.nome) return { ok: true, semMudanca: true };
  const { error } = await sb.from("ml_conversas").update({ nome }).eq("id", a.conv.id);
  if (error) throw error;
  const s = await mensagemSistema(a.conv.id, `${nomeDe(c, c.eu)} mudou o nome do grupo para "${nome}".`);
  await sb.from("ml_conversa_membros").update({ lido_ate: s }).eq("conversa_id", a.conv.id).eq("usuario", c.eu);
  return { ok: true };
}

async function fotoGrupo(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  if (a.conv.tipo !== "grupo") erro(400, "Só grupos têm foto.");
  if (!a.admin) erro(403, "Só quem administra o grupo muda a foto.");
  if (b.remover === true) {
    const { error } = await sb.from("ml_conversas").update({ foto: null }).eq("id", a.conv.id);
    if (error) throw error;
    await apagarFotoAntiga(a.conv.foto);
    const s = await mensagemSistema(a.conv.id, `${nomeDe(c, c.eu)} removeu a foto do grupo.`);
    await sb.from("ml_conversa_membros").update({ lido_ate: s }).eq("conversa_id", a.conv.id).eq("usuario", c.eu);
    return { ok: true, foto: null };
  }
  const b64 = String(b.base64 ?? "").replace(/^data:image\/jpeg;base64,/, "");
  if (!b64) erro(400, "Escolha a foto.");
  let bytes: Uint8Array;
  try { const bin = atob(b64); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } catch { return erro(400, "Foto inválida."); }
  if (bytes.length < 200 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) erro(400, "A foto precisa ser JPEG.");
  if (bytes.length > 450 * 1024) erro(400, "A foto ficou grande demais. Escolha uma menor.");
  const caminho = `grupo-${a.conv.id}-${Date.now()}.jpg`;
  const { error: eUp } = await sb.storage.from(BUCKET_FOTOS).upload(caminho, bytes, { contentType: "image/jpeg", upsert: false });
  if (eUp) throw eUp;
  const endereco = `${U}/storage/v1/object/public/${BUCKET_FOTOS}/${caminho}`;
  const { error } = await sb.from("ml_conversas").update({ foto: endereco }).eq("id", a.conv.id);
  if (error) throw error;
  await apagarFotoAntiga(a.conv.foto);
  const s = await mensagemSistema(a.conv.id, `${nomeDe(c, c.eu)} mudou a foto do grupo.`);
  await sb.from("ml_conversa_membros").update({ lido_ate: s }).eq("conversa_id", a.conv.id).eq("usuario", c.eu);
  return { ok: true, foto: endereco };
}

async function descricao(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  if (a.conv.tipo !== "grupo") erro(400, "Só grupos têm descrição.");
  if (!a.admin) erro(403, "Só quem administra o grupo muda a descrição.");
  const texto = String(b.descricao ?? "").replace(/\r\n/g, "\n").trim().slice(0, 500);
  if (texto === txt(a.conv.descricao)) return { ok: true, semMudanca: true };
  const { error } = await sb.from("ml_conversas").update({ descricao: texto }).eq("id", a.conv.id);
  if (error) throw error;
  const s = await mensagemSistema(a.conv.id, `${nomeDe(c, c.eu)} mudou a descrição do grupo.`);
  await sb.from("ml_conversa_membros").update({ lido_ate: s }).eq("conversa_id", a.conv.id).eq("usuario", c.eu);
  return { ok: true, descricao: texto };
}

async function silenciar(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  const { error } = await sb.from("ml_conversa_membros").update({ silenciado: b.silenciado === true }).eq("conversa_id", a.conv.id).eq("usuario", c.eu);
  if (error) throw error;
  return { ok: true };
}

async function apagarMensagem(c: Ctx, b: any) {
  const a = await carregarConversa(c, b.id);
  const mid = txt(b.mensagem_id);
  if (!UUID.test(mid)) erro(400, "Mensagem inválida.");
  const { data: m, error } = await sb.from("ml_conversa_mensagens").select("id,autor,conversa_id,tipo,anexo_caminho").eq("id", mid).maybeSingle();
  if (error) throw error;
  if (!m || m.conversa_id !== a.conv.id || m.tipo !== "mensagem") erro(404, "Não encontrei essa mensagem.");
  if (m.autor !== c.eu) erro(403, "Você só apaga as suas próprias mensagens.");
  const { error: e2 } = await sb.from("ml_conversa_mensagens").update({ apagada: true, alterado_em: new Date().toISOString() }).eq("id", mid);
  if (e2) throw e2;
  if (m.anexo_caminho) { const { error: eRm } = await sb.storage.from(BUCKET_ARQUIVOS).remove([m.anexo_caminho]); if (eRm) console.error("apagarArquivo", eRm); }
  const { data: ult } = await sb.from("ml_conversa_mensagens").select("texto,autor,criado_em,apagada,tipo,anexo_nome,anexo_caminho").eq("conversa_id", a.conv.id).order("seq", { ascending: false }).limit(20);
  const vivo = (ult ?? []).find((x: any) => !x.apagada);
  await sb.from("ml_conversas").update(vivo ? { ultima_msg_texto: resumoTexto(dizDe(vivo)), ultima_msg_autor: vivo.autor, ultima_msg_em: vivo.criado_em } : { ultima_msg_texto: "", ultima_msg_autor: null }).eq("id", a.conv.id);
  return { ok: true };
}

const ACOES: Record<string, (c: Ctx, b: any) => Promise<unknown>> = {
  usuarios: (c) => usuarios(c), conversas: (c) => listarConversas(c), contar: (c) => contar(c),
  abrir_direta: abrirDireta, criar_grupo: criarGrupo, obter, enviar, membros: mudarMembros, sair, renomear, silenciar, apagar_mensagem: apagarMensagem, editar_mensagem: editarMensagem, foto_grupo: fotoGrupo, descricao, enviar_arquivo: enviarArquivo, arquivo_url: arquivoUrl, reagir,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const cracha = await crachaDoPainel(req);
  if (!cracha) return json({ erro: "Sua sessão expirou. Entre de novo.", semSessao: true }, 401);
  try {
    const b = await req.json().catch(() => ({}));
    const fn = ACOES[txt(b.action)];
    if (!fn) return json({ erro: "Ação inválida." }, 400);
    const c = await carregarCtx(cracha);
    return json(await fn(c, b));
  } catch (e) {
    if (e instanceof Falha) return json({ erro: e.message, ...(e.status === 401 ? { semSessao: true } : {}) }, e.status);
    console.error("ml-messenger", e);
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
