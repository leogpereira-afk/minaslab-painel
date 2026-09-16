alter table public.movimentos_bancarios
  add column if not exists lote_importacao uuid;

create index if not exists movimentos_bancarios_lote_importacao_idx
  on public.movimentos_bancarios (lote_importacao)
  where lote_importacao is not null;

comment on column public.movimentos_bancarios.lote_importacao is
  'Identificador do lote de importação manual OFX, usado para desfazer a importação com segurança.';
