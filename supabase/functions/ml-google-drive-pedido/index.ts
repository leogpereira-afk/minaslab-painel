// ml-google-drive-pedido — pasta do Pedido de Compra no Google Drive (igual ao legado:
// salvarOuAtualizarPedidoCompra cria a pasta "PC-XX" dentro da pasta-mãe e guarda o link
// em todos os itens do PC). Só a ml-sync chama (x-token); a permissão é conferida lá.
// Nada aqui apaga, move ou renomeia arquivo no Drive.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const CID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") || "", CSEC = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") || "";
const TOKEN = Deno.env.get("ML_TOKEN") || "";
// Mesma pasta-mãe do sistema antigo (PASTA_DRIVE_ID no Apps Script).
const PASTA_MAE = "13U3VF_8DekFayNg3p0dtyx_e7Gd94NIj";
const EXT_OK = ["pdf", "jpg", "jpeg", "png", "xls", "xlsx"];
const TETO = 25 * 1024 * 1024;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type,x-token", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const out = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { ...cors, "content-type": "application/json" } });
class Recusa extends Error { constructor(m: string, public status = 400) { super(m); } }

async function tokenGoogle(): Promise<string> {
  const { data, error } = await sb.rpc("ml_google_drive_obter_refresh_token");
  if (error || !data) throw new Recusa("Google Drive não autorizado.", 409);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: CID, client_secret: CSEC, refresh_token: String(data), grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Recusa("Falha ao renovar autorização do Google Drive.", 502);
  return String(j.access_token);
}
async function pastaMeta(id: string, t: string) {
  const r = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?fields=id,name,mimeType,trashed,webViewLink,capabilities/canAddChildren&supportsAllDrives=true", { headers: { authorization: "Bearer " + t } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.trashed || j.mimeType !== "application/vnd.google-apps.folder") throw new Recusa("A conta Google conectada não enxerga a pasta dos pedidos. Compartilhe a pasta com ela.", 404);
  return j;
}
const b64 = (s: string) => { const limpo = s.includes(",") ? s.split(",")[1] : s; const bin = atob(limpo); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

async function enviar(t: string, pasta: string, nome: string, tipo: string, bytes: Uint8Array): Promise<{ id: string; url: string }> {
  const bd = "ml_" + crypto.randomUUID(), enc = new TextEncoder();
  const cab = enc.encode(`--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [pasta] })}\r\n--${bd}\r\nContent-Type: ${tipo}\r\n\r\n`), fim = enc.encode(`\r\n--${bd}--`);
  const corpo = new Uint8Array(cab.length + bytes.length + fim.length); corpo.set(cab); corpo.set(bytes, cab.length); corpo.set(fim, cab.length + bytes.length);
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink", { method: "POST", headers: { authorization: "Bearer " + t, "content-type": `multipart/related; boundary=${bd}` }, body: corpo });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error("O Drive não aceitou o arquivo (" + r.status + ").");
  return { id: String(j.id), url: String(j.webViewLink || "https://drive.google.com/file/d/" + j.id + "/view") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ erro: "Use POST." }, 405);
  try {
    if (!TOKEN || req.headers.get("x-token") !== TOKEN) return out({ erro: "Não autorizado." }, 401);
    const b = await req.json(), codigo = String(b.pedidoCodigo || "").trim(), usuario = String(b.usuario || "").trim();
    // Anexo da ENTRADA de lote (legado: arquivo na pasta-mãe, link na linha do lote).
    if (String(b.action || "") === "lote") {
      const loteId = String(b.loteId || "").trim(), nome = String(b.nomeOriginal || "").trim().replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 200), ext = (nome.split(".").pop() || "").toLowerCase();
      if (!loteId || !nome || !b.arquivoBase64) throw new Recusa("Lote e arquivo são obrigatórios.");
      if (!EXT_OK.includes(ext)) throw new Recusa("Formato não permitido. Envie PDF, Excel ou imagem.", 415);
      const bytes = b64(String(b.arquivoBase64)); if (bytes.length > TETO) throw new Recusa("O anexo excede o limite de 25 MB.", 413);
      const t = await tokenGoogle(); await pastaMeta(PASTA_MAE, t);
      const f = await enviar(t, PASTA_MAE, loteId + "_" + nome, String(b.mimeType || "application/octet-stream").slice(0, 150), bytes);
      return out({ ok: true, arquivoId: f.id, arquivoUrl: f.url, nomeArquivo: nome });
    }
    if (!codigo) throw new Recusa("Pedido obrigatório.");
    const { data: linhas, error } = await sb.from("ml_registros").select("id,registro").eq("colecao", "estoque_pedidos").eq("apagado", false);
    if (error) throw error;
    const itens = (linhas ?? []).filter((x: any) => String(x.registro?.pedidoCodigo ?? x.registro?.idPedido ?? x.registro?.codigoPedido ?? "") === codigo);
    if (!itens.length) throw new Recusa("Pedido não localizado.", 404);

    let arquivo: { nome: string; tipo: string; bytes: Uint8Array } | null = null;
    if (b.arquivoBase64) {
      const nome = String(b.nomeOriginal || "").trim().replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 200), ext = (nome.split(".").pop() || "").toLowerCase();
      if (!nome || !EXT_OK.includes(ext)) throw new Recusa("Formato não permitido. Envie PDF, Excel ou imagem.", 415);
      const bytes = b64(String(b.arquivoBase64)); if (bytes.length > TETO) throw new Recusa("O anexo excede o limite de 25 MB.", 413);
      arquivo = { nome, tipo: String(b.mimeType || "application/octet-stream").slice(0, 150), bytes };
    }

    const t = await tokenGoogle();
    const existente = itens.map((x: any) => String(x.registro?.anexo ?? "")).find((a: string) => /^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+/.test(a));
    let pastaId = "", pastaUrl = "", criada = false;
    if (existente) {
      pastaUrl = existente; pastaId = (existente.match(/folders\/([A-Za-z0-9_-]+)/) || [])[1] || "";
    } else {
      await pastaMeta(PASTA_MAE, t);
      const r = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,webViewLink", { method: "POST", headers: { authorization: "Bearer " + t, "content-type": "application/json" }, body: JSON.stringify({ name: codigo, mimeType: "application/vnd.google-apps.folder", parents: [PASTA_MAE] }) });
      const p = await r.json().catch(() => ({}));
      if (!r.ok || !p.id) throw new Recusa("Não foi possível criar a pasta no Google Drive (" + r.status + ").", 502);
      pastaId = String(p.id); pastaUrl = String(p.webViewLink || "https://drive.google.com/drive/folders/" + p.id); criada = true;
    }
    // Grava o link nos itens que ainda não têm pasta (também conserta um PC que ficou pela metade).
    const agora = new Date().toISOString();
    for (const x of itens) {
      if (/^https:\/\/drive\.google\.com\//.test(String(x.registro?.anexo ?? ""))) continue;
      const registro = { ...(x.registro as Record<string, unknown>), anexo: pastaUrl, pastaDriveId: pastaId, pastaDriveUrl: pastaUrl, atualizadoPor: usuario || "maquina", atualizadoEm: agora };
      const { error: e } = await sb.from("ml_registros").update({ registro, atualizado_em: agora }).eq("colecao", "estoque_pedidos").eq("id", x.id).eq("apagado", false);
      if (e) throw e;
    }
    let erroArquivo = "", arquivoUrl = "";
    if (arquivo && pastaId) { try { arquivoUrl = (await enviar(t, pastaId, arquivo.nome, arquivo.tipo, arquivo.bytes)).url; } catch (e) { erroArquivo = e instanceof Error ? e.message : "Falha ao enviar o arquivo."; } }
    return out({ ok: true, pastaId, pastaUrl, criada, arquivoEnviado: !!arquivo && !erroArquivo, arquivoUrl, erroArquivo });
  } catch (e) {
    if (e instanceof Recusa) return out({ erro: e.message }, e.status);
    console.error("[drive-pedido]", e);
    return out({ erro: "Erro inesperado ao falar com o Google Drive." }, 500);
  }
});
