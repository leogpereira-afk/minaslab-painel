-- Serviço gerado lançado à mão e ligado a um título CANCELADO no Omie não é "pago nem a receber": o título morreu,
-- e a data que vale é a da própria OS. Antes, o título cancelado tirava a OS da rotina de vencidos e ela ficava
-- como "A RECEBER" mesmo com o vencimento passado (caso OS01359/2026). Já aplicada no banco.
create or replace function public.servicos_gerados_marcar_vencidos()
 returns integer
 language plpgsql
 set search_path to ''
as $function$
declare
  v_qtd integer;
begin
  with alvo as (
    select s.id, s.status_pagamento as anterior
      from public.servicos_gerados s
      left join public.recebimentos r on r.id = s.recebimento_id and r.apagado = false
     where s.apagado = false
       and s.status_faturamento = 'FATURADO'
       and upper(coalesce(s.status_pagamento, '')) in ('A RECEBER', 'AGUARDANDO')
       and coalesce(case when upper(coalesce(r.status, '')) = 'CANCELADO' then null else r.data_vencimento end, s.data_vencimento) < (now() at time zone 'America/Sao_Paulo')::date
       and (s.recebimento_id is null or s.pagamento_manual = true)
       and (r.id is null or upper(coalesce(r.status, '')) not in ('PAGO', 'PARCIAL'))
  ), atualizadas as (
    update public.servicos_gerados s
       set status_pagamento = 'VENCIDO', updated_at = now(), updated_by = 'rotina-vencimento'
      from alvo
     where s.id = alvo.id
    returning s.id, alvo.anterior
  ), hist as (
    insert into public.servicos_gerados_historico (servico_id, campo, valor_anterior, valor_novo, origem, usuario)
    select id, 'status_pagamento', anterior, 'VENCIDO', 'AUTOMATICO', 'rotina-vencimento' from atualizadas
    returning 1
  )
  select count(*) into v_qtd from atualizadas;
  return v_qtd;
end
$function$;
