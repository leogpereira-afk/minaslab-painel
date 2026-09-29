-- Permite que uma mesma pessoa represente várias empresas sem duplicar o contato.
create table if not exists public.contato_empresas (
  contato_id uuid not null references public.contatos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  principal boolean not null default false,
  origem text not null default 'CRM',
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id),
  primary key (contato_id, cliente_id)
);

create index if not exists contato_empresas_cliente_idx on public.contato_empresas(cliente_id);
create index if not exists contato_empresas_contato_idx on public.contato_empresas(contato_id);

insert into public.contato_empresas (contato_id, cliente_id, principal, origem, created_by)
select id, cliente_id, coalesce(principal,false), 'CADASTRO_EXISTENTE', created_by
from public.contatos
where deleted_at is null
on conflict (contato_id, cliente_id) do update
set principal = excluded.principal;

alter table public.contato_empresas enable row level security;

drop policy if exists contato_empresas_select on public.contato_empresas;
create policy contato_empresas_select on public.contato_empresas
for select using (public.has_permission('crm.read'));

drop policy if exists contato_empresas_insert on public.contato_empresas;
create policy contato_empresas_insert on public.contato_empresas
for insert with check (public.has_permission('crm.write'));

drop policy if exists contato_empresas_update on public.contato_empresas;
create policy contato_empresas_update on public.contato_empresas
for update using (public.has_permission('crm.write'))
with check (public.has_permission('crm.write'));

drop policy if exists contato_empresas_delete on public.contato_empresas;
create policy contato_empresas_delete on public.contato_empresas
for delete using (public.has_permission('crm.write'));

comment on table public.contato_empresas is 'Vínculos de um contato/solicitante com uma ou mais empresas.';
