// Inicia a conexão OAuth com o Google Calendar (somente admin.manage).
// Retorna { url } para o navegador; o Google devolve em google-calendar-auth-callback.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') ?? '';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const STATE_TTL_MS = 10 * 60_000;

// Para onde voltar depois do Google, conforme a origem de quem clicou.
const RETURN_BY_ORIGIN: Record<string, string> = {
  'https://leogpereira-afk.github.io': 'https://leogpereira-afk.github.io/minaslab-painel/crm',
  'https://crm-minaslab-2.vercel.app': 'https://crm-minaslab-2.vercel.app',
  'http://localhost:5173': 'http://localhost:5173',
};
const DEFAULT_ORIGIN = 'https://leogpereira-afk.github.io';

function corsFor(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': origin in RETURN_BY_ORIGIN ? origin : DEFAULT_ORIGIN,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SERVICE_ROLE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(signature));
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY || !CLIENT_ID) return reply({ error: 'config_incomplete' }, 500);

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return reply({ error: 'unauthorized' }, 401);
  const { data: allowed, error: permError } = await authClient.rpc('has_permission', { p_permission: 'admin.manage' });
  if (permError || allowed !== true) return reply({ error: 'forbidden' }, 403);

  const origin = req.headers.get('Origin') ?? '';
  const returnTo = RETURN_BY_ORIGIN[origin] ?? RETURN_BY_ORIGIN[DEFAULT_ORIGIN];
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    uid: userData.user.id,
    ret: returnTo,
    exp: Date.now() + STATE_TTL_MS,
    n: crypto.randomUUID(),
  })));
  const state = `${payload}.${await sign(payload)}`;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${SUPABASE_URL}/functions/v1/google-calendar-auth-callback`,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return reply({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});
