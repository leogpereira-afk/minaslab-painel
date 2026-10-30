-- Financeiro: títulos em aberto passam a usar a DATA DE PREVISÃO da Omie como data do sistema
-- (é a data que o financeiro ajusta na Omie quando renegocia). "Vencido" = previsão anterior a hoje.
-- Substitui a regra de 20261027200000_financeiro_vencimento_omie.sql. O vencimento original continua em dados_omie.
-- A sincronização (ml-financeiro-omie-v2, versão 48) já grava assim; isto acerta o que está gravado.

update public.recebimentos r
set data_vencimento = coalesce(to_date(nullif(r.dados_omie->>'data_previsao',''), 'DD/MM/YYYY'), to_date(nullif(r.dados_omie->>'data_vencimento',''), 'DD/MM/YYYY')),
    status = case when coalesce(to_date(nullif(r.dados_omie->>'data_previsao',''), 'DD/MM/YYYY'), to_date(nullif(r.dados_omie->>'data_vencimento',''), 'DD/MM/YYYY')) < (now() at time zone 'America/Sao_Paulo')::date
                  then 'VENCIDO' else 'A RECEBER' end,
    updated_at = now()
where upper(coalesce(r.origem,'')) = 'OMIE' and coalesce(r.apagado,false) = false
  and r.status in ('VENCIDO','A RECEBER')
  and upper(coalesce(r.status_omie,'')) not in ('PAGO','LIQUIDADO','RECEBIDO')
  and upper(coalesce(r.status_omie,'')) not like 'CANCEL%'
  and coalesce(nullif(r.dados_omie->>'data_previsao',''), nullif(r.dados_omie->>'data_vencimento','')) is not null;

update public.despesas d
set data_vencimento = coalesce(to_date(nullif(d.dados_omie->>'data_previsao',''), 'DD/MM/YYYY'), to_date(nullif(d.dados_omie->>'data_vencimento',''), 'DD/MM/YYYY')),
    status = case when coalesce(to_date(nullif(d.dados_omie->>'data_previsao',''), 'DD/MM/YYYY'), to_date(nullif(d.dados_omie->>'data_vencimento',''), 'DD/MM/YYYY')) < (now() at time zone 'America/Sao_Paulo')::date
                  then 'VENCIDO' else 'A PAGAR' end,
    updated_at = now()
where upper(coalesce(d.origem,'')) = 'OMIE' and coalesce(d.apagado,false) = false
  and d.status in ('VENCIDO','A PAGAR')
  and upper(coalesce(d.status_omie,'')) not in ('PAGO','LIQUIDADO','RECEBIDO')
  and upper(coalesce(d.status_omie,'')) not like 'CANCEL%'
  and coalesce(nullif(d.dados_omie->>'data_previsao',''), nullif(d.dados_omie->>'data_vencimento','')) is not null;
