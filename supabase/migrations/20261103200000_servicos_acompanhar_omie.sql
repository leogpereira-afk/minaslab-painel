-- Serviços gerados acompanham o Omie pelo número da NF ou do pedido, também os de pagamento manual (já aplicada no banco):
--  1) liga a OS aberta ao título vivo quando NF ou pedido batem, o valor bate e só existe UM título possível;
--  2) copia o vencimento do título (quando o valor bate), para quem alterou a data no Omie;
--  3) status pela data: vencimento passou = VENCIDO; vencimento adiado ou futuro = A RECEBER.
-- Título pago é com a rotina de pagamento; valor diferente (parcela, desconto) não é mexido: fica para conferência.
create or replace function public.servicos_gerados_acompanhar_omie()
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_lig int := 0; v_dat int := 0; v_sta int := 0;
begin
  -- 1) vínculo
  with cand as (
    select s.id sid, r.id rid, s.recebimento_id antigo
      from public.servicos_gerados s
      join public.recebimentos r
        on r.empresa_id = s.empresa_id and coalesce(r.apagado, false) = false and upper(coalesce(r.status, '')) <> 'CANCELADO'
       and abs(coalesce(r.valor_previsto, 0) - coalesce(s.valor_faturar, s.valor_original, 0)) <= 0.05
       and ( (coalesce(r.numero_nf, '') <> '' and r.numero_nf = s.numero_nf)
          or (coalesce(s.referencia_pagamento, '') <> '' and r.dados_omie->>'numero_pedido' = s.referencia_pagamento) )
     where coalesce(s.apagado, false) = false and s.status_faturamento = 'FATURADO'
       and upper(coalesce(s.status_pagamento, '')) not in ('PAGO', 'CANCELADO')
       and (s.recebimento_id is null or exists (select 1 from public.recebimentos c where c.id = s.recebimento_id and upper(coalesce(c.status, '')) = 'CANCELADO'))
  ), unico as (
    select sid, (array_agg(distinct rid))[1] rid, (array_agg(antigo))[1] antigo from cand group by sid having count(distinct rid) = 1
  ), feito as (
    update public.servicos_gerados s set recebimento_id = unico.rid, updated_at = now(), updated_by = 'rotina-acompanhar-omie'
      from unico where s.id = unico.sid returning s.id, unico.antigo, unico.rid
  ), h as (
    insert into public.servicos_gerados_historico (servico_id, campo, valor_anterior, valor_novo, origem, usuario)
    select id, 'recebimento_id', antigo::text, rid::text, 'AUTOMATICO', 'rotina-acompanhar-omie' from feito returning 1
  ) select count(*) into v_lig from feito;

  -- 2) vencimento do título
  with alvo as (
    select s.id, s.data_vencimento anterior, r.data_vencimento novo
      from public.servicos_gerados s
      join public.recebimentos r on r.id = s.recebimento_id and coalesce(r.apagado, false) = false
     where coalesce(s.apagado, false) = false and s.status_faturamento = 'FATURADO'
       and upper(coalesce(s.status_pagamento, '')) not in ('PAGO', 'CANCELADO')
       and upper(coalesce(r.status, '')) not in ('CANCELADO', 'PAGO')
       and r.data_vencimento is not null and r.data_vencimento is distinct from s.data_vencimento
       and abs(coalesce(r.valor_previsto, 0) - coalesce(s.valor_faturar, s.valor_original, 0)) <= 0.05
  ), feito as (
    update public.servicos_gerados s set data_vencimento = alvo.novo, updated_at = now(), updated_by = 'rotina-acompanhar-omie'
      from alvo where s.id = alvo.id returning s.id, alvo.anterior, alvo.novo
  ), h as (
    insert into public.servicos_gerados_historico (servico_id, campo, valor_anterior, valor_novo, origem, usuario)
    select id, 'data_vencimento', anterior::text, novo::text, 'AUTOMATICO', 'rotina-acompanhar-omie' from feito returning 1
  ) select count(*) into v_dat from feito;

  -- 3) status pela data
  with alvo as (
    select s.id, s.status_pagamento anterior,
           case when coalesce(r.data_vencimento, s.data_vencimento) < v_hoje then 'VENCIDO' else 'A RECEBER' end novo
      from public.servicos_gerados s
      left join public.recebimentos r on r.id = s.recebimento_id and coalesce(r.apagado, false) = false
     where coalesce(s.apagado, false) = false and s.status_faturamento = 'FATURADO'
       and upper(coalesce(s.status_pagamento, '')) in ('A RECEBER', 'VENCIDO', 'AGUARDANDO')
       and (r.id is null or upper(coalesce(r.status, '')) = 'CANCELADO'
            or (upper(coalesce(r.status, '')) not in ('PAGO', 'PARCIAL')
                and abs(coalesce(r.valor_previsto, 0) - coalesce(s.valor_faturar, s.valor_original, 0)) <= 0.05))
       and coalesce(case when upper(coalesce(r.status, '')) = 'CANCELADO' then null else r.data_vencimento end, s.data_vencimento) is not null
  ), feito as (
    update public.servicos_gerados s set status_pagamento = alvo.novo, updated_at = now(), updated_by = 'rotina-acompanhar-omie'
      from alvo where s.id = alvo.id and upper(coalesce(s.status_pagamento, '')) <> alvo.novo
     returning s.id, alvo.anterior, alvo.novo
  ), h as (
    insert into public.servicos_gerados_historico (servico_id, campo, valor_anterior, valor_novo, origem, usuario)
    select id, 'status_pagamento', anterior, novo, 'AUTOMATICO', 'rotina-acompanhar-omie' from feito returning 1
  ) select count(*) into v_sta from feito;

  return jsonb_build_object('vinculados', v_lig, 'vencimentos', v_dat, 'status', v_sta);
end
$function$;

-- De hora em hora, antes das rotinas de vencido (:20) e de pagamento manual (:25).
select cron.schedule('servicos-gerados-acompanhar-omie-hora', '10 * * * *', 'select public.servicos_gerados_acompanhar_omie();');
