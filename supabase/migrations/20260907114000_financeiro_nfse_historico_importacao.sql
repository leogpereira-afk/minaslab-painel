-- Importação histórica das NFS-e emitidas pela M Lab no Portal Nacional.
alter table public.notas_fiscais
  add column if not exists importacao_origem text;

create unique index if not exists notas_fiscais_empresa_chave_uq
  on public.notas_fiscais(empresa_id, chave_acesso)
  where chave_acesso is not null and apagado=false;

create table if not exists public.nfse_importacoes_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  origem text not null default 'PORTAL_NFSE_NACIONAL',
  total_arquivos integer not null default 0,
  novas integer not null default 0,
  existentes integer not null default 0,
  cancelamentos integer not null default 0,
  ignoradas integer not null default 0,
  detalhes jsonb,
  criado_por text,
  created_at timestamptz not null default now()
);

alter table public.nfse_importacoes_historico enable row level security;

create index if not exists notas_fiscais_importacao_origem_idx
  on public.notas_fiscais(importacao_origem)
  where importacao_origem is not null;

create index if not exists nfse_importacoes_historico_empresa_idx
  on public.nfse_importacoes_historico(empresa_id, created_at desc);
