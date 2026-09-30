-- Fase 1 hardening ChatPro: normalizacao E.164 + busca indexada segura.

create or replace function public.normalize_phone_e164(p_phone text)
returns text
language sql
immutable
strict
set search_path = pg_catalog, public
as $$
  with raw as (
    select regexp_replace(p_phone, '[^0-9]', '', 'g') as d
  )
  select case
    when d ~ '^55[0-9]{10,11}$' then '+' || d
    when d ~ '^[0-9]{10,11}$' then '+55' || d
    when d ~ '^[1-9][0-9]{7,14}$' then '+' || d
    else null
  end
  from raw;
$$;

alter table public.clientes add column if not exists telefone_principal_e164 text;
alter table public.contatos add column if not exists telefone_e164 text, add column if not exists whatsapp_e164 text;

update public.clientes
set telefone_principal_e164 = public.normalize_phone_e164(telefone_principal)
where telefone_principal_e164 is distinct from public.normalize_phone_e164(telefone_principal);

update public.contatos
set telefone_e164 = public.normalize_phone_e164(telefone),
    whatsapp_e164 = public.normalize_phone_e164(whatsapp)
where telefone_e164 is distinct from public.normalize_phone_e164(telefone)
   or whatsapp_e164 is distinct from public.normalize_phone_e164(whatsapp);

create or replace function public.sync_cliente_phone_e164()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.telefone_principal_e164 := public.normalize_phone_e164(new.telefone_principal);
  return new;
end;
$$;

create or replace function public.sync_contato_phone_e164()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.telefone_e164 := public.normalize_phone_e164(new.telefone);
  new.whatsapp_e164 := public.normalize_phone_e164(new.whatsapp);
  return new;
end;
$$;

drop trigger if exists trg_clientes_sync_phone_e164 on public.clientes;
create trigger trg_clientes_sync_phone_e164 before insert or update of telefone_principal on public.clientes for each row execute function public.sync_cliente_phone_e164();

drop trigger if exists trg_contatos_sync_phone_e164 on public.contatos;
create trigger trg_contatos_sync_phone_e164 before insert or update of telefone, whatsapp on public.contatos for each row execute function public.sync_contato_phone_e164();

create index if not exists idx_clientes_telefone_principal_e164 on public.clientes (telefone_principal_e164) where deleted_at is null and telefone_principal_e164 is not null;
create index if not exists idx_contatos_telefone_e164 on public.contatos (telefone_e164) where deleted_at is null and ativo = true and telefone_e164 is not null;
create index if not exists idx_contatos_whatsapp_e164 on public.contatos (whatsapp_e164) where deleted_at is null and ativo = true and whatsapp_e164 is not null;

create or replace function public.find_cliente_by_phone_e164(p_phone text)
returns table (cliente_id uuid, contato_id uuid, matched_phone text, match_source text)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with input as (
    select public.normalize_phone_e164(p_phone) as e164
  ), candidates_raw as (
    select c.cliente_id, c.id as contato_id, c.whatsapp_e164 as matched_phone, 'contatos.whatsapp'::text as match_source, 1 as priority
    from public.contatos c, input i
    where i.e164 is not null and c.deleted_at is null and c.ativo = true and c.whatsapp_e164 = i.e164
    union all
    select c.cliente_id, c.id, c.telefone_e164, 'contatos.telefone'::text, 2
    from public.contatos c, input i
    where i.e164 is not null and c.deleted_at is null and c.ativo = true and c.telefone_e164 = i.e164
    union all
    select cl.id, null::uuid, cl.telefone_principal_e164, 'clientes.telefone_principal'::text, 3
    from public.clientes cl, input i
    where i.e164 is not null and cl.deleted_at is null and cl.telefone_principal_e164 = i.e164
  ), unique_clients as (
    select distinct cr.cliente_id from candidates_raw cr where cr.cliente_id is not null
  ), safe_match as (
    select cr.*
    from candidates_raw cr
    where (select count(*) from unique_clients) = 1
    order by cr.priority, cr.contato_id nulls last
    limit 1
  )
  select sm.cliente_id, sm.contato_id, sm.matched_phone, sm.match_source
  from safe_match sm;
$$;

revoke all on function public.find_cliente_by_phone_e164(text) from public, anon, authenticated;
grant execute on function public.find_cliente_by_phone_e164(text) to service_role;
revoke all on function public.normalize_phone_e164(text) from public, anon;
grant execute on function public.normalize_phone_e164(text) to authenticated, service_role;
