alter table public.oportunidades
  add column if not exists numero_proposta_gerencialab text;

create index if not exists oportunidades_numero_proposta_gerencialab_idx
  on public.oportunidades (numero_proposta_gerencialab)
  where deleted_at is null and numero_proposta_gerencialab is not null;

comment on column public.oportunidades.numero_proposta_gerencialab is
  'Número da proposta digitado pelo operador conforme o GerenciaLab.';