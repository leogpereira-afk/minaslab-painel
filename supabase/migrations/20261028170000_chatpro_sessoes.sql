-- ChatPro: sessões de atendimento (aberto/finalizado), responsável e cadastro.
--
-- O webhook guarda cada evento em chatpro_eventos. Os eventos de sessão
-- (SESSION.OPENED/ASSIGNED/TRANSFERRED/CLOSED e o formato antigo
-- opened_session/...) não trazem telefone: a sessão é ligada ao atendimento
-- (lead do CRM) pelas mensagens, que trazem o id da sessão (interacoes.chat_session_id).
--
-- O "atendimento" da tela Atendimentos é o lead. Ele recebe um resumo da sessão
-- mais recente (situação, protocolo, motivo, NPS, quem atendeu/finalizou) e o
-- responsável do CRM quando o usuário do ChatPro está ligado a um usuário do CRM.
-- Nome, e-mail e empresa vazios são completados pelo cadastro (cliente/contato)
-- localizado pelo telefone.

-- Usuários do ChatPro (preenchido pela função chatpro-chat) e o usuário do CRM correspondente.
create table if not exists public.chatpro_usuarios (
  id text primary key,
  nome text,
  email text,
  ativo boolean,
  papel text,
  perfil_id uuid references public.profiles(id) on delete set null,
  perfil_manual boolean not null default false,
  atualizado_em timestamptz not null default now()
);

-- Motivos de finalização (close_tag do ChatPro).
create table if not exists public.chatpro_motivos (
  id text primary key,
  nome text,
  ativo boolean,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.chatpro_sessoes (
  id text primary key,
  chatpro_lead_id text,
  lead_id uuid references public.leads(id) on delete set null,
  aberta boolean,
  aberta_em timestamptz,
  finalizada_em timestamptz,
  responsavel_chatpro text,
  finalizado_por_chatpro text,
  motivo_id text,
  protocolo text,
  nps text,
  nps_nota integer,
  departamento_id text,
  ultimo_evento text,
  ultima_atualizacao timestamptz,
  atualizado_em timestamptz not null default now()
);
create index if not exists chatpro_sessoes_lead_idx on public.chatpro_sessoes(lead_id);
create index if not exists chatpro_sessoes_chatpro_lead_idx on public.chatpro_sessoes(chatpro_lead_id);
create index if not exists interacoes_chat_session_idx on public.interacoes(chat_session_id) where chat_session_id is not null;

alter table public.leads
  add column if not exists chatpro_sessao_id text,
  add column if not exists chatpro_situacao text,
  add column if not exists chatpro_aberto_em timestamptz,
  add column if not exists chatpro_finalizado_em timestamptz,
  add column if not exists chatpro_finalizado_por text,
  add column if not exists chatpro_responsavel text,
  add column if not exists chatpro_protocolo text,
  add column if not exists chatpro_motivo text,
  add column if not exists chatpro_nps text;
do $$ begin
  alter table public.leads add constraint leads_chatpro_situacao_chk check (chatpro_situacao is null or chatpro_situacao in ('ABERTO','FINALIZADO'));
exception when duplicate_object then null; end $$;
create index if not exists leads_chatpro_situacao_idx on public.leads(chatpro_situacao) where chatpro_situacao is not null;

alter table public.chatpro_usuarios enable row level security;
alter table public.chatpro_motivos enable row level security;
alter table public.chatpro_sessoes enable row level security;
drop policy if exists chatpro_usuarios_select on public.chatpro_usuarios;
create policy chatpro_usuarios_select on public.chatpro_usuarios for select to authenticated using ((select public.has_permission('crm.read')));
drop policy if exists chatpro_usuarios_update on public.chatpro_usuarios;
create policy chatpro_usuarios_update on public.chatpro_usuarios for update to authenticated using ((select public.has_permission('admin.manage'))) with check ((select public.has_permission('admin.manage')));
drop policy if exists chatpro_motivos_select on public.chatpro_motivos;
create policy chatpro_motivos_select on public.chatpro_motivos for select to authenticated using ((select public.has_permission('crm.read')));
drop policy if exists chatpro_sessoes_select on public.chatpro_sessoes;
create policy chatpro_sessoes_select on public.chatpro_sessoes for select to authenticated using ((select public.has_permission('crm.read')));
revoke all on public.chatpro_usuarios, public.chatpro_motivos, public.chatpro_sessoes from anon;
grant select on public.chatpro_usuarios, public.chatpro_motivos, public.chatpro_sessoes to authenticated;
grant update (perfil_id, perfil_manual) on public.chatpro_usuarios to authenticated;

-- Texto -> timestamptz sem quebrar com valor ruim.
create or replace function public.chatpro_ts(p text) returns timestamptz
language plpgsql immutable set search_path = pg_catalog as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  return p::timestamptz;
exception when others then return null;
end $$;

-- Completa o atendimento (lead) pelo cadastro: vincula cliente/contato pelo
-- telefone e preenche nome, e-mail e empresa que estiverem vazios.
create or replace function public.chatpro_completar_cadastro_lead(p_lead uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  l public.leads%rowtype;
  v_fone text; r record;
  v_cli uuid; v_cont uuid;
  k public.clientes%rowtype; c public.contatos%rowtype;
  v_empresa text; v_nome text; v_email text;
begin
  select * into l from public.leads where id = p_lead and deleted_at is null;
  if not found then return false; end if;
  v_fone := public.normalize_phone_e164(l.telefone_whatsapp);
  v_cli := l.cliente_convertido_id; v_cont := l.contato_convertido_id;

  if v_cli is null and v_fone is not null then
    select * into r from public.resolve_cliente_by_phone_e164(v_fone) limit 1;
    if r.status = 'LOCALIZADO' and r.cliente_id is not null then v_cli := r.cliente_id; v_cont := coalesce(v_cont, r.contato_id); end if;
  end if;
  if v_cli is null then return false; end if;

  select * into k from public.clientes where id = v_cli and deleted_at is null;
  if not found then return false; end if;
  if v_cont is not null then
    select * into c from public.contatos where id = v_cont and deleted_at is null and cliente_id = v_cli;
    if not found then v_cont := null; end if;
  end if;
  if v_cont is null and v_fone is not null then
    select * into c from public.contatos ct
     where ct.cliente_id = v_cli and ct.deleted_at is null and coalesce(ct.ativo, true)
       and (ct.whatsapp_e164 = v_fone or ct.telefone_e164 = v_fone)
     order by ct.principal desc nulls last, ct.updated_at desc limit 1;
    if found then v_cont := c.id; end if;
  end if;

  v_empresa := coalesce(nullif(btrim(k.nome_fantasia), ''), nullif(btrim(k.razao_social), ''));
  v_nome := nullif(btrim(c.nome), '');
  v_email := coalesce(nullif(btrim(c.email), ''), nullif(btrim(k.email_principal), ''));

  update public.leads set
    cliente_convertido_id = coalesce(cliente_convertido_id, v_cli),
    contato_convertido_id = coalesce(contato_convertido_id, v_cont),
    -- Nome: preenche se vazio, se for só o telefone ou se for o nome da empresa
    -- e houver o nome da pessoa (contato).
    nome = case
      when nullif(btrim(nome), '') is null then coalesce(v_nome, v_empresa)
      when regexp_replace(nome, '\D', '', 'g') <> '' and regexp_replace(nome, '[\d\s()+-]', '', 'g') = '' then coalesce(v_nome, v_empresa, nome)
      when v_nome is not null and lower(btrim(nome)) in (lower(coalesce(k.nome_fantasia, '')), lower(coalesce(k.razao_social, ''))) then v_nome
      else nome end,
    email_contato = coalesce(nullif(btrim(email_contato), ''), v_email),
    empresa_contato = coalesce(nullif(btrim(empresa_contato), ''), v_empresa),
    assunto = case when assunto = 'WhatsApp / ChatPro — selecionar empresa' then 'WhatsApp / ChatPro' else assunto end,
    updated_at = now()
  where id = p_lead
    and (cliente_convertido_id is distinct from coalesce(cliente_convertido_id, v_cli)
      or contato_convertido_id is distinct from coalesce(contato_convertido_id, v_cont)
      or nullif(btrim(nome), '') is null
      or (regexp_replace(nome, '\D', '', 'g') <> '' and regexp_replace(nome, '[\d\s()+-]', '', 'g') = '')
      or (v_nome is not null and lower(btrim(nome)) in (lower(coalesce(k.nome_fantasia, '')), lower(coalesce(k.razao_social, ''))))
      or (nullif(btrim(email_contato), '') is null and v_email is not null)
      or (nullif(btrim(empresa_contato), '') is null and v_empresa is not null)
      or assunto = 'WhatsApp / ChatPro — selecionar empresa');

  update public.atendimentos set
    cliente_id = coalesce(cliente_id, v_cli),
    contato_id = case when cliente_id is null or cliente_id = v_cli then coalesce(contato_id, v_cont) else contato_id end,
    assunto = case when assunto = 'WhatsApp / ChatPro — selecionar empresa' then 'WhatsApp / ChatPro' else assunto end
  where lead_id = p_lead and (cliente_id is null or (contato_id is null and v_cont is not null and cliente_id = v_cli));
  return true;
end $$;

-- Aplica ao atendimento (lead) o estado da sessão ChatPro mais recente.
create or replace function public.chatpro_sincronizar_lead(p_lead uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare s public.chatpro_sessoes%rowtype; v_perfil uuid;
begin
  if p_lead is null then return; end if;
  select * into s from public.chatpro_sessoes where lead_id = p_lead
   order by coalesce(aberta_em, ultima_atualizacao) desc nulls last, ultima_atualizacao desc nulls last limit 1;
  if found then
    select perfil_id into v_perfil from public.chatpro_usuarios where id = s.responsavel_chatpro;
    update public.leads l set
      chatpro_sessao_id = s.id,
      chatpro_situacao = case when s.aberta is false then 'FINALIZADO' else 'ABERTO' end,
      chatpro_aberto_em = s.aberta_em,
      chatpro_finalizado_em = case when s.aberta is false then coalesce(s.finalizada_em, s.ultima_atualizacao) end,
      chatpro_finalizado_por = case when s.aberta is false then
        (select coalesce(u.nome, u.email) from public.chatpro_usuarios u where u.id = coalesce(s.finalizado_por_chatpro, s.responsavel_chatpro)) end,
      chatpro_responsavel = (select coalesce(u.nome, u.email) from public.chatpro_usuarios u where u.id = s.responsavel_chatpro),
      chatpro_protocolo = s.protocolo,
      chatpro_motivo = case when s.motivo_id is null then null else coalesce((select m.nome from public.chatpro_motivos m where m.id = s.motivo_id), 'Motivo não identificado') end,
      chatpro_nps = coalesce(s.nps, case when s.nps_nota > 0 then s.nps_nota::text end),
      responsavel_id = coalesce(v_perfil, l.responsavel_id)
    where l.id = p_lead;
  end if;
  perform public.chatpro_completar_cadastro_lead(p_lead);
end $$;

-- Registra um evento de sessão (formato novo: payload.new; antigo: payload.session_data).
create or replace function public.chatpro_registrar_sessao(p_payload jsonb, p_recebido timestamptz default now()) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  s jsonb; v_id text; v_ts timestamptz; v_lead uuid; v_aberta boolean; v_evento text; v_resp text; v_antigo uuid;
begin
  s := coalesce(p_payload->'new', p_payload->'session_data');
  v_id := nullif(btrim(s->>'id'), '');
  if v_id is null then return null; end if;
  v_evento := lower(coalesce(p_payload->>'event', ''));
  v_ts := coalesce(public.chatpro_ts(s->>'last_update'), public.chatpro_ts(p_payload->>'timestamp'), public.chatpro_ts(p_payload->>'event_ts'), p_recebido);
  v_aberta := case when s ? 'open' and jsonb_typeof(s->'open') = 'boolean' then (s->>'open')::boolean
                   when v_evento in ('session.closed', 'closed_session') then false else true end;
  v_resp := nullif(btrim(s->>'assing_to'), '');

  -- Liga ao atendimento: pela mensagem da própria sessão; senão pela sessão
  -- anterior do mesmo contato ChatPro.
  select i.lead_id into v_lead from public.interacoes i
   where i.chat_session_id = v_id and i.lead_id is not null order by i.ocorrido_em desc limit 1;
  if v_lead is null and nullif(s->>'lead_id', '') is not null then
    select x.lead_id into v_lead from public.chatpro_sessoes x
     where x.chatpro_lead_id = s->>'lead_id' and x.lead_id is not null and x.id <> v_id
     order by coalesce(x.aberta_em, x.ultima_atualizacao) desc nulls last limit 1;
  end if;
  select lead_id into v_antigo from public.chatpro_sessoes where id = v_id;

  insert into public.chatpro_sessoes as cs (id, chatpro_lead_id, lead_id, aberta, aberta_em, finalizada_em, responsavel_chatpro,
      finalizado_por_chatpro, motivo_id, protocolo, nps, nps_nota, departamento_id, ultimo_evento, ultima_atualizacao, atualizado_em)
  values (v_id, nullif(s->>'lead_id', ''), v_lead, v_aberta, public.chatpro_ts(s->>'open_ts'), public.chatpro_ts(s->>'close_ts'), v_resp,
      case when not v_aberta then v_resp end, nullif(s->>'close_tag', ''), nullif(s->>'protocoll', ''), nullif(s->>'nps', ''),
      case when (s->>'nps_grade') ~ '^\d+$' then (s->>'nps_grade')::int end, nullif(s->>'department_id', ''), v_evento, v_ts, now())
  on conflict (id) do update set
      chatpro_lead_id = coalesce(excluded.chatpro_lead_id, cs.chatpro_lead_id),
      lead_id = coalesce(cs.lead_id, excluded.lead_id),
      aberta = excluded.aberta,
      aberta_em = coalesce(excluded.aberta_em, cs.aberta_em),
      finalizada_em = case when excluded.aberta then null else coalesce(excluded.finalizada_em, cs.finalizada_em) end,
      responsavel_chatpro = coalesce(excluded.responsavel_chatpro, cs.responsavel_chatpro),
      finalizado_por_chatpro = case when excluded.aberta then null else coalesce(excluded.finalizado_por_chatpro, cs.finalizado_por_chatpro) end,
      motivo_id = case when excluded.aberta then null else coalesce(excluded.motivo_id, cs.motivo_id) end,
      protocolo = coalesce(excluded.protocolo, cs.protocolo),
      nps = coalesce(excluded.nps, cs.nps),
      nps_nota = coalesce(nullif(excluded.nps_nota, 0), cs.nps_nota, excluded.nps_nota),
      departamento_id = coalesce(excluded.departamento_id, cs.departamento_id),
      ultimo_evento = excluded.ultimo_evento,
      ultima_atualizacao = excluded.ultima_atualizacao,
      atualizado_em = now()
    -- Evento atrasado (mais antigo que o já aplicado) não desfaz o estado atual.
    where cs.ultima_atualizacao is null or excluded.ultima_atualizacao >= cs.ultima_atualizacao;

  select lead_id into v_lead from public.chatpro_sessoes where id = v_id;
  if v_antigo is not null and v_antigo is distinct from v_lead then perform public.chatpro_sincronizar_lead(v_antigo); end if;
  if v_lead is not null then perform public.chatpro_sincronizar_lead(v_lead); end if;
  return v_lead;
end $$;

-- Gatilho: todo evento de sessão que chega é aplicado na hora.
create or replace function public.chatpro_evento_sessao_trg() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if upper(coalesce(new.event_type, '')) ~ '^SESSION\.|_SESSION$' then
    begin
      perform public.chatpro_registrar_sessao(new.payload, coalesce(new.recebido_em, now()));
      new.processado_em := now();
      new.erro := null;
    exception when others then
      new.erro := 'sessao: ' || sqlerrm;
    end;
  end if;
  return new;
end $$;
drop trigger if exists trg_chatpro_evento_sessao on public.chatpro_eventos;
create trigger trg_chatpro_evento_sessao before insert on public.chatpro_eventos
  for each row execute function public.chatpro_evento_sessao_trg();

-- Gatilho: a mensagem que chega liga a sessão ao atendimento e completa o cadastro.
create or replace function public.chatpro_interacao_sessao_trg() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_antigo uuid;
begin
  if new.source_system = 'CHATPRO' and new.lead_id is not null then
    begin
      if new.chat_session_id is not null then
        select lead_id into v_antigo from public.chatpro_sessoes where id = new.chat_session_id;
        if found and v_antigo is distinct from new.lead_id then
          update public.chatpro_sessoes set lead_id = new.lead_id, atualizado_em = now() where id = new.chat_session_id;
          if v_antigo is not null then perform public.chatpro_sincronizar_lead(v_antigo); end if;
          perform public.chatpro_sincronizar_lead(new.lead_id);
        elsif not found then
          perform public.chatpro_completar_cadastro_lead(new.lead_id);
        end if;
      else
        perform public.chatpro_completar_cadastro_lead(new.lead_id);
      end if;
    exception when others then
      raise warning 'chatpro_interacao_sessao_trg: %', sqlerrm;
    end;
  end if;
  return null;
end $$;
drop trigger if exists trg_chatpro_interacao_sessao on public.interacoes;
create trigger trg_chatpro_interacao_sessao after insert on public.interacoes
  for each row execute function public.chatpro_interacao_sessao_trg();

-- Liga usuários do ChatPro aos do CRM (e-mail igual; senão primeiro nome único).
create or replace function public.chatpro_ligar_usuarios() returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  update public.chatpro_usuarios u set perfil_id = x.perfil
  from (
    select cu.id,
      coalesce(
        (select p.id from public.profiles p join auth.users au on au.id = p.id where lower(au.email) = lower(cu.email) limit 1),
        (select min(p.id::text)::uuid from public.profiles p
          where lower(extensions.unaccent(split_part(btrim(p.nome), ' ', 1))) = lower(extensions.unaccent(split_part(btrim(cu.nome), ' ', 1)))
          having count(*) = 1)
      ) perfil
    from public.chatpro_usuarios cu where not cu.perfil_manual
  ) x
  where u.id = x.id and u.perfil_id is distinct from x.perfil and x.perfil is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Reprocessa tudo: liga usuários, reaplica os eventos de sessão em ordem e
-- completa o cadastro de todos os atendimentos ChatPro. Usado no carregamento
-- inicial e quando os usuários/motivos do ChatPro são atualizados.
create or replace function public.chatpro_reaplicar_tudo() returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare e record; n_ev integer := 0; n_leads integer := 0; v_lig integer; v_lead uuid;
begin
  v_lig := public.chatpro_ligar_usuarios();
  for e in select id, payload, recebido_em from public.chatpro_eventos
           where upper(event_type) ~ '^SESSION\.|_SESSION$' order by recebido_em, id loop
    begin
      perform public.chatpro_registrar_sessao(e.payload, e.recebido_em);
      update public.chatpro_eventos set processado_em = coalesce(processado_em, now()), erro = null where id = e.id;
      n_ev := n_ev + 1;
    exception when others then
      update public.chatpro_eventos set erro = 'sessao: ' || sqlerrm where id = e.id;
    end;
  end loop;
  -- Sessões que só agora têm mensagem ligada.
  update public.chatpro_sessoes cs set lead_id = i.lead_id
    from (select distinct on (chat_session_id) chat_session_id, lead_id from public.interacoes
           where chat_session_id is not null and lead_id is not null order by chat_session_id, ocorrido_em desc) i
   where i.chat_session_id = cs.id and cs.lead_id is distinct from i.lead_id;
  for v_lead in select distinct lead_id from public.chatpro_sessoes where lead_id is not null loop
    perform public.chatpro_sincronizar_lead(v_lead);
  end loop;
  for v_lead in select l.id from public.leads l where l.deleted_at is null
                 and (l.source_system = 'CHATPRO' or exists (select 1 from public.interacoes i where i.lead_id = l.id and i.source_system = 'CHATPRO')) loop
    if public.chatpro_completar_cadastro_lead(v_lead) then n_leads := n_leads + 1; end if;
  end loop;
  return jsonb_build_object('usuarios_ligados', v_lig, 'eventos_sessao', n_ev, 'leads_com_cadastro', n_leads);
end $$;

revoke all on function public.chatpro_completar_cadastro_lead(uuid), public.chatpro_sincronizar_lead(uuid),
  public.chatpro_registrar_sessao(jsonb, timestamptz), public.chatpro_ligar_usuarios(), public.chatpro_reaplicar_tudo()
  from public, anon, authenticated;
grant execute on function public.chatpro_reaplicar_tudo() to service_role;
