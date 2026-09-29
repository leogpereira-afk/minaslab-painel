create or replace function public.crm_coletas_list(
  p_query text default null,
  p_status text default null,
  p_period text default null,
  p_month integer default null,
  p_collector uuid default null,
  p_city text default null,
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with params as (
  select
    nullif(trim(coalesce(p_query,'')),'') as q,
    nullif(trim(coalesce(p_status,'')),'') as st,
    upper(nullif(trim(coalesce(p_period,'')),'')) as per,
    p_month as mon,
    p_collector as collector,
    nullif(trim(coalesce(p_city,'')),'') as city,
    greatest(1,coalesce(p_page,1)) as pg,
    least(100,greatest(1,coalesce(p_page_size,10))) as psz,
    timezone('America/Sao_Paulo',now()) as local_now
), base as (
  select
    c.id,c.agendamento_id,c.ordem_servico_id,c.numero_os_referencia,c.proposta_id,c.numero_proposta_referencia,
    c.coletor_id,c.ocorrida_em,c.status,c.observacoes,c.endereco_evento,c.updated_at,
    coalesce(os.numero_os,c.numero_os_referencia) as numero_os,
    coalesce(pr.numero_proposta,c.numero_proposta_referencia) as numero_proposta,
    coalesce(os.cliente_id,pr.cliente_id) as cliente_id,
    coalesce(cl.nome_fantasia,cl.razao_social,'Cliente não informado') as client,
    coalesce(prof.nome,'Sem coletor') as collector,
    prof.avatar_url as collector_avatar,
    coalesce(nullif(addr.cidade,''), nullif(trim(substring(c.endereco_evento from '([^-/]+)\/[A-Za-z]{2}')),''), 'Não informada') as city,
    (ag.external_calendar_id is not null) as synced,
    case
      when coalesce(os.numero_os,c.numero_os_referencia) is not null then 'OS '||coalesce(os.numero_os,c.numero_os_referencia)
      when coalesce(pr.numero_proposta,c.numero_proposta_referencia) is not null then 'Proposta '||coalesce(pr.numero_proposta,c.numero_proposta_referencia)
      else 'Sem vínculo'
    end as reference_label
  from public.coletas c
  left join public.ordens_servico os on os.id=c.ordem_servico_id and os.deleted_at is null
  left join public.propostas pr on pr.id=c.proposta_id and pr.deleted_at is null
  left join public.clientes cl on cl.id=coalesce(os.cliente_id,pr.cliente_id) and cl.deleted_at is null
  left join public.profiles prof on prof.id=c.coletor_id
  left join lateral (
    select e.cidade
    from public.enderecos e
    where e.cliente_id=coalesce(os.cliente_id,pr.cliente_id) and e.ativo=true and e.deleted_at is null
    order by e.created_at asc
    limit 1
  ) addr on true
  left join public.agendamentos ag on ag.id=c.agendamento_id and ag.deleted_at is null
  where c.deleted_at is null
), filtered as (
  select b.*
  from base b, params p
  where
    (p.q is null or concat_ws(' ',b.reference_label,b.client,b.collector,b.endereco_evento,b.city) ilike '%'||p.q||'%')
    and (p.st is null or p.st='TODOS' or b.status=p.st)
    and (p.collector is null or b.coletor_id=p.collector)
    and (p.city is null or p.city='TODAS' or b.city=p.city)
    and (p.mon is null or extract(month from timezone('America/Sao_Paulo',b.ocorrida_em))::int=p.mon)
    and (
      p.per is null or p.per='TODOS'
      or (p.per='ATRASADAS' and b.ocorrida_em is not null and coalesce(b.status,'') not in ('COLETADA','CANCELADA') and b.ocorrida_em < now())
      or (p.per='HOJE' and timezone('America/Sao_Paulo',b.ocorrida_em)::date=p.local_now::date)
      or (p.per='ESTE MÊS' and date_trunc('month',timezone('America/Sao_Paulo',b.ocorrida_em))=date_trunc('month',p.local_now))
      or (p.per='7 DIAS' and b.ocorrida_em between now() and now()+interval '7 days')
      or (p.per='30 DIAS' and b.ocorrida_em between now() and now()+interval '30 days')
    )
), counts as (
  select
    count(*)::int total,
    count(*) filter(where status='COLETADA')::int completed,
    count(*) filter(where ocorrida_em is not null and coalesce(status,'') not in ('COLETADA','CANCELADA') and ocorrida_em between now() and now()+interval '7 days')::int week,
    count(*) filter(where city<>'Não informada' and upper(translate(city,'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ','AAAAEEEIIIOOOOUUUC')) not like '%MONTES CLAROS%')::int outside,
    count(*) filter(where endereco_evento is null or trim(endereco_evento)='')::int no_address
  from filtered
), cards as (
  select
    count(*) filter(where status='AGENDADA' and timezone('America/Sao_Paulo',ocorrida_em)::date=(select local_now::date from params))::int today_scheduled,
    count(*) filter(where status='EM COLETA')::int in_route,
    count(*) filter(where status='COLETADA' and (
      ((select mon from params) is null and date_trunc('month',timezone('America/Sao_Paulo',ocorrida_em))=date_trunc('month',(select local_now from params)))
      or ((select mon from params) is not null and extract(month from timezone('America/Sao_Paulo',ocorrida_em))::int=(select mon from params))
    ))::int collected_month,
    count(*) filter(where ocorrida_em is not null and coalesce(status,'') not in ('COLETADA','CANCELADA') and ocorrida_em<now())::int late,
    count(*) filter(where coletor_id is null and coalesce(status,'')<>'CANCELADA')::int no_collector
  from base
  where (select mon from params) is null or extract(month from timezone('America/Sao_Paulo',ocorrida_em))::int=(select mon from params)
), page_rows as (
  select * from filtered
  order by ocorrida_em asc nulls last, id
  limit (select psz from params)
  offset ((select pg from params)-1)*(select psz from params)
), cities as (
  select coalesce(jsonb_agg(city order by city),'[]'::jsonb) value
  from (select distinct city from base where city is not null) x
)
select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(page_rows) order by ocorrida_em asc nulls last,id) from page_rows),'[]'::jsonb),
  'total',(select total from counts),
  'summary',jsonb_build_object(
    'completed',(select completed from counts),
    'rate',case when (select total from counts)>0 then round((select completed from counts)*100.0/(select total from counts))::int else 0 end,
    'week',(select week from counts),
    'outside',(select outside from counts),
    'noAddress',(select no_address from counts)
  ),
  'cards',jsonb_build_object(
    'todayScheduled',(select today_scheduled from cards),
    'inRoute',(select in_route from cards),
    'collectedMonth',(select collected_month from cards),
    'late',(select late from cards),
    'noCollector',(select no_collector from cards)
  ),
  'cities',(select value from cities)
);
$$;

revoke all on function public.crm_coletas_list(text,text,text,integer,uuid,text,integer,integer) from public, anon;
grant execute on function public.crm_coletas_list(text,text,text,integer,uuid,text,integer,integer) to authenticated, service_role;
