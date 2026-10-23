// crm-sso — entrada única: quem está logado no painel abre o CRM sem digitar senha de novo.
//
// O painel usa um crachá próprio (JWT assinado com ML_JWT_SECRET); o CRM usa o Supabase Auth.
// Esta função confere o crachá do painel e, se o usuário tem conta vinculada no CRM
// (tabela crm_sso_vinculos; criada sozinha na primeira entrada), devolve um token de uso único que o CRM troca por sessão
// (supabase.auth.verifyOtp). Nenhuma senha passa por aqui e nenhuma chave de serviço sai daqui.
//
// Ações:
//   quem   → { crmUserId }            só diz quem é a conta do CRM deste usuário
//   entrar → { tokenHash, crmUserId } token de uso único para abrir a sessão do CRM
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

// Nome sem acento/caixa/espaços extras, para achar a conta antiga do CRM da mesma pessoa.
const normal = (v: unknown) => txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
const primeiroUltimo = (v: unknown) => { const p = normal(v).split(" ").filter(Boolean); return p.length ? `${p[0]} ${p[p.length - 1]}` : ""; };

async function vinculoDoUsuario(usuario: string) {
  const { data, error } = await sb.from("crm_sso_vinculos").select("crm_user_id").eq("usuario_painel", usuario).maybeSingle();
  if (error) throw error;
  return data;
}

async function criarVinculo(usuario: string, nome: string) {
  // 1) A pessoa já tem conta no CRM ainda sem dono (criada antes da entrada única)? Usa essa, para não perder o histórico.
  //    Só liga se o primeiro e último nome baterem com exatamente uma conta livre.
  const [{ data: perfis, error: eP }, { data: ligados, error: eL }] = await Promise.all([
    sb.from("profiles").select("id,nome"),
    sb.from("crm_sso_vinculos").select("crm_user_id"),
  ]);
  if (eP) throw eP;
  if (eL) throw eL;
  const usados = new Set((ligados ?? []).map((x: any) => x.crm_user_id));
  const chave = primeiroUltimo(nome);
  const iguais = chave ? (perfis ?? []).filter((p: any) => !usados.has(p.id) && primeiroUltimo(p.nome) === chave) : [];
  let crmUserId: string | null = iguais.length === 1 ? iguais[0].id : null;

  // 2) Senão, cria a conta do CRM. O e-mail é só identificador interno: ninguém entra por ele, só pelo painel.
  if (!crmUserId) {
    const email = `${usuario.toLowerCase().replace(/[^a-z0-9._-]/g, "-")}@painel.minaslab.online`;
    const { data: criado, error: eC } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: nome, usuario_painel: usuario, origem: "painel" } });
    if (eC) {
      // Já existia (tentativa anterior interrompida): reaproveita.
      for (let page = 1; page <= 20 && !crmUserId; page++) {
        const { data: lista, error: eList } = await sb.auth.admin.listUsers({ page, perPage: 200 });
        if (eList) throw eList;
        crmUserId = lista.users.find((u) => txt(u.email).toLowerCase() === email)?.id ?? null;
        if (lista.users.length < 200) break;
      }
      if (!crmUserId) throw eC;
    } else crmUserId = criado.user.id;

    const { error: ePerfil } = await sb.from("profiles").upsert({ id: crmUserId, nome, ativo: true }, { onConflict: "id", ignoreDuplicates: true });
    if (ePerfil) throw ePerfil;
    const { data: papel, error: ePapel } = await sb.from("roles").select("id").eq("codigo", "equipe").eq("ativo", true).maybeSingle();
    if (ePapel) throw ePapel;
    if (papel) {
      const { error: eRole } = await sb.from("profile_roles").upsert({ profile_id: crmUserId, role_id: papel.id }, { onConflict: "profile_id,role_id", ignoreDuplicates: true });
      if (eRole) throw eRole;
    }
  }

  const { error: eVinc } = await sb.from("crm_sso_vinculos").upsert({ usuario_painel: usuario, crm_user_id: crmUserId }, { onConflict: "usuario_painel", ignoreDuplicates: true });
  if (eVinc) throw eVinc;
  // Lê de novo: se duas abas entraram juntas, vale o vínculo que gravou primeiro.
  const final = await vinculoDoUsuario(usuario);
  if (!final) throw new Error("Não foi possível ligar sua conta do CRM.");
  return final;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const cracha = await crachaDoPainel(req);
  if (!cracha) return json({ erro: "Sessão do painel inválida ou vencida. Entre no painel de novo.", semSessao: true }, 401);

  try {
    const b = await req.json().catch(() => ({}));
    const acao = txt(b.action);
    if (!["quem", "entrar"].includes(acao)) return json({ erro: "Ação inválida." }, 400);
    const usuario = txt(cracha.sub);

    // A conta precisa continuar ativa AGORA (o crachá vale 12h) e ter acesso ao CRM.
    const { data: conta, error: eConta } = await sb.from("ml_contas").select("ativo,papel,paginas_consulta,nome").eq("usuario", usuario).maybeSingle();
    if (eConta) throw eConta;
    if (!conta?.ativo) return json({ erro: "Esta conta do painel está inativa.", semSessao: true }, 401);
    const paginas = Array.isArray(conta.paginas_consulta) ? conta.paginas_consulta : [];
    if (conta.papel !== "direcao" && !paginas.includes("crm")) return json({ erro: "Seu usuário não tem acesso ao CRM.", semAcesso: true }, 403);

    // Login unificado: quem tem acesso ao CRM no painel ganha a conta do CRM na primeira entrada.
    // As permissões continuam sendo do CRM (papel inicial "Equipe", ajustável lá dentro).
    const vinculo = await vinculoDoUsuario(usuario) ?? await criarVinculo(usuario, txt(conta.nome) || usuario);

    if (acao === "quem") return json({ ok: true, crmUserId: vinculo.crm_user_id });

    const { data: ud, error: eUser } = await sb.auth.admin.getUserById(vinculo.crm_user_id);
    if (eUser || !ud?.user?.email) return json({ erro: "A conta do CRM ligada a este usuário não foi encontrada.", semVinculo: true }, 403);
    const { data: link, error: eLink } = await sb.auth.admin.generateLink({ type: "magiclink", email: ud.user.email });
    if (eLink) throw eLink;
    const tokenHash = link?.properties?.hashed_token;
    if (!tokenHash) return json({ erro: "Não foi possível abrir a sessão do CRM agora. Tente de novo." }, 500);
    return json({ ok: true, tokenHash, crmUserId: vinculo.crm_user_id });
  } catch (e) {
    console.error("crm-sso", e);
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
