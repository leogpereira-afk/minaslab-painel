// Retorno do OAuth do Google Calendar (chamado pelo navegador, sem JWT).
// Valida o state assinado em google-calendar-auth-start, troca o code pelo refresh token
// e grava em google_calendar_integrations. Depois volta para a Agenda do CRM.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') ?? '';
const CALENDAR_ID = Deno.env.get('GOOGLE_CALENDAR_ID') ?? '';
const ALLOWED_RETURNS = new Set([
  'https://leogpereira-afk.github.io/minaslab-painel/crm',
  'https://crm-minaslab-2.vercel.app',
  'http://localhost:5173',
]);
const DEFAULT_RETURN = 'https://leogpereira-afk.github.io/minaslab-painel/crm';

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SERVICE_ROLE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(signature));
}

function redirect(returnTo: string, status: string) {
  return new Response(null, { status: 302, headers: { Location: `${returnTo}/agenda/lista?google=${encodeURIComponent(status)}` } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');

  // Valida o state antes de qualquer coisa; sem state válido não há para onde voltar com segurança.
  const [payload, signature] = state.split('.');
  if (!payload || !signature || signature !== await sign(payload)) {
    return new Response('Link de autorização inválido. Volte ao CRM e tente conectar novamente.', { status: 400 });
  }
  let parsed: { uid?: string; ret?: string; exp?: number };
  try { parsed = JSON.parse(decodeBase64url(payload)); } catch { return new Response('Estado inválido.', { status: 400 }); }
  const returnTo = parsed.ret && ALLOWED_RETURNS.has(parsed.ret) ? parsed.ret : DEFAULT_RETURN;
  if (!parsed.exp || Date.now() > parsed.exp) return redirect(returnTo, 'expirado');
  if (oauthError || !code) return redirect(returnTo, 'cancelado');
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CLIENT_ID || !CLIENT_SECRET || !CALENDAR_ID) return redirect(returnTo, 'config_incompleta');

  let tokens: { refresh_token?: string; scope?: string } | null = null;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: `${SUPABASE_URL}/functions/v1/google-calendar-auth-callback`,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    tokens = response.ok ? await response.json() : null;
  } catch {
    tokens = null;
  }
  if (!tokens?.refresh_token) return redirect(returnTo, 'falha_token');

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await admin.from('google_calendar_integrations').upsert({
    provider: 'google',
    calendar_id: CALENDAR_ID,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope ?? null,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'provider,calendar_id' });
  if (error) return redirect(returnTo, 'falha_gravacao');

  return redirect(returnTo, 'conectado');
});
