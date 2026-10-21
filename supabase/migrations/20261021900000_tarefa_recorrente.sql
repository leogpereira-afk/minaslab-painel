-- Tarefas recorrentes: uma regra (todo dia, dias úteis, dias da semana, dia do mês) cria uma tarefa nova
-- na hora combinada. Um agendamento a cada 5 minutos confere as regras vencidas e cria as tarefas.
-- A primeira tarefa é criada na hora pela tela; a regra cuida das próximas.
-- Se o sistema ficar parado e perder várias ocorrências, cria só UMA (não enche a lista de atrasadas).

create table if not exists public.ml_tarefa_recorrencias (
  id uuid primary key default gen_random_uuid(),
  criador text not null,
  titulo text not null check (length(btrim(titulo)) > 0),
  descricao text not null default '',
  responsavel text not null,
  participantes text[] not null default '{}',
  observadores text[] not null default '{}',
  urgente boolean not null default false,
  marcadores text[] not null default '{}',
  checklist text[] not null default '{}',
  tipo text not null check (tipo in ('diaria', 'dias_uteis', 'semanal', 'mensal')),
  dias_semana integer[] not null default '{}',   -- 0 = domingo ... 6 = sábado
  dia_mes integer check (dia_mes is null or dia_mes between 1 and 31),
  hora time not null default '08:00',            -- hora (São Paulo) em que a tarefa é criada
  prazo_dias integer not null default 0 check (prazo_dias between 0 and 90), -- prazo: quantos dias depois de criada
  prazo_hora time,                                -- hora do prazo; vazio = sem prazo
  lembrete_min integer check (lembrete_min is null or lembrete_min between 0 and 20160),
  ativa boolean not null default true,
  proxima_em timestamptz,
  ultima_em timestamptz,
  criado_em timestamptz not null default now(),
  check (tipo <> 'semanal' or cardinality(dias_semana) > 0),
  check (tipo <> 'mensal' or dia_mes is not null)
);
create index if not exists ml_tarefa_recorrencias_proxima_idx on public.ml_tarefa_recorrencias (proxima_em) where ativa;
alter table public.ml_tarefa_recorrencias enable row level security;
revoke all on public.ml_tarefa_recorrencias from anon, authenticated;

alter table public.ml_tarefas add column if not exists recorrencia_id uuid references public.ml_tarefa_recorrencias(id) on delete set null;
create index if not exists ml_tarefas_recorrencia_idx on public.ml_tarefas (recorrencia_id) where recorrencia_id is not null;

-- Próxima ocorrência DEPOIS de p_apos (horário de São Paulo). Mês curto: dia 31 vira o último dia do mês.
create or replace function public.ml_recorrencia_proxima(p_tipo text, p_dias_semana integer[], p_dia_mes integer, p_hora time, p_apos timestamptz)
returns timestamptz language plpgsql stable set search_path = public as $$
declare d date := (p_apos at time zone 'America/Sao_Paulo')::date; i integer; dow integer; ult integer; cand timestamptz;
begin
  for i in 0..400 loop
    dow := extract(dow from d)::integer;
    ult := extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::integer;
    if p_tipo = 'diaria'
       or (p_tipo = 'dias_uteis' and dow between 1 and 5)
       or (p_tipo = 'semanal' and dow = any (p_dias_semana))
       or (p_tipo = 'mensal' and extract(day from d)::integer = least(p_dia_mes, ult)) then
      cand := (d + p_hora) at time zone 'America/Sao_Paulo';
      if cand > p_apos then return cand; end if;
    end if;
    d := d + 1;
  end loop;
  return null;
end $$;
revoke all on function public.ml_recorrencia_proxima(text, integer[], integer, time, timestamptz) from public, anon, authenticated;
grant execute on function public.ml_recorrencia_proxima(text, integer[], integer, time, timestamptz) to service_role;

create or replace function public.ml_tarefas_gerar_recorrentes() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; total integer := 0; tid uuid; dia date; prazo timestamptz; u text; item text; n integer;
begin
  for r in select * from ml_tarefa_recorrencias where ativa and proxima_em is not null and proxima_em <= now() order by proxima_em for update skip locked loop
    -- Responsável que saiu do sistema: pausa a regra em vez de criar tarefa para ninguém.
    if not exists (select 1 from ml_contas where usuario = r.responsavel and ativo) then
      update ml_tarefa_recorrencias set ativa = false where id = r.id;
      continue;
    end if;
    dia := (r.proxima_em at time zone 'America/Sao_Paulo')::date;
    prazo := case when r.prazo_hora is null then null else ((dia + r.prazo_dias) + r.prazo_hora) at time zone 'America/Sao_Paulo' end;
    insert into ml_tarefas (titulo, descricao, proprietario, responsavel, prazo, urgente, marcadores, lembrete_min, recorrencia_id)
    values (r.titulo, r.descricao, r.criador, r.responsavel, prazo, r.urgente, r.marcadores, case when prazo is null then null else r.lembrete_min end, r.id)
    returning id into tid;

    for u in select x from unnest(r.participantes) x where x <> r.responsavel and x <> r.criador and exists (select 1 from ml_contas where usuario = x and ativo) loop
      insert into ml_tarefa_pessoas (tarefa_id, usuario, papel) values (tid, u, 'participante') on conflict do nothing;
    end loop;
    for u in select x from unnest(r.observadores) x where x <> r.responsavel and x <> r.criador and not (x = any (r.participantes)) and exists (select 1 from ml_contas where usuario = x and ativo) loop
      insert into ml_tarefa_pessoas (tarefa_id, usuario, papel) values (tid, u, 'observador') on conflict do nothing;
    end loop;
    n := 0;
    foreach item in array r.checklist loop
      insert into ml_tarefa_checklist (tarefa_id, texto, ordem) values (tid, item, n);
      n := n + 1;
    end loop;
    insert into ml_tarefa_mensagens (tarefa_id, autor, tipo, texto) values (tid, null, 'sistema', 'Tarefa criada automaticamente pela repetição.');

    insert into ml_notificacoes (usuario, tipo, titulo, corpo, link, ref_tipo, ref_id)
    select x, 'tarefa_nova', 'Nova tarefa para você', r.titulo, '/tarefas?abrir=' || tid, 'tarefa', tid
    from (select r.responsavel as x union select y from unnest(r.participantes || r.observadores) y) q
    where x <> r.criador and exists (select 1 from ml_contas where usuario = x and ativo);

    update ml_tarefa_recorrencias
       set ultima_em = now(), proxima_em = ml_recorrencia_proxima(tipo, dias_semana, dia_mes, hora, now())
     where id = r.id;
    total := total + 1;
  end loop;
  return total;
end $$;

revoke all on function public.ml_tarefas_gerar_recorrentes() from public, anon, authenticated;
select cron.schedule('tarefas-gerar-recorrentes', '*/5 * * * *', 'select public.ml_tarefas_gerar_recorrentes();');
