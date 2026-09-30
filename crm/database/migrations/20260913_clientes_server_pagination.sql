-- Phase 2: server-side list/filter/aggregation for Clientes.
-- SECURITY INVOKER keeps existing RLS authoritative.

create or replace function public.crm_clientes_list(
  p_query text default '',
  p_status text default 'TODOS',
  p_segment text default 'TODOS',
  p_responsible text default 'TODOS',
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
with settings as (
  select
    btrim(coalesce(p_query, '')) as q,
    coalesce(p_status, 'TODOS') as status_filter,
    coalesce(p_segment, 'TODOS') as segment_filter,
    coalesce(p_responsible, 'TODOS') as responsible_filter
),
opp_stats as (
  select o.cliente_id, count(*)::integer as opportunity_count
  from public.oportunidades o
  where o.deleted_at is null
  group by o.cliente_id
),
proposal_stats as (
  select p.cliente_id, count(*)::integer as proposal_count
  from public.propostas p
  where p.deleted_at is null
  group by p.cliente_id
),
last_interaction as (
  select distinct on (i.cliente_id)
    i.cliente_id,
    i.ocorrido_em as last_interaction_at,
    i.tipo as last_interaction_type
  from public.interacoes i
  where i.cliente_id is not null
  order by i.cliente_id, i.ocorrido_em desc
),
base as (
  select
    c.id,c.tipo_pessoa,c.cpf_cnpj_original,c.razao_social,c.nome_fantasia,
    c.telefone_principal,c.email_principal,c.segmento,c.origem,
    c.responsavel_comercial_id,c.status_comercial,c.observacoes_comerciais,
    c.ativo,c.created_at,
    coalesce(os.opportunity_count,0) as opportunity_count,
    coalesce(ps.proposal_count,0) as proposal_count,
    li.last_interaction_at,li.last_interaction_type
  from public.clientes c
  left join opp_stats os on os.cliente_id=c.id
  left join proposal_stats ps on ps.cliente_id=c.id
  left join last_interaction li on li.cliente_id=c.id
  where c.deleted_at is null
),
filtered as (
  select b.*
  from base b cross join settings s
  where
    (s.q='' or position(lower(s.q) in lower(concat_ws(' ',
      coalesce(nullif(b.nome_fantasia,''),b.razao_social),b.razao_social,
      b.cpf_cnpj_original,b.telefone_principal,b.email_principal)))>0)
    and (s.status_filter='TODOS' or b.status_comercial=s.status_filter)
    and (s.segment_filter='TODOS' or b.segmento=s.segment_filter)
    and (s.responsible_filter='TODOS' or b.responsavel_comercial_id::text=s.responsible_filter)
),
paged as (
  select f.*
  from filtered f
  order by f.created_at desc,f.id
  offset ((greatest(coalesce(p_page,1),1)-1) * least(greatest(coalesce(p_page_size,10),1),100))
  limit least(greatest(coalesce(p_page_size,10),1),100)
),
open_opportunities as (
  select count(*)::integer as open_count,
         coalesce(sum(o.valor_estimado),0)::numeric as negotiation_value
  from public.oportunidades o
  where o.deleted_at is null
    and upper(coalesce(o.status,'')) not in ('GANHA','PERDIDA','CANCELADA')
    and upper(coalesce(o.estagio,'')) not in ('GANHO','PERDIDO')
),
all_stats as (
  select
    count(*)::integer as total_clients,
    count(*) filter(where ativo and coalesce(status_comercial,'')<>'CLIENTE INATIVO')::integer as active_clients,
    count(*) filter(where status_comercial='PROSPECT' and ativo)::integer as prospects,
    count(*) filter(where not ativo or status_comercial='CLIENTE INATIVO')::integer as inactive_clients,
    count(*) filter(where last_interaction_at is null)::integer as clients_without_interaction,
    coalesce(jsonb_agg(distinct responsavel_comercial_id) filter(where responsavel_comercial_id is not null),'[]'::jsonb) as responsible_ids
  from base
),
filtered_stats as (select count(*)::integer as total_filtered from filtered)
select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from paged p),'[]'::jsonb),
  'total',fs.total_filtered,
  'stats',jsonb_build_object(
    'totalClients',ast.total_clients,'activeClients',ast.active_clients,'prospects',ast.prospects,
    'inactiveClients',ast.inactive_clients,'openOpportunities',oo.open_count,
    'negotiationValue',oo.negotiation_value,'clientsWithoutInteraction',ast.clients_without_interaction,
    'responsibleIds',ast.responsible_ids))
from all_stats ast cross join filtered_stats fs cross join open_opportunities oo;
$$;

revoke all on function public.crm_clientes_list(text,text,text,text,integer,integer) from public, anon;
grant execute on function public.crm_clientes_list(text,text,text,text,integer,integer) to authenticated, service_role;

create index if not exists clientes_created_at_active_idx
  on public.clientes (created_at desc) where deleted_at is null;
create index if not exists interacoes_cliente_ocorrido_idx
  on public.interacoes (cliente_id, ocorrido_em desc) where cliente_id is not null;
