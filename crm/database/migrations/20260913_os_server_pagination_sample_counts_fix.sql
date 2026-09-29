-- Correct sample aggregation: joining amostra_parametros multiplies rows per sample.
-- Count distinct sample IDs while keeping parameter rows counted individually.

create or replace function public.crm_ordens_servico_list(
  p_query text default '',
  p_status text default 'TODOS',
  p_period text default 'TODOS',
  p_origin text default 'TODAS',
  p_owner text default 'TODOS',
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
    coalesce(p_query, '') as q,
    coalesce(p_status, 'TODOS') as status_filter,
    coalesce(p_period, 'TODOS') as period_filter,
    coalesce(p_origin, 'TODAS') as origin_filter,
    coalesce(p_owner, 'TODOS') as owner_filter
),
sample_stats as (
  select
    a.ordem_servico_id,
    count(distinct a.id)::integer as samples,
    count(distinct a.id) filter (where a.data_entrada is not null)::integer as received,
    count(ap.*)::integer as params
  from public.amostras a
  left join public.amostra_parametros ap
    on ap.amostra_id = a.id
   and ap.deleted_at is null
  where a.deleted_at is null
  group by a.ordem_servico_id
),
base as (
  select
    o.id,
    o.contrato_id,
    o.cliente_id,
    o.numero_os,
    o.status_os,
    o.data_agendamento,
    o.data_recepcao,
    o.data_vencimento,
    o.source_system,
    o.external_id,
    o.valor,
    o.observacoes,
    o.origem_cadastro,
    o.updated_at,
    coalesce(nullif(c.nome_fantasia, ''), nullif(c.razao_social, ''), 'Cliente não informado') as client,
    coalesce(ct.numero_contrato, '—') as contract,
    coalesce(pr.nome, 'Sem responsável') as owner,
    coalesce(ss.samples, 0) as samples,
    coalesce(ss.received, 0) as received,
    coalesce(ss.params, 0) as params,
    replace(upper(coalesce(nullif(o.origem_cadastro, ''), nullif(o.source_system, ''), 'CRM')), 'GERENCIA_LAB', 'GERENCIALAB') as source_norm
  from public.ordens_servico o
  left join public.clientes c on c.id = o.cliente_id and c.deleted_at is null
  left join public.contratos ct on ct.id = o.contrato_id and ct.deleted_at is null
  left join public.profiles pr on pr.id = c.responsavel_comercial_id
  left join sample_stats ss on ss.ordem_servico_id = o.id
  where o.deleted_at is null
),
filtered as (
  select b.*
  from base b cross join settings s
  where
    (s.q = '' or position(lower(s.q) in lower(concat_ws(' ', b.numero_os, b.client, b.contract))) > 0)
    and (s.status_filter = 'TODOS' or b.status_os = s.status_filter)
    and (s.origin_filter = 'TODAS' or b.source_norm = s.origin_filter)
    and (s.owner_filter = 'TODOS' or b.owner = s.owner_filter)
    and (
      s.period_filter = 'TODOS'
      or (s.period_filter = 'ATRASADAS' and b.data_agendamento is not null and coalesce(b.status_os, '') not in ('CONCLUÍDA','CANCELADA') and b.data_agendamento < now())
      or (s.period_filter = 'HOJE' and b.data_agendamento is not null and timezone('America/Sao_Paulo', b.data_agendamento)::date = timezone('America/Sao_Paulo', now())::date)
      or (s.period_filter = 'ESTE MÊS' and b.data_agendamento is not null and date_trunc('month', timezone('America/Sao_Paulo', b.data_agendamento)) = date_trunc('month', timezone('America/Sao_Paulo', now())))
      or (s.period_filter = '7 DIAS' and b.data_agendamento between now() and now() + interval '7 days')
      or (s.period_filter = '30 DIAS' and b.data_agendamento between now() and now() + interval '30 days')
    )
),
paged as (
  select f.*
  from filtered f
  order by f.updated_at desc
  offset ((greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 10), 1), 100))
  limit least(greatest(coalesce(p_page_size, 10), 1), 100)
),
all_stats as (
  select
    count(*) filter (where coalesce(status_os, '') not in ('CONCLUÍDA','CANCELADA'))::integer as open_count,
    count(*) filter (where status_os = 'AGENDADA')::integer as scheduled,
    count(*) filter (where status_os = 'EM ANDAMENTO')::integer as progress,
    count(*) filter (where data_recepcao is null and status_os in ('AGENDADA','EM ANDAMENTO'))::integer as waiting,
    count(*) filter (
      where status_os = 'CONCLUÍDA'
        and date_trunc('month', timezone('America/Sao_Paulo', updated_at)) = date_trunc('month', timezone('America/Sao_Paulo', now()))
    )::integer as completed_month
  from base
),
filtered_stats as (
  select
    count(*)::integer as total_count,
    case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where status_os = 'CONCLUÍDA') / count(*))::integer end as conclusion_rate,
    count(*) filter (
      where data_agendamento between now() and now() + interval '7 days'
        and coalesce(status_os, '') not in ('CONCLUÍDA','CANCELADA')
    )::integer as week_count,
    count(*) filter (
      where samples = 0 and coalesce(status_os, '') not in ('CONCLUÍDA','CANCELADA')
    )::integer as wait_samples_count,
    coalesce(sum(params) filter (where status_os = 'EM ANDAMENTO'), 0)::integer as params_in_execution
  from filtered
)
select jsonb_build_object(
  'rows', coalesce((select jsonb_agg(to_jsonb(p) - 'source_norm' order by p.updated_at desc) from paged p), '[]'::jsonb),
  'total', fs.total_count,
  'stats', jsonb_build_object(
    'openCount', ast.open_count,
    'scheduled', ast.scheduled,
    'progress', ast.progress,
    'waiting', ast.waiting,
    'completedMonth', ast.completed_month,
    'conclusion', fs.conclusion_rate,
    'week', fs.week_count,
    'waitSamples', fs.wait_samples_count,
    'paramTotal', fs.params_in_execution
  )
)
from all_stats ast cross join filtered_stats fs;
$$;

revoke all on function public.crm_ordens_servico_list(text,text,text,text,text,integer,integer) from public, anon;
grant execute on function public.crm_ordens_servico_list(text,text,text,text,text,integer,integer) to authenticated, service_role;
