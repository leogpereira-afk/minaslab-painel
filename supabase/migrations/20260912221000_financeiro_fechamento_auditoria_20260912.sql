-- Fechamento da auditoria do Financeiro em 12/09/2026.
-- Idempotente: reforça segurança, índices e a consistência de pagamento dos grupos.

-- SECURITY DEFINER usados apenas internamente/triggers: não expor ao Data API.
revoke all on function public.preencher_servico_gerado_nfse() from public, anon, authenticated;
revoke all on function public.recalcular_saldo_conta_mlab_c6() from public, anon, authenticated;
revoke all on function public.sincronizar_nfse_autorizada_servico_gerado() from public, anon, authenticated;
grant execute on function public.preencher_servico_gerado_nfse() to service_role;
grant execute on function public.recalcular_saldo_conta_mlab_c6() to service_role;
grant execute on function public.sincronizar_nfse_autorizada_servico_gerado() to service_role;

-- Search path explícito, sem alterar a lógica das funções compartilhadas.
alter function public.domo_proximo_numero(text) set search_path = public;
alter function public.bsq_proximo_numero(text) set search_path = public;
alter function public.pdb_proximo_numero(text) set search_path = public;
alter function public.set_updated_at() set search_path = public;

-- Índices de suporte às FKs apontadas pelo Database Advisor.
create index if not exists ix_servicos_gerados_historico_servico_id on public.servicos_gerados_historico(servico_id);
create index if not exists ix_servicos_grupos_nota_fiscal_id on public.servicos_gerados_grupos_faturamento(nota_fiscal_id);
create index if not exists ix_servicos_grupos_recebimento_id on public.servicos_gerados_grupos_faturamento(recebimento_id);
create index if not exists ix_baixas_despesas_conta_bancaria_id on public.baixas_despesas(conta_bancaria_id);
create index if not exists ix_baixas_recebimentos_conta_bancaria_id on public.baixas_recebimentos(conta_bancaria_id);
create index if not exists ix_categorias_omie_codigos_categoria_id on public.categorias_omie_codigos(categoria_id);
create index if not exists ix_clientes_financeiro_mesclado_para on public.clientes_financeiro(mesclado_para);
create index if not exists ix_clientes_financeiro_mesclas_destino_id on public.clientes_financeiro_mesclas(destino_id);
create index if not exists ix_despesas_fornecedor_id on public.despesas(fornecedor_id);
create index if not exists ix_formas_pagamento_empresa_id on public.formas_pagamento(empresa_id);
create index if not exists ix_log_envios_nf_empresa_id on public.log_envios_nf(empresa_id);
create index if not exists ix_regras_categorizacao_categoria_id on public.regras_categorizacao(categoria_id);
create index if not exists ix_servicos_empresa_preferencia_empresa_id on public.servicos_gerados_empresa_preferencia(empresa_id);
create index if not exists ix_servicos_referencia_historica_empresa_id on public.servicos_gerados_referencia_historica(empresa_id);

-- Guardrail: uma OS agrupada não pode virar DIVERGÊNCIA por comparação individual.
create or replace function public.guardrail_status_pagamento_grupo()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  gid uuid;
  v_total numeric;
  v_recs int;
  v_rec uuid;
  r public.recebimentos%rowtype;
begin
  if new.pagamento_manual = true
     or new.status_pagamento is not distinct from old.status_pagamento then
    return new;
  end if;

  select grupo_id into gid
  from public.servicos_gerados_grupos_itens
  where servico_id = new.id
  limit 1;
  if gid is null then return new; end if;

  select
    sum(coalesce(s.valor_faturar,s.valor_original,0)),
    count(distinct s.recebimento_id) filter(where s.recebimento_id is not null),
    min(s.recebimento_id::text)::uuid
  into v_total,v_recs,v_rec
  from public.servicos_gerados_grupos_itens gi
  join public.servicos_gerados s
    on s.id=gi.servico_id and s.apagado=false
  where gi.grupo_id=gid;

  if v_recs<>1 or v_rec is null then return new; end if;
  select * into r from public.recebimentos where id=v_rec and apagado=false;
  if not found then return new; end if;

  if abs(coalesce(v_total,0)-coalesce(r.valor_previsto,0))>0.01 then
    new.status_pagamento := 'DIVERGENCIA';
  elsif upper(coalesce(r.status,''))='PAGO' then
    new.status_pagamento := 'PAGO';
  elsif upper(coalesce(r.status,''))='VENCIDO' then
    new.status_pagamento := 'VENCIDO';
  elsif upper(coalesce(r.status,''))='CANCELADO' then
    new.status_pagamento := 'CANCELADO';
  elsif upper(coalesce(r.status,''))='PARCIAL' then
    new.status_pagamento := 'PARCIAL';
  else
    new.status_pagamento := 'A RECEBER';
  end if;
  return new;
end
$function$;

drop trigger if exists trg_guardrail_status_pagamento_grupo on public.servicos_gerados;
create trigger trg_guardrail_status_pagamento_grupo
before update of status_pagamento on public.servicos_gerados
for each row execute function public.guardrail_status_pagamento_grupo();
