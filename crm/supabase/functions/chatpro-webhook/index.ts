import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const MAX_BODY_BYTES = 20 * 1024;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
function digits(value: unknown): string { return String(value ?? "").replace(/\D/g, ""); }
function phoneCandidate(value: unknown): string {
  const d = digits(value);
  return d.length >= 8 && d.length <= 15 ? d : "";
}
function jidPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  return phoneCandidate(value.includes("@") ? value.split("@")[0] : value);
}
function firstPhone(...values: unknown[]): string {
  for (const value of values) {
    const p = typeof value === "string" && value.includes("@") ? jidPhone(value) : phoneCandidate(value);
    if (p) return p;
  }
  return "";
}
function deepFindPhone(root: unknown): string {
  const preferredKeys = new Set(["number","phone","whatsapp","waid","from","participant","remotejid","senderjid","jid"]);
  const seen = new Set<object>();
  const queue: unknown[] = [root];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current as object)) continue;
    seen.add(current as object);
    if (Array.isArray(current)) { queue.push(...current); continue; }
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      const k = key.toLowerCase().replace(/[_-]/g, "");
      if (preferredKeys.has(k)) {
        const candidate = k.endsWith("jid") || k === "jid" ? jidPhone(value) : firstPhone(value);
        if (candidate) return candidate;
      }
    }
    queue.push(...Object.values(current as Record<string, unknown>));
  }
  return "";
}
function phoneOf(x: any): string {
  return firstPhone(
    x?.new?.number, x?.new?.participant,
    x?.message_data?.number, x?.message_data?.participant,
    x?.Body?.Info?.SenderJid, x?.Body?.Info?.RemoteJid,
    x?.body?.info?.senderJid, x?.body?.info?.remoteJid,
    x?.data?.message_data?.number, x?.data?.number, x?.data?.phone, x?.data?.from, x?.data?.wa_id,
    x?.message?.from, x?.message?.sender?.phone,
    x?.sender?.phone, x?.sender?.number, x?.contact?.phone, x?.contact?.number,
    x?.wa_id, x?.phone, x?.number, x?.from
  ) || deepFindPhone(x);
}
function textOf(x: any): string {
  const candidates = [
    x?.new?.message, x?.new?.alt_message,
    x?.message_data?.message, x?.message_data?.alt_message,
    x?.Body?.Message?.conversation, x?.Body?.Message?.extendedTextMessage?.text,
    x?.body?.message?.conversation, x?.body?.message?.extendedTextMessage?.text,
    x?.text, typeof x?.body === "string" ? x.body : undefined,
    x?.message?.text, x?.message?.body, x?.data?.text, x?.data?.body,
    x?.data?.message?.text, x?.data?.message?.body,
  ];
  return candidates.find((v) => typeof v === "string" && v.trim())?.trim() || "";
}
function mediaOf(x: any) {
  const message = x?.new ?? x?.message_data ?? x?.message ?? x?.data ?? {};
  const url = [message?.url, message?.media_url, message?.file_url].find((v) => typeof v === "string" && v.trim())?.trim() || "";
  const rawType = String(message?.type ?? message?.file_type ?? message?.mime_type ?? "").toLowerCase();
  const mime = String(message?.mime_type ?? message?.file_type ?? "").trim();
  const name = String(message?.title ?? message?.filename ?? message?.file_name ?? "").trim();
  const kind = rawType.includes("audio") ? "AUDIO" : rawType.includes("image") ? "IMAGE" : rawType.includes("video") ? "VIDEO" : url ? "DOCUMENT" : "TEXT";
  return {
    url, mime, name, kind,
    sessionId: String(message?.session_id ?? "").trim(),
    instanceId: String(message?.instance_id ?? "").trim(),
    status: String(message?.status ?? "").trim(),
  };
}
function normalizeEventType(payload: any): string {
  return String(payload?.event ?? payload?.type ?? payload?.event_type ?? payload?.action ?? "CHATPRO").trim().toUpperCase();
}
function isSentEvent(eventType: string, payload: any): boolean {
  const normalized = eventType.replace(/[.\s-]+/g, "_");
  return normalized === "MESSAGE_SENT" || normalized === "SENT_MESSAGE" || payload?.new?.from_me === true || payload?.message_data?.from_me === true || payload?.Body?.Info?.IsFromMe === true || payload?.body?.info?.isFromMe === true;
}
function isMessageEvent(eventType: string, text: string, mediaUrl: string): boolean {
  const normalized = eventType.replace(/[.\s-]+/g, "_");
  return ["MESSAGE_RECEIVED","RECEIVED_MESSAGE","MESSAGE_SENT","SENT_MESSAGE","MESSAGE_UPDATED"].includes(normalized) || Boolean(text) || Boolean(mediaUrl);
}

Deno.serve(async (req: Request) => {
  const configuredSecret = Deno.env.get("CHATPRO_WEBHOOK_SECRET") || "";
  const url = new URL(req.url);
  const suppliedSecret = req.headers.get("x-chatpro-webhook-secret") || url.searchParams.get("key") || "";
  if (!configuredSecret) return json(503, { ok:false, error:"webhook_secret_not_configured" });
  if (suppliedSecret !== configuredSecret) return json(401, { ok:false, error:"unauthorized" });
  if (req.method === "GET" || req.method === "HEAD") {
    return new Response(req.method === "HEAD" ? null : JSON.stringify({ ok:true, service:"chatpro-webhook", version:16 }), { status:200, headers:JSON_HEADERS });
  }
  if (req.method !== "POST") return json(405, { ok:false, error:"method_not_allowed" });
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return json(415, { ok:false, error:"content_type_must_be_json" });
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json(413, { ok:false, error:"payload_too_large" });
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json(413, { ok:false, error:"payload_too_large" });
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return json(400, { ok:false, error:"invalid_json" }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json(400, { ok:false, error:"invalid_payload" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json(503, { ok:false, error:"supabase_environment_missing" });
  const sb = createClient(supabaseUrl, serviceRoleKey);
  const eventType = normalizeEventType(payload);
  const sourceEventKey = String(payload?.new?.id ?? payload?.id ?? payload?.event_id ?? payload?.message_data?.id ?? payload?.message?.id ?? payload?.data?.id ?? payload?.Body?.Info?.Id ?? payload?.Body?.Info?.ID ?? "").trim();
// ChatPro nem sempre envia um ID. O hash do corpo torna reentregas idênticas idempotentes.
  const eventKey = sourceEventKey || `sha256:${await sha256(raw)}`;
  const phone = phoneOf(payload);
  const text = textOf(payload);
  const media = mediaOf(payload);

  const { data:eventRow, error:eventErr } = await sb.from("chatpro_eventos").insert({ event_key:eventKey, event_type:eventType, phone:phone || null, payload }).select("id").single();
  if (eventErr && eventErr.code !== "23505") return json(500, { ok:false, error:"event_store_failed" });
  if (eventErr?.code === "23505") return json(200, { ok:true, duplicate:true });
  if (!phone) return json(200, { ok:true, stored:true, matched:false, phone_found:false });

  const { data:resolutions, error:matchErr } = await sb.rpc("resolve_cliente_by_phone_e164", { p_phone:phone });
  if (matchErr) {
    if (eventRow?.id) await sb.from("chatpro_eventos").update({ processado_em:new Date().toISOString(), erro:"lookup_e164_failed" }).eq("id", eventRow.id);
    return json(500, { ok:false, error:"phone_lookup_failed" });
  }
  const resolution = Array.isArray(resolutions) && resolutions.length ? resolutions[0] : null;
  const resolutionStatus = String(resolution?.status || "NAO_LOCALIZADO");
  const candidateClients = Number(resolution?.candidate_clients || 0);

  if (eventRow?.id) await sb.from("chatpro_eventos").update({ resolution_status:resolutionStatus }).eq("id", eventRow.id);
  if (!isMessageEvent(eventType, text, media.url)) {
    if (eventRow?.id) await sb.from("chatpro_eventos").update({ processado_em:new Date().toISOString(), erro:null }).eq("id", eventRow.id);
    return json(200, { ok:true, stored:true, matched:resolutionStatus === "LOCALIZADO", interaction:false, resolution:resolutionStatus });
  }

  const clientId = resolutionStatus === "LOCALIZADO" ? (resolution?.cliente_id || null) : null;
  const contactId = resolutionStatus === "LOCALIZADO" ? (resolution?.contato_id || null) : null;
  if (resolutionStatus === "LOCALIZADO" && !clientId) {
    if (eventRow?.id) await sb.from("chatpro_eventos").update({ processado_em:new Date().toISOString(), erro:"lookup_e164_inconsistent" }).eq("id", eventRow.id);
    return json(500, { ok:false, error:"phone_lookup_inconsistent" });
  }

  const { data:flows, error:flowErr } = await sb.rpc("chatpro_resolve_or_create_atendimento", {
    p_phone: phone,
    p_cliente_id: clientId,
    p_contato_id: contactId,
    p_resumo: text || null,
  });
  if (flowErr || !Array.isArray(flows) || !flows.length) {
    if (eventRow?.id) await sb.from("chatpro_eventos").update({ processado_em:new Date().toISOString(), erro:"atendimento_resolution_failed" }).eq("id", eventRow.id);
    return json(500, { ok:false, error:"atendimento_resolution_failed" });
  }
  const flow = flows[0];
  const isSent = isSentEvent(eventType, payload);
  const direction = isSent ? "Enviada" : "Recebida";
  const mediaLabel = media.kind === "AUDIO" ? "Áudio" : media.kind === "IMAGE" ? "Imagem" : media.kind === "VIDEO" ? "Vídeo" : media.kind === "DOCUMENT" ? (media.name || "Documento") : "";
  const description = text ? `ChatPro | ${direction}: ${text}` : mediaLabel ? `ChatPro | ${direction}: ${mediaLabel}` : `ChatPro | ${direction}: evento ${eventType}`;
  const { error:interactionErr } = await sb.from("interacoes").insert({
    cliente_id: clientId,
    contato_id: contactId,
    lead_id: flow.lead_id,
    tipo: "WHATSAPP",
    descricao: description,
    source_system: "CHATPRO",
    external_id: eventKey,
    phone_e164: phone ? `+${phone}` : null,
    direction: isSent ? "SENT" : "RECEIVED",
    message_kind: media.kind,
    message_text: text || null,
    media_url: media.url || null,
    media_mime: media.mime || null,
    media_name: media.name || null,
    chat_session_id: media.sessionId || null,
    chat_instance_id: media.instanceId || null,
    delivery_status: media.status || null,
  });

  if (eventRow?.id) await sb.from("chatpro_eventos").update({ processado_em:new Date().toISOString(), erro:interactionErr?.message || null, resolution_status:resolutionStatus }).eq("id", eventRow.id);
  return json(interactionErr ? 500 : 200, {
    ok: !interactionErr,
    stored: true,
    matched: Boolean(clientId),
    phone_found: true,
    resolution: resolutionStatus,
    lead_created: Boolean(flow.lead_created),
    atendimento_created: Boolean(flow.atendimento_created),
    interaction: !interactionErr,
  });
});
