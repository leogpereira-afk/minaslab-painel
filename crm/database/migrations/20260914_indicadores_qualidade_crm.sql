create or replace function public.crm_data_quality_counts()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'empresa_definir',(select count(*) from public.leads where deleted_at is null and cliente_convertido_id is null and assunto ilike '%selecionar empresa%'),
    'atendimento_sem_responsavel',(select count(*) from public.leads where deleted_at is null and responsavel_id is null and status is distinct from 'ENCERRADO'),
    'oportunidade_sem_numero',(select count(*) from public.oportunidades where deleted_at is null and nullif(trim(numero_proposta_gerencialab),'') is null),
    'proposta_sem_data_decisao',(select count(*) from public.propostas where deleted_at is null and ((status='APROVADA' and data_aceite is null) or (status='RECUSADA' and data_recusa is null)))
  );
$$;
revoke all on function public.crm_data_quality_counts() from public, anon;
grant execute on function public.crm_data_quality_counts() to authenticated;
