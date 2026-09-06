create or replace function public.financeiro_aplicar_conciliacao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  mov public.movimentos_bancarios%rowtype;
  rec public.recebimentos%rowtype;
  des public.despesas%rowtype;
  total_baixas numeric := 0;
  ultima_data date;
  total_conciliado numeric := 0;
begin
  select * into mov from public.movimentos_bancarios where id = new.movimento_id;

  if new.recebimento_id is not null then
    select * into rec from public.recebimentos where id = new.recebimento_id;
    if rec.origem <> 'OMIE' then
      insert into public.baixas_recebimentos
        (recebimento_id, valor, data_pagamento, conta_bancaria_id, forma_pagamento, observacao, origem, created_by)
      values
        (rec.id, new.valor_conciliado, mov.data_movimento, mov.conta_bancaria_id,
         coalesce(rec.forma_pagamento,'OFX'), 'Baixa gerada pela conciliação OFX', 'OFX', coalesce(new.conciliado_por,'sistema'));

      select coalesce(sum(valor),0), max(data_pagamento)
        into total_baixas, ultima_data
      from public.baixas_recebimentos
      where recebimento_id = rec.id and estornada = false;

      update public.recebimentos
      set valor_recebido = least(total_baixas, valor_previsto),
          valor_pendente = greatest(valor_previsto - total_baixas, 0),
          status = case
            when total_baixas >= valor_previsto and valor_previsto > 0 then 'PAGO'
            when total_baixas > 0 then 'PARCIAL'
            when data_vencimento < current_date then 'VENCIDO'
            else 'A RECEBER'
          end,
          data_pagamento = case when total_baixas >= valor_previsto and valor_previsto > 0 then ultima_data else null end,
          updated_by = coalesce(new.conciliado_por,'sistema'),
          updated_at = now()
      where id = rec.id;
    end if;
  else
    select * into des from public.despesas where id = new.despesa_id;
    if des.origem <> 'OMIE' then
      insert into public.baixas_despesas
        (despesa_id, valor, data_pagamento, conta_bancaria_id, forma_pagamento, observacao, origem, created_by)
      values
        (des.id, new.valor_conciliado, mov.data_movimento, mov.conta_bancaria_id,
         coalesce(des.forma_pagamento,'OFX'), 'Baixa gerada pela conciliação OFX', 'OFX', coalesce(new.conciliado_por,'sistema'));

      select coalesce(sum(valor),0), max(data_pagamento)
        into total_baixas, ultima_data
      from public.baixas_despesas
      where despesa_id = des.id and estornada = false;

      update public.despesas
      set valor_pago = least(total_baixas, valor_original),
          valor_pendente = greatest(valor_original - total_baixas, 0),
          status = case
            when total_baixas >= valor_original and valor_original > 0 then 'PAGO'
            when total_baixas > 0 then 'PARCIAL'
            when data_vencimento < current_date then 'VENCIDO'
            else 'A PAGAR'
          end,
          data_pagamento = case when total_baixas >= valor_original and valor_original > 0 then ultima_data else null end,
          updated_by = coalesce(new.conciliado_por,'sistema'),
          updated_at = now()
      where id = des.id;
    end if;
  end if;

  select coalesce(sum(valor_conciliado),0) into total_conciliado
  from public.conciliacoes where movimento_id = new.movimento_id;

  update public.movimentos_bancarios
  set conciliado = total_conciliado >= valor - 0.005,
      updated_at = now()
  where id = new.movimento_id;

  return new;
end;
$$;

drop trigger if exists trg_fin_conciliacao_aplicar on public.conciliacoes;
create trigger trg_fin_conciliacao_aplicar
after insert on public.conciliacoes
for each row execute function public.financeiro_aplicar_conciliacao();
