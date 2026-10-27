-- Propostas: cards por mês.
-- Acrescenta 'approvedMonthValue' (soma do valor das propostas aprovadas — pela data de aceite —
-- no ano/mês escolhido) para o card "Valor aprovado" acompanhar o filtro de Mês.

create or replace function public.crm_propostas_list_v2(
  p_query text default ''::text, p_status text default 'TODOS'::text, p_responsible text default 'TODOS'::text,
  p_period text default 'TODOS'::text, p_validity text default 'TODAS'::text, p_page integer default 1,
  p_page_size integer default 10, p_year integer default null::integer, p_month integer default null::integer)
returns jsonb
language sql
stable
set search_path to 'pg_catalog', 'public'
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
  select count(*)::integer n, coalesce(sum(b.valor),0)::numeric v from base b cross join approved_ref r
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
    'approvedMonth',am.n,'approvedMonthValue',am.v,'approvedWithoutDate',ast.approved_without_date))
from all_stats ast cross join filtered_stats fs cross join approved_month am;
$function$;
