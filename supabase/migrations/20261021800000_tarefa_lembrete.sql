-- Lembrete por tarefa: a pessoa escolhe quanto tempo ANTES do prazo quer ser avisada.
-- Um agendamento a cada 5 minutos coloca o aviso no sino (que apita) do responsável e dos participantes.
-- Cada lembrete é enviado uma vez; mudar o prazo ou o lembrete rearma.

alter table public.ml_tarefas
  add column if not exists lembrete_min integer check (lembrete_min is null or lembrete_min between 0 and 20160),
  add column if not exists lembrete_enviado_em timestamptz;

create index if not exists ml_tarefas_lembrete_idx on public.ml_tarefas (prazo)
  where lembrete_min is not null and lembrete_enviado_em is null and not apagada and status <> 'concluida';

create or replace function public.ml_tarefas_avisar_prazo() returns integer
language plpgsql security definer set search_path = public as $$
declare total integer := 0;
begin
  with devidas as (
    update ml_tarefas t
       set lembrete_enviado_em = now()
     where not t.apagada and t.status <> 'concluida'
       and t.prazo is not null and t.lembrete_min is not null and t.lembrete_enviado_em is null
       and now() >= t.prazo - make_interval(mins => t.lembrete_min)
       and t.prazo > now() - interval '1 day' -- lembrete atrasado demais não vale (ex.: prazo marcado no passado)
    returning t.id, t.titulo, t.prazo, t.responsavel
  ), alvo as (
    select d.id, d.titulo, d.prazo, d.responsavel as usuario from devidas d
    union
    select d.id, d.titulo, d.prazo, p.usuario from devidas d
      join ml_tarefa_pessoas p on p.tarefa_id = d.id and p.papel = 'participante'
  ), gravado as (
    insert into ml_notificacoes (usuario, tipo, titulo, corpo, link, ref_tipo, ref_id)
    select a.usuario, 'tarefa_lembrete',
      case when a.prazo <= now() then 'Prazo da tarefa chegou' else 'Lembrete: prazo se aproxima' end,
      a.titulo || ' — ' || to_char(a.prazo at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
      '/tarefas?abrir=' || a.id, 'tarefa', a.id
    from alvo a join ml_contas c on c.usuario = a.usuario and c.ativo
    returning 1
  )
  select count(*) into total from gravado;
  return total;
end $$;

revoke all on function public.ml_tarefas_avisar_prazo() from public, anon, authenticated;
select cron.schedule('tarefas-avisar-prazo', '*/5 * * * *', 'select public.ml_tarefas_avisar_prazo();');
