-- Títulos MANUAIS a receber vencidos viravam VENCIDO só nas empresas que não usam o Omie.
-- Os títulos manuais da MinasLab (criados pelos Serviços Gerados) ficavam eternamente "A RECEBER".
-- Agora a rotina horária recalcula os títulos manuais de qualquer empresa (os do Omie continuam vindo do Omie).
create or replace function public.financeiro_recalcular_status_manuais()
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  update public.recebimentos r
  set status = case
    when coalesce(r.valor_pendente,0) <= 0 then r.status
    when r.data_vencimento is not null and r.data_vencimento < (now() at time zone 'America/Sao_Paulo')::date then 'VENCIDO'
    when upper(coalesce(r.status,'')) = 'VENCIDO' then 'A RECEBER'
    else r.status
  end,
  updated_at = now()
  where upper(coalesce(r.origem,'')) = 'MANUAL'
    and coalesce(r.apagado,false)=false
    and upper(coalesce(r.status,'')) <> 'CANCELADO'
    and (
      (coalesce(r.valor_pendente,0)>0 and r.data_vencimento is not null and r.data_vencimento < (now() at time zone 'America/Sao_Paulo')::date and upper(coalesce(r.status,'')) <> 'VENCIDO')
      or
      (upper(coalesce(r.status,''))='VENCIDO' and (r.data_vencimento is null or r.data_vencimento >= (now() at time zone 'America/Sao_Paulo')::date))
    );

  update public.despesas d
  set status = case
    when coalesce(d.valor_pendente,0) <= 0 then d.status
    when d.data_vencimento is not null and d.data_vencimento < (now() at time zone 'America/Sao_Paulo')::date then 'VENCIDO'
    when upper(coalesce(d.status,'')) = 'VENCIDO' then 'A PAGAR'
    else d.status
  end,
  updated_at = now()
  where upper(coalesce(d.origem,'')) = 'MANUAL'
    and coalesce(d.apagado,false)=false
    and upper(coalesce(d.status,'')) <> 'CANCELADO'
    and exists (
      select 1 from public.empresas e
      where e.id=d.empresa_id and coalesce(e.usa_omie,false)=false
    )
    and (
      (coalesce(d.valor_pendente,0)>0 and d.data_vencimento is not null and d.data_vencimento < (now() at time zone 'America/Sao_Paulo')::date and upper(coalesce(d.status,'')) <> 'VENCIDO')
      or
      (upper(coalesce(d.status,''))='VENCIDO' and (d.data_vencimento is null or d.data_vencimento >= (now() at time zone 'America/Sao_Paulo')::date))
    );
end;
$function$;
