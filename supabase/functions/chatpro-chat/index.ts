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
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

async function chamar(token: string, caminho: string, corpo: Record<string, unknown>) {
  const r = await fetch(BASE + caminho, { method: "POST", headers: { "content-type": "application/json", "instance-token": token }, body: JSON.stringify(corpo) });
  const t = await r.text();
  let dados: unknown = null;
  try { dados = JSON.parse(t); } catch { dados = t.slice(0, 300); }
  return { status: r.status, ok: r.ok, dados };
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

  // Liga usuários do ChatPro aos do CRM (e-mail/nome) e reaplica as sessões.
  const { data: reaplicado, error: errR } = await sb.rpc("chatpro_reaplicar_tudo");
  return json(200, {
    ok: !errR, instancia,
    usuarios: linhasU.length, motivos: linhasM.length, status_motivos: motivos.status,
    reaplicado: reaplicado ?? null, erro: errR?.message,
  });
});
