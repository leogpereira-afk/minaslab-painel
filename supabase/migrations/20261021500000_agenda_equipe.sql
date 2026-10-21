-- Calendário da equipe: treinamentos, reuniões, férias e ausências com responsável, visíveis para quem participa (ou para todos).
-- Quem acessa é só a edge function ml-agenda (service role): RLS ligado e nenhuma política.

create table if not exists public.ml_agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('treinamento', 'reuniao', 'ferias', 'ausencia', 'evento')),
  titulo text not null check (length(btrim(titulo)) > 0),
  descricao text not null default '',
  local text not null default '',
  dia_inicio date not null,
  dia_fim date not null,                 -- inclusive; igual ao início em evento de um dia só
  hora_inicio time,                      -- vazio = dia inteiro
  hora_fim time,
  para_todos boolean not null default false,
  criador text not null,
  cancelado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (dia_fim >= dia_inicio),
  check (hora_fim is null or hora_inicio is not null)
);
create index if not exists ml_agenda_eventos_dias_idx on public.ml_agenda_eventos (dia_inicio, dia_fim) where not cancelado;

-- Quem está ligado ao evento: participante (convidado), ausente (quem está de férias/ausente) e responsável (quem responde no lugar).
create table if not exists public.ml_agenda_pessoas (
  evento_id uuid not null references public.ml_agenda_eventos(id) on delete cascade,
  usuario text not null,
  papel text not null check (papel in ('participante', 'ausente', 'responsavel')),
  primary key (evento_id, usuario, papel)
);
create index if not exists ml_agenda_pessoas_usuario_idx on public.ml_agenda_pessoas (usuario);

-- Lembrete do dia: um aviso por pessoa, por evento e por dia (não repete se a rotina rodar duas vezes).
create table if not exists public.ml_agenda_avisos (
  evento_id uuid not null references public.ml_agenda_eventos(id) on delete cascade,
  usuario text not null,
  dia date not null,
  primary key (evento_id, usuario, dia)
);

alter table public.ml_agenda_eventos enable row level security;
alter table public.ml_agenda_pessoas enable row level security;
alter table public.ml_agenda_avisos enable row level security;
revoke all on public.ml_agenda_eventos, public.ml_agenda_pessoas, public.ml_agenda_avisos from anon, authenticated;

-- Todo dia às 8h (horário de São Paulo = 11h UTC): avisa no sino quem tem treinamento/reunião/evento hoje,
-- e o responsável de quem entra de férias ou ausência hoje.
create or replace function public.ml_agenda_avisar_hoje()
returns integer language plpgsql security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  total integer := 0;
begin
  with alvo as (
    select e.id as evento_id, e.tipo, e.titulo, e.hora_inicio, e.dia_inicio, p.usuario, p.papel
    from ml_agenda_eventos e
    join ml_agenda_pessoas p on p.evento_id = e.id
    where not e.cancelado and e.dia_inicio = hoje
      and ((e.tipo in ('treinamento', 'reuniao', 'evento') and p.papel = 'participante')
        or (e.tipo in ('ferias', 'ausencia') and p.papel = 'responsavel'))
    union
    select e.id, e.tipo, e.titulo, e.hora_inicio, e.dia_inicio, c.usuario, 'participante'
    from ml_agenda_eventos e
    cross join (select usuario from ml_contas where ativo) c
    where not e.cancelado and e.para_todos and e.dia_inicio = hoje and e.tipo in ('treinamento', 'reuniao', 'evento')
  ), novos as (
    insert into ml_agenda_avisos (evento_id, usuario, dia)
    select a.evento_id, a.usuario, hoje from alvo a
    join ml_contas c on c.usuario = a.usuario and c.ativo
    on conflict do nothing
    returning evento_id, usuario
  ), gravado as (
    insert into ml_notificacoes (usuario, tipo, titulo, corpo, link, ref_tipo, ref_id)
    select n.usuario, 'agenda',
      case when a.tipo in ('ferias', 'ausencia') then 'Hoje você responde por uma ausência' else 'Hoje: ' || a.titulo end,
      case when a.tipo in ('ferias', 'ausencia') then a.titulo else coalesce('às ' || to_char(a.hora_inicio, 'HH24:MI'), 'o dia todo') end,
      '/calendario?dia=' || to_char(hoje, 'YYYY-MM-DD'), 'agenda', n.evento_id
    from novos n join (select distinct on (evento_id, usuario) * from alvo) a on a.evento_id = n.evento_id and a.usuario = n.usuario
    returning 1
  )
  select count(*) into total from gravado;
  return total;
end $$;

revoke all on function public.ml_agenda_avisar_hoje() from public, anon, authenticated;
select cron.schedule('agenda-equipe-avisar-hoje', '0 11 * * *', 'select public.ml_agenda_avisar_hoje();');
