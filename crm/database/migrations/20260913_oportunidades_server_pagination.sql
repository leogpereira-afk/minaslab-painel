create or replace function public.crm_oportunidades_list(
  p_query text default null,
  p_stage text default null,
  p_status text default null,
  p_responsible uuid default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with settings as (
  select greatest(coalesce(p_page,1),1) as page_no,
         least(greatest(coalesce(p_page_size,25),1),100) as page_size,
         nullif(btrim(p_query),'') as q
), base as (
  select
    o.id,o.cliente_id,o.titulo,o.valor_estimado,o.estagio,o.status,o.responsavel_id,o.previsao_fechamento,o.created_at,
    coalesce(c.nome_fantasia,c.razao_social,'Cliente não informado') as cliente_nome,
    pr.nome as responsavel_nome, pr.avatar_url as responsavel_avatar,
    case
      when upper(coalesce(o.status,''))='CANCELADA' then 'CANCELADA'
      when upper(coalesce(o.estagio,''))='GANHO' or upper(coalesce(o.status,''))='GANHA' then 'GANHA'
      when upper(coalesce(o.estagio,''))='PERDIDO' or upper(coalesce(o.status,''))='PERDIDA' then 'PERDIDA'
      else 'ABERTA'
    end as lifecycle_status
  from public.oportunidades o
  left join public.clientes c on c.id=o.cliente_id and c.deleted_at is null
  left join public.profiles pr on pr.id=o.responsavel_id
  where o.deleted_at is null
), filtered as (
  select b.*
  from base b, settings s
  where (s.q is null or (coalesce(b.titulo,'') || ' ' || coalesce(b.cliente_nome,'')) ilike '%' || s.q || '%')
    and (p_stage is null or p_stage='' or p_stage='TODAS' or b.estagio=p_stage)
    and (p_status is null or p_status='' or p_status='TODOS' or b.lifecycle_status=p_status)
    and (p_responsible is null or b.responsavel_id=p_responsible)
), page_rows as (
  select * from filtered
  order by created_at desc, id desc
  offset (greatest(coalesce(p_page,1),1)-1) * least(greatest(coalesce(p_page_size,25),1),100)
  limit least(greatest(coalesce(p_page_size,25),1),100)
), stats as (
  select
    count(*) filter (where lifecycle_status='ABERTA')::int as open_count,
    count(*) filter (where lifecycle_status='GANHA')::int as won_count,
    count(*) filter (where lifecycle_status='PERDIDA')::int as lost_count,
    coalesce(sum(valor_estimado) filter (where lifecycle_status='ABERTA'),0)::numeric as open_value,
    case when count(*) filter (where lifecycle_status in ('GANHA','PERDIDA'))>0
      then round(100.0 * count(*) filter (where lifecycle_status='GANHA') / count(*) filter (where lifecycle_status in ('GANHA','PERDIDA')),1)
      else 0 end as conversion
  from base
)
select jsonb_build_object(
  'rows', coalesce((select jsonb_agg(to_jsonb(r)) from page_rows r),'[]'::jsonb),
  'total', (select count(*) from filtered),
  'stats', (select to_jsonb(s) from stats s)
);
$$;

revoke all on function public.crm_oportunidades_list(text,text,text,uuid,integer,integer) from public, anon;
grant execute on function public.crm_oportunidades_list(text,text,text,uuid,integer,integer) to authenticated, service_role;

create index if not exists oportunidades_created_at_active_idx
  on public.oportunidades(created_at desc)
  where deleted_at is null;
