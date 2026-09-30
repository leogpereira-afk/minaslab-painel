-- Flexibiliza o formulário real de Coletas para aceitar OS ou proposta.
alter table public.coletas
  add column if not exists proposta_id uuid,
  add column if not exists numero_proposta_referencia text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'coletas_proposta_id_fkey'
      and conrelid = 'public.coletas'::regclass
  ) then
    alter table public.coletas
      add constraint coletas_proposta_id_fkey
      foreign key (proposta_id)
      references public.propostas(id)
      on delete restrict;
  end if;
end
$$;

create index if not exists coletas_proposta_id_idx
  on public.coletas (proposta_id)
  where proposta_id is not null;

create index if not exists coletas_numero_proposta_referencia_idx
  on public.coletas (numero_proposta_referencia)
  where numero_proposta_referencia is not null;
