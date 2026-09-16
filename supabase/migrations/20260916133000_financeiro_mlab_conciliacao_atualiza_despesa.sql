create or replace function public.financeiro_atualizar_status_conciliacao_lancamento()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  rid uuid;
  did uuid;
  mid uuid;
  mv numeric;
  total_mov numeric;
  total_recebido numeric;
  total_pago numeric;
  vencimento_recebimento date;
  vencimento_despesa date;
  ultima_liquidacao_recebimento date;
  ultima_liquidacao_despesa date;
  empresa_mlab_recebimento boolean := false;
  empresa_mlab_despesa boolean := false;
begin
  rid := coalesce(new.recebimento_id, old.recebimento_id);
  did := coalesce(new.despesa_id, old.despesa_id);
  mid := coalesce(new.movimento_id, old.movimento_id);

  if rid is not null then
    select
      coalesce(sum(c.valor_conciliado), 0),
      max(coalesce(c.data_liquidacao, m.data_movimento))
    into total_recebido, ultima_liquidacao_recebimento
    from public.conciliacoes c
    left join public.movimentos_bancarios m on m.id = c.movimento_id
    where c.recebimento_id = rid;

    select
      r.data_vencimento,
      exists (
        select 1
        from public.empresas e
        where e.id = r.empresa_id
          and regexp_replace(coalesce(e.cnpj, ''), '[^0-9]', '', 'g') = '65312061000130'
      )
    into vencimento_recebimento, empresa_mlab_recebimento
    from public.recebimentos r
    where r.id = rid;

    update public.recebimentos r
    set
      valor_conciliado = total_recebido,
      conciliado = total_recebido >= greatest(coalesce(r.valor_previsto, 0), 0) - 0.005,
      valor_recebido = case
        when empresa_mlab_recebimento then least(total_recebido, greatest(coalesce(r.valor_previsto, 0), 0))
        else r.valor_recebido
      end,
      valor_pendente = case
        when empresa_mlab_recebimento then greatest(coalesce(r.valor_previsto, 0) - total_recebido, 0)
        else r.valor_pendente
      end,
      status = case
        when not empresa_mlab_recebimento then r.status
        when total_recebido >= coalesce(r.valor_previsto, 0) - 0.005
             and coalesce(r.valor_previsto, 0) > 0 then 'PAGO'
        when total_recebido > 0 then 'PARCIAL'
        when vencimento_recebimento < current_date then 'VENCIDO'
        else 'A RECEBER'
      end,
      data_pagamento = case
        when empresa_mlab_recebimento
         and total_recebido >= coalesce(r.valor_previsto, 0) - 0.005
         and coalesce(r.valor_previsto, 0) > 0 then ultima_liquidacao_recebimento
        when empresa_mlab_recebimento then null
        else r.data_pagamento
      end,
      updated_at = now()
    where r.id = rid;
  end if;

  if did is not null then
    select
      coalesce(sum(c.valor_conciliado), 0),
      max(coalesce(c.data_liquidacao, m.data_movimento))
    into total_pago, ultima_liquidacao_despesa
    from public.conciliacoes c
    left join public.movimentos_bancarios m on m.id = c.movimento_id
    where c.despesa_id = did;

    select
      d.data_vencimento,
      exists (
        select 1
        from public.empresas e
        where e.id = d.empresa_id
          and regexp_replace(coalesce(e.cnpj, ''), '[^0-9]', '', 'g') = '65312061000130'
      )
    into vencimento_despesa, empresa_mlab_despesa
    from public.despesas d
    where d.id = did;

    update public.despesas d
    set
      valor_conciliado = total_pago,
      conciliado = total_pago >= greatest(coalesce(d.valor_original, 0), 0) - 0.005,
      valor_pago = case
        when empresa_mlab_despesa then least(total_pago, greatest(coalesce(d.valor_original, 0), 0))
        else d.valor_pago
      end,
      valor_pendente = case
        when empresa_mlab_despesa then greatest(coalesce(d.valor_original, 0) - total_pago, 0)
        else d.valor_pendente
      end,
      status = case
        when not empresa_mlab_despesa then d.status
        when total_pago >= coalesce(d.valor_original, 0) - 0.005
             and coalesce(d.valor_original, 0) > 0 then 'PAGO'
        when total_pago > 0 then 'PARCIAL'
        when vencimento_despesa < current_date then 'VENCIDO'
        else 'A PAGAR'
      end,
      data_pagamento = case
        when empresa_mlab_despesa
         and total_pago >= coalesce(d.valor_original, 0) - 0.005
         and coalesce(d.valor_original, 0) > 0 then ultima_liquidacao_despesa
        when empresa_mlab_despesa then null
        else d.data_pagamento
      end,
      updated_at = now()
    where d.id = did;
  end if;

  if mid is not null then
    select abs(valor)
    into mv
    from public.movimentos_bancarios
    where id = mid;

    select coalesce(sum(coalesce(valor_movimento, valor_conciliado)), 0)
    into total_mov
    from public.conciliacoes
    where movimento_id = mid;

    update public.movimentos_bancarios
    set
      conciliado = total_mov >= coalesce(mv, 0) - 0.005,
      updated_at = now()
    where id = mid;
  end if;

  return coalesce(new, old);
end;
$function$;

with totais as (
  select
    d.id,
    d.valor_original,
    d.data_vencimento,
    coalesce(sum(c.valor_conciliado), 0) as total_pago,
    max(coalesce(c.data_liquidacao, m.data_movimento)) as ultima_liquidacao
  from public.despesas d
  join public.empresas e on e.id = d.empresa_id
  left join public.conciliacoes c on c.despesa_id = d.id
  left join public.movimentos_bancarios m on m.id = c.movimento_id
  where regexp_replace(coalesce(e.cnpj, ''), '[^0-9]', '', 'g') = '65312061000130'
    and exists (
      select 1 from public.conciliacoes cx where cx.despesa_id = d.id
    )
  group by d.id, d.valor_original, d.data_vencimento
)
update public.despesas d
set
  valor_conciliado = t.total_pago,
  conciliado = t.total_pago >= greatest(coalesce(t.valor_original, 0), 0) - 0.005,
  valor_pago = least(t.total_pago, greatest(coalesce(t.valor_original, 0), 0)),
  valor_pendente = greatest(coalesce(t.valor_original, 0) - t.total_pago, 0),
  status = case
    when t.total_pago >= coalesce(t.valor_original, 0) - 0.005
         and coalesce(t.valor_original, 0) > 0 then 'PAGO'
    when t.total_pago > 0 then 'PARCIAL'
    when t.data_vencimento < current_date then 'VENCIDO'
    else 'A PAGAR'
  end,
  data_pagamento = case
    when t.total_pago >= coalesce(t.valor_original, 0) - 0.005
     and coalesce(t.valor_original, 0) > 0 then t.ultima_liquidacao
    else null
  end,
  updated_at = now()
from totais t
where d.id = t.id;