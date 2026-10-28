// chatpro-chat: consulta a API do ChatPro Chat (sparks.chatpro.com.br) com o
// token salvo no servidor (CHATPRO_CHAT_TOKEN) e guarda no banco o que o CRM
// precisa para traduzir os eventos de atendimento: usuários (quem atende) e
// motivos de finalização. Depois reaplica as sessões aos atendimentos.
// Chamada pelo cron/SQL (cabeçalho x-rotina-token, conferido no cofre) ou por
// um usuário logado do CRM (Authorization: Bearer <jwt>).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const BASE = "https://sparks.chatpro.com.br";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, x-rotina-token, apikey, x-client-info" };

function fromJson(name: string): string {
  try { return JSON.parse(Deno.env.get(name) ?? "{}")["default"] ?? ""; } catch { return ""; }
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEY = Deno.env.get("SB_SECRET_KEY") || fromJson("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function json(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS }); }

// Lista "embrulhada" de jeitos diferentes conforme o endpoint.
function lista(x: any): any[] {
  if (Array.isArray(x)) return x;
  for (const k of ["data", "users", "items", "results", "endings", "result", "rows"]) {
    if (Array.isArray(x?.[k])) return x[k];
    if (x?.[k] && typeof x[k] === "object") { const r = lista(x[k]); if (r.length) return r; }
  }
  return [];
}
// Objeto único (getSessionById etc.) embrulhado ou não.
function objeto(x: any): any {
  if (x && typeof x === "object" && !Array.isArray(x) && typeof x.id === "string") return x;
  for (const k of ["data", "session", "result", "item"]) if (x?.[k] && typeof x[k] === "object") { const r = objeto(x[k]); if (r) return r; }
  return null;
}
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Chama a API do ChatPro; se ela pedir calma (429), espera e tenta de novo.
async function chamar(token: string, caminho: string, corpo: Record<string, unknown>) {
  for (let tentativa = 0; ; tentativa++) {
    const r = await fetch(BASE + caminho, { method: "POST", headers: { "content-type": "application/json", "instance-token": token }, body: JSON.stringify(corpo) });
    const t = await r.text();
    if (r.status === 429 && tentativa < 4) { await espera(1500 * (tentativa + 1)); continue; }
    let dados: unknown = null;
    try { dados = JSON.parse(t); } catch { dados = t.slice(0, 300); }
    return { status: r.status, ok: r.ok, dados };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
  if (req.method !== "POST") return json(405, { ok: false, erro: "use POST" });
  if (!SUPABASE_URL || !SECRET_KEY) return json(503, { ok: false, erro: "ambiente do servidor incompleto" });
  const sb = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } });

  // Quem chama: rotina (token do cofre) ou usuário logado do CRM.
  const rotina = req.headers.get("x-rotina-token") || "";
  let autorizado = false;
  if (rotina) { const { data } = await sb.rpc("ml_chatpro_conferir_rotina", { p_token: rotina }); autorizado = data === true; }
  if (!autorizado) {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (jwt) { const { data } = await sb.auth.getUser(jwt); autorizado = Boolean(data?.user?.id); }
  }
  if (!autorizado) return json(401, { ok: false, erro: "não autorizado" });

  const token = (Deno.env.get("CHATPRO_CHAT_TOKEN") || "").trim();
  if (!token) return json(200, { ok: false, erro: "CHATPRO_CHAT_TOKEN não está salvo nos segredos das funções" });

  let corpo: any = {};
  try { corpo = await req.json(); } catch { corpo = {}; }
  const acao = txt(corpo?.acao) || "sincronizar";

  // Instância: a informada ou a que aparece nos eventos recebidos.
  let instancia = txt(corpo?.instancia);
  if (!instancia) {
    const { data } = await sb.from("chatpro_eventos").select("payload").like("event_type", "SESSION.%").order("recebido_em", { ascending: false }).limit(1);
    instancia = txt((data?.[0] as any)?.payload?.new?.instance_id) || "chatpro-85815d6bd1";
  }

  const usuarios = await chamar(token, "/users/getAllInstanceUsers", { instanceId: instancia });
  if (acao === "verificar") {
    const l = lista(usuarios.dados);
    const m = await chamar(token, "/endings/list", { instanceId: instancia });
    const lm = lista(m.dados);
    return json(200, {
      ok: usuarios.ok, status_chatpro: usuarios.status, instancia, usuarios: l.length,
      campos_usuario: l[0]?.user ? Object.keys(l[0].user) : [],
      status_motivos: m.status, motivos: lm.length, campos_motivo: lm[0] ? Object.keys(lm[0]) : [],
      resposta_motivos: lm.length ? undefined : m.dados,
    });
  }
  if (!usuarios.ok) return json(200, { ok: false, erro: "ChatPro recusou a consulta de usuários", status_chatpro: usuarios.status, resposta: usuarios.dados });

  // Só os campos que interessam: o registro do ChatPro traz até segredo de MFA.
  const linhasU = lista(usuarios.dados).map((u: any) => {
    const p = u?.user && typeof u.user === "object" ? u.user : {};
    return {
      id: txt(u?.user_id ?? p?.id ?? p?.uid ?? u?.id),
      nome: txt(p?.name ?? p?.nome ?? p?.display_name ?? p?.displayName ?? u?.name) || null,
      email: txt(p?.email ?? u?.email).toLowerCase() || null,
      ativo: typeof u?.active === "boolean" ? u.active && !u?.deleted : null,
      papel: txt(u?.role) || null,
      atualizado_em: new Date().toISOString(),
    };
  }).filter((u) => u.id);
  if (linhasU.length) {
    const { error } = await sb.from("chatpro_usuarios").upsert(linhasU, { onConflict: "id" });
    if (error) return json(500, { ok: false, erro: "falha ao gravar usuários: " + error.message });
  }

  const motivos = await chamar(token, "/endings/list", { instanceId: instancia });
  const linhasM = lista(motivos.dados).map((m: any) => ({
    id: txt(m?.id ?? m?._id),
    nome: txt(m?.name ?? m?.nome ?? m?.title ?? m?.description) || null,
    ativo: typeof m?.deleted === "boolean" ? !m.deleted : null,
    atualizado_em: new Date().toISOString(),
  })).filter((m) => m.id);
  if (linhasM.length) {
    const { error } = await sb.from("chatpro_motivos").upsert(linhasM, { onConflict: "id" });
    if (error) return json(500, { ok: false, erro: "falha ao gravar motivos: " + error.message });
  }

  // Liga usuários do ChatPro aos do CRM e reaplica os eventos de sessão guardados.
  let reaplicado: unknown = null;
  if (acao !== "sessoes") {
    const r = await sb.rpc("chatpro_reaplicar_tudo");
    if (r.error) return json(500, { ok: false, erro: "falha ao reaplicar: " + r.error.message });
    reaplicado = r.data;
  }

  // O ChatPro nem sempre avisa a finalização pelo webhook: confere na API o
  // estado real das sessões que o CRM ainda tem como abertas.
  // 1) Lista as sessões finalizadas desde a mais antiga aberta no CRM (100 por página).
  // 2) As que continuarem abertas no CRM são conferidas uma a uma, devagar
  //    (a API limita as chamadas por minuto); o que sobrar fica para a próxima rodada.
  const inicio = Date.now(), LIMITE_MS = corpo?.rapido ? 25_000 : 110_000;
  const registrar = async (sessao: any) => {
    const { error } = await sb.rpc("chatpro_registrar_sessao", { p_payload: { event: "sync.api", new: sessao }, p_recebido: new Date().toISOString() });
    return !error;
  };
  let amostraFalha: unknown = undefined;
  const { data: maisAntiga } = await sb.from("chatpro_sessoes").select("aberta_em,ultima_atualizacao").eq("aberta", true)
    .order("aberta_em", { ascending: true, nullsFirst: false }).limit(1);
  const desde = (maisAntiga?.[0] as any)?.aberta_em || (maisAntiga?.[0] as any)?.ultima_atualizacao;
  let listadas = 0, paginas = 0;
  if (desde) {
    for (let offset = 0; Date.now() - inicio < LIMITE_MS / 2 && paginas < 40; offset += 100) {
      const r = await chamar(token, "/sessions/list", { instanceId: instancia, open: false, start: new Date(desde).toISOString(), end: new Date().toISOString(), limit: 100, offset });
      paginas++;
      if (!r.ok) { amostraFalha ??= { etapa: "lista", status: r.status, resposta: typeof r.dados === "string" ? r.dados.slice(0, 120) : Object.keys(r.dados ?? {}) }; break; }
      const itens = lista(r.dados).filter((x: any) => x && typeof x.id === "string");
      for (const sessao of itens) if (await registrar(sessao)) listadas++;
      if (itens.length < 100) break;
      await espera(400);
    }
  }

  const { data: abertas } = await sb.from("chatpro_sessoes").select("id").eq("aberta", true)
    .order("ultima_atualizacao", { ascending: true, nullsFirst: true }).limit(Number(corpo?.limite) || 600);
  const ids: string[] = (abertas ?? []).map((x: any) => x.id as string);
  let conferidas = 0, finalizadas = 0, falhas = 0;
  for (const id of ids) {
    if (Date.now() - inicio > LIMITE_MS) break;
    try {
      const r = await chamar(token, "/sessions/getSessionById", { instanceId: instancia, sessionId: id });
      const sessao = objeto(r.dados);
      if (!r.ok || !sessao || sessao.id !== id) {
        falhas++;
        amostraFalha ??= { etapa: "sessao", status: r.status, resposta: typeof r.dados === "string" ? r.dados.slice(0, 120) : Object.keys(r.dados ?? {}) };
        if (r.status === 429) break;
        continue;
      }
      conferidas++;
      if (sessao.open === false) finalizadas++;
      if (!(await registrar(sessao))) falhas++;
    } catch { falhas++; }
    await espera(350);
  }
  return json(200, {
    ok: true, instancia,
    usuarios: linhasU.length, motivos: linhasM.length,
    reaplicado,
    sessoes: { listadas_finalizadas: listadas, paginas, em_aberto_no_crm: ids.length, conferidas, finalizadas_no_chatpro: finalizadas, falhas, restantes: Math.max(0, ids.length - conferidas - falhas), amostra_falha: amostraFalha },
  });
});
