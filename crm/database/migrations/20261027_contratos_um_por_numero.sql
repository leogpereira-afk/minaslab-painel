-- Contratos: um único contrato por número (sem duplicidade).
-- Regra do contrato que fica ("vigente"): Ativo primeiro; depois o que não é pré-cadastro;
-- depois o de início mais recente; empate pelo maior ID GerenciaLab e pelo mais recente no sistema.
-- Os demais (versões antigas/revisões e pré-cadastros provisórios) são excluídos (soft delete, deleted_at)
-- e coletas, OS, licitações e recorrências que apontavam para eles passam a apontar para o vigente.

create or replace function public.crm_contratos_dedup_numero(p_numero text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_keep uuid; v_losers uuid[]; v_n integer := 0;
begin
  if nullif(btrim(coalesce(p_numero,'')),'') is null then return 0; end if;
  select id into v_keep from contratos
   where deleted_at is null and coalesce(nullif(numero_contrato,''),proposta_origem_referencia)=p_numero
   order by (upper(coalesce(status,''))='ATIVO') desc, (status is distinct from 'PRÉ-CADASTRO') desc,
            data_inicio desc nulls last,
            nullif(regexp_replace(split_part(coalesce(external_id,''),'|',2),'\D','','g'),'')::bigint desc nulls last,
            created_at desc
   limit 1;
  if v_keep is null then return 0; end if;
  select array_agg(id) into v_losers from contratos where deleted_at is null and id<>v_keep
     and coalesce(nullif(numero_contrato,''),proposta_origem_referencia)=p_numero;
  if v_losers is null then return 0; end if;
  update coletas set contrato_id=v_keep where contrato_id = any(v_losers);
  update ordens_servico set contrato_id=v_keep where contrato_id = any(v_losers);
  update licitacoes set contrato_id=v_keep where contrato_id = any(v_losers);
  -- recorrência é única por contrato: leva só a mais recente, se o vigente ainda não tiver
  if not exists (select 1 from recorrencias_clientes where contrato_id=v_keep) then
    update recorrencias_clientes set contrato_id=v_keep
     where id = (select id from recorrencias_clientes where contrato_id = any(v_losers) order by created_at desc limit 1);
  end if;
  update contratos set deleted_at=now(), ativo=false, updated_at=now() where id = any(v_losers);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.trg_contratos_dedup_numero()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.deleted_at is null then
    perform public.crm_contratos_dedup_numero(coalesce(nullif(new.numero_contrato,''),new.proposta_origem_referencia));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_contratos_dedup_numero on public.contratos;
create trigger trg_contratos_dedup_numero
  after insert or update of numero_contrato, proposta_origem_referencia, status, data_inicio, deleted_at on public.contratos
  for each row when (pg_trigger_depth() < 1)
  execute function public.trg_contratos_dedup_numero();

-- Aprovação de proposta: só cria pré-cadastro se ainda não houver contrato com esse número (de qualquer origem).
do $mig$
declare d text; n text;
begin
  d := pg_get_functiondef('public.crm_sync_proposta_pipeline_contrato()'::regprocedure);
  n := replace(d, $a$and c.proposta_origem_referencia = coalesce(nullif(new.numero_proposta,''), new.id::text)$a$,
                  $a$and (c.proposta_origem_referencia = coalesce(nullif(new.numero_proposta,''), new.id::text) or c.numero_contrato = coalesce(nullif(new.numero_proposta,''), new.id::text))$a$);
  n := replace(n, $a$and c.cliente_id = new.cliente_id$a$, $a$$a$);
  if n = d then raise exception 'crm_sync_proposta_pipeline_contrato: trecho não encontrado'; end if;
  execute n;
end
$mig$;

-- Limpeza do que já existe
do $mig$
declare r record; total integer := 0;
begin
  for r in select coalesce(nullif(numero_contrato,''),proposta_origem_referencia) num
             from contratos where deleted_at is null
            group by 1 having count(*)>1
  loop
    total := total + public.crm_contratos_dedup_numero(r.num);
  end loop;
  raise notice 'contratos duplicados excluídos: %', total;
end
$mig$;
