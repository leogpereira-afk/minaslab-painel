-- Permite propostas sem vínculo obrigatório com uma oportunidade.
alter table public.propostas
  alter column oportunidade_id drop not null;

-- Permite que o agendamento seja vinculado a uma proposta cadastrada
-- ou preserve um número de proposta digitado manualmente.
alter table public.agendamentos
  add column if not exists proposta_id uuid,
  add column if not exists numero_proposta_referencia text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agendamentos_proposta_id_fkey'
      and conrelid = 'public.agendamentos'::regclass
  ) then
    alter table public.agendamentos
      add constraint agendamentos_proposta_id_fkey
      foreign key (proposta_id)
      references public.propostas(id)
      on delete restrict;
  end if;
end
$$;

create index if not exists agendamentos_proposta_id_idx
  on public.agendamentos (proposta_id)
  where proposta_id is not null;

create index if not exists agendamentos_numero_proposta_referencia_idx
  on public.agendamentos (numero_proposta_referencia)
  where numero_proposta_referencia is not null;
