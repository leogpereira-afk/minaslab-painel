-- Phase 2: add a real UUID relationship from contratos to propostas while preserving
-- proposta_origem_referencia as the legacy/manual display reference.

alter table public.contratos
  add column if not exists proposta_origem_id uuid;

update public.contratos c
set proposta_origem_id = p.id
from public.propostas p
where c.proposta_origem_id is null
  and c.proposta_origem_referencia is not null
  and btrim(c.proposta_origem_referencia) <> ''
  and p.deleted_at is null
  and p.numero_proposta is not null
  and btrim(p.numero_proposta) = btrim(c.proposta_origem_referencia)
  and not exists (
    select 1
    from public.propostas p2
    where p2.deleted_at is null
      and p2.id <> p.id
      and p2.numero_proposta is not null
      and btrim(p2.numero_proposta) = btrim(c.proposta_origem_referencia)
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contratos_proposta_origem_id_fkey'
      and conrelid = 'public.contratos'::regclass
  ) then
    alter table public.contratos
      add constraint contratos_proposta_origem_id_fkey
      foreign key (proposta_origem_id)
      references public.propostas(id)
      on delete set null;
  end if;
end
$$;

create index if not exists contratos_proposta_origem_id_idx
  on public.contratos (proposta_origem_id)
  where proposta_origem_id is not null;

create or replace function public.sync_contrato_proposta_origem_id()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_proposta_id uuid;
begin
  if new.proposta_origem_referencia is null
     or btrim(new.proposta_origem_referencia) = '' then
    new.proposta_origem_id := null;
    return new;
  end if;

  select p.id
    into v_proposta_id
  from public.propostas p
  where p.deleted_at is null
    and p.numero_proposta is not null
    and btrim(p.numero_proposta) = btrim(new.proposta_origem_referencia)
    and not exists (
      select 1
      from public.propostas p2
      where p2.deleted_at is null
        and p2.id <> p.id
        and p2.numero_proposta is not null
        and btrim(p2.numero_proposta) = btrim(new.proposta_origem_referencia)
    )
  limit 1;

  new.proposta_origem_id := v_proposta_id;
  return new;
end;
$$;

drop trigger if exists trg_contratos_sync_proposta_origem_id on public.contratos;
create trigger trg_contratos_sync_proposta_origem_id
before insert or update of proposta_origem_referencia on public.contratos
for each row
execute function public.sync_contrato_proposta_origem_id();
