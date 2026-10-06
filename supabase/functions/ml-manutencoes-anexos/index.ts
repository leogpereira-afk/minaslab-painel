// Anexos das manutenções (nota fiscal, orçamento): PDF e imagens no bucket privado ml-arquivos, pasta manutencoes/.
// O registro da manutenção guarda a lista de anexos; esta função só envia, abre (URL assinada de 5 min) e remove arquivos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const URL = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(URL, Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUCKET = "ml-arquivos";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const LIMITE_BYTES = 8 * 1024 * 1024;
const PASTA = /^[A-Za-z0-9_-]{6,80}$/;
const CAMINHO = /^manutencoes\/[A-Za-z0-9_-]{6,80}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/;

// Tipo pelo CONTEÚDO (não pelo nome nem pelo mime informado): só PDF e imagens.
function tipoReal(b: Uint8Array): { ext: string; mime: string } | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { ext: "pdf", mime: "application/pdf" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: "webp", mime: "image/webp" };
  return null;
}
const nomeSeguro = (v: unknown) => String(v ?? "anexo").replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 120) || "anexo";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ erro: "Use POST." }, 405);
  try {
    const auth = req.headers.get("authorization") || "";
    if (!/^Bearer .+/.test(auth)) return out({ erro: "Entre no sistema.", semSessao: true }, 401);
    // A porta canônica (ml-sync) confere assinatura, validade, sistema e conta ativa.
    const sessao = await fetch(`${URL}/functions/v1/ml-sync`, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify({ action: "rev" }) });
    if (!sessao.ok) return out({ erro: "Sessão inválida ou indisponível.", semSessao: sessao.status === 401 }, sessao.status === 401 ? 401 : 503);
    let p: any;
    try { p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return out({ erro: "Sessão inválida.", semSessao: true }, 401); }
    if (p.sis !== "minaslab" || !p.sub || !Number.isFinite(p.exp) || p.exp <= Date.now() / 1000) return out({ erro: "Sessão inválida.", semSessao: true }, 401);
    if (p.papel !== "direcao") {
      // Mesma regra de edição de Manutenções: equipe sem matriz edita como antes; com matriz, só se a página foi liberada.
      if (p.papel !== "equipe") return out({ erro: "Sem permissão.", semPermissao: true }, 403);
      const { data: conta, error } = await sb.from("ml_contas").select("ativo,paginas_consulta").eq("usuario", p.sub).maybeSingle();
      if (error || !conta || conta.ativo !== true) return out({ erro: "Não foi possível confirmar sua permissão.", semPermissao: true }, 403);
      const paginas: string[] = Array.isArray(conta.paginas_consulta) ? conta.paginas_consulta : [];
      if (paginas.includes("__matriz_v1") && !paginas.includes("manutencoes")) return out({ erro: "Manutenções não liberadas para sua conta.", semPermissao: true }, 403);
    }
    const b = await req.json();
    const action = String(b.action || "");

    if (action === "enviar") {
      if (!PASTA.test(String(b.pasta || ""))) return out({ erro: "Pasta inválida." }, 400);
      if (typeof b.base64 !== "string" || !b.base64) return out({ erro: "Arquivo não informado." }, 400);
      if (b.base64.length > Math.ceil((LIMITE_BYTES * 4) / 3) + 8) return out({ erro: "Arquivo acima de 8 MB." }, 413);
      let bytes: Uint8Array;
      try { bytes = Uint8Array.from(atob(b.base64), (c) => c.charCodeAt(0)); } catch { return out({ erro: "Arquivo inválido." }, 400); }
      if (bytes.length > LIMITE_BYTES) return out({ erro: "Arquivo acima de 8 MB." }, 413);
      const tipo = tipoReal(bytes);
      if (!tipo) return out({ erro: "Envie um PDF ou uma imagem (JPG, PNG ou WebP)." }, 400);
      const path = `manutencoes/${b.pasta}/${crypto.randomUUID()}.${tipo.ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: tipo.mime, upsert: false });
      if (error) throw error;
      return out({ ok: true, anexo: { path, nome: nomeSeguro(b.nome), mime: tipo.mime, tamanho: bytes.length, em: new Date().toISOString(), por: String(p.sub) } });
    }

    if (action === "url" || action === "remover") {
      const path = String(b.path || "");
      if (!CAMINHO.test(path)) return out({ erro: "Anexo inválido." }, 400);
      if (action === "url") {
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 300);
        if (error || !data?.signedUrl) return out({ erro: "Não foi possível abrir o anexo." }, 404);
        return out({ ok: true, url: data.signedUrl });
      }
      const { error } = await sb.storage.from(BUCKET).remove([path]);
      if (error) throw error;
      return out({ ok: true });
    }
    return out({ erro: "Operação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return out({ erro: e instanceof Error ? e.message : "Falha ao processar o anexo." }, 500);
  }
});
