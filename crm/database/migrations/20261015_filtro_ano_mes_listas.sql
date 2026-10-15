-- Filtro de Ano/Mês nas listas paginadas no banco (Propostas, Oportunidades,
-- Clientes) e "Sem responsável" em Propostas. Os indicadores (stats) passam a
-- respeitar o ano/mês escolhido; sem ano/mês, continuam sobre tudo.
-- Datas de referência (fuso America/Sao_Paulo):
--   propostas     -> data de envio (ou criação, se não enviada)
--   oportunidades -> criação
--   clientes      -> cadastro
-- Versões _v2 criadas ao lado das originais (sem apagar nada); a tela usa as _v2.
-- Correção: o período "Este mês/Este ano" de Propostas usava updated_at.

create function public.crm_propostas_list_v2(
  p_query text default ''::text, p_status text default 'TODOS'::text, p_responsible text default 'TODOS'::text,
  p_period text default 'TODOS'::text, p_validity text default 'TODAS'::text, p_page integer default 1,
  p_page_size integer default 10, p_year integer default null, p_month integer default null)
returns jsonb language sql stable set search_path to 'pg_catalog', 'public'
as $function$
with settings as (
  select btrim(coalesce(p_query, '')) as q, coalesce(p_status, 'TODOS') as status_filter,
         coalesce(p_responsible, 'TODOS') as responsible_filter, coalesce(p_period, 'TODOS') as period_filter,
         coalesce(p_validity, 'TODAS') as validity_filter
),
base as (
  select p.id,p.cliente_id,p.numero_proposta,p.solicitante_snapshot_nome,p.responsavel_comercial_id,p.valor,p.logistica_coleta,p.status,p.validade,p.data_aceite,p.data_envio,p.ativo,p.created_at,p.updated_at,
    coalesce(nullif(c.nome_fantasia, ''), nullif(c.razao_social, ''), c.cpf_cnpj_original, 'Cliente não identificado') as client_name,
    coalesce(pr.nome, 'Sem responsável') as responsible_name, pr.ativo as responsible_active, pr.avatar_url as responsible_avatar_url,
    timezone('America/Sao_Paulo', coalesce(p.data_envio, p.created_at)) as ref_date
  from public.propostas p
  left join public.clientes c on c.id=p.cliente_id and c.deleted_at is null
  left join public.profiles pr on pr.id=p.responsavel_comercial_id
  where p.deleted_at is null
),
period as (
  select b.* from base b
  where (p_year is null or extract(year from b.ref_date)=p_year)
    and (p_month is null or extract(month from b.ref_date)=p_month)
),
filtered as (
  select b.* from period b cross join settings s
  where (s.q='' or position(lower(s.q) in lower(concat_ws(' ',b.numero_proposta,b.solicitante_snapshot_nome,b.status,b.logistica_coleta,b.client_name,b.responsible_name)))>0)
    and (s.status_filter='TODOS' or b.status=s.status_filter)
    and (s.responsible_filter='TODOS' or (s.responsible_filter='SEM' and b.responsavel_comercial_id is null) or b.responsavel_comercial_id::text=s.responsible_filter)
    and (s.period_filter='TODOS'
      or (s.period_filter='MES' and date_trunc('month', b.ref_date)=date_trunc('month', timezone('America/Sao_Paulo', now())))
      or (s.period_filter='ANO' and extract(year from b.ref_date)=extract(year from timezone('America/Sao_Paulo', now()))))
    and (s.validity_filter='TODAS'
      or (s.validity_filter='VENCIDAS' and b.validade is not null and b.validade<timezone('America/Sao_Paulo',now())::date)
      or (s.validity_filter='30_DIAS' and b.validade is not null and b.validade>=timezone('America/Sao_Paulo',now())::date and b.validade<=timezone('America/Sao_Paulo',now())::date+30))
),
paged as (
  select f.* from filtered f order by f.created_at desc,f.id
  offset ((greatest(coalesce(p_page,1),1)-1)*least(greatest(coalesce(p_page_size,10),1),100))
  limit least(greatest(coalesce(p_page_size,10),1),100)
),
approved_ref as (
  select coalesce(p_year, extract(year from timezone('America/Sao_Paulo', now()))::int) y,
         coalesce(p_month, case when p_year is null then extract(month from timezone('America/Sao_Paulo', now()))::int end) m
),
all_stats as (
  select count(*)::integer as total_proposals, coalesce(sum(valor),0)::numeric as total_value,
    count(*) filter(where status='EM NEGOCIAÇÃO')::integer as negotiation_count,
    coalesce(sum(valor) filter(where status='EM NEGOCIAÇÃO'),0)::numeric as negotiation_value,
    count(*) filter(where status='ENVIADA')::integer as awaiting_count,
    count(*) filter(where status='APROVADA')::integer as approved_count,
    coalesce(sum(valor) filter(where status='APROVADA'),0)::numeric as approved_value,
    count(*) filter(where status in('APROVADA','RECUSADA'))::integer as finalized_count,
    count(*) filter(where status='APROVADA' and data_aceite is null)::integer as approved_without_date
  from period
),
approved_month as (
  select count(*)::integer n from base b cross join approved_ref r
  where b.status='APROVADA' and b.data_aceite is not null
    and extract(year from timezone('America/Sao_Paulo', b.data_aceite))=r.y
    and (r.m is null or extract(month from timezone('America/Sao_Paulo', b.data_aceite))=r.m)
),
filtered_stats as (select count(*)::integer as total_filtered from filtered)
select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(p)-'ref_date' order by p.created_at desc,p.id) from paged p),'[]'::jsonb),
  'total',fs.total_filtered,
  'stats',jsonb_build_object(
    'totalProposals',ast.total_proposals,'totalValue',ast.total_value,
    'negotiationCount',ast.negotiation_count,'negotiationValue',ast.negotiation_value,
    'awaiting',ast.awaiting_count,'approvedCount',ast.approved_count,'approvedValue',ast.approved_value,
    'finalizedCount',ast.finalized_count,
    'approvalRate',case when ast.finalized_count=0 then 0 else round(100.0*ast.approved_count/ast.finalized_count)::integer end,
    'approvedMonth',am.n,'approvedWithoutDate',ast.approved_without_date))
from all_stats ast cross join filtered_stats fs cross join approved_month am;
$function$;

create function public.crm_oportunidades_list_v2(
  p_query text default null::text, p_stage text default null::text, p_status text default null::text,
  p_responsible uuid default null::uuid, p_page integer default 1, p_page_size integer default 25,
  p_year integer default null, p_month integer default null)
returns jsonb language sql stable set search_path to 'public', 'pg_temp'
as $function$
with settings as (
  select nullif(btrim(p_query),'') as q
), base as (
  select o.id,o.cliente_id,o.titulo,o.valor_estimado,o.estagio,o.status,o.responsavel_id,o.previsao_fechamento,o.created_at,
    coalesce(c.nome_fantasia,c.razao_social,'Cliente não informado') as cliente_nome,
    pr.nome as responsavel_nome, pr.avatar_url as responsavel_avatar,
    case
      when upper(coalesce(o.status,''))='CANCELADA' then 'CANCELADA'
      when upper(coalesce(o.estagio,''))='GANHO' or upper(coalesce(o.status,''))='GANHA' then 'GANHA'
      when upper(coalesce(o.estagio,''))='PERDIDO' or upper(coalesce(o.status,''))='PERDIDA' then 'PERDIDA'
      else 'ABERTA'
    end as lifecycle_status,
    timezone('America/Sao_Paulo', o.created_at) as ref_date
  from public.oportunidades o
  left join public.clientes c on c.id=o.cliente_id and c.deleted_at is null
  left join public.profiles pr on pr.id=o.responsavel_id
  where o.deleted_at is null
), period as (
  select b.* from base b
  where (p_year is null or extract(year from b.ref_date)=p_year)
    and (p_month is null or extract(month from b.ref_date)=p_month)
), filtered as (
  select b.* from period b, settings s
  where (s.q is null or (coalesce(b.titulo,'') || ' ' || coalesce(b.cliente_nome,'')) ilike '%' || s.q || '%')
    and (p_stage is null or p_stage='' or p_stage='TODAS' or b.estagio=p_stage)
    and (p_status is null or p_status='' or p_status='TODOS' or (p_status='ENCERRADAS' and b.lifecycle_status in ('GANHA','PERDIDA')) or b.lifecycle_status=p_status)
    and (p_responsible is null or b.responsavel_id=p_responsible)
), page_rows as (
  select * from filtered order by created_at desc, id desc
  offset (greatest(coalesce(p_page,1),1)-1) * least(greatest(coalesce(p_page_size,25),1),100)
  limit least(greatest(coalesce(p_page_size,25),1),100)
), stats as (
  select count(*) filter (where lifecycle_status='ABERTA')::int as open_count,
    count(*) filter (where lifecycle_status='GANHA')::int as won_count,
    count(*) filter (where lifecycle_status='PERDIDA')::int as lost_count,
    coalesce(sum(valor_estimado) filter (where lifecycle_status='ABERTA'),0)::numeric as open_value,
    case when count(*) filter (where lifecycle_status in ('GANHA','PERDIDA'))>0
      then round(100.0 * count(*) filter (where lifecycle_status='GANHA') / count(*) filter (where lifecycle_status in ('GANHA','PERDIDA')),1)
      else 0 end as conversion
  from period
)
select jsonb_build_object(
  'rows', coalesce((select jsonb_agg(to_jsonb(r)-'ref_date') from page_rows r),'[]'::jsonb),
  'total', (select count(*) from filtered),
  'stats', (select to_jsonb(s) from stats s)
);
$function$;

create function public.crm_clientes_list_v2(
  p_query text default ''::text, p_status text default 'TODOS'::text, p_segment text default 'TODOS'::text,
  p_responsible text default 'TODOS'::text, p_page integer default 1, p_page_size integer default 10,
  p_year integer default null, p_month integer default null)
returns jsonb language sql stable set search_path to 'pg_catalog', 'public'
as $function$
with settings as (select btrim(coalesce(p_query,'')) q, coalesce(p_status,'TODOS') status_filter, coalesce(p_segment,'TODOS') segment_filter, coalesce(p_responsible,'TODOS') responsible_filter),
opp_stats as (select cliente_id,count(*)::integer opportunity_count from public.oportunidades where deleted_at is null group by cliente_id),
proposal_stats as (select cliente_id,count(*)::integer proposal_count from public.propostas where deleted_at is null group by cliente_id),
last_interaction as (select distinct on (cliente_id) cliente_id,ocorrido_em last_interaction_at,tipo last_interaction_type from public.interacoes where cliente_id is not null order by cliente_id,ocorrido_em desc),
base as (select c.id,c.tipo_pessoa,c.cpf_cnpj_original,c.razao_social,c.nome_fantasia,c.telefone_principal,c.email_principal,c.segmento,c.origem,c.responsavel_comercial_id,c.status_comercial,c.observacoes_comerciais,c.ativo,c.created_at,coalesce(os.opportunity_count,0) opportunity_count,coalesce(ps.proposal_count,0) proposal_count,li.last_interaction_at,li.last_interaction_type from public.clientes c left join opp_stats os on os.cliente_id=c.id left join proposal_stats ps on ps.cliente_id=c.id left join last_interaction li on li.cliente_id=c.id where c.deleted_at is null
  and (p_year is null or extract(year from timezone('America/Sao_Paulo', c.created_at))=p_year)
  and (p_month is null or extract(month from timezone('America/Sao_Paulo', c.created_at))=p_month)),
filtered as (select b.* from base b cross join settings s where (s.q='' or position(lower(s.q) in lower(concat_ws(' ',coalesce(nullif(b.nome_fantasia,''),b.razao_social),b.razao_social,b.cpf_cnpj_original,b.telefone_principal,b.email_principal)))>0) and (s.status_filter='TODOS' or (s.status_filter='ATIVOS' and b.ativo and coalesce(b.status_comercial,'')<>'CLIENTE INATIVO') or (s.status_filter='INATIVOS' and (not b.ativo or b.status_comercial='CLIENTE INATIVO')) or b.status_comercial=s.status_filter) and (s.segment_filter='TODOS' or b.segmento=s.segment_filter) and (s.responsible_filter='TODOS' or b.responsavel_comercial_id::text=s.responsible_filter)),
paged as (select f.* from filtered f order by f.created_at desc,f.id offset ((greatest(coalesce(p_page,1),1)-1)*least(greatest(coalesce(p_page_size,10),1),100)) limit least(greatest(coalesce(p_page_size,10),1),100)),
open_opportunities as (select count(*)::integer open_count,coalesce(sum(valor_estimado),0)::numeric negotiation_value from public.oportunidades where deleted_at is null and upper(coalesce(status,'')) not in ('GANHA','PERDIDA','CANCELADA') and upper(coalesce(estagio,'')) not in ('GANHO','PERDIDO')),
all_stats as (select count(*)::integer total_clients,count(*) filter(where ativo and coalesce(status_comercial,'')<>'CLIENTE INATIVO')::integer active_clients,count(*) filter(where status_comercial='PROSPECT' and ativo)::integer prospects,count(*) filter(where not ativo or status_comercial='CLIENTE INATIVO')::integer inactive_clients,count(*) filter(where last_interaction_at is null)::integer clients_without_interaction,coalesce(jsonb_agg(distinct responsavel_comercial_id) filter(where responsavel_comercial_id is not null),'[]'::jsonb) responsible_ids from base),
filtered_stats as (select count(*)::integer total_filtered from filtered)
select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from paged p),'[]'::jsonb),'total',fs.total_filtered,'stats',jsonb_build_object('totalClients',ast.total_clients,'activeClients',ast.active_clients,'prospects',ast.prospects,'inactiveClients',ast.inactive_clients,'openOpportunities',oo.open_count,'negotiationValue',oo.negotiation_value,'clientsWithoutInteraction',ast.clients_without_interaction,'responsibleIds',ast.responsible_ids)) from all_stats ast cross join filtered_stats fs cross join open_opportunities oo;
$function$;

revoke all on function public.crm_propostas_list_v2(text, text, text, text, text, integer, integer, integer, integer) from public, anon;
revoke all on function public.crm_oportunidades_list_v2(text, text, text, uuid, integer, integer, integer, integer) from public, anon;
revoke all on function public.crm_clientes_list_v2(text, text, text, text, integer, integer, integer, integer) from public, anon;
grant execute on function public.crm_propostas_list_v2(text, text, text, text, text, integer, integer, integer, integer) to authenticated, service_role;
grant execute on function public.crm_oportunidades_list_v2(text, text, text, uuid, integer, integer, integer, integer) to authenticated, service_role;
grant execute on function public.crm_clientes_list_v2(text, text, text, text, integer, integer, integer, integer) to authenticated, service_role;

notify pgrst, 'reload schema';
