-- Serviços Gerados: OS faturada em "A RECEBER"/"AGUARDANDO" cujo vencimento já passou vira "VENCIDO".
-- Vale o vencimento do título ligado (Omie/manual) quando existe; senão, o da própria OS.
-- Só atua nas OS sem título ligado ou marcadas como pagamento manual: nas demais, o status vem do título
-- (conferência a cada 15 min), e mexer aqui faria o status ficar alternando.
-- Nunca mexe em PAGO, PARCIAL, CANCELADO nem DIVERGENCIA. Cada mudança entra no histórico da OS.
create or replace function public.servicos_gerados_marcar_vencidos()
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
      left join public.recebimentos r on r.id = s.recebimento_id and r.apagado = false
     where s.apagado = false
       and s.status_faturamento = 'FATURADO'
       and upper(coalesce(s.status_pagamento, '')) in ('A RECEBER', 'AGUARDANDO')
       and coalesce(r.data_vencimento, s.data_vencimento) < (now() at time zone 'America/Sao_Paulo')::date
       and (s.recebimento_id is null or s.pagamento_manual = true)
       and (r.id is null or upper(coalesce(r.status, '')) not in ('PAGO', 'CANCELADO', 'PARCIAL'))
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
$$;

revoke all on function public.servicos_gerados_marcar_vencidos() from public, anon, authenticated;

-- A cada hora, no minuto 20 (a recalculadora dos títulos manuais roda no minuto 5).
select cron.schedule('servicos-gerados-marcar-vencidos-hora', '20 * * * *', 'select public.servicos_gerados_marcar_vencidos();');
