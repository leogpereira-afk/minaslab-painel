// ml-notificacoes — o sino do painel: contar, listar e marcar como lida.
// Cada pessoa só enxerga as próprias notificações (usuário vem do crachá conferido aqui).
// Quem cria as notificações são as outras funções (tarefas e, adiante, calendário e messenger).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const cracha = await crachaDoPainel(req);
  if (!cracha) return json({ erro: "Sua sessão expirou. Entre de novo.", semSessao: true }, 401);
  try {
    const b = await req.json().catch(() => ({}));
    const acao = txt(b.action);
    const eu = txt(cracha.sub);
    const { data: conta, error: eConta } = await sb.from("ml_contas").select("ativo").eq("usuario", eu).maybeSingle();
    if (eConta) throw eConta;
    if (!conta?.ativo) return json({ erro: "Sua conta do painel está inativa.", semSessao: true }, 401);

    if (acao === "contar") {
      const { count, error } = await sb.from("ml_notificacoes").select("id", { count: "exact", head: true }).eq("usuario", eu).eq("lida", false);
      if (error) throw error;
      return json({ naoLidas: count ?? 0 });
    }
    if (acao === "listar") {
      const limite = Math.min(100, Math.max(1, Number(b.limite) || 30));
      const { data, error } = await sb.from("ml_notificacoes").select("*").eq("usuario", eu).order("criado_em", { ascending: false }).limit(limite);
      if (error) throw error;
      const { count, error: e2 } = await sb.from("ml_notificacoes").select("id", { count: "exact", head: true }).eq("usuario", eu).eq("lida", false);
      if (e2) throw e2;
      return json({ itens: data ?? [], naoLidas: count ?? 0 });
    }
    if (acao === "lida") {
      const id = txt(b.id);
      if (!UUID.test(id)) return json({ erro: "Notificação inválida." }, 400);
      const { error } = await sb.from("ml_notificacoes").update({ lida: true }).eq("id", id).eq("usuario", eu);
      if (error) throw error;
      return json({ ok: true });
    }
    if (acao === "todas") {
      const { error } = await sb.from("ml_notificacoes").update({ lida: true }).eq("usuario", eu).eq("lida", false);
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ erro: "Ação inválida." }, 400);
  } catch (e) {
    console.error("ml-notificacoes", e);
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
