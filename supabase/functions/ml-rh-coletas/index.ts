// ml-rh-coletas — as coletas do CRM que geram comissão ao coletor, para a
// Publicada automaticamente pelo GitHub (workflow "Publicar funções (Supabase)").
// Folha de Pagamento do painel (aba RH: a direção ou quem tem a Folha liberada).
//
// Regra (Ana, 05/11/2026): na coleta do CRM marca-se o tipo — COMPOSTA ou VIAGEM
// (com os km de ida e volta). Entra na folha só a coleta COLETADA no mês, feita
// por um coletor da MinasLab (não pelo cliente). O VALOR é calculado no painel
// (src/lib/rh/coletasComissao.js, com teste); aqui só se entrega a lista.
//
// Crachá: o mesmo do ml-sync (JWT HS256 com ML_JWT_SECRET, sis "minaslab").
// verify_jwt = false de propósito: o preflight CORS chega sem token e o crachá
// é conferido aqui dentro.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("ML_JWT_SECRET") ?? "";
const SIS = "minaslab";
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const dec = new TextDecoder();
function bytesFromB64url(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function verificarJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const partes = String(token || "").split(".");
  if (partes.length !== 3) return null;
  try {
    const chave = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", chave, bytesFromB64url(partes[2]), enc.encode(`${partes[0]}.${partes[1]}`));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(bytesFromB64url(partes[1])));
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Início e fim do mês em São Paulo (UTC−3, sem horário de verão desde 2019), em ISO UTC. */
function janelaDoMes(competencia: string) {
  const [a, m] = competencia.split("-").map(Number);
  const de = new Date(Date.UTC(a, m - 1, 1, 3, 0, 0));
  const ate = new Date(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 1, 3, 0, 0));
  return { de: de.toISOString(), ate: ate.toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const m = String(req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
    const cracha = m && JWT_SECRET ? await verificarJwt(m[1], JWT_SECRET) : null;
    if (!cracha || cracha.sis !== SIS) return resp({ erro: "Entre no sistema.", semSessao: true }, 401);
    const { data: conta } = await sb.from("ml_contas").select("ativo,paginas_consulta").eq("usuario", String(cracha.sub ?? "")).maybeSingle();
    if (conta && conta.ativo !== true) return resp({ erro: "Esta conta foi desativada.", semSessao: true }, 401);
    // A direção, ou quem tem a Folha de Pagamento (com o RH) liberada pela matriz em Acessos — lido ao vivo.
    const pags: string[] = Array.isArray(conta?.paginas_consulta) ? conta.paginas_consulta : [];
    const liberado = !!conta && pags.includes("__matriz_v1") && pags.includes("folha-pagamento") && pags.includes("rh");
    if (cracha.papel !== "direcao" && !liberado) return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);

    const body = await req.json().catch(() => ({}));
    if (body.action !== "comissaoColetas") return resp({ erro: "Ação desconhecida." }, 400);
    const competencia = String(body.competencia ?? "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return resp({ erro: "Competência inválida (AAAA-MM)." }, 400);
    const { de, ate } = janelaDoMes(competencia);

    const { data: coletas, error } = await sb.from("coletas")
      .select("id,ocorrida_em,status,tipo_pagamento,km_viagem,coletor_id,ordem_servico_id,numero_os_referencia,cliente_id,endereco_evento")
      .is("deleted_at", null).eq("status", "COLETADA").eq("realizada_pelo_cliente", false)
      .in("tipo_pagamento", ["COMPOSTA", "VIAGEM"])
      .gte("ocorrida_em", de).lt("ocorrida_em", ate)
      .order("ocorrida_em", { ascending: true });
    if (error) throw error;
    const lista = coletas ?? [];
    const ids = (k: string) => [...new Set(lista.map((c: Record<string, unknown>) => c[k]).filter(Boolean))] as string[];
    const [perfis, ordens] = await Promise.all([
      ids("coletor_id").length ? sb.from("profiles").select("id,nome").in("id", ids("coletor_id")) : { data: [] },
      ids("ordem_servico_id").length ? sb.from("ordens_servico").select("id,numero_os,cliente_id").in("id", ids("ordem_servico_id")) : { data: [] },
    ]);
    // O cliente vem da coleta ou, se ela não tiver, da OS.
    const idsCliente = [...new Set([...ids("cliente_id"), ...((ordens.data ?? []) as Record<string, unknown>[]).map((o) => o.cliente_id).filter(Boolean)])] as string[];
    const clientes = idsCliente.length ? await sb.from("clientes").select("id,nome_fantasia,razao_social").in("id", idsCliente) : { data: [] };
    const mapa = (r: { data: unknown }) => new Map(((r.data ?? []) as Record<string, unknown>[]).map((x) => [x.id, x]));
    const pPerfil = mapa(perfis), pOs = mapa(ordens), pCli = mapa(clientes);
    return resp({
      competencia,
      coletas: lista.map((c: Record<string, unknown>) => {
        const os = pOs.get(c.ordem_servico_id) as Record<string, unknown> | undefined;
        const cli = pCli.get(c.cliente_id ?? os?.cliente_id) as Record<string, unknown> | undefined;
        return {
          id: c.id, data: c.ocorrida_em, tipo: c.tipo_pagamento, km: c.km_viagem === null ? null : Number(c.km_viagem),
          coletorId: c.coletor_id, coletorNome: (pPerfil.get(c.coletor_id) as Record<string, unknown> | undefined)?.nome ?? "",
          os: os?.numero_os ?? c.numero_os_referencia ?? "", cliente: cli?.nome_fantasia || cli?.razao_social || "",
        };
      }),
    });
  } catch (e) {
    return resp({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
