-- Financeiro: o vencimento do sistema passa a ser o vencimento da Omie (e não a data de previsão),
-- e títulos que a Omie já marca como pagos deixam de ficar como pendência.
-- A sincronização (ml-financeiro-omie-v2) já grava assim daqui para frente; isto acerta o que ficou gravado.

-- 1) Pago na Omie, mas parcial/pendente aqui (títulos antigos, fora da janela da sincronização).
update public.despesas
set status = 'PAGO', valor_pago = valor_original, valor_pendente = 0, updated_at = now()
where upper(coalesce(origem,'')) = 'OMIE' and coalesce(apagado,false) = false
  and upper(coalesce(status_omie,'')) in ('PAGO','LIQUIDADO','RECEBIDO')
  and status not in ('PAGO','CANCELADO');

update public.recebimentos
set status = 'PAGO', valor_recebido = valor_previsto, valor_pendente = 0, updated_at = now()
where upper(coalesce(origem,'')) = 'OMIE' and coalesce(apagado,false) = false
  and upper(coalesce(status_omie,'')) in ('PAGO','LIQUIDADO','RECEBIDO')
  and status not in ('PAGO','CANCELADO');

-- 2) Em aberto: data = vencimento da Omie; status segue o da Omie (atrasado/a vencer) ou a data.
update public.recebimentos r
set data_vencimento = to_date(r.dados_omie->>'data_vencimento', 'DD/MM/YYYY'),
    status = case
      when upper(coalesce(r.status_omie,'')) like '%ATRAS%' then 'VENCIDO'
      when upper(coalesce(r.status_omie,'')) like '%A VENCER%' then 'A RECEBER'
      when to_date(r.dados_omie->>'data_vencimento', 'DD/MM/YYYY') < (now() at time zone 'America/Sao_Paulo')::date then 'VENCIDO'
      else 'A RECEBER' end,
    updated_at = now()
where upper(coalesce(r.origem,'')) = 'OMIE' and coalesce(r.apagado,false) = false
  and r.status in ('VENCIDO','A RECEBER')
  and upper(coalesce(r.status_omie,'')) not in ('PAGO','LIQUIDADO','RECEBIDO')
  and upper(coalesce(r.status_omie,'')) not like 'CANCEL%'
  and to_date(r.dados_omie->>'data_vencimento', 'DD/MM/YYYY') is not null
  and to_date(r.dados_omie->>'data_vencimento', 'DD/MM/YYYY') is distinct from r.data_vencimento;

update public.despesas d
set data_vencimento = to_date(d.dados_omie->>'data_vencimento', 'DD/MM/YYYY'),
    status = case
      when upper(coalesce(d.status_omie,'')) like '%ATRAS%' then 'VENCIDO'
      when upper(coalesce(d.status_omie,'')) like '%A VENCER%' then 'A PAGAR'
      when to_date(d.dados_omie->>'data_vencimento', 'DD/MM/YYYY') < (now() at time zone 'America/Sao_Paulo')::date then 'VENCIDO'
      else 'A PAGAR' end,
    updated_at = now()
where upper(coalesce(d.origem,'')) = 'OMIE' and coalesce(d.apagado,false) = false
  and d.status in ('VENCIDO','A PAGAR')
  and upper(coalesce(d.status_omie,'')) not in ('PAGO','LIQUIDADO','RECEBIDO')
  and upper(coalesce(d.status_omie,'')) not like 'CANCEL%'
  and to_date(d.dados_omie->>'data_vencimento', 'DD/MM/YYYY') is not null
  and to_date(d.dados_omie->>'data_vencimento', 'DD/MM/YYYY') is distinct from d.data_vencimento;
