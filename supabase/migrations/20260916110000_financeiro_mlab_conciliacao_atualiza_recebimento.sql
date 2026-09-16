create or replace function public.financeiro_atualizar_status_conciliacao_lancamento()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  rid uuid;
  did uuid;
  mid uuid;
  v numeric;
  mv numeric;
  total_mov numeric;
  total_recebido numeric;
  vencimento_recebimento date;
  ultima_liquidacao date;
  empresa_mlab boolean := false;
begin
  rid := coalesce(new.recebimento_id, old.recebimento_id);
  did := coalesce(new.despesa_id, old.despesa_id);
  mid := coalesce(new.movimento_id, old.movimento_id);

  if rid is not null then
    select
      coalesce(sum(c.valor_conciliado), 0),
      max(coalesce(c.data_liquidacao, m.data_movimento))
    into total_recebido, ultima_liquidacao
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
    into vencimento_recebimento, empresa_mlab
    from public.recebimentos r
    where r.id = rid;

    update public.recebimentos r
    set
      valor_conciliado = total_recebido,
      conciliado = total_recebido >= greatest(coalesce(r.valor_previsto, 0), 0) - 0.005,
      valor_recebido = case
        when empresa_mlab then least(total_recebido, greatest(coalesce(r.valor_previsto, 0), 0))
        else r.valor_recebido
      end,
      valor_pendente = case
        when empresa_mlab then greatest(coalesce(r.valor_previsto, 0) - total_recebido, 0)
        else r.valor_pendente
      end,
      status = case
        when not empresa_mlab then r.status
        when total_recebido >= coalesce(r.valor_previsto, 0) - 0.005
             and coalesce(r.valor_previsto, 0) > 0 then 'PAGO'
        when total_recebido > 0 then 'PARCIAL'
        when vencimento_recebimento < current_date then 'VENCIDO'
        else 'A RECEBER'
      end,
      data_pagamento = case
        when empresa_mlab
         and total_recebido >= coalesce(r.valor_previsto, 0) - 0.005
         and coalesce(r.valor_previsto, 0) > 0 then ultima_liquidacao
        when empresa_mlab then null
        else r.data_pagamento
      end,
      updated_at = now()
    where r.id = rid;
  end if;

  if did is not null then
    select coalesce(sum(valor_conciliado), 0)
    into v
    from public.conciliacoes
    where despesa_id = did;

    update public.despesas
    set
      valor_conciliado = v,
      conciliado = v >= greatest(coalesce(valor_original, 0), 0) - 0.005,
      updated_at = now()
    where id = did;
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
    r.id,
    r.valor_previsto,
    r.data_vencimento,
    coalesce(sum(c.valor_conciliado), 0) as total_recebido,
    max(coalesce(c.data_liquidacao, m.data_movimento)) as ultima_liquidacao
  from public.recebimentos r
  join public.empresas e on e.id = r.empresa_id
  left join public.conciliacoes c on c.recebimento_id = r.id
  left join public.movimentos_bancarios m on m.id = c.movimento_id
  where regexp_replace(coalesce(e.cnpj, ''), '[^0-9]', '', 'g') = '65312061000130'
    and exists (
      select 1 from public.conciliacoes cx where cx.recebimento_id = r.id
    )
  group by r.id, r.valor_previsto, r.data_vencimento
)
update public.recebimentos r
set
  valor_conciliado = t.total_recebido,
  conciliado = t.total_recebido >= greatest(coalesce(t.valor_previsto, 0), 0) - 0.005,
  valor_recebido = least(t.total_recebido, greatest(coalesce(t.valor_previsto, 0), 0)),
  valor_pendente = greatest(coalesce(t.valor_previsto, 0) - t.total_recebido, 0),
  status = case
    when t.total_recebido >= coalesce(t.valor_previsto, 0) - 0.005
         and coalesce(t.valor_previsto, 0) > 0 then 'PAGO'
    when t.total_recebido > 0 then 'PARCIAL'
    when t.data_vencimento < current_date then 'VENCIDO'
    else 'A RECEBER'
  end,
  data_pagamento = case
    when t.total_recebido >= coalesce(t.valor_previsto, 0) - 0.005
     and coalesce(t.valor_previsto, 0) > 0 then t.ultima_liquidacao
    else null
  end,
  updated_at = now()
from totais t
where r.id = t.id;