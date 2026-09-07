create or replace function public.financeiro_aplicar_conciliacao()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  mov public.movimentos_bancarios%rowtype;
  rec public.recebimentos%rowtype;
  des public.despesas%rowtype;
  total_baixas numeric := 0;
  ultima_data date;
  total_conciliado numeric := 0;
  valor_baixa numeric := 0;
  valor_extra numeric := 0;
  cat_entrada public.categorias_financeiras%rowtype;
begin
  select * into mov from public.movimentos_bancarios where id = new.movimento_id;

  if new.recebimento_id is not null then
    select * into rec from public.recebimentos where id = new.recebimento_id;
    if rec.origem <> 'OMIE' then
      valor_baixa := least(new.valor_conciliado, greatest(coalesce(rec.valor_pendente,0),0));
      valor_extra := greatest(new.valor_conciliado - valor_baixa, 0);

      if valor_baixa > 0 then
        insert into public.baixas_recebimentos
          (recebimento_id, valor, data_pagamento, conta_bancaria_id, forma_pagamento, observacao, origem, created_by)
        values
          (rec.id, valor_baixa, mov.data_movimento, mov.conta_bancaria_id,
           coalesce(rec.forma_pagamento,'OFX'), 'Baixa gerada pela conciliação OFX', 'CONCILIACAO', coalesce(new.conciliado_por,'sistema'));
      end if;

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

      if valor_extra > 0 and mov.tipo = 'CREDITO' then
        select * into cat_entrada
        from public.categorias_financeiras
        where empresa_id = rec.empresa_id
          and ativa = true
          and upper(nome) = 'OUTRAS ENTRADAS'
        order by created_at desc nulls last
        limit 1;

        insert into public.recebimentos
          (empresa_id, cliente, descricao, valor_previsto, valor_recebido, valor_pendente,
           data_vencimento, data_pagamento, status, categoria_id, categoria_texto,
           conta_bancaria_id, forma_pagamento, observacao, origem, apagado,
           created_by, updated_by, created_at, updated_at)
        values
          (rec.empresa_id, rec.cliente, 'JUROS DE ATRASO / DIFERENÇA DE LIQUIDAÇÃO',
           valor_extra, valor_extra, 0, mov.data_movimento, mov.data_movimento, 'PAGO',
           cat_entrada.id, coalesce(cat_entrada.nome,'OUTRAS ENTRADAS'), mov.conta_bancaria_id,
           coalesce(rec.forma_pagamento,'OFX'),
           'Valor adicional identificado automaticamente na conciliação bancária do movimento '||mov.id::text||'. Principal mantido separado do acréscimo.',
           'MANUAL', false, coalesce(new.conciliado_por,'sistema'), coalesce(new.conciliado_por,'sistema'), now(), now());
      end if;
    end if;
  else
    select * into des from public.despesas where id = new.despesa_id;
    if des.origem <> 'OMIE' then
      valor_baixa := least(new.valor_conciliado, greatest(coalesce(des.valor_pendente,0),0));
      if valor_baixa > 0 then
        insert into public.baixas_despesas
          (despesa_id, valor, data_pagamento, conta_bancaria_id, forma_pagamento, observacao, origem, created_by)
        values
          (des.id, valor_baixa, mov.data_movimento, mov.conta_bancaria_id,
           coalesce(des.forma_pagamento,'OFX'), 'Baixa gerada pela conciliação OFX', 'CONCILIACAO', coalesce(new.conciliado_por,'sistema'));
      end if;

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
  set conciliado = total_conciliado >= abs(mov.valor) - 0.005,
      updated_at = now()
  where id = new.movimento_id;

  return new;
end;
$function$;