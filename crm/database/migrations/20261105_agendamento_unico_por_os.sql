-- Agenda/Coletas: o agendamento é por OS, não por amostra.
-- A tela de Coletas criava um agendamento (e um evento no Google) para cada coleta lançada; várias OS ficaram
-- com um agendamento por amostra/ponto. Aqui: (1) junta os existentes em um agendamento e uma coleta por OS
-- (mantendo VIAGEM/COMPOSTA e os km lançados) e (2) impede um segundo agendamento/coleta para a mesma OS.

-- Chave da OS: id da OS; senão o número digitado, ligado à OS cadastrada quando existir.
create or replace function public.os_chave(p_os uuid, p_ref text)
returns text language sql stable set search_path = public as $$
  select coalesce(p_os::text,
    (select o.id::text from public.ordens_servico o
      where o.deleted_at is null and upper(btrim(o.numero_os)) = upper(btrim(p_ref)) order by o.created_at limit 1),
    case when btrim(coalesce(p_ref,'')) ~ '\d' then upper(btrim(p_ref)) end)
$$;

create or replace function public.agendamento_os_unico()
returns trigger language plpgsql set search_path = public as $$
declare k text; v record;
begin
  if new.deleted_at is not null then return new; end if;
  -- Número digitado que é de uma OS cadastrada: liga à OS.
  if new.ordem_servico_id is null and new.numero_os_referencia is not null then
    select o.id into new.ordem_servico_id from public.ordens_servico o
     where o.deleted_at is null and upper(btrim(o.numero_os)) = upper(btrim(new.numero_os_referencia)) order by o.created_at limit 1;
  end if;
  k := public.os_chave(new.ordem_servico_id, new.numero_os_referencia);
  if k is null then return new; end if;
  select a.id, a.inicio into v from public.agendamentos a
   where a.deleted_at is null and a.id <> new.id and public.os_chave(a.ordem_servico_id, a.numero_os_referencia) = k limit 1;
  if found then
    raise exception 'Esta OS já tem agendamento (%). O agendamento é por OS: edite o existente.',
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
   where c.deleted_at is null and c.id <> new.id and public.os_chave(c.ordem_servico_id, c.numero_os_referencia) = k limit 1;
  if found then
    raise exception 'Esta OS já tem coleta registrada (%). A coleta é por OS: edite a existente.',
      to_char(v.ocorrida_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') using errcode = 'unique_violation';
  end if;
  return new;
end $$;

revoke execute on function public.agendamento_os_unico() from public, anon, authenticated;
revoke execute on function public.coleta_os_unica() from public, anon, authenticated;

create index if not exists agendamentos_os_ativos_idx on public.agendamentos (ordem_servico_id) where deleted_at is null;
create index if not exists coletas_os_ativas_idx on public.coletas (ordem_servico_id) where deleted_at is null;

-- Dois agendamentos/coletas de outubro estavam com o nº da proposta no campo da OS.
update public.agendamentos a set numero_os_referencia = x.os, ordem_servico_id = o.id
  from (values ('00000913/2026','OS01581/2026'), ('00000740/2026','OS01593/2026')) x(errado, os)
  join public.ordens_servico o on o.numero_os = x.os and o.deleted_at is null
 where a.deleted_at is null and a.numero_os_referencia = x.errado and a.cliente_id = o.cliente_id;
update public.coletas c set numero_os_referencia = x.os, ordem_servico_id = o.id
  from (values ('00000913/2026','OS01581/2026'), ('00000740/2026','OS01593/2026')) x(errado, os)
  join public.ordens_servico o on o.numero_os = x.os and o.deleted_at is null
 where c.deleted_at is null and c.numero_os_referencia = x.errado and c.cliente_id = o.cliente_id;

-- Número digitado de OS cadastrada: liga à OS.
update public.agendamentos a set ordem_servico_id = o.id from public.ordens_servico o
 where a.deleted_at is null and a.ordem_servico_id is null and o.deleted_at is null and upper(btrim(o.numero_os)) = upper(btrim(a.numero_os_referencia));
update public.coletas c set ordem_servico_id = o.id from public.ordens_servico o
 where c.deleted_at is null and c.ordem_servico_id is null and o.deleted_at is null and upper(btrim(o.numero_os)) = upper(btrim(c.numero_os_referencia));

-- Junta: um agendamento e uma coleta por OS. Grupos espalhados por mais de 7 dias ficam para conferência manual.
do $m$
declare g record; keep uuid; ck uuid; n_ag int := 0; n_col int := 0;
begin
  for g in
    select k, array_agg(id order by (ordem_servico_id is not null) desc, (external_calendar_id is not null) desc, inicio, created_at) ids
      from (select a.*, public.os_chave(a.ordem_servico_id, a.numero_os_referencia) k from public.agendamentos a where a.deleted_at is null) a
     where k is not null
     group by k having count(*) > 1 and max(inicio) - min(inicio) <= interval '7 days'
  loop
    keep := g.ids[1];
    -- Agendamento que fica: do primeiro ao último horário; realizado se algum foi realizado.
    update public.agendamentos a set
      inicio = s.i0, fim = greatest(s.f1, s.i0 + interval '1 hour'),
      status = case when s.realizado then 'REALIZADO' else a.status end,
      descricao = nullif(s.descr, ''),
      updated_at = now()
      from (select min(inicio) i0, max(coalesce(fim, inicio + interval '1 hour')) f1, bool_or(status = 'REALIZADO') realizado,
                   string_agg(distinct nullif(btrim(descricao), ''), ' | ') descr
              from public.agendamentos where id = any(g.ids)) s
     where a.id = keep;
    update public.agendamentos set deleted_at = now(), updated_at = now() where id = any(g.ids) and id <> keep;
    n_ag := n_ag + array_length(g.ids, 1) - 1;
    update public.recorrencias_clientes set agendamento_id = keep where agendamento_id = any(g.ids) and agendamento_id <> keep;
    update public.coletas set agendamento_id = keep where deleted_at is null and agendamento_id = any(g.ids);
  end loop;

  -- Coletas: uma por OS. Fica a que tem VIAGEM/COMPOSTA (senão a primeira), com o maior km lançado.
  for g in
    select k, array_agg(id order by case tipo_pagamento when 'VIAGEM' then 0 when 'COMPOSTA' then 1 else 2 end, ocorrida_em, created_at) ids
      from (select c.*, public.os_chave(c.ordem_servico_id, c.numero_os_referencia) k from public.coletas c where c.deleted_at is null) c
     where k is not null
     group by k having count(*) > 1 and max(ocorrida_em) - min(ocorrida_em) <= interval '7 days'
  loop
    ck := g.ids[1];
    update public.coletas c set
      ocorrida_em = s.o0,
      status = case when s.coletada then 'COLETADA' else c.status end,
      km_viagem = coalesce(c.km_viagem, s.km),
      observacoes = nullif(s.obs, ''),
      agendamento_id = coalesce(c.agendamento_id, s.ag),
      updated_at = now()
      from (select min(ocorrida_em) o0, bool_or(status = 'COLETADA') coletada, max(km_viagem) km,
                   string_agg(distinct nullif(btrim(observacoes), ''), ' | ') obs, (array_agg(agendamento_id) filter (where agendamento_id is not null))[1] ag
              from public.coletas where id = any(g.ids)) s
     where c.id = ck;
    update public.coletas set deleted_at = now(), updated_at = now() where id = any(g.ids) and id <> ck;
    n_col := n_col + array_length(g.ids, 1) - 1;
  end loop;
  raise notice 'agendamentos removidos: %, coletas juntadas: %', n_ag, n_col;
end $m$;

drop trigger if exists trg_agendamento_os_unico on public.agendamentos;
create trigger trg_agendamento_os_unico before insert or update of ordem_servico_id, numero_os_referencia, deleted_at on public.agendamentos
  for each row execute function public.agendamento_os_unico();
drop trigger if exists trg_coleta_os_unica on public.coletas;
create trigger trg_coleta_os_unica before insert or update of ordem_servico_id, numero_os_referencia, deleted_at on public.coletas
  for each row execute function public.coleta_os_unica();
