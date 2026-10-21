// ml-tarefas — Tarefas do painel (estilo Bitrix24).
//
// Quem entra: qualquer usuário ATIVO do painel (crachá conferido aqui + conta ativa conferida ao vivo).
// Regra de visão: a pessoa vê a tarefa se for proprietária, responsável, participante ou observadora;
// a direção vê qualquer uma. As pessoas são os usuários do painel (ml_contas.usuario).
//
// Ações: usuarios, listar, obter, criar, atualizar, delegar, status, pessoas, checklist, mensagem, excluir.
// Cada mudança importante vira um aviso do sistema no bate-papo da tarefa e uma notificação (sino) para quem importa.
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

const fmtDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const rotuloLembrete = (min: number) => (min % 1440 === 0 ? `${min / 1440} dia${min > 1440 ? "s" : ""}` : min % 60 === 0 ? `${min / 60} hora${min > 60 ? "s" : ""}` : `${min} minutos`);
const quando = (iso: string) => { const d = new Date(iso); return `${fmtDia.format(d)}, ${fmtHora.format(d)}`; };

function lerPrazo(v: unknown): string | null {
  if (v === null || v === undefined || txt(v) === "") return null;
  const d = new Date(txt(v));
  if (Number.isNaN(d.getTime())) erro(400, "Prazo inválido.");
  return d.toISOString();
}

// Lembrete: minutos ANTES do prazo (0 = na hora). Vazio = sem lembrete.
const LEMBRETES_MIN = [0, 15, 30, 60, 120, 1440, 2880];
function lerLembrete(v: unknown): number | null {
  if (v === null || v === undefined || txt(v) === "") return null;
  const n = Number(v);
  if (!LEMBRETES_MIN.includes(n)) erro(400, "Lembrete inválido.");
  return n;
}

// ---------------------------------------------------------------- contexto da chamada
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

// ---------------------------------------------------------------- acesso à tarefa
type Tarefa = any;
async function carregarTarefa(c: Ctx, id: unknown) {
  const tid = txt(id);
  if (!UUID.test(tid)) erro(400, "Tarefa inválida.");
  const { data: t, error } = await sb.from("ml_tarefas").select("*").eq("id", tid).eq("apagada", false).maybeSingle();
  if (error) throw error;
  if (!t) erro(404, "Não encontrei essa tarefa (talvez alguém tenha apagado).");
  const { data: pessoas, error: e2 } = await sb.from("ml_tarefa_pessoas").select("usuario,papel").eq("tarefa_id", tid);
  if (e2) throw e2;
  const participantes = (pessoas ?? []).filter((p: any) => p.papel === "participante").map((p: any) => p.usuario);
  const observadores = (pessoas ?? []).filter((p: any) => p.papel === "observador").map((p: any) => p.usuario);
  const ehProprietario = t.proprietario === c.eu, ehResponsavel = t.responsavel === c.eu;
  const ehParticipante = participantes.includes(c.eu), ehObservador = observadores.includes(c.eu);
  const envolvido = ehProprietario || ehResponsavel || ehParticipante || ehObservador;
  if (!envolvido && !c.direcao) erro(403, "Você não participa desta tarefa.");
  return {
    t: t as Tarefa, participantes, observadores,
    gestor: ehProprietario || ehResponsavel || c.direcao, // edita, delega, conclui, mexe nas pessoas
    colaborador: ehProprietario || ehResponsavel || ehParticipante || c.direcao, // checklist e iniciar
  };
}
const envolvidos = (a: { t: Tarefa; participantes: string[]; observadores: string[] }) =>
  unicos([a.t.proprietario, a.t.responsavel, ...a.participantes, ...a.observadores]);

// ---------------------------------------------------------------- avisos
async function avisoSistema(tarefaId: string, texto: string, autor: string | null) {
  const { error } = await sb.from("ml_tarefa_mensagens").insert({ tarefa_id: tarefaId, autor, tipo: "sistema", texto });
  if (error) throw error;
}
async function notificar(c: Ctx, para: string[], n: { tipo: string; titulo: string; corpo?: string; tarefaId: string }) {
  const rows = unicos(para).filter((u) => u !== c.eu && c.nomes.has(u)).map((usuario) => ({
    usuario, tipo: n.tipo, titulo: n.titulo, corpo: n.corpo ?? "", link: `/tarefas?abrir=${n.tarefaId}`, ref_tipo: "tarefa", ref_id: n.tarefaId,
  }));
  if (!rows.length) return;
  const { error } = await sb.from("ml_notificacoes").insert(rows);
  if (error) console.error("notificacoes", error);
}
const tocar = async (id: string) => { await sb.from("ml_tarefas").update({ atualizado_em: new Date().toISOString() }).eq("id", id); };

// ---------------------------------------------------------------- ações
async function usuarios(c: Ctx) {
  return { usuarios: [...c.nomes.entries()].map(([usuario, nome]) => ({ usuario, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), eu: c.eu };
}

async function listar(c: Ctx, b: any) {
  const escopo = txt(b.escopo) === "todas" && c.direcao ? "todas" : "minhas";
  const papel = txt(b.papel) || "todas";
  const status = txt(b.status) || "abertas";
  const busca = txt(b.busca).toLowerCase();

  let tarefas: Tarefa[] = [];
  if (escopo === "todas") {
    const { data, error } = await sb.from("ml_tarefas").select("*").eq("apagada", false).order("criado_em", { ascending: false }).limit(2000);
    if (error) throw error;
    tarefas = data ?? [];
  } else {
    const [{ data: meus1, error: e1 }, { data: meus2, error: e2 }, { data: ligas, error: e3 }] = await Promise.all([
      sb.from("ml_tarefas").select("*").eq("apagada", false).eq("proprietario", c.eu),
      sb.from("ml_tarefas").select("*").eq("apagada", false).eq("responsavel", c.eu),
      sb.from("ml_tarefa_pessoas").select("tarefa_id").eq("usuario", c.eu),
    ]);
    if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;
    const mapa = new Map<string, Tarefa>();
    for (const t of [...(meus1 ?? []), ...(meus2 ?? [])]) mapa.set(t.id, t);
    const faltam = unicos((ligas ?? []).map((l: any) => l.tarefa_id)).filter((id) => !mapa.has(id));
    for (const t of await lerPorIds("ml_tarefas", "id", faltam)) if (!t.apagada) mapa.set(t.id, t);
    tarefas = [...mapa.values()];
  }

  if (status === "abertas") tarefas = tarefas.filter((t) => t.status !== "concluida");
  else if (status === "concluidas") tarefas = tarefas.filter((t) => t.status === "concluida").sort((a, b) => String(b.concluida_em).localeCompare(String(a.concluida_em))).slice(0, 200);

  const ids = tarefas.map((t) => t.id);
  const [pessoas, itens, leituras, mensagens, filhas] = await Promise.all([
    lerPorIds("ml_tarefa_pessoas", "tarefa_id", ids, "tarefa_id,usuario,papel"),
    lerPorIds("ml_tarefa_checklist", "tarefa_id", ids, "tarefa_id,feito"),
    lerPorIds("ml_tarefa_leituras", "tarefa_id", ids, "tarefa_id,usuario,visto_em"),
    lerPorIds("ml_tarefa_mensagens", "tarefa_id", ids, "tarefa_id,autor,tipo,criado_em"),
    lerPorIds("ml_tarefas", "tarefa_pai_id", ids, "id,tarefa_pai_id,apagada"),
  ]);
  const porTarefa = <T extends { tarefa_id: string }>(l: T[]) => { const m = new Map<string, T[]>(); for (const x of l) m.set(x.tarefa_id, [...(m.get(x.tarefa_id) ?? []), x]); return m; };
  const pessoasM = porTarefa(pessoas), itensM = porTarefa(itens), msgM = porTarefa(mensagens);
  const meuVisto = new Map<string, string>(leituras.filter((l: any) => l.usuario === c.eu).map((l: any) => [l.tarefa_id, l.visto_em]));
  const subs = new Map<string, number>();
  for (const f of filhas) if (!f.apagada) subs.set(f.tarefa_pai_id, (subs.get(f.tarefa_pai_id) ?? 0) + 1);

  const itensSaida = tarefas.map((t) => {
    const ps = pessoasM.get(t.id) ?? [];
    const participantes = ps.filter((p: any) => p.papel === "participante").map((p: any) => p.usuario);
    const observadores = ps.filter((p: any) => p.papel === "observador").map((p: any) => p.usuario);
    const its = itensM.get(t.id) ?? [];
    const visto = meuVisto.get(t.id);
    const novas = (msgM.get(t.id) ?? []).filter((m: any) => m.tipo === "mensagem" && m.autor !== c.eu && (!visto || m.criado_em > visto)).length;
    const nuncaVista = !visto && t.proprietario !== c.eu;
    const papeis = [t.proprietario === c.eu && "proprietario", t.responsavel === c.eu && "responsavel", participantes.includes(c.eu) && "participante", observadores.includes(c.eu) && "observador"].filter(Boolean) as string[];
    return {
      id: t.id, titulo: t.titulo, proprietario: t.proprietario, responsavel: t.responsavel, prazo: t.prazo, urgente: t.urgente, status: t.status, lembrete: t.lembrete_min ?? null,
      criadoEm: t.criado_em, concluidaEm: t.concluida_em, marcadores: t.marcadores ?? [], participantes, observadores,
      checklist: { feitos: its.filter((i: any) => i.feito).length, total: its.length },
      naoLidas: novas + (nuncaVista ? 1 : 0), subtarefas: subs.get(t.id) ?? 0, meusPapeis: papeis, descricao: t.descricao,
    };
  }).filter((t) => {
    if (escopo === "minhas" && papel !== "todas" && !t.meusPapeis.includes(papel)) return false;
    if (busca && !`${t.titulo} ${t.descricao}`.toLowerCase().includes(busca)) return false;
    return true;
  }).map(({ descricao: _d, ...resto }) => resto);

  itensSaida.sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") || String(b.criadoEm).localeCompare(String(a.criadoEm)));
  const nomes: Record<string, string> = {};
  for (const t of itensSaida) for (const u of [t.proprietario, t.responsavel, ...t.participantes, ...t.observadores]) nomes[u] = nomeDe(c, u);
  return { tarefas: itensSaida, nomes, eu: c.eu, escopo };
}

async function obter(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id);
  const [{ data: checklist, error: e1 }, { data: mensagens, error: e2 }, { data: leituras, error: e3 }, { data: filhas, error: e4 }, { data: anexos, error: e6 }] = await Promise.all([
    sb.from("ml_tarefa_checklist").select("*").eq("tarefa_id", a.t.id).order("ordem", { ascending: true }),
    sb.from("ml_tarefa_mensagens").select("*").eq("tarefa_id", a.t.id).order("criado_em", { ascending: true }).limit(1000),
    sb.from("ml_tarefa_leituras").select("usuario,visto_em").eq("tarefa_id", a.t.id),
    sb.from("ml_tarefas").select("id,titulo,status").eq("tarefa_pai_id", a.t.id).eq("apagada", false),
    sb.from("ml_tarefa_anexos").select("id,nome,tipo,tamanho,autor,criado_em").eq("tarefa_id", a.t.id).eq("apagado", false).order("criado_em", { ascending: true }),
  ]);
  if (e1) throw e1; if (e2) throw e2; if (e3) throw e3; if (e4) throw e4; if (e6) throw e6;
  let pai = null;
  if (a.t.tarefa_pai_id) {
    const { data } = await sb.from("ml_tarefas").select("id,titulo,status").eq("id", a.t.tarefa_pai_id).eq("apagada", false).maybeSingle();
    pai = data ?? null;
  }
  // Abrir a tarefa marca como lida (e conta no "visualizado por").
  const { error: e5 } = await sb.from("ml_tarefa_leituras").upsert({ tarefa_id: a.t.id, usuario: c.eu, visto_em: new Date().toISOString() }, { onConflict: "tarefa_id,usuario" });
  if (e5) console.error("leitura", e5);
  await sb.from("ml_notificacoes").update({ lida: true }).eq("usuario", c.eu).eq("ref_id", a.t.id).eq("lida", false);

  const nomes: Record<string, string> = {};
  for (const u of [...envolvidos(a), ...(mensagens ?? []).map((m: any) => m.autor), ...(checklist ?? []).map((i: any) => i.feito_por), ...(leituras ?? []).map((l: any) => l.usuario), ...(anexos ?? []).map((x: any) => x.autor)]) if (u) nomes[u] = nomeDe(c, u);
  const t = a.t;
  return {
    tarefa: {
      id: t.id, titulo: t.titulo, descricao: t.descricao, proprietario: t.proprietario, responsavel: t.responsavel, prazo: t.prazo, urgente: t.urgente, status: t.status, lembrete: t.lembrete_min ?? null,
      criadoEm: t.criado_em, iniciadaEm: t.iniciada_em, concluidaEm: t.concluida_em, concluidaPor: t.concluida_por, marcadores: t.marcadores ?? [],
      participantes: a.participantes, observadores: a.observadores,
    },
    checklist: checklist ?? [], mensagens: mensagens ?? [], visualizacoes: (leituras ?? []).filter((l: any) => l.usuario !== c.eu), subtarefas: filhas ?? [], pai,
    anexos: (anexos ?? []).map((x: any) => ({ id: x.id, nome: x.nome, tipo: x.tipo, tamanho: x.tamanho, autor: x.autor, criadoEm: x.criado_em })),
    nomes, eu: c.eu, pode: { gerir: a.gestor, colaborar: a.colaborador, excluir: t.proprietario === c.eu || c.direcao },
  };
}

function lerMarcadores(v: unknown) {
  const l = Array.isArray(v) ? v : [];
  return unicos(l.map((x) => txt(x).slice(0, 30))).slice(0, 10);
}

async function criar(c: Ctx, b: any) {
  const titulo = txt(b.titulo).slice(0, 200);
  if (!titulo) erro(400, "Dê um nome para a tarefa.");
  const responsavel = txt(b.responsavel) || c.eu;
  const participantes = unicos(Array.isArray(b.participantes) ? b.participantes : []).filter((u) => u !== responsavel && u !== c.eu);
  const observadores = unicos(Array.isArray(b.observadores) ? b.observadores : []).filter((u) => u !== responsavel && u !== c.eu && !participantes.includes(u));
  exigirUsuarios(c, [responsavel, ...participantes, ...observadores]);
  let paiId: string | null = null;
  if (txt(b.tarefa_pai_id)) { const pai = await carregarTarefa(c, b.tarefa_pai_id); paiId = pai.t.id; }

  const { data: nova, error } = await sb.from("ml_tarefas").insert({
    titulo, descricao: txt(b.descricao).slice(0, 20000), proprietario: c.eu, responsavel, prazo: lerPrazo(b.prazo), urgente: b.urgente === true, lembrete_min: lerLembrete(b.lembrete),
    marcadores: lerMarcadores(b.marcadores), tarefa_pai_id: paiId,
  }).select("*").single();
  if (error) throw error;

  const pessoas = [...participantes.map((usuario) => ({ tarefa_id: nova.id, usuario, papel: "participante" })), ...observadores.map((usuario) => ({ tarefa_id: nova.id, usuario, papel: "observador" }))];
  if (pessoas.length) { const { error: e } = await sb.from("ml_tarefa_pessoas").insert(pessoas); if (e) throw e; }

  const lista = (Array.isArray(b.checklist) ? b.checklist : []).slice(0, 200);
  const itens = lista.map((i: any, n: number) => ({ tarefa_id: nova.id, grupo: txt(i?.grupo).slice(0, 80) || "Lista de verificação", texto: txt(i?.texto).slice(0, 300), ordem: n })).filter((i: any) => i.texto);
  if (itens.length) { const { error: e } = await sb.from("ml_tarefa_checklist").insert(itens); if (e) throw e; }

  await avisoSistema(nova.id, `${nomeDe(c, c.eu)} criou a tarefa.`, null);
  await notificar(c, [responsavel], { tipo: "tarefa_nova", titulo: "Nova tarefa para você", corpo: titulo, tarefaId: nova.id });
  await notificar(c, participantes, { tipo: "tarefa_participante", titulo: "Você foi adicionado a uma tarefa", corpo: titulo, tarefaId: nova.id });
  await notificar(c, observadores, { tipo: "tarefa_observador", titulo: "Você acompanha uma tarefa", corpo: titulo, tarefaId: nova.id });
  return { ok: true, id: nova.id };
}

async function atualizar(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id);
  if (!a.gestor) erro(403, "Só o proprietário, o responsável ou a direção editam a tarefa.");
  const mudou: Record<string, unknown> = {};
  const avisos: string[] = [];
  const quem = nomeDe(c, c.eu);
  if ("titulo" in b) { const t = txt(b.titulo).slice(0, 200); if (!t) erro(400, "O nome da tarefa não pode ficar vazio."); if (t !== a.t.titulo) { mudou.titulo = t; avisos.push(`${quem} alterou o nome da tarefa.`); } }
  if ("descricao" in b) { const d = txt(b.descricao).slice(0, 20000); if (d !== a.t.descricao) { mudou.descricao = d; avisos.push(`${quem} editou a descrição.`); } }
  if ("prazo" in b) {
    const p = lerPrazo(b.prazo);
    const antes = a.t.prazo ? new Date(a.t.prazo).toISOString() : null;
    if (p !== antes) { mudou.prazo = p; avisos.push(p ? `${quem} alterou o prazo para ${quando(p)}.` : `${quem} removeu o prazo.`); }
  }
  if ("lembrete" in b) {
    const l = lerLembrete(b.lembrete);
    if (l !== (a.t.lembrete_min ?? null)) { mudou.lembrete_min = l; avisos.push(l === null ? `${quem} removeu o lembrete.` : `${quem} definiu um lembrete ${l === 0 ? "para a hora do prazo" : `${rotuloLembrete(l)} antes do prazo`}.`); }
  }
  // Mudou o prazo ou o lembrete: o aviso volta a valer.
  if ("prazo" in mudou || "lembrete_min" in mudou) mudou.lembrete_enviado_em = null;
  if ("urgente" in b && (b.urgente === true) !== a.t.urgente) { mudou.urgente = b.urgente === true; avisos.push(b.urgente === true ? `${quem} marcou a tarefa como urgente.` : `${quem} tirou a marca de urgente.`); }
  if ("marcadores" in b) { const m = lerMarcadores(b.marcadores); if (m.join("|") !== (a.t.marcadores ?? []).join("|")) mudou.marcadores = m; }
  if (!Object.keys(mudou).length) return { ok: true, semMudanca: true };
  const { error } = await sb.from("ml_tarefas").update({ ...mudou, atualizado_em: new Date().toISOString() }).eq("id", a.t.id);
  if (error) throw error;
  for (const t of avisos) await avisoSistema(a.t.id, t, null);
  if ("prazo" in mudou || "titulo" in mudou) await notificar(c, envolvidos(a), { tipo: "tarefa_alterada", titulo: "Tarefa alterada", corpo: `${a.t.titulo}: ${avisos[0] ?? ""}`, tarefaId: a.t.id });
  return { ok: true };
}

async function delegar(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id);
  if (!a.gestor) erro(403, "Só o proprietário, o responsável ou a direção passam a tarefa para outra pessoa.");
  const novo = txt(b.responsavel);
  exigirUsuarios(c, [novo]);
  if (novo === a.t.responsavel) return { ok: true, semMudanca: true };
  const { error } = await sb.from("ml_tarefas").update({ responsavel: novo, atualizado_em: new Date().toISOString() }).eq("id", a.t.id);
  if (error) throw error;
  // Quem vira responsável deixa de ser participante/observador (já está no comando da tarefa).
  await sb.from("ml_tarefa_pessoas").delete().eq("tarefa_id", a.t.id).eq("usuario", novo);
  // Quem passou a tarefa adiante continua enxergando: vira participante (se não for o proprietário).
  if (a.t.responsavel !== a.t.proprietario) {
    const { error: eAnt } = await sb.from("ml_tarefa_pessoas").upsert({ tarefa_id: a.t.id, usuario: a.t.responsavel, papel: "participante" }, { onConflict: "tarefa_id,usuario" });
    if (eAnt) throw eAnt;
  }
  await avisoSistema(a.t.id, `${nomeDe(c, c.eu)} passou a tarefa de ${nomeDe(c, a.t.responsavel)} para ${nomeDe(c, novo)}.`, null);
  await notificar(c, [novo], { tipo: "tarefa_delegada", titulo: "Uma tarefa foi passada para você", corpo: a.t.titulo, tarefaId: a.t.id });
  await notificar(c, [a.t.proprietario, a.t.responsavel], { tipo: "tarefa_alterada", titulo: "Responsável alterado", corpo: `${a.t.titulo}: agora com ${nomeDe(c, novo)}`, tarefaId: a.t.id });
  return { ok: true };
}

async function mudarStatus(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id);
  const acao = txt(b.acao);
  const quem = nomeDe(c, c.eu);
  const agora = new Date().toISOString();
  let patch: Record<string, unknown>, aviso: string, tipo = "tarefa_status";
  if (acao === "iniciar") {
    if (!a.colaborador) erro(403, "Só quem trabalha na tarefa pode iniciá-la.");
    if (a.t.status === "em_andamento") return { ok: true, semMudanca: true };
    if (a.t.status === "concluida") erro(400, "A tarefa já foi concluída. Reabra para continuar.");
    patch = { status: "em_andamento", iniciada_em: a.t.iniciada_em ?? agora }; aviso = `${quem} iniciou a tarefa.`;
  } else if (acao === "pausar") {
    if (!a.colaborador) erro(403, "Só quem trabalha na tarefa pode colocá-la em espera.");
    if (a.t.status === "concluida") erro(400, "A tarefa já foi concluída.");
    patch = { status: "aguardando" }; aviso = `${quem} colocou a tarefa em espera.`;
  } else if (acao === "concluir") {
    if (!a.gestor) erro(403, "Só o proprietário, o responsável ou a direção concluem a tarefa.");
    if (a.t.status === "concluida") return { ok: true, semMudanca: true };
    patch = { status: "concluida", concluida_em: agora, concluida_por: c.eu, iniciada_em: a.t.iniciada_em ?? agora }; aviso = `${quem} concluiu a tarefa.`; tipo = "tarefa_concluida";
  } else if (acao === "reabrir") {
    if (!a.gestor) erro(403, "Só o proprietário, o responsável ou a direção reabrem a tarefa.");
    if (a.t.status !== "concluida") return { ok: true, semMudanca: true };
    patch = { status: "em_andamento", concluida_em: null, concluida_por: null }; aviso = `${quem} reabriu a tarefa.`;
  } else erro(400, "Ação inválida.");
  const { error } = await sb.from("ml_tarefas").update({ ...patch, atualizado_em: agora }).eq("id", a.t.id);
  if (error) throw error;
  await avisoSistema(a.t.id, aviso, null);
  const destino = acao === "concluir" ? envolvidos(a) : [a.t.proprietario, a.t.responsavel];
  await notificar(c, destino, { tipo, titulo: acao === "concluir" ? "Tarefa concluída" : "Tarefa atualizada", corpo: `${a.t.titulo}: ${aviso}`, tarefaId: a.t.id });
  return { ok: true };
}

async function definirPessoas(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id);
  if (!a.gestor) erro(403, "Só o proprietário, o responsável ou a direção mudam as pessoas da tarefa.");
  const participantes = unicos(Array.isArray(b.participantes) ? b.participantes : []).filter((u) => u !== a.t.responsavel && u !== a.t.proprietario);
  const observadores = unicos(Array.isArray(b.observadores) ? b.observadores : []).filter((u) => u !== a.t.responsavel && u !== a.t.proprietario && !participantes.includes(u));
  exigirUsuarios(c, [...participantes, ...observadores]);
  const { error: ed } = await sb.from("ml_tarefa_pessoas").delete().eq("tarefa_id", a.t.id);
  if (ed) throw ed;
  const rows = [...participantes.map((usuario) => ({ tarefa_id: a.t.id, usuario, papel: "participante" })), ...observadores.map((usuario) => ({ tarefa_id: a.t.id, usuario, papel: "observador" }))];
  if (rows.length) { const { error } = await sb.from("ml_tarefa_pessoas").insert(rows); if (error) throw error; }
  const novosP = participantes.filter((u) => !a.participantes.includes(u)), novosO = observadores.filter((u) => !a.observadores.includes(u));
  const tiradosP = a.participantes.filter((u) => !participantes.includes(u)), tiradosO = a.observadores.filter((u) => !observadores.includes(u));
  const quem = nomeDe(c, c.eu);
  if (novosP.length) await avisoSistema(a.t.id, `${quem} adicionou ${novosP.map((u) => nomeDe(c, u)).join(", ")} como participante${novosP.length > 1 ? "s" : ""}.`, null);
  if (novosO.length) await avisoSistema(a.t.id, `${quem} adicionou ${novosO.map((u) => nomeDe(c, u)).join(", ")} como observador${novosO.length > 1 ? "es" : ""}.`, null);
  const tirados = [...tiradosP, ...tiradosO];
  if (tirados.length) await avisoSistema(a.t.id, `${quem} retirou ${tirados.map((u) => nomeDe(c, u)).join(", ")} da tarefa.`, null);
  await notificar(c, novosP, { tipo: "tarefa_participante", titulo: "Você foi adicionado a uma tarefa", corpo: a.t.titulo, tarefaId: a.t.id });
  await notificar(c, novosO, { tipo: "tarefa_observador", titulo: "Você acompanha uma tarefa", corpo: a.t.titulo, tarefaId: a.t.id });
  return { ok: true };
}

async function checklist(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id);
  if (!a.colaborador) erro(403, "Só quem trabalha na tarefa mexe na lista de verificação.");
  const acao = txt(b.acao);
  if (acao === "adicionar") {
    const texto = txt(b.texto).slice(0, 300);
    if (!texto) erro(400, "Escreva o item.");
    const { data: ult } = await sb.from("ml_tarefa_checklist").select("ordem").eq("tarefa_id", a.t.id).order("ordem", { ascending: false }).limit(1);
    const { count } = await sb.from("ml_tarefa_checklist").select("id", { count: "exact", head: true }).eq("tarefa_id", a.t.id);
    if ((count ?? 0) >= 200) erro(400, "A lista de verificação chegou ao limite de 200 itens.");
    const { error } = await sb.from("ml_tarefa_checklist").insert({ tarefa_id: a.t.id, grupo: txt(b.grupo).slice(0, 80) || "Lista de verificação", texto, ordem: (ult?.[0]?.ordem ?? -1) + 1 });
    if (error) throw error;
  } else {
    const itemId = txt(b.item_id);
    if (!UUID.test(itemId)) erro(400, "Item inválido.");
    const { data: item, error: e0 } = await sb.from("ml_tarefa_checklist").select("id,tarefa_id").eq("id", itemId).maybeSingle();
    if (e0) throw e0;
    if (!item || item.tarefa_id !== a.t.id) erro(404, "Não encontrei esse item.");
    if (acao === "marcar") {
      const feito = b.feito === true;
      const { error } = await sb.from("ml_tarefa_checklist").update({ feito, feito_por: feito ? c.eu : null, feito_em: feito ? new Date().toISOString() : null }).eq("id", itemId);
      if (error) throw error;
    } else if (acao === "renomear") {
      const texto = txt(b.texto).slice(0, 300);
      if (!texto) erro(400, "Escreva o item.");
      const { error } = await sb.from("ml_tarefa_checklist").update({ texto }).eq("id", itemId);
      if (error) throw error;
    } else if (acao === "remover") {
      const { error } = await sb.from("ml_tarefa_checklist").delete().eq("id", itemId);
      if (error) throw error;
    } else erro(400, "Ação inválida.");
  }
  await tocar(a.t.id);
  const { data, error } = await sb.from("ml_tarefa_checklist").select("*").eq("tarefa_id", a.t.id).order("ordem", { ascending: true });
  if (error) throw error;
  return { ok: true, checklist: data ?? [] };
}

async function mensagem(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id);
  const texto = txt(b.texto).slice(0, 5000);
  if (!texto) erro(400, "Escreva a mensagem.");
  const { data, error } = await sb.from("ml_tarefa_mensagens").insert({ tarefa_id: a.t.id, autor: c.eu, tipo: "mensagem", texto }).select("*").single();
  if (error) throw error;
  await sb.from("ml_tarefa_leituras").upsert({ tarefa_id: a.t.id, usuario: c.eu, visto_em: new Date().toISOString() }, { onConflict: "tarefa_id,usuario" });
  await tocar(a.t.id);
  await notificar(c, envolvidos(a), { tipo: "tarefa_mensagem", titulo: `${nomeDe(c, c.eu)} comentou em "${a.t.titulo}"`.slice(0, 160), corpo: texto.slice(0, 140), tarefaId: a.t.id });
  return { ok: true, mensagem: data };
}


// ---------------------------------------------------------------- anexos
const BUCKET_ARQUIVOS = "ml-arquivos";
const MAX_ANEXO_BYTES = 8 * 1024 * 1024;
const MAX_ANEXOS_POR_TAREFA = 30;
// Tipos aceitos (pelo nome do arquivo; o tipo que o navegador diz não vale). Nada executável.
const TIPOS_ANEXO: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv", txt: "text/plain", xml: "application/xml", zip: "application/zip",
};
const extensaoDe = (nome: string) => (nome.split(".").length > 1 ? nome.split(".").pop()!.toLowerCase() : "");
const nomeSeguro = (nome: string) => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(-80) || "arquivo";

async function anexoEnviar(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id);
  if (!a.colaborador) erro(403, "Observador só comenta; quem participa, o responsável e o proprietário anexam arquivos.");
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
  const { count, error: eCount } = await sb.from("ml_tarefa_anexos").select("id", { count: "exact", head: true }).eq("tarefa_id", a.t.id).eq("apagado", false);
  if (eCount) throw eCount;
  if ((count ?? 0) >= MAX_ANEXOS_POR_TAREFA) erro(400, `Esta tarefa já tem ${MAX_ANEXOS_POR_TAREFA} arquivos.`);
  const caminho = `tarefas/${a.t.id}/${crypto.randomUUID()}-${nomeSeguro(nome)}`;
  const { error: eUp } = await sb.storage.from(BUCKET_ARQUIVOS).upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (eUp) throw eUp;
  const { data, error } = await sb.from("ml_tarefa_anexos").insert({ tarefa_id: a.t.id, nome, tipo, tamanho: bytes.length, caminho, autor: c.eu }).select("id,nome,tipo,tamanho,autor,criado_em").single();
  if (error) { await sb.storage.from(BUCKET_ARQUIVOS).remove([caminho]); throw error; }
  await avisoSistema(a.t.id, `${nomeDe(c, c.eu)} anexou "${nome}".`, null);
  await tocar(a.t.id);
  await notificar(c, envolvidos(a), { tipo: "tarefa_anexo", titulo: `${nomeDe(c, c.eu)} anexou um arquivo em "${a.t.titulo}"`.slice(0, 160), corpo: nome, tarefaId: a.t.id });
  return { ok: true, anexo: { id: data.id, nome: data.nome, tipo: data.tipo, tamanho: data.tamanho, autor: data.autor, criadoEm: data.criado_em } };
}

async function carregarAnexo(a: { t: Tarefa }, id: unknown) {
  const aid = txt(id);
  if (!UUID.test(aid)) erro(400, "Arquivo inválido.");
  const { data, error } = await sb.from("ml_tarefa_anexos").select("*").eq("id", aid).eq("tarefa_id", a.t.id).eq("apagado", false).maybeSingle();
  if (error) throw error;
  if (!data) erro(404, "Não encontrei esse arquivo.");
  return data;
}

async function anexoUrl(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id); // quem vê a tarefa baixa
  const anexo = await carregarAnexo(a, b.anexo_id);
  const { data, error } = await sb.storage.from(BUCKET_ARQUIVOS).createSignedUrl(anexo.caminho, 120, { download: anexo.nome });
  if (error || !data?.signedUrl) throw error ?? new Error("Não consegui gerar o link do arquivo.");
  return { ok: true, url: data.signedUrl, nome: anexo.nome };
}

async function anexoApagar(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id);
  const anexo = await carregarAnexo(a, b.anexo_id);
  if (anexo.autor !== c.eu && !a.gestor) erro(403, "Só quem anexou, o proprietário, o responsável ou a direção apagam o arquivo.");
  const { error } = await sb.from("ml_tarefa_anexos").update({ apagado: true }).eq("id", anexo.id);
  if (error) throw error;
  const { error: eRm } = await sb.storage.from(BUCKET_ARQUIVOS).remove([anexo.caminho]);
  if (eRm) console.error("anexoApagar", eRm);
  await avisoSistema(a.t.id, `${nomeDe(c, c.eu)} removeu o arquivo "${anexo.nome}".`, null);
  await tocar(a.t.id);
  return { ok: true };
}

async function excluir(c: Ctx, b: any) {
  const a = await carregarTarefa(c, b.id);
  if (a.t.proprietario !== c.eu && !c.direcao) erro(403, "Só o proprietário ou a direção apagam a tarefa.");
  const { error } = await sb.from("ml_tarefas").update({ apagada: true, atualizado_em: new Date().toISOString() }).eq("id", a.t.id);
  if (error) throw error;
  return { ok: true };
}

const ACOES: Record<string, (c: Ctx, b: any) => Promise<unknown>> = {
  usuarios: (c) => usuarios(c), listar, obter, criar, atualizar, delegar, status: mudarStatus, pessoas: definirPessoas, checklist, mensagem, excluir, anexo_enviar: anexoEnviar, anexo_url: anexoUrl, anexo_apagar: anexoApagar,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const cracha = await crachaDoPainel(req);
  if (!cracha) return json({ erro: "Sua sessão expirou. Entre de novo.", semSessao: true }, 401);
  try {
    const b = await req.json().catch(() => ({}));
    const acao = txt(b.action);
    const fn = ACOES[acao];
    if (!fn) return json({ erro: "Ação inválida." }, 400);
    const c = await carregarCtx(cracha);
    return json(await fn(c, b));
  } catch (e) {
    if (e instanceof Falha) return json({ erro: e.message, ...(e.status === 401 ? { semSessao: true } : {}) }, e.status);
    console.error("ml-tarefas", e);
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
