-- Ajuste da regra "um agendamento por OS": há OS com coleta em mais de um dia (ex.: Fazenda Tamanduá, 3 dias).
-- Regra agora: um agendamento e uma coleta por OS em cada dia.

create or replace function public.agendamento_os_unico()
returns trigger language plpgsql set search_path = public as $$
declare k text; v record;
begin
  if new.deleted_at is not null then return new; end if;
  if new.ordem_servico_id is null and new.numero_os_referencia is not null then
    select o.id into new.ordem_servico_id from public.ordens_servico o
     where o.deleted_at is null and upper(btrim(o.numero_os)) = upper(btrim(new.numero_os_referencia)) order by o.created_at limit 1;
  end if;
  k := public.os_chave(new.ordem_servico_id, new.numero_os_referencia);
  if k is null then return new; end if;
  select a.id, a.inicio into v from public.agendamentos a
   where a.deleted_at is null and a.id <> new.id and public.os_chave(a.ordem_servico_id, a.numero_os_referencia) = k
     and (a.inicio at time zone 'America/Sao_Paulo')::date = (new.inicio at time zone 'America/Sao_Paulo')::date limit 1;
  if found then
    raise exception 'Esta OS já tem agendamento neste dia (%). O agendamento é por OS: edite o existente.',
      to_char(v.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') using errcode = 'unique_violation';
  end if;
  return new;
end $$;

create or replace function public.coleta_os_unica()
returns trigger language plpgsql set search_path = public as $$
declare k text; v record;
begin
  if new.deleted_at is not null then return new; end if;
  if new.ordem_servico_id is null and new.numero_os_referencia is not null then
    select o.id into new.ordem_servico_id from public.ordens_servico o
     where o.deleted_at is null and upper(btrim(o.numero_os)) = upper(btrim(new.numero_os_referencia)) order by o.created_at limit 1;
  end if;
  k := public.os_chave(new.ordem_servico_id, new.numero_os_referencia);
  if k is null then return new; end if;
  select c.id, c.ocorrida_em into v from public.coletas c
   where c.deleted_at is null and c.id <> new.id and public.os_chave(c.ordem_servico_id, c.numero_os_referencia) = k
     and (c.ocorrida_em at time zone 'America/Sao_Paulo')::date = (new.ocorrida_em at time zone 'America/Sao_Paulo')::date limit 1;
  if found then
    raise exception 'Esta OS já tem coleta registrada neste dia (%). A coleta é por OS: edite a existente.',
      to_char(v.ocorrida_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') using errcode = 'unique_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_agendamento_os_unico on public.agendamentos;
create trigger trg_agendamento_os_unico before insert or update of ordem_servico_id, numero_os_referencia, deleted_at, inicio on public.agendamentos
  for each row execute function public.agendamento_os_unico();
drop trigger if exists trg_coleta_os_unica on public.coletas;
create trigger trg_coleta_os_unica before insert or update of ordem_servico_id, numero_os_referencia, deleted_at, ocorrida_em on public.coletas
  for each row execute function public.coleta_os_unica();

-- Volta um agendamento e uma coleta por dia nas OS de vários dias que foram juntadas (OS00764, 00765, 00795, 00921, 00998, 01059).
do $m$
declare r record; n_ag int := 0; n_col int := 0;
begin
  for r in
    select distinct on (d.k, d.dia) d.id
      from (select a.id, a.inicio, a.created_at, public.os_chave(a.ordem_servico_id, a.numero_os_referencia) k,
                   (a.inicio at time zone 'America/Sao_Paulo')::date dia
              from public.agendamentos a where a.deleted_at >= '2026-11-05 18:30+00') d
     where exists (select 1 from public.agendamentos x where x.deleted_at is null
                     and public.os_chave(x.ordem_servico_id, x.numero_os_referencia) = d.k
                     and (x.inicio at time zone 'America/Sao_Paulo')::date <> d.dia)
       and not exists (select 1 from public.agendamentos x where x.deleted_at is null
                     and public.os_chave(x.ordem_servico_id, x.numero_os_referencia) = d.k
                     and (x.inicio at time zone 'America/Sao_Paulo')::date = d.dia)
     order by d.k, d.dia, d.inicio, d.created_at
  loop
    update public.agendamentos set deleted_at = null, updated_at = now() where id = r.id;
    n_ag := n_ag + 1;
  end loop;
  -- O agendamento que ficou volta a ocupar só o próprio dia.
  update public.agendamentos set fim = inicio + interval '1 hour', updated_at = now()
   where deleted_at is null and (fim at time zone 'America/Sao_Paulo')::date > (inicio at time zone 'America/Sao_Paulo')::date
     and updated_at >= '2026-11-05 18:30+00';

  for r in
    select distinct on (d.k, d.dia) d.id
      from (select c.id, c.ocorrida_em, c.created_at, public.os_chave(c.ordem_servico_id, c.numero_os_referencia) k,
                   (c.ocorrida_em at time zone 'America/Sao_Paulo')::date dia
              from public.coletas c where c.deleted_at >= '2026-11-05 18:30+00') d
     where exists (select 1 from public.coletas x where x.deleted_at is null
                     and public.os_chave(x.ordem_servico_id, x.numero_os_referencia) = d.k
                     and (x.ocorrida_em at time zone 'America/Sao_Paulo')::date <> d.dia)
       and not exists (select 1 from public.coletas x where x.deleted_at is null
                     and public.os_chave(x.ordem_servico_id, x.numero_os_referencia) = d.k
                     and (x.ocorrida_em at time zone 'America/Sao_Paulo')::date = d.dia)
     order by d.k, d.dia, d.ocorrida_em, d.created_at
  loop
    update public.coletas set deleted_at = null, updated_at = now() where id = r.id;
    n_col := n_col + 1;
  end loop;
  -- Cada coleta aponta para o agendamento do seu dia.
  update public.coletas c set agendamento_id = a.id
    from public.agendamentos a
   where c.deleted_at is null and a.deleted_at is null and c.ordem_servico_id is not null and a.ordem_servico_id = c.ordem_servico_id
     and (a.inicio at time zone 'America/Sao_Paulo')::date = (c.ocorrida_em at time zone 'America/Sao_Paulo')::date
     and c.agendamento_id is distinct from a.id;
  raise notice 'agendamentos restaurados: %, coletas restauradas: %', n_ag, n_col;
end $m$;

-- OS00997 (Fazenda Tamanduá): coleta em 3 dias; "07/06" era 07/07. Fica um agendamento por dia.
do $m$
declare v_os uuid := (select id from public.ordens_servico where numero_os = 'OS00997/2026' and deleted_at is null limit 1);
begin
  if v_os is null then return; end if;
  -- Primeiro retira os repetidos do mesmo dia (fica o que tem coleta/evento).
  update public.agendamentos a set deleted_at = now(), updated_at = now()
   where a.id in (
     select id from (select a2.id, row_number() over (partition by (a2.inicio at time zone 'America/Sao_Paulo')::date
                       order by (exists (select 1 from public.coletas c where c.agendamento_id = a2.id and c.deleted_at is null)) desc,
                                (a2.external_calendar_id is not null) desc, a2.created_at) rn
                       from public.agendamentos a2 where a2.deleted_at is null and a2.ordem_servico_id = v_os) z where rn > 1);
  update public.agendamentos set inicio = inicio + interval '30 days', fim = fim + interval '30 days', updated_at = now()
   where deleted_at is null and ordem_servico_id = v_os and (inicio at time zone 'America/Sao_Paulo')::date = date '2026-06-07';
  update public.coletas set ocorrida_em = ocorrida_em + interval '30 days', updated_at = now()
   where deleted_at is null and ordem_servico_id = v_os and (ocorrida_em at time zone 'America/Sao_Paulo')::date = date '2026-06-07';
end $m$;

-- OS00809 (C&A Loja 5): sai o agendamento de outubro (e a coleta dele); em 01/06 fica um só.
do $m$
declare v_os uuid := (select id from public.ordens_servico where numero_os = 'OS00809/2026' and deleted_at is null limit 1);
begin
  if v_os is null then return; end if;
  update public.coletas set deleted_at = now(), updated_at = now()
   where deleted_at is null and ordem_servico_id = v_os and ocorrida_em >= '2026-10-01 03:00+00';
  update public.agendamentos set deleted_at = now(), updated_at = now()
   where deleted_at is null and ordem_servico_id = v_os and inicio >= '2026-10-01 03:00+00';
  update public.agendamentos a set deleted_at = now(), updated_at = now()
   where a.id in (
     select id from (select a2.id, row_number() over (partition by (a2.inicio at time zone 'America/Sao_Paulo')::date
                       order by (exists (select 1 from public.coletas c where c.agendamento_id = a2.id and c.deleted_at is null)) desc,
                                (a2.external_calendar_id is not null) desc, a2.created_at) rn
                       from public.agendamentos a2 where a2.deleted_at is null and a2.ordem_servico_id = v_os) z where rn > 1);
end $m$;
