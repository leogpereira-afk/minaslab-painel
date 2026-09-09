alter table public.movimentos_bancarios
  add column if not exists classificacao_bancaria text,
  add column if not exists movimento_relacionado_id uuid,
  add column if not exists classificado_em timestamptz,
  add column if not exists classificado_por text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'movimentos_bancarios_classificacao_bancaria_check') then
    alter table public.movimentos_bancarios
      add constraint movimentos_bancarios_classificacao_bancaria_check
      check (classificacao_bancaria is null or classificacao_bancaria in ('MOVIMENTO_INTERNO','ESTORNO','TRANSFERENCIA'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'movimentos_bancarios_movimento_relacionado_id_fkey') then
    alter table public.movimentos_bancarios
      add constraint movimentos_bancarios_movimento_relacionado_id_fkey
      foreign key (movimento_relacionado_id) references public.movimentos_bancarios(id) on delete set null;
  end if;
end $$;

create index if not exists idx_movimentos_bancarios_classificacao on public.movimentos_bancarios(classificacao_bancaria);
create index if not exists idx_movimentos_bancarios_relacionado on public.movimentos_bancarios(movimento_relacionado_id);