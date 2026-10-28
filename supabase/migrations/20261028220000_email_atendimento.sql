-- E-mail (caixa da Hostinger) dentro de Atendimentos.
--
-- A função email-atendimento lê a caixa por IMAP (entrada e enviados) a cada
-- 5 minutos e envia respostas por SMTP. Cada e-mail é guardado em
-- email_mensagens e ligado a um atendimento (lead):
--   1) resposta de um e-mail já ligado -> mesmo atendimento;
--   2) remetente com atendimento em aberto (e-mail do contato) -> esse atendimento;
--   3) remetente cadastrado (contato ou cliente) -> atendimento novo já com cadastro;
--   4) remetente desconhecido -> atendimento novo (exceto mensagens automáticas:
--      newsletters, "no-reply", avisos de sistema), que ficam guardadas sem atendimento.

create table if not exists public.email_mensagens (
  id uuid primary key default gen_random_uuid(),
  caixa text not null,
  pasta text not null default 'INBOX',
  uid bigint,
  message_id text not null unique,
  in_reply_to text,
  referencias text[] not null default '{}',
  direcao text not null check (direcao in ('RECEIVED', 'SENT')),
  de_email text,
  de_nome text,
  para text[] not null default '{}',
  cc text[] not null default '{}',
  assunto text,
  texto text,
  texto_resumido text,
  anexos jsonb not null default '[]'::jsonb,
  automatica boolean not null default false,
  recebido_em timestamptz not null default now(),
  lead_id uuid references public.leads(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  contato_id uuid references public.contatos(id) on delete set null,
  enviado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists email_mensagens_lead_idx on public.email_mensagens(lead_id, recebido_em);
create index if not exists email_mensagens_de_idx on public.email_mensagens(lower(de_email));

create table if not exists public.email_estado (
  chave text primary key,          -- "<caixa>|<pasta>"
  uidvalidity bigint,
  ultimo_uid bigint not null default 0,
  atualizado_em timestamptz not null default now(),
  ultimo_erro text
);

alter table public.email_mensagens enable row level security;
alter table public.email_estado enable row level security;
drop policy if exists email_mensagens_select on public.email_mensagens;
create policy email_mensagens_select on public.email_mensagens for select to authenticated using ((select public.has_permission('crm.read')));
revoke all on public.email_mensagens, public.email_estado from anon;
grant select on public.email_mensagens to authenticated;

-- Anexos recebidos (privado; o CRM abre por link temporário).
insert into storage.buckets (id, name, public, file_size_limit)
values ('email-anexos', 'email-anexos', false, 26214400)
on conflict (id) do update set public = false;
drop policy if exists email_anexos_select on storage.objects;
create policy email_anexos_select on storage.objects for select to authenticated
  using (bucket_id = 'email-anexos' and (select public.has_permission('crm.read')));

-- Liga um e-mail a um atendimento (cria o atendimento quando precisa).
create or replace function public.email_vincular(
  p_email text, p_nome text, p_assunto text, p_in_reply_to text, p_referencias text[],
  p_automatica boolean, p_pode_criar boolean)
returns table(lead_id uuid, cliente_id uuid, contato_id uuid, criado boolean)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_lead uuid; v_cli uuid; v_cont uuid; v_nome text; v_empresa text;
begin
  -- 1) Resposta a um e-mail já ligado.
  select m.lead_id into v_lead from public.email_mensagens m
   where m.lead_id is not null and (m.message_id = p_in_reply_to or m.message_id = any(coalesce(p_referencias, '{}')))
   order by m.recebido_em desc limit 1;

  -- Cadastro do remetente.
  if v_email <> '' then
    select c.id, c.cliente_id, c.nome into v_cont, v_cli, v_nome from public.contatos c
     where c.deleted_at is null and coalesce(c.ativo, true) and lower(btrim(c.email)) = v_email
     order by c.principal desc nulls last, c.updated_at desc limit 1;
    if v_cli is null then
      select k.id into v_cli from public.clientes k
       where k.deleted_at is null and lower(btrim(k.email_principal)) = v_email
       order by k.updated_at desc limit 1;
    end if;
  end if;
  if v_cli is not null then
    select coalesce(nullif(btrim(k.nome_fantasia), ''), nullif(btrim(k.razao_social), '')) into v_empresa from public.clientes k where k.id = v_cli;
  end if;

  -- 2) Atendimento em aberto com esse e-mail (ou do mesmo cliente).
  if v_lead is null and v_email <> '' then
    select l.id into v_lead from public.leads l
     where l.deleted_at is null and coalesce(l.ativo, true)
       and lower(l.status) not in ('encerrado', 'convertido')
       and (lower(btrim(l.email_contato)) = v_email or (v_cont is not null and l.contato_convertido_id = v_cont))
     order by coalesce(l.updated_at, l.created_at) desc limit 1;
  end if;

  if v_lead is not null then
    return query select v_lead, v_cli, v_cont, false; return;
  end if;
  if not p_pode_criar or v_email = '' or (p_automatica and v_cli is null) then
    return query select null::uuid, v_cli, v_cont, false; return;
  end if;

  -- 3/4) Atendimento novo.
  insert into public.leads(nome, email_contato, empresa_contato, origem, assunto, resumo, status, data_primeiro_atendimento,
                           cliente_convertido_id, contato_convertido_id, source_system)
  values (coalesce(nullif(btrim(v_nome), ''), nullif(btrim(p_nome), ''), v_email), v_email, v_empresa, 'E-mail',
          left(coalesce(nullif(btrim(p_assunto), ''), 'E-mail recebido'), 300), null, 'Em atendimento', now(), v_cli, v_cont, 'EMAIL')
  returning id into v_lead;
  insert into public.atendimentos(lead_id, cliente_id, contato_id, ocorrido_em, canal, assunto, resumo, source_system)
  values (v_lead, v_cli, v_cont, now(), 'E-mail', left(coalesce(nullif(btrim(p_assunto), ''), 'E-mail recebido'), 300), null, 'EMAIL');
  return query select v_lead, v_cli, v_cont, true;
end $$;

-- Grava um e-mail (idempotente pelo Message-ID) e o registra no histórico.
create or replace function public.email_registrar(p jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_id uuid; v_dir text := p->>'direcao'; r record; v_lead uuid := nullif(p->>'lead_id', '')::uuid;
  v_cli uuid; v_cont uuid; v_criado boolean := false; v_quem text; v_refs text[];
begin
  if exists (select 1 from public.email_mensagens where message_id = p->>'message_id') then
    return jsonb_build_object('duplicado', true);
  end if;
  v_refs := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'referencias', '[]'::jsonb)) x), '{}');
  if v_lead is null then
    -- Recebido: o remetente; enviado pelo webmail: o primeiro destinatário (só liga, não cria).
    v_quem := case when v_dir = 'RECEIVED' then p->>'de_email' else (p->'para'->>0) end;
    select * into r from public.email_vincular(v_quem, case when v_dir = 'RECEIVED' then p->>'de_nome' end, p->>'assunto',
      p->>'in_reply_to', v_refs,
      -- Histórico (primeira leitura) segue a regra das automáticas: só cria se o remetente for cadastrado.
      coalesce((p->>'automatica')::boolean, false) or coalesce((p->>'historico')::boolean, false), v_dir = 'RECEIVED');
    v_lead := r.lead_id; v_cli := r.cliente_id; v_cont := r.contato_id; v_criado := coalesce(r.criado, false);
  else
    select l.cliente_convertido_id, l.contato_convertido_id into v_cli, v_cont from public.leads l where l.id = v_lead;
  end if;

  insert into public.email_mensagens(caixa, pasta, uid, message_id, in_reply_to, referencias, direcao, de_email, de_nome, para, cc,
     assunto, texto, texto_resumido, anexos, automatica, recebido_em, lead_id, cliente_id, contato_id, enviado_por)
  values (p->>'caixa', coalesce(p->>'pasta', 'INBOX'), nullif(p->>'uid', '')::bigint, p->>'message_id', nullif(p->>'in_reply_to', ''), v_refs, v_dir,
     lower(nullif(p->>'de_email', '')), nullif(p->>'de_nome', ''),
     coalesce((select array_agg(lower(x)) from jsonb_array_elements_text(coalesce(p->'para', '[]'::jsonb)) x), '{}'),
     coalesce((select array_agg(lower(x)) from jsonb_array_elements_text(coalesce(p->'cc', '[]'::jsonb)) x), '{}'),
     left(p->>'assunto', 500), left(p->>'texto', 100000), left(p->>'texto_resumido', 20000), coalesce(p->'anexos', '[]'::jsonb),
     coalesce((p->>'automatica')::boolean, false), coalesce(public.chatpro_ts(p->>'recebido_em'), now()),
     v_lead, v_cli, v_cont, nullif(p->>'enviado_por', '')::uuid)
  returning id into v_id;

  if v_lead is not null then
    insert into public.interacoes(lead_id, cliente_id, contato_id, usuario_id, ocorrido_em, tipo, descricao, source_system, external_id, direction, message_kind, message_text)
    values (v_lead, v_cli, v_cont, nullif(p->>'enviado_por', '')::uuid, coalesce(public.chatpro_ts(p->>'recebido_em'), now()), 'EMAIL',
      left(case when v_dir = 'RECEIVED' then 'E-mail recebido' else 'E-mail enviado' end || coalesce(': ' || nullif(p->>'assunto', ''), ''), 500),
      'EMAIL', 'email:' || (p->>'message_id'), v_dir, 'TEXT', left(coalesce(p->>'texto_resumido', p->>'texto'), 4000));
    update public.leads set updated_at = now() where id = v_lead;
  end if;
  return jsonb_build_object('id', v_id, 'lead_id', v_lead, 'atendimento_novo', v_criado);
end $$;

revoke all on function public.email_vincular(text, text, text, text, text[], boolean, boolean), public.email_registrar(jsonb) from public, anon, authenticated;
grant execute on function public.email_registrar(jsonb) to service_role;

-- Leitura da caixa a cada 5 minutos.
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'email-atendimento-5min';
end $$;
select cron.schedule('email-atendimento-5min', '*/5 * * * *', $c$
  select net.http_post(url := 'https://reoghclxripktzpdwhiy.supabase.co/functions/v1/email-atendimento',
    headers := jsonb_build_object('content-type','application/json','x-rotina-token',(select decrypted_secret from vault.decrypted_secrets where name='ml_chatpro_chat_token_rotina')),
    body := '{"acao":"buscar"}'::jsonb, timeout_milliseconds := 150000);
$c$);
