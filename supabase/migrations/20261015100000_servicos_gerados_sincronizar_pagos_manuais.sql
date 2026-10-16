-- Serviços Gerados: OS marcada como "pagamento manual" nunca acompanhava o título.
-- Se o título ligado já está PAGO, a OS vira PAGO (NF 118 e NF 120 da M Lab ficaram em VENCIDO / A RECEBER
-- mesmo com o título pago). Só avança para PAGO: não mexe em CANCELADO nem em OS sem título ligado.
-- Cada mudança entra no histórico da OS.
create or replace function public.servicos_gerados_sincronizar_pagos_manuais()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_qtd integer;
begin
  with alvo as (
    select s.id, s.status_pagamento as anterior
      from public.servicos_gerados s
      join public.recebimentos r on r.id = s.recebimento_id and r.apagado = false
     where s.apagado = false
       and s.status_faturamento = 'FATURADO'
       and s.pagamento_manual = true
       and upper(coalesce(s.status_pagamento, '')) not in ('PAGO', 'CANCELADO')
       and upper(coalesce(r.status, '')) = 'PAGO'
  ), atualizadas as (
    update public.servicos_gerados s
       set status_pagamento = 'PAGO', updated_at = now(), updated_by = 'rotina-pagamento-manual'
      from alvo
     where s.id = alvo.id
    returning s.id, alvo.anterior
  ), hist as (
    insert into public.servicos_gerados_historico (servico_id, campo, valor_anterior, valor_novo, origem, usuario)
    select id, 'status_pagamento', anterior, 'PAGO', 'AUTOMATICO', 'rotina-pagamento-manual' from atualizadas
    returning 1
  )
  select count(*) into v_qtd from atualizadas;
  return v_qtd;
end
$$;

revoke all on function public.servicos_gerados_sincronizar_pagos_manuais() from public, anon, authenticated;

-- A cada hora, no minuto 25 (depois da recalculadora dos títulos, :05, e da marcação de vencidos, :20).
select cron.schedule('servicos-gerados-sincronizar-pagos-manuais-hora', '25 * * * *', 'select public.servicos_gerados_sincronizar_pagos_manuais();');
