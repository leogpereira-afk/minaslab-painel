// ml-canais — Canais MinasLab: notícias, comunicados e eventos da empresa,
// parabéns automáticos no aniversário, aniversariantes do mês e informativo de
// férias, com curtidas e comentários dos colaboradores.
//
// Quem entra: qualquer conta ATIVA do painel (crachá conferido aqui + conta
// ativa conferida ao vivo). Quem publica: a direção e quem ela colocar em
// "publicadores" (ml_meta, chave "canais").
//
// Do RH sai só o mínimo: nome/apelido, dia e mês do aniversário (sem ano) e o
// período de férias. Nada mais da ficha.
//
// Ações: feed, publicar, apagarPost, comentar, apagarComentario, curtir, config, salvarConfig,
// destaqueOpcoes, salvarDestaque (funcionário do mês na lateral; foto vem de Gestão › Destaque do mês › Fotos).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  hojeSP, aniversariantesDoMes, parabensRecentes, informativoFerias, ehRefAniversario,
  validarPost, validarComentario, naCasa, nomeCurto, validarDestaque, normNome,
  lerFoto, ehFotoGuardada,
} from "./regras.mjs";
const BUCKET = "ml-arquivos";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY")!;
const J = Deno.env.get("ML_JWT_SECRET") ?? "";
const sb = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder(), dec = new TextDecoder();
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const txt = (v: unknown) => String(v ?? "").trim();
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

// ---------------------------------------------------------------- contexto
type Config = { publicadores: string[]; ocultos: string[]; destaque: any };
type Ctx = { eu: string; nome: string; direcao: boolean; publica: boolean; nomes: Map<string, string>; cfg: Config };

async function lerConfig(): Promise<Config> {
  const { data, error } = await sb.from("ml_meta").select("valor").eq("chave", "canais").maybeSingle();
  if (error) throw error;
  const v = (data?.valor ?? {}) as any;
  const lista = (x: unknown) => Array.isArray(x) ? x.map(txt).filter(Boolean) : [];
  return { publicadores: lista(v.publicadores), ocultos: lista(v.ocultos), destaque: v.destaque ?? null };
}
async function gravarConfig(parcial: Record<string, unknown>) {
  const { data, error } = await sb.from("ml_meta").select("valor").eq("chave", "canais").maybeSingle();
  if (error) throw error;
  const valor = { ...((data?.valor ?? {}) as any), ...parcial };
  const { error: e2 } = await sb.from("ml_meta").upsert({ chave: "canais", valor, atualizado_em: new Date().toISOString() });
  if (e2) throw e2;
  return valor;
}

// Fotos do Destaque do mês cadastradas na Gestão (com autorização da pessoa).
async function lerFotos(comFoto: boolean) {
  const { data, error } = await sb.from("ml_registros").select(comFoto ? "id,registro" : "id,nome:registro->>nome").eq("colecao", "rh_comercial_fotos").eq("apagado", false);
  if (error) throw error;
  return (data ?? []).map((l: any) => comFoto ? { id: l.id, nome: l.registro?.nome ?? "", foto: l.registro?.foto ?? "" } : { id: l.id, nome: l.nome ?? "" });
}
async function destaqueComFoto(d: any) {
  if (!d?.nome) return null;
  const fotos = await lerFotos(true);
  const f = fotos.find((x) => d.fotoId && x.id === d.fotoId) || fotos.find((x) => normNome(x.nome) === normNome(d.nome));
  return { nome: d.nome, mes: d.mes, itens: d.itens ?? [], foto: f?.foto && String(f.foto).startsWith("data:image/") ? f.foto : "" };
}

async function carregarCtx(cracha: any): Promise<Ctx> {
  const [{ data: contas, error }, cfg] = await Promise.all([sb.from("ml_contas").select("usuario,nome,papel,ativo"), lerConfig()]);
  if (error) throw error;
  const nomes = new Map<string, string>();
  let mim: any = null;
  for (const c of contas ?? []) {
    if (c.ativo) nomes.set(c.usuario, txt(c.nome) || c.usuario);
    if (c.usuario === txt(cracha.sub)) mim = c;
  }
  if (!mim?.ativo) erro(401, "Sua conta do painel está inativa. Entre de novo.");
  const direcao = mim.papel === "direcao";
  return { eu: mim.usuario, nome: txt(mim.nome) || mim.usuario, direcao, publica: direcao || cfg.publicadores.includes(mim.usuario), nomes, cfg };
}
const exigirPublicador = (c: Ctx) => { if (!c.publica) erro(403, "Só a gestão publica no Canais."); };

// ---------------------------------------------------------------- RH (mínimo)
async function lerRH() {
  const [{ data, error }, fotos] = await Promise.all([
    sb.from("ml_registros").select("colecao,id,registro").in("colecao", ["rh_pessoas", "rh_ferias"]).eq("apagado", false),
    lerFotos(true),
  ]);
  if (error) throw error;
  // Foto: a da ficha do RH; sem ela, a de Gestão › Destaque do mês › Fotos (mesmo nome).
  const fotoPorNome = new Map(fotos.filter((f) => f.foto).map((f) => [normNome(f.nome), f.foto]));
  const pessoas: any[] = [], ferias: any[] = [];
  for (const l of data ?? []) {
    const r = (l.registro ?? {}) as any;
    if (l.colecao === "rh_pessoas") pessoas.push({ id: l.id, nome: r.nome, apelido: r.apelido, dataNascimento: r.dataNascimento, ativo: r.ativo, desligadoEm: r.desligadoEm, foto: r.foto || fotoPorNome.get(normNome(r.nome)) || "" });
    else ferias.push({ pessoaId: r.pessoaId, inicio: r.inicio, retorno: r.retorno, status: r.status });
  }
  return { pessoas, ferias };
}

// ---------------------------------------------------------------- avisos (sino)
async function notificar(c: Ctx, para: string[], n: { titulo: string; corpo?: string; postId: string }) {
  const rows = [...new Set(para)].filter((u) => u !== c.eu && c.nomes.has(u)).map((usuario) => ({
    usuario, tipo: "canais", titulo: n.titulo, corpo: n.corpo ?? "", link: `/canais?post=${n.postId}`, ref_tipo: "canais", ref_id: n.postId,
  }));
  if (!rows.length) return;
  const { error } = await sb.from("ml_notificacoes").insert(rows);
  if (error) console.error("notificacoes", error);
}

// ---------------------------------------------------------------- ações
async function feed(c: Ctx, b: any) {
  const hoje = hojeSP();
  const ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7));
  const limite = Math.min(Math.max(Number(b.limite) || 40, 1), 100);
  const [{ data: posts, error }, rh, destaque] = await Promise.all([
    sb.from("ml_canais_posts").select("*").eq("apagado", false).order("fixado", { ascending: false }).order("criado_em", { ascending: false }).limit(limite),
    lerRH(),
    destaqueComFoto(c.cfg.destaque),
  ]);
  if (error) throw error;
  const parabens = parabensRecentes(rh.pessoas, hoje, { ocultos: c.cfg.ocultos });
  const todos: any[] = [...(posts ?? []), ...parabens];
  const refs = todos.map((p) => String(p.id));

  const [{ data: curtidas, error: e1 }, { data: comentarios, error: e2 }] = await Promise.all([
    refs.length ? sb.from("ml_canais_curtidas").select("post_ref,usuario,nome").in("post_ref", refs) : Promise.resolve({ data: [], error: null }),
    refs.length ? sb.from("ml_canais_comentarios").select("id,post_ref,usuario,nome,texto,criado_em").in("post_ref", refs).eq("apagado", false).order("criado_em", { ascending: true }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const caminhos = todos.map((p) => p.imagem).filter(ehFotoGuardada);
  const links = new Map<string, string>();
  if (caminhos.length) {
    const { data: ass, error: e3 } = await sb.storage.from(BUCKET).createSignedUrls(caminhos, 6 * 3600);
    if (e3) console.error("fotos", e3);
    for (const a of ass ?? []) if (a.path && a.signedUrl) links.set(a.path, a.signedUrl);
  }

  const saida = todos.map((p) => {
    const ref = String(p.id);
    const cs = (curtidas ?? []).filter((x: any) => x.post_ref === ref);
    return {
      ...p,
      imagemUrl: ehFotoGuardada(p.imagem) ? links.get(p.imagem) ?? "" : p.imagem || "",
      curtidas: cs.length,
      curti: cs.some((x: any) => x.usuario === c.eu),
      quemCurtiu: cs.map((x: any) => x.nome || x.usuario),
      comentarios: (comentarios ?? []).filter((x: any) => x.post_ref === ref).map((x: any) => ({ ...x, meu: x.usuario === c.eu })),
    };
  }).sort((a, b) => Number(!!b.fixado) - Number(!!a.fixado) || String(b.criado_em).localeCompare(String(a.criado_em)));

  return {
    eu: c.eu, nome: c.nome, podePublicar: c.publica, direcao: c.direcao, hoje,
    posts: saida,
    aniversariantes: aniversariantesDoMes(rh.pessoas, ano, mes, c.cfg.ocultos),
    ferias: informativoFerias(rh.ferias, rh.pessoas, hoje, 30),
    destaque,
  };
}

async function publicar(c: Ctx, b: any) {
  exigirPublicador(c);
  const v = validarPost(b);
  if (!v.ok) erro(400, v.erro);
  if (b.foto) {
    const f = lerFoto(b.foto);
    if (!f.ok) erro(400, f.erro);
    const caminho = `canais/${crypto.randomUUID()}.${f.ext}`;
    const bin = Uint8Array.from(atob(f.base64), (ch) => ch.charCodeAt(0));
    const { error: eu } = await sb.storage.from(BUCKET).upload(caminho, bin, { contentType: f.mime, upsert: false });
    if (eu) throw eu;
    v.post.imagem = caminho;
  }
  const id = txt(b.id);
  if (id) {
    if (!UUID.test(id)) erro(400, "Publicação inválida.");
    const { data, error } = await sb.from("ml_canais_posts").update({ ...v.post, editado_em: new Date().toISOString() }).eq("id", id).eq("apagado", false).select("id").maybeSingle();
    if (error) throw error;
    if (!data) erro(404, "Não encontrei essa publicação.");
    return { ok: true, id };
  }
  const { data, error } = await sb.from("ml_canais_posts").insert({ ...v.post, autor: c.eu, autor_nome: c.nome }).select("id").single();
  if (error) throw error;
  const rotulo = v.post.tipo === "comunicado" ? "Novo comunicado" : v.post.tipo === "evento" ? "Novo evento" : "Nova notícia";
  await notificar(c, [...c.nomes.keys()], { titulo: `${rotulo} no Canais MinasLab`, corpo: v.post.titulo, postId: data.id });
  return { ok: true, id: data.id };
}

async function apagarPost(c: Ctx, b: any) {
  exigirPublicador(c);
  const id = txt(b.id);
  if (!UUID.test(id)) erro(400, "Publicação inválida.");
  const { error } = await sb.from("ml_canais_posts").update({ apagado: true }).eq("id", id);
  if (error) throw error;
  return { ok: true };
}

async function conferirRef(ref: string) {
  if (ehRefAniversario(ref)) return { autor: null as string | null, titulo: "parabéns" };
  if (!UUID.test(ref)) erro(400, "Publicação inválida.");
  const { data, error } = await sb.from("ml_canais_posts").select("id,autor,titulo").eq("id", ref).eq("apagado", false).maybeSingle();
  if (error) throw error;
  if (!data) erro(404, "Essa publicação não existe mais.");
  return { autor: data.autor as string, titulo: data.titulo as string };
}

async function comentar(c: Ctx, b: any) {
  const ref = txt(b.ref);
  const post = await conferirRef(ref);
  const v = validarComentario(b.texto);
  if (!v.ok) erro(400, v.erro);
  const { data, error } = await sb.from("ml_canais_comentarios").insert({ post_ref: ref, usuario: c.eu, nome: c.nome, texto: v.texto }).select("id").single();
  if (error) throw error;
  if (post.autor && UUID.test(ref)) await notificar(c, [post.autor], { titulo: `${c.nome} comentou no Canais`, corpo: post.titulo, postId: ref });
  return { ok: true, id: data.id };
}

async function apagarComentario(c: Ctx, b: any) {
  const id = txt(b.id);
  if (!UUID.test(id)) erro(400, "Comentário inválido.");
  const { data, error } = await sb.from("ml_canais_comentarios").select("usuario").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) erro(404, "Comentário não encontrado.");
  if (data.usuario !== c.eu && !c.publica) erro(403, "Você só pode apagar os seus comentários.");
  const { error: e2 } = await sb.from("ml_canais_comentarios").update({ apagado: true }).eq("id", id);
  if (e2) throw e2;
  return { ok: true };
}

async function curtir(c: Ctx, b: any) {
  const ref = txt(b.ref);
  await conferirRef(ref);
  const { data: ja, error } = await sb.from("ml_canais_curtidas").select("usuario").eq("post_ref", ref).eq("usuario", c.eu).maybeSingle();
  if (error) throw error;
  if (ja) {
    const { error: e } = await sb.from("ml_canais_curtidas").delete().eq("post_ref", ref).eq("usuario", c.eu);
    if (e) throw e;
    return { ok: true, curti: false };
  }
  const { error: e } = await sb.from("ml_canais_curtidas").insert({ post_ref: ref, usuario: c.eu, nome: c.nome });
  if (e) throw e;
  return { ok: true, curti: true };
}

// Configuração (só direção): quem publica e quem prefere não aparecer nos aniversários.
async function config(c: Ctx) {
  if (!c.direcao) erro(403, "Só a direção ajusta o Canais.");
  const { pessoas } = await lerRH();
  return {
    ...c.cfg,
    contas: [...c.nomes.entries()].map(([usuario, nome]) => ({ usuario, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    pessoas: pessoas.filter(naCasa).map((p) => ({ id: p.id, nome: nomeCurto(p), temData: !!p.dataNascimento })).filter((p) => p.nome).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

async function salvarConfig(c: Ctx, b: any) {
  if (!c.direcao) erro(403, "Só a direção ajusta o Canais.");
  const lista = (x: unknown) => Array.isArray(x) ? [...new Set(x.map(txt).filter(Boolean))].slice(0, 300) : [];
  const valor = await gravarConfig({ publicadores: lista(b.publicadores), ocultos: lista(b.ocultos) });
  return { ok: true, publicadores: valor.publicadores, ocultos: valor.ocultos };
}

// Funcionário do mês: quem publica escolhe; a lista junta quem está na casa e quem tem foto na Gestão.
async function destaqueOpcoes(c: Ctx) {
  exigirPublicador(c);
  const [{ pessoas }, fotos] = await Promise.all([lerRH(), lerFotos(false)]);
  const porNome = new Map<string, { nome: string; fotoId: string }>();
  for (const f of fotos) if (f.nome) porNome.set(normNome(f.nome), { nome: f.nome, fotoId: f.id });
  for (const p of pessoas.filter(naCasa)) { const n = txt(p.nome); if (n && !porNome.has(normNome(n))) porNome.set(normNome(n), { nome: n, fotoId: "" }); }
  return { atual: c.cfg.destaque, pessoas: [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) };
}

async function salvarDestaque(c: Ctx, b: any) {
  exigirPublicador(c);
  const v = validarDestaque(b);
  if (!v.ok) erro(400, v.erro);
  await gravarConfig({ destaque: v.destaque });
  return { ok: true };
}

const ACOES: Record<string, (c: Ctx, b: any) => Promise<unknown>> = {
  feed, publicar, apagarPost, comentar, apagarComentario, curtir, config: (c) => config(c), salvarConfig,
  destaqueOpcoes: (c) => destaqueOpcoes(c), salvarDestaque,
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
    console.error("ml-canais", e);
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
