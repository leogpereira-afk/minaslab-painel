create table if not exists public.servicos_gerados_grupos_faturamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  cliente_chave text not null,
  cliente_nome text,
  cnpj_cpf text,
  tipo text not null default 'FATURAMENTO' check (tipo in ('FATURAMENTO','OMIE')),
  status text not null default 'ABERTO' check (status in ('ABERTO','FATURADO','CANCELADO')),
  referencia_pagamento text,
  nota_fiscal_id uuid references public.notas_fiscais(id),
  recebimento_id uuid references public.recebimentos(id),
  valor_total numeric(15,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.servicos_gerados_grupos_itens (
  grupo_id uuid not null references public.servicos_gerados_grupos_faturamento(id) on delete cascade,
  servico_id uuid not null references public.servicos_gerados(id) on delete cascade,
  valor numeric(15,2) not null default 0,
  created_at timestamptz not null default now(),
  primary key (grupo_id, servico_id)
);
create unique index if not exists ux_servicos_gerados_grupo_servico_ativo on public.servicos_gerados_grupos_itens(servico_id);
create index if not exists ix_servicos_gerados_grupos_empresa_cliente on public.servicos_gerados_grupos_faturamento(empresa_id,cliente_chave,status);
alter table public.servicos_gerados_grupos_faturamento enable row level security;
alter table public.servicos_gerados_grupos_itens enable row level security;
comment on table public.servicos_gerados_grupos_faturamento is 'Agrupa uma ou mais OS/serviços em um único faturamento, NFS-e ou referência Omie.';
comment on table public.servicos_gerados_grupos_itens is 'Itens/OS pertencentes a um grupo de faturamento.';
