// ml-perfis — fotos de perfil de quem usa o painel, para o sistema inteiro mostrar o rosto de cada pessoa.
// Qualquer usuário ATIVO do painel lê (crachá conferido aqui + conta ativa ao vivo). Só devolve usuario → endereço da foto.
// Ação "minhas": devolve as páginas liberadas AGORA para a própria conta (a tela atualiza a sessão sem precisar sair e entrar).
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
    const body = await req.json().catch(() => ({}));
    if (txt(body.acao) === "minhas") {
      const { data: conta, error: e0 } = await sb.from("ml_contas").select("ativo,papel,paginas_consulta").eq("usuario", txt(cracha.sub)).maybeSingle();
      if (e0) throw e0;
      if (!conta?.ativo) return json({ erro: "Sua conta do painel está inativa. Entre de novo.", semSessao: true }, 401);
      return json({ ok: true, papel: conta.papel, paginas_consulta: Array.isArray(conta.paginas_consulta) ? conta.paginas_consulta : [] });
    }
    const { data, error } = await sb.from("ml_contas").select("usuario,ativo,foto");
    if (error) throw error;
    const eu = (data ?? []).find((c: any) => c.usuario === txt(cracha.sub));
    if (!eu?.ativo) return json({ erro: "Sua conta do painel está inativa. Entre de novo.", semSessao: true }, 401);
    const fotos: Record<string, string> = {};
    for (const c of data ?? []) if (c.foto) fotos[c.usuario] = c.foto;
    return json({ ok: true, fotos });
  } catch (e) {
    console.error("ml-perfis", e);
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
