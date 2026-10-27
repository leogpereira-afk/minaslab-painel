-- Histórico de revisões de propostas (versões do GerenciaLab).
-- Cada linha é uma versão; a versão vigente fica marcada com atual = true
-- e é a que está refletida em public.propostas.

create table if not exists public.proposta_revisoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id) on delete cascade,
  numero_proposta text not null,
  versao integer not null,
  gerencialab_id integer,
  status_gerencialab text,
  status text,
  responsavel_id uuid references public.profiles(id),
  responsavel_nome text,
  cliente_documento text,
  cliente_nome text,
  solicitante text,
  valor numeric(14,2),
  data_criacao date,
  data_validade date,
  data_aceite timestamptz,
  grupos text[] not null default '{}',
  atual boolean not null default false,
  observacoes text,
  source_system text not null default 'GERENCIALAB',
  importacao_id uuid references public.importacoes(id),
  created_at timestamptz not null default now(),
  created_by uuid
);

create unique index if not exists proposta_revisoes_gerencialab_id_uq
  on public.proposta_revisoes (gerencialab_id) where gerencialab_id is not null;
create index if not exists proposta_revisoes_proposta_idx
  on public.proposta_revisoes (proposta_id, versao);

alter table public.proposta_revisoes enable row level security;

drop policy if exists proposta_revisoes_select on public.proposta_revisoes;
create policy proposta_revisoes_select on public.proposta_revisoes
  for select to authenticated
  using ((select has_permission('crm.read')));

drop policy if exists proposta_revisoes_insert on public.proposta_revisoes;
create policy proposta_revisoes_insert on public.proposta_revisoes
  for insert to authenticated
  with check (has_permission('crm.write'));

drop policy if exists proposta_revisoes_update on public.proposta_revisoes;
create policy proposta_revisoes_update on public.proposta_revisoes
  for update to authenticated
  using (has_permission('crm.write'))
  with check (has_permission('crm.write'));

comment on table public.proposta_revisoes is 'Histórico de versões (revisões) das propostas importadas do GerenciaLab.';
