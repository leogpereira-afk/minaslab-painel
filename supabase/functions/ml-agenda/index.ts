// ml-agenda — agenda da equipe: treinamentos, reuniões, eventos e férias/ausências com responsável.
//
// Quem vê um evento: o criador, quem está ligado a ele (participante, ausente, responsável) ou todos, se for "para todos".
// Quem muda ou cancela: o criador, a direção e, nas férias/ausências, a própria pessoa ausente.
// Quem cria: qualquer usuário ativo, menos o papel "leitura". Quem não é direção só marca ausência para si mesmo.
// Os avisos vão para o sino (ml_notificacoes); o lembrete do dia às 8h é uma rotina do banco (ml_agenda_avisar_hoje).
//
// Ações: usuarios, listar, criar, atualizar, cancelar.
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
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIPOS = ["treinamento", "reuniao", "ferias", "ausencia", "evento"];
const ROTULO: Record<string, string> = { treinamento: "Treinamento", reuniao: "Reunião", ferias: "Férias", ausencia: "Ausência", evento: "Evento" };
const MAX_DIAS = 400;

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

const fatiar = <T,>(lista: T[], n = 150) => { const o: T[][] = []; for (let i = 0; i < lista.length; i += n) o.push(lista.slice(i, i + n)); return o; };
const unicos = (l: unknown) => [...new Set((Array.isArray(l) ? l : []).map(txt).filter(Boolean))];
async function lerPorIds(tabela: string, coluna: string, ids: string[]) {
  const out: any[] = [];
  for (const f of fatiar(ids)) {
    const { data, error } = await sb.from(tabela).select("*").in(coluna, f);
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}
const diaValido = (d: string) => DIA.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const br = (d: string) => d.split("-").reverse().join("/");
const hhmm = (h: unknown) => txt(h).slice(0, 5);

type Ctx = { eu: string; nome: string; direcao: boolean; leitura: boolean; nomes: Map<string, string> };
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
  return { eu: mim.usuario, nome: txt(mim.nome) || mim.usuario, direcao: mim.papel === "direcao", leitura: mim.papel === "leitura", nomes };
}
const nomeDe = (c: Ctx, u: string) => c.nomes.get(u) ?? u;
function exigirUsuarios(c: Ctx, lista: string[]) {
  for (const u of lista) if (!c.nomes.has(u)) erro(400, `O usuário "${u}" não existe ou está inativo.`);
}

async function avisar(c: Ctx, para: string[], n: { titulo: string; corpo?: string; dia: string; id: string }) {
  const rows = [...new Set(para)].filter((u) => u !== c.eu && c.nomes.has(u)).map((usuario) => ({ usuario, tipo: "agenda", titulo: n.titulo, corpo: n.corpo ?? "", link: `/calendario?dia=${n.dia}`, ref_tipo: "agenda", ref_id: n.id }));
  if (!rows.length) return;
  const { error } = await sb.from("ml_notificacoes").insert(rows);
  if (error) console.error("notificacoes", error);
}

// ---------------------------------------------------------------- leitura
function montar(c: Ctx, e: any, pessoas: any[]) {
  const dele = pessoas.filter((p) => p.evento_id === e.id);
  const por = (papel: string) => dele.filter((p) => p.papel === papel).map((p) => p.usuario);
  const ausentes = por("ausente");
  const ehAusencia = e.tipo === "ferias" || e.tipo === "ausencia";
  return {
    id: e.id, tipo: e.tipo, titulo: e.titulo, descricao: e.descricao, local: e.local,
    diaInicio: e.dia_inicio, diaFim: e.dia_fim, horaInicio: e.hora_inicio ? hhmm(e.hora_inicio) : "", horaFim: e.hora_fim ? hhmm(e.hora_fim) : "",
    paraTodos: !!e.para_todos, criador: e.criador, participantes: por("participante"), ausentes, responsaveis: por("responsavel"),
    pode: { editar: e.criador === c.eu || c.direcao || (ehAusencia && ausentes.includes(c.eu)) },
  };
}

async function usuarios(c: Ctx) {
  return { usuarios: [...c.nomes.entries()].map(([usuario, nome]) => ({ usuario, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), eu: c.eu, podeCriar: !c.leitura, direcao: c.direcao };
}

async function listar(c: Ctx, b: any) {
  const de = txt(b.de), ate = txt(b.ate);
  if (!diaValido(de) || !diaValido(ate) || ate < de) erro(400, "Período inválido.");
  if (diasEntre(de, ate) > 800) erro(400, "Período grande demais.");
  const { data, error } = await sb.from("ml_agenda_eventos").select("*").eq("cancelado", false).lte("dia_inicio", ate).gte("dia_fim", de).order("dia_inicio", { ascending: true }).limit(1000);
  if (error) throw error;
  const eventos = data ?? [];
  const pessoas = await lerPorIds("ml_agenda_pessoas", "evento_id", eventos.map((e: any) => e.id));
  const visiveis = eventos.filter((e: any) => e.para_todos || e.criador === c.eu || pessoas.some((p) => p.evento_id === e.id && p.usuario === c.eu));
  const lista = visiveis.map((e: any) => montar(c, e, pessoas));
  const nomes: Record<string, string> = {};
  for (const e of lista) for (const u of [e.criador, ...e.participantes, ...e.ausentes, ...e.responsaveis]) nomes[u] = nomeDe(c, u);
  return { eventos: lista, nomes, eu: c.eu, podeCriar: !c.leitura };
}

// ---------------------------------------------------------------- escrita
function ler(c: Ctx, b: any, atual?: any) {
  const tipo = txt(b.tipo ?? atual?.tipo);
  if (!TIPOS.includes(tipo)) erro(400, "Escolha o tipo do evento.");
  const ehAusencia = tipo === "ferias" || tipo === "ausencia";
  const diaInicio = txt(b.diaInicio ?? atual?.dia_inicio), diaFim = txt(b.diaFim ?? b.diaInicio ?? atual?.dia_fim);
  if (!diaValido(diaInicio) || !diaValido(diaFim)) erro(400, "Informe as datas.");
  if (diaFim < diaInicio) erro(400, "A data final não pode ser antes da inicial.");
  if (diasEntre(diaInicio, diaFim) + 1 > MAX_DIAS) erro(400, "O período passa de um ano. Divida em dois.");
  let horaInicio = ehAusencia ? "" : txt(b.horaInicio), horaFim = ehAusencia ? "" : txt(b.horaFim);
  if (horaInicio && !HORA.test(horaInicio)) erro(400, "Hora de início inválida.");
  if (horaFim && !HORA.test(horaFim)) erro(400, "Hora final inválida.");
  if (horaFim && !horaInicio) erro(400, "Informe a hora de início.");
  if (horaInicio && horaFim && diaInicio === diaFim && horaFim < horaInicio) erro(400, "A hora final não pode ser antes da inicial.");
  const descricao = String(b.descricao ?? "").replace(/\r\n/g, "\n").trim().slice(0, 1000);
  const local = txt(b.local).slice(0, 120);
  let participantes: string[] = [], ausentes: string[] = [], responsaveis: string[] = [], paraTodos = false;
  if (ehAusencia) {
    ausentes = unicos(b.ausentes);
    if (!ausentes.length) ausentes = [c.eu];
    if (!c.direcao && (ausentes.length !== 1 || ausentes[0] !== c.eu)) erro(403, "Você só marca férias ou ausência para você mesmo.");
    responsaveis = unicos(b.responsaveis);
    if (!responsaveis.length) erro(400, "Escolha quem fica responsável durante a ausência.");
    if (responsaveis.some((u) => ausentes.includes(u))) erro(400, "O responsável não pode ser a própria pessoa que está ausente.");
  } else {
    paraTodos = b.paraTodos === true;
    participantes = paraTodos ? [] : unicos(b.participantes).filter((u) => u !== c.eu);
  }
  exigirUsuarios(c, [...participantes, ...ausentes, ...responsaveis]);
  let titulo = txt(b.titulo).replace(/\s+/g, " ").slice(0, 120);
  if (!titulo && ehAusencia) titulo = `${ROTULO[tipo]} de ${ausentes.map((u) => nomeDe(c, u)).join(", ")}`;
  if (!titulo) erro(400, "Dê um nome para o evento.");
  return { tipo, titulo, descricao, local, diaInicio, diaFim, horaInicio, horaFim, participantes, ausentes, responsaveis, paraTodos, ehAusencia };
}

async function gravarPessoas(id: string, v: ReturnType<typeof ler>) {
  const { error: e0 } = await sb.from("ml_agenda_pessoas").delete().eq("evento_id", id);
  if (e0) throw e0;
  const rows = [
    ...v.participantes.map((usuario) => ({ evento_id: id, usuario, papel: "participante" })),
    ...v.ausentes.map((usuario) => ({ evento_id: id, usuario, papel: "ausente" })),
    ...v.responsaveis.map((usuario) => ({ evento_id: id, usuario, papel: "responsavel" })),
  ];
  if (rows.length) { const { error } = await sb.from("ml_agenda_pessoas").insert(rows); if (error) throw error; }
}

function periodo(v: { diaInicio: string; diaFim: string; horaInicio: string }) {
  const dias = v.diaInicio === v.diaFim ? br(v.diaInicio) : `${br(v.diaInicio)} a ${br(v.diaFim)}`;
  return v.horaInicio ? `${dias} às ${v.horaInicio}` : dias;
}

async function avisarEvento(c: Ctx, id: string, v: ReturnType<typeof ler>, acao: "novo" | "mudou" | "cancelado") {
  const prefixo = acao === "novo" ? "" : acao === "mudou" ? "Mudou: " : "Cancelado: ";
  const dia = v.diaInicio;
  if (v.ehAusencia) {
    const quem = v.ausentes.map((u) => nomeDe(c, u)).join(", ");
    const oQue = ROTULO[v.tipo].toLowerCase();
    await avisar(c, v.responsaveis, { titulo: acao === "cancelado" ? `Cancelado: ${oQue} de ${quem}` : `${acao === "mudou" ? "Mudou: " : ""}Você é o responsável durante ${oQue === "férias" ? "as férias" : "a ausência"} de ${quem}`, corpo: periodo(v), dia, id });
    await avisar(c, v.ausentes, { titulo: `${prefixo}${ROTULO[v.tipo]} marcada para você`, corpo: periodo(v), dia, id });
    return;
  }
  const destino = v.paraTodos ? [...c.nomes.keys()] : v.participantes;
  await avisar(c, destino, { titulo: `${prefixo}${acao === "novo" ? `${ROTULO[v.tipo]} marcado: ` : ""}${v.titulo}`, corpo: periodo(v), dia, id });
}

async function criar(c: Ctx, b: any) {
  if (c.leitura) erro(403, "Seu acesso é só de leitura.");
  const v = ler(c, b);
  const { data, error } = await sb.from("ml_agenda_eventos").insert({
    tipo: v.tipo, titulo: v.titulo, descricao: v.descricao, local: v.local, dia_inicio: v.diaInicio, dia_fim: v.diaFim,
    hora_inicio: v.horaInicio || null, hora_fim: v.horaFim || null, para_todos: v.paraTodos, criador: c.eu,
  }).select("id").single();
  if (error) throw error;
  await gravarPessoas(data.id, v);
  await avisarEvento(c, data.id, v, "novo");
  return { ok: true, id: data.id };
}

async function carregarEvento(c: Ctx, id: unknown) {
  const eid = txt(id);
  if (!UUID.test(eid)) erro(400, "Evento inválido.");
  const { data: e, error } = await sb.from("ml_agenda_eventos").select("*").eq("id", eid).eq("cancelado", false).maybeSingle();
  if (error) throw error;
  if (!e) erro(404, "Não encontrei esse evento.");
  const pessoas = await lerPorIds("ml_agenda_pessoas", "evento_id", [eid]);
  const visivel = e.para_todos || e.criador === c.eu || pessoas.some((p) => p.usuario === c.eu);
  if (!visivel) erro(403, "Você não participa deste evento.");
  const m = montar(c, e, pessoas);
  if (!m.pode.editar) erro(403, "Só quem marcou o evento (ou a direção) muda ou cancela.");
  return { e, m };
}

async function atualizar(c: Ctx, b: any) {
  const { e, m } = await carregarEvento(c, b.id);
  const v = ler(c, { ...b, tipo: m.tipo }, e); // o tipo não muda depois de criado
  const { error } = await sb.from("ml_agenda_eventos").update({
    titulo: v.titulo, descricao: v.descricao, local: v.local, dia_inicio: v.diaInicio, dia_fim: v.diaFim,
    hora_inicio: v.horaInicio || null, hora_fim: v.horaFim || null, para_todos: v.paraTodos, atualizado_em: new Date().toISOString(),
  }).eq("id", e.id);
  if (error) throw error;
  await gravarPessoas(e.id, v);
  await avisarEvento(c, e.id, v, "mudou");
  return { ok: true };
}

async function cancelar(c: Ctx, b: any) {
  const { e, m } = await carregarEvento(c, b.id);
  const { error } = await sb.from("ml_agenda_eventos").update({ cancelado: true, atualizado_em: new Date().toISOString() }).eq("id", e.id);
  if (error) throw error;
  await avisarEvento(c, e.id, { tipo: m.tipo, titulo: m.titulo, descricao: "", local: "", diaInicio: m.diaInicio, diaFim: m.diaFim, horaInicio: m.horaInicio, horaFim: m.horaFim, participantes: m.participantes, ausentes: m.ausentes, responsaveis: m.responsaveis, paraTodos: m.paraTodos, ehAusencia: m.tipo === "ferias" || m.tipo === "ausencia" }, "cancelado");
  return { ok: true };
}

const ACOES: Record<string, (c: Ctx, b: any) => Promise<unknown>> = { usuarios: (c) => usuarios(c), listar, criar, atualizar, cancelar };

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
    console.error("ml-agenda", e);
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
