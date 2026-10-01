// Lista eventos da agenda Google configurada (GOOGLE_CALENDAR_ID) para o painel de Coletas.
// Entrada (POST JSON, opcional): { time_min?: ISO, time_max?: ISO }
// Saída: { events: [{ id, summary, description, location, start, end, status, htmlLink, updated }] }
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') ?? '';
const CALENDAR_ID = Deno.env.get('GOOGLE_CALENDAR_ID') ?? '';
const DEFAULT_LOOKBACK_DAYS = 90;
const MAX_PAGES = 4;

const ALLOWED_ORIGINS = new Set([
  'https://leogpereira-afk.github.io',
  'http://localhost:5173',
]);

function corsFor(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://leogpereira-afk.github.io',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function isoOrNull(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function accessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.access_token) throw new Error('google_token_refresh_failed');
  return json.access_token as string;
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY || !CLIENT_ID || !CLIENT_SECRET || !CALENDAR_ID) {
    return reply({ error: 'config_incomplete' }, 500);
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return reply({ error: 'unauthorized' }, 401);
  const { data: allowed, error: permError } = await authClient.rpc('has_permission', { p_permission: 'crm.read' });
  if (permError || allowed !== true) return reply({ error: 'forbidden' }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corpo opcional */ }
  const timeMax = isoOrNull(body.time_max);
  const timeMin = isoOrNull(body.time_min) ?? new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 86_400_000).toISOString();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: integration } = await admin
    .from('google_calendar_integrations')
    .select('refresh_token')
    .eq('provider', 'google')
    .eq('calendar_id', CALENDAR_ID)
    .maybeSingle();
  if (!integration?.refresh_token) return reply({ error: 'google_calendar_not_connected', events: [] }, 409);

  let token: string;
  try { token = await accessToken(integration.refresh_token); }
  catch { return reply({ error: 'google_auth_refresh_failed', events: [] }, 502); }

  const events: unknown[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      timeMin,
    });
    if (timeMax) params.set('timeMax', timeMax);
    if (pageToken) params.set('pageToken', pageToken);
    let response: Response;
    try {
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
      );
    } catch {
      return reply({ error: 'google_calendar_unavailable', events }, 502);
    }
    const json = await response.json().catch(() => null);
    if (!response.ok || !json) return reply({ error: 'google_calendar_read_failed', google_status: response.status, events }, 502);
    for (const item of json.items ?? []) {
      events.push({
        id: item.id,
        summary: item.summary ?? null,
        description: item.description ?? null,
        location: item.location ?? null,
        start: item.start?.dateTime ?? item.start?.date ?? null,
        end: item.end?.dateTime ?? item.end?.date ?? null,
        status: item.status ?? null,
        htmlLink: item.htmlLink ?? null,
        updated: item.updated ?? null,
      });
    }
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  return reply({ events });
});
