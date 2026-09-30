create or replace function public.crm_dashboard_executivo(
  p_period text default 'ANO',
  p_month integer default null,
  p_owner uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_can_crm boolean := current_user in ('postgres','service_role') or public.has_permission('crm.read');
  v_can_op boolean := current_user in ('postgres','service_role') or public.has_permission('operational.read');
  v_result jsonb;
begin
  with params as (
    select case when p_period='90' then now()-interval '90 days' when p_period='ANO' then date_trunc('year',now()) else null end period_start
  ),
  crm_atendimentos as (
    select a.* from atendimentos a,params p where v_can_crm and (p_owner is null or a.usuario_id=p_owner) and ((p_month is not null and extract(year from a.ocorrido_em)=extract(year from now()) and extract(month from a.ocorrido_em)=p_month) or (p_month is null and (p.period_start is null or a.ocorrido_em>=p.period_start)))
  ),
  crm_opps as (
    select o.* from oportunidades o,params p where v_can_crm and o.deleted_at is null and (p_owner is null or o.responsavel_id=p_owner) and ((p_month is not null and extract(year from o.created_at)=extract(year from now()) and extract(month from o.created_at)=p_month) or (p_month is null and (p.period_start is null or o.created_at>=p.period_start)))
  ),
  crm_props as (
    select pr.* from propostas pr,params p where v_can_crm and pr.deleted_at is null and (p_owner is null or pr.responsavel_comercial_id=p_owner) and ((p_month is not null and extract(year from coalesce(pr.data_envio,pr.created_at))=extract(year from now()) and extract(month from coalesce(pr.data_envio,pr.created_at))=p_month) or (p_month is null and (p.period_start is null or coalesce(pr.data_envio,pr.created_at)>=p.period_start)))
  ),
  op_orders as (
    select os.* from ordens_servico os,params p where v_can_op and os.deleted_at is null and ((p_month is not null and extract(year from coalesce(os.data_recepcao,os.created_at))=extract(year from now()) and extract(month from coalesce(os.data_recepcao,os.created_at))=p_month) or (p_month is null and (p.period_start is null or coalesce(os.data_recepcao,os.created_at)>=p.period_start)))
  ),
  crm_counts as (
    select (select count(*) from crm_atendimentos)::int atendimentos,(select count(*) from crm_opps)::int oportunidades,(select count(*) from crm_opps where upper(coalesce(estagio,'')) not in ('GANHO','PERDIDO') and upper(coalesce(status,''))<>'CANCELADA')::int oportunidades_abertas,(select count(*) from crm_props)::int propostas,(select count(*) from crm_props where upper(coalesce(status,''))~'(APROV|ACEIT|FECHAD)')::int aprovadas,coalesce((select sum(valor) from crm_props),0)::numeric valor_propostas
  ),
  op_counts as (
    select (select count(*) from op_orders)::int os_filtradas,(select count(*) from op_orders where status_os='EM ANDAMENTO')::int os_em_andamento,coalesce((select sum(valor) from op_orders),0)::numeric valor_os,(select count(distinct cliente_id) from op_orders where cliente_id is not null)::int clientes_atendidos,(select count(*) from coletas c,params p where v_can_op and c.deleted_at is null and c.status='COLETADA' and c.ocorrida_em is not null and ((p_month is not null and extract(year from c.ocorrida_em)=extract(year from now()) and extract(month from c.ocorrida_em)=p_month) or (p_month is null and (p.period_start is null or c.ocorrida_em>=p.period_start))))::int coletas_registradas
  ),
  alerts as (
    select (select count(*) from contratos c where v_can_op and c.deleted_at is null and c.data_fim is not null and c.data_fim>=current_date and c.data_fim<=current_date+30)::int contratos_vencendo,(select count(*) from ordens_servico os where v_can_op and os.deleted_at is null and coalesce(os.status_os,'') not in ('CONCLUÍDA','CANCELADA'))::int os_pendentes,(select count(*) from coletas c where v_can_op and c.deleted_at is null and c.ocorrida_em<now() and coalesce(c.status,'') not in ('COLETADA','CANCELADA'))::int coletas_atrasadas,(select count(*) from clientes cl where v_can_crm and cl.deleted_at is null and not exists(select 1 from atendimentos a where a.cliente_id=cl.id and a.ocorrido_em>=now()-interval '90 days'))::int clientes_sem_contato
  ),
  agenda as (
    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'titulo',x.titulo,'inicio',x.inicio,'status',x.status) order by x.inicio),'[]'::jsonb) val from (select a.id,a.titulo,a.inicio,a.status from agendamentos a where v_can_crm and a.deleted_at is null and a.inicio>=date_trunc('day',now()) and a.inicio<date_trunc('day',now())+interval '1 day' and (p_owner is null or a.responsavel_id=p_owner) order by a.inicio limit 5)x
  ),
  priority_tasks as (
    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'titulo',x.titulo,'prazo',x.prazo,'prioridade',x.prioridade) order by x.prazo nulls last),'[]'::jsonb) val from (select t.id,t.titulo,t.prazo,t.prioridade from tarefas t where v_can_crm and t.deleted_at is null and upper(coalesce(t.status,'')) not like '%CONCLU%' and (p_owner is null or t.responsavel_id=p_owner or exists(select 1 from tarefa_responsaveis tr where tr.tarefa_id=t.id and tr.usuario_id=p_owner)) order by t.prazo nulls last limit 5)x
  ),
  os_status as (
    select coalesce(jsonb_agg(jsonb_build_array(status_name,qtd) order by qtd desc,status_name),'[]'::jsonb) val from (select coalesce(status_os,'Sem status') status_name,count(*)::int qtd from op_orders group by 1)s
  ),
  monthly as (
    select coalesce(jsonb_agg(jsonb_build_object('key',to_char(m.m,'YYYY-MM'),'label',case extract(month from m.m)::int when 1 then 'Jan' when 2 then 'Fev' when 3 then 'Mar' when 4 then 'Abr' when 5 then 'Mai' when 6 then 'Jun' when 7 then 'Jul' when 8 then 'Ago' when 9 then 'Set' when 10 then 'Out' when 11 then 'Nov' else 'Dez' end,'proposal',coalesce(p.valor,0),'orders',coalesce(o.qtd,0)) order by m.m),'[]'::jsonb) val from generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),interval '1 month')m(m) left join lateral(select sum(pr.valor)::numeric valor from propostas pr where v_can_crm and pr.deleted_at is null and coalesce(pr.data_envio,pr.created_at)>=m.m and coalesce(pr.data_envio,pr.created_at)<m.m+interval '1 month' and (p_owner is null or pr.responsavel_comercial_id=p_owner))p on true left join lateral(select count(*)::int qtd from ordens_servico os where v_can_op and os.deleted_at is null and coalesce(os.data_recepcao,os.created_at)>=m.m and coalesce(os.data_recepcao,os.created_at)<m.m+interval '1 month')o on true
  ),
  active_contracts as (select count(*)::int qtd from contratos c where v_can_op and c.deleted_at is null and upper(coalesce(c.status,''))='ATIVO')
  select jsonb_build_object('metrics',jsonb_build_object('atendimentos',cc.atendimentos,'oportunidades_abertas',cc.oportunidades_abertas,'valor_propostas',cc.valor_propostas,'conversao',case when cc.propostas=0 then 0 else round(cc.aprovadas::numeric*100/cc.propostas,1) end,'contratos_ativos',ac.qtd,'os_em_andamento',oc.os_em_andamento),'volume',jsonb_build_object('atendimentos',cc.atendimentos,'oportunidades',cc.oportunidades,'propostas',cc.propostas,'aprovadas',cc.aprovadas),'alerts',jsonb_build_object('contratos_vencendo',al.contratos_vencendo,'os_pendentes',al.os_pendentes,'coletas_atrasadas',al.coletas_atrasadas,'clientes_sem_contato',al.clientes_sem_contato),'results',jsonb_build_object('valor_os',oc.valor_os,'ticket_os',case when oc.os_filtradas=0 then 0 else round(oc.valor_os/oc.os_filtradas,2) end,'clientes_atendidos',oc.clientes_atendidos,'coletas_registradas',oc.coletas_registradas),'agenda_today',ag.val,'priority_tasks',pt.val,'os_statuses',st.val,'monthly',mo.val) into v_result from crm_counts cc cross join op_counts oc cross join alerts al cross join agenda ag cross join priority_tasks pt cross join os_status st cross join monthly mo cross join active_contracts ac;
  return v_result;
end;
$$;
revoke all on function public.crm_dashboard_executivo(text,integer,uuid) from public,anon;
grant execute on function public.crm_dashboard_executivo(text,integer,uuid) to authenticated,service_role;
