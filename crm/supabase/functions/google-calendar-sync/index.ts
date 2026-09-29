import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') ?? '';
const CALENDAR_ID = Deno.env.get('GOOGLE_CALENDAR_ID') ?? '';
const TZ = 'America/Sao_Paulo';
const EXTERNAL_TIMEOUT_MS = 10_000;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const cors = {
  'Access-Control-Allow-Origin': 'https://crm-minaslab-2.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response: Response | null, attempt: number) {
  const retryAfter = response?.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 5000);
  }
  return Math.min(300 * (2 ** attempt), 2400);
}

async function externalFetch(
  url: string,
  init: RequestInit,
  options: { retries?: number; timeoutMs?: number } = {},
) {
  const retries = options.retries ?? 0;
  const timeoutMs = options.timeoutMs ?? EXTERNAL_TIMEOUT_MS;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response | null = null;

    try {
      response = await fetch(url, { ...init, signal: controller.signal });
      if (!RETRYABLE_STATUS.has(response.status) || attempt === retries) return response;
      try { await response.body?.cancel(); } catch { /* no-op */ }
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    } finally {
      clearTimeout(timer);
    }

    await sleep(retryDelay(response, attempt));
  }

  throw lastError ?? new Error('external_request_failed');
}

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function addressText(a: any) {
  if (!a) return '';
  return [
    [a.logradouro, a.numero].filter(Boolean).join(', '),
    a.complemento,
    a.bairro,
    [a.cidade, a.uf].filter(Boolean).join('/'),
    a.cep ? `CEP ${a.cep}` : '',
  ].filter(Boolean).join(' - ');
}

function statusDisplay(status?: string | null) {
  const s = (status ?? 'AGENDADO').toUpperCase();
  if (s === 'CANCELADO') return 'Cancelado';
  if (s === 'REALIZADO') return 'Realizado';
  if (s === 'CONFIRMADO') return 'Confirmado';
  return 'Ativo';
}

async function accessToken(refreshToken: string) {
  const response = await externalFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  }, { retries: 2 });
  const json = await safeJson(response);
  if (!response.ok || !json?.access_token) throw new Error('google_token_refresh_failed');
  return json.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY || !CLIENT_ID || !CLIENT_SECRET || !CALENDAR_ID) {
    return reply({ error: 'config_incomplete' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return reply({ error: 'unauthorized' }, 401);
  const { data: allowed, error: permError } = await authClient.rpc('has_permission', { p_permission: 'crm.write' });
  if (permError || allowed !== true) return reply({ error: 'forbidden' }, 403);

  let body: any;
  try { body = await req.json(); } catch { return reply({ error: 'invalid_json' }, 400); }
  const agendamentoId = String(body?.agendamento_id ?? '');
  if (!agendamentoId) return reply({ error: 'agendamento_id_required' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: agenda, error: agendaError } = await admin
    .from('agendamentos')
    .select('id,ordem_servico_id,numero_os_referencia,proposta_id,numero_proposta_referencia,cliente_id,endereco_id,responsavel_id,inicio,fim,status,titulo,descricao,endereco_evento,external_calendar_id,deleted_at')
    .eq('id', agendamentoId)
    .single();
  if (agendaError || !agenda || agenda.deleted_at) return reply({ error: 'agendamento_not_found' }, 404);

  const [clientRes, osRes, proposalRes, profileRes, addressRes, integrationRes] = await Promise.all([
    agenda.cliente_id ? admin.from('clientes').select('nome_fantasia,razao_social').eq('id', agenda.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
    agenda.ordem_servico_id ? admin.from('ordens_servico').select('numero_os').eq('id', agenda.ordem_servico_id).maybeSingle() : Promise.resolve({ data: null }),
    agenda.proposta_id ? admin.from('propostas').select('numero_proposta').eq('id', agenda.proposta_id).maybeSingle() : Promise.resolve({ data: null }),
    agenda.responsavel_id ? admin.from('profiles').select('nome').eq('id', agenda.responsavel_id).maybeSingle() : Promise.resolve({ data: null }),
    agenda.endereco_id ? admin.from('enderecos').select('logradouro,numero,complemento,bairro,cidade,uf,cep').eq('id', agenda.endereco_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('google_calendar_integrations').select('refresh_token').eq('provider', 'google').eq('calendar_id', CALENDAR_ID).maybeSingle(),
  ]);

  const integration = integrationRes.data as any;
  if (!integration?.refresh_token) return reply({ error: 'google_calendar_not_connected' }, 409);

  const client = (clientRes as any).data;
  const os = (osRes as any).data;
  const proposal = (proposalRes as any).data;
  const profile = (profileRes as any).data;
  const addr = (addressRes as any).data;
  const location = (agenda.endereco_evento || '').trim() || addressText(addr);
  const clientName = client?.nome_fantasia || client?.razao_social || 'Cliente';
  const proposalNumber = proposal?.numero_proposta || agenda.numero_proposta_referencia;
  const osNumber = os?.numero_os || agenda.numero_os_referencia;
  const referencePart = osNumber ? ` (OS: ${osNumber})` : proposalNumber ? ` (Proposta: ${proposalNumber})` : '';
  const status = statusDisplay(agenda.status);
  const summary = agenda.titulo?.trim() || `[${status}] - ${clientName}${referencePart}`;
  const description = [
    `📍 STATUS: ${status}`,
    `👤 COLETOR: ${profile?.nome || 'Não informado'}`,
    `📍 ENDEREÇO: ${location || 'Não informado'}`,
    `📝 OBS: ${agenda.descricao?.trim() || 'Sem observações'}`,
  ].join('\n');
  const start = new Date(agenda.inicio);
  const end = agenda.fim ? new Date(agenda.fim) : new Date(start.getTime() + 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return reply({ error: 'invalid_datetime' }, 400);

  let token: string;
  try { token = await accessToken(integration.refresh_token); }
  catch { return reply({ error: 'google_auth_refresh_failed' }, 502); }

  const eventBody = {
    summary,
    location,
    description,
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
  };

  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
  let eventId = agenda.external_calendar_id as string | null;
  let response: Response;
  try {
    if (eventId) {
      response = await externalFetch(`${base}/${encodeURIComponent(eventId)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody),
      }, { retries: 2 });
      if (response.status === 404) eventId = null;
    }

    if (!eventId) {
      // Do not automatically retry event creation: repeating POST after an uncertain
      // network outcome can create duplicate calendar events.
      response = await externalFetch(base, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody),
      }, { retries: 0 });
    }
  } catch {
    return reply({ error: 'google_calendar_unavailable' }, 502);
  }

  const event = await safeJson(response!);
  if (!response!.ok || !event?.id) {
    return reply({ error: 'google_calendar_write_failed', google_status: response!.status }, 502);
  }

  const { error: updateError } = await admin
    .from('agendamentos')
    .update({ external_calendar_id: event.id, updated_at: new Date().toISOString() })
    .eq('id', agendamentoId);
  if (updateError) return reply({ error: 'calendar_created_but_crm_update_failed', event_id: event.id }, 500);
  return reply({ ok: true, event_id: event.id, html_link: event.htmlLink ?? null });
});
