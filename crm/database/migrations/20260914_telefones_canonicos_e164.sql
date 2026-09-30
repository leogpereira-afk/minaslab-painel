-- Padroniza telefones brasileiros em todos os cadastros relevantes.
-- Formato canônico: +55DDDNÚMERO, sem espaços, parênteses ou hífens.
-- Números incompletos/ambíguos não recebem DDD inventado.

create or replace function public.canonicalize_phone_br(p_phone text)
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
    when d ~ '^[0-9]{10,11}$' and d !~ '^0' then '+55' || d
    else null
  end
  from raw;
$$;

create or replace function public.sync_cliente_phone_e164()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_phone text;
begin
  v_phone := public.canonicalize_phone_br(new.telefone_principal);
  if v_phone is not null then
    new.telefone_principal := v_phone;
    new.telefone_principal_e164 := v_phone;
  else
    new.telefone_principal_e164 := public.normalize_phone_e164(new.telefone_principal);
  end if;
  return new;
end;
$$;

create or replace function public.sync_contato_phone_e164()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_phone text;
  v_whatsapp text;
begin
  v_phone := public.canonicalize_phone_br(new.telefone);
  v_whatsapp := public.canonicalize_phone_br(new.whatsapp);

  if v_phone is not null then
    new.telefone := v_phone;
    new.telefone_e164 := v_phone;
  else
    new.telefone_e164 := public.normalize_phone_e164(new.telefone);
  end if;

  if v_whatsapp is not null then
    new.whatsapp := v_whatsapp;
    new.whatsapp_e164 := v_whatsapp;
  else
    new.whatsapp_e164 := public.normalize_phone_e164(new.whatsapp);
  end if;
  return new;
end;
$$;

create or replace function public.sync_other_phone_canonical()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_phone text;
begin
  if tg_table_name = 'leads' then
    v_phone := public.canonicalize_phone_br(new.telefone_whatsapp);
    if v_phone is not null then new.telefone_whatsapp := v_phone; end if;
  elsif tg_table_name = 'laboratorios_parceiros' then
    v_phone := public.canonicalize_phone_br(new.telefone);
    if v_phone is not null then new.telefone := v_phone; end if;
  elsif tg_table_name = 'propostas' then
    v_phone := public.canonicalize_phone_br(new.solicitante_snapshot_telefone);
    if v_phone is not null then new.solicitante_snapshot_telefone := v_phone; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_phone_canonical on public.leads;
create trigger trg_leads_phone_canonical
before insert or update of telefone_whatsapp on public.leads
for each row execute function public.sync_other_phone_canonical();

drop trigger if exists trg_laboratorios_phone_canonical on public.laboratorios_parceiros;
create trigger trg_laboratorios_phone_canonical
before insert or update of telefone on public.laboratorios_parceiros
for each row execute function public.sync_other_phone_canonical();

drop trigger if exists trg_propostas_phone_canonical on public.propostas;
create trigger trg_propostas_phone_canonical
before insert or update of solicitante_snapshot_telefone on public.propostas
for each row execute function public.sync_other_phone_canonical();

-- Backfill seguro: altera somente números em que o país/DDD podem ser determinados sem inferência.
update public.clientes
set telefone_principal = public.canonicalize_phone_br(telefone_principal)
where public.canonicalize_phone_br(telefone_principal) is not null
  and telefone_principal is distinct from public.canonicalize_phone_br(telefone_principal);

update public.contatos
set telefone = public.canonicalize_phone_br(telefone)
where public.canonicalize_phone_br(telefone) is not null
  and telefone is distinct from public.canonicalize_phone_br(telefone);

update public.contatos
set whatsapp = public.canonicalize_phone_br(whatsapp)
where public.canonicalize_phone_br(whatsapp) is not null
  and whatsapp is distinct from public.canonicalize_phone_br(whatsapp);

update public.leads
set telefone_whatsapp = public.canonicalize_phone_br(telefone_whatsapp)
where public.canonicalize_phone_br(telefone_whatsapp) is not null
  and telefone_whatsapp is distinct from public.canonicalize_phone_br(telefone_whatsapp);

update public.laboratorios_parceiros
set telefone = public.canonicalize_phone_br(telefone)
where public.canonicalize_phone_br(telefone) is not null
  and telefone is distinct from public.canonicalize_phone_br(telefone);

update public.propostas
set solicitante_snapshot_telefone = public.canonicalize_phone_br(solicitante_snapshot_telefone)
where public.canonicalize_phone_br(solicitante_snapshot_telefone) is not null
  and solicitante_snapshot_telefone is distinct from public.canonicalize_phone_br(solicitante_snapshot_telefone);
