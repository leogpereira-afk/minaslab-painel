-- Financeiro MinasLab / M Lab — consolidação da base relacional
-- Preserva as coleções fin_* históricas e evolui somente as tabelas financeiras.

create extension if not exists pgcrypto with schema extensions;

alter table public.recebimentos
  add column if not exists status_omie text,
  add column if not exists codigo_lancamento_integracao text,
  add column if not exists numero_parcela text,
  add column if not exists dados_omie jsonb,
  add column if not exists ultimo_evento_omie timestamptz;

alter table public.despesas
  add column if not exists apagado boolean not null default false,
  add column if not exists apagado_em timestamptz,
  add column if not exists apagado_por text,
  add column if not exists created_by text,
  add column if not exists updated_by text,
  add column if not exists categoria_texto text,
  add column if not exists conta_bancaria_texto text,
  add column if not exists importacao_origem text,
  add column if not exists status_omie text,
  add column if not exists codigo_lancamento_integracao text,
  add column if not exists numero_parcela text,
  add column if not exists dados_omie jsonb,
  add column if not exists ultimo_evento_omie timestamptz;

create table if not exists public.formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  nome text not null,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists formas_pagamento_empresa_nome_uq
  on public.formas_pagamento (coalesce(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));

create table if not exists public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nome)
);

alter table public.despesas
  add column if not exists centro_custo_id uuid references public.centros_custo(id);

create table if not exists public.baixas_recebimentos (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null references public.recebimentos(id) on delete cascade,
  valor numeric(14,2) not null check (valor > 0),
  data_pagamento date not null,
  conta_bancaria_id uuid references public.contas_bancarias(id),
  forma_pagamento text,
  observacao text,
  origem text not null default 'MANUAL' check (origem in ('MANUAL','OMIE','CONCILIACAO','IMPORTACAO')),
  id_omie text,
  status_omie text,
  dados_omie jsonb,
  estornada boolean not null default false,
  estornada_em timestamptz,
  estornada_por text,
  created_by text,
  created_at timestamptz not null default now()
);

create unique index if not exists baixas_recebimentos_omie_uq
  on public.baixas_recebimentos (recebimento_id, id_omie)
  where id_omie is not null;
create index if not exists baixas_recebimentos_recebimento_idx on public.baixas_recebimentos(recebimento_id);
create index if not exists baixas_recebimentos_data_idx on public.baixas_recebimentos(data_pagamento);

create table if not exists public.baixas_despesas (
  id uuid primary key default gen_random_uuid(),
  despesa_id uuid not null references public.despesas(id) on delete cascade,
  valor numeric(14,2) not null check (valor > 0),
  data_pagamento date not null,
  conta_bancaria_id uuid references public.contas_bancarias(id),
  forma_pagamento text,
  observacao text,
  origem text not null default 'MANUAL' check (origem in ('MANUAL','OMIE','CONCILIACAO','IMPORTACAO')),
  id_omie text,
  status_omie text,
  dados_omie jsonb,
  estornada boolean not null default false,
  estornada_em timestamptz,
  estornada_por text,
  created_by text,
  created_at timestamptz not null default now()
);

create unique index if not exists baixas_despesas_omie_uq
  on public.baixas_despesas (despesa_id, id_omie)
  where id_omie is not null;
create index if not exists baixas_despesas_despesa_idx on public.baixas_despesas(despesa_id);
create index if not exists baixas_despesas_data_idx on public.baixas_despesas(data_pagamento);

alter table public.notas_fiscais
  add column if not exists email_destino text,
  add column if not exists status_envio text,
  add column if not exists enviado_em timestamptz,
  add column if not exists enviado_por text,
  add column if not exists observacao text,
  add column if not exists apagado boolean not null default false,
  add column if not exists apagado_em timestamptz,
  add column if not exists apagado_por text;

create table if not exists public.log_envios_nf (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid references public.notas_fiscais(id) on delete set null,
  empresa_id uuid references public.empresas(id) on delete set null,
  numero_nf text,
  email_destino text,
  status text not null,
  observacao text,
  anexos jsonb,
  enviado_por text,
  created_at timestamptz not null default now()
);
create index if not exists log_envios_nf_nota_idx on public.log_envios_nf(nota_fiscal_id);
create index if not exists log_envios_nf_created_idx on public.log_envios_nf(created_at desc);

create table if not exists public.regras_categorizacao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  termo text not null,
  tipo_movimento text check (tipo_movimento in ('CREDITO','DEBITO','AMBOS')) default 'AMBOS',
  categoria_id uuid references public.categorias_financeiras(id) on delete set null,
  prioridade integer not null default 100,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists regras_categorizacao_empresa_idx on public.regras_categorizacao(empresa_id, ativa, prioridade);

alter table public.omie_sync
  add column if not exists fonte text,
  add column if not exists cursor jsonb,
  add column if not exists detalhes jsonb;

create index if not exists despesas_categoria_idx on public.despesas(categoria_id);
create index if not exists despesas_conta_idx on public.despesas(conta_bancaria_id);
create index if not exists despesas_centro_custo_idx on public.despesas(centro_custo_id);
create index if not exists despesas_ativos_idx on public.despesas(empresa_id, data_vencimento) where apagado = false;
create index if not exists movimentos_conta_idx on public.movimentos_bancarios(conta_bancaria_id);
create index if not exists notas_recebimento_idx on public.notas_fiscais(recebimento_id);
create index if not exists notas_despesa_idx on public.notas_fiscais(despesa_id);

alter table public.formas_pagamento enable row level security;
alter table public.centros_custo enable row level security;
alter table public.baixas_recebimentos enable row level security;
alter table public.baixas_despesas enable row level security;
alter table public.log_envios_nf enable row level security;
alter table public.regras_categorizacao enable row level security;

-- Seed mínimo de formas de pagamento do legado; sem empresa = disponível às duas empresas.
insert into public.formas_pagamento (empresa_id, nome)
select null, x.nome
from (values ('PIX'), ('BOLETO'), ('TRANSFERÊNCIA'), ('CARTÃO'), ('DINHEIRO'), ('DÉBITO AUTOMÁTICO'), ('OUTROS')) as x(nome)
on conflict do nothing;
