-- Licitações: registro das consultas às fontes (ex.: "SAAE Bocaiúva — 30/10/2026 — Sem licitação")
-- e data da consulta no cadastro da licitação.

create table if not exists public.licitacao_consultas (
  id uuid primary key default gen_random_uuid(),
  fonte text not null,
  fonte_url text,
  data_consulta date not null default (timezone('America/Sao_Paulo', now()))::date,
  status text not null check (status in ('VERIFICADO','SEM_LICITACAO')),
  observacao text,
  licitacao_id uuid references public.licitacoes(id) on delete set null,
  responsavel_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists licitacao_consultas_fonte_data_idx on public.licitacao_consultas (fonte, data_consulta desc);

alter table public.licitacao_consultas enable row level security;
drop policy if exists licitacao_consultas_read on public.licitacao_consultas;
create policy licitacao_consultas_read on public.licitacao_consultas for select to authenticated using ((select has_permission('crm.read')));
drop policy if exists licitacao_consultas_insert on public.licitacao_consultas;
create policy licitacao_consultas_insert on public.licitacao_consultas for insert to authenticated with check (has_permission('crm.write'));
drop policy if exists licitacao_consultas_update on public.licitacao_consultas;
create policy licitacao_consultas_update on public.licitacao_consultas for update to authenticated using (has_permission('crm.write')) with check (has_permission('crm.write'));
drop policy if exists licitacao_consultas_delete on public.licitacao_consultas;
create policy licitacao_consultas_delete on public.licitacao_consultas for delete to authenticated using (has_permission('crm.write'));

alter table public.licitacoes add column if not exists data_consulta date;
comment on column public.licitacoes.data_consulta is 'Data em que a licitação foi consultada/encontrada na fonte.';
