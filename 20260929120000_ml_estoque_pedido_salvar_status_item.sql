-- Pedido de Compra: edição do PC completo respeitando o status INDIVIDUAL de cada item.
--
-- Antes (20260925173000): o registro de cada item era substituído pelo que o navegador enviava,
-- itens ausentes da lista eram apagados sem olhar o status, item novo herdava o status do
-- primeiro item do pedido e o id de item novo era a posição na lista (podia colidir com um item
-- existente, ex.: item-03). Uma edição simples podia destruir status CONCLUÍDO/INTEGRADO,
-- recebimento e o vínculo com inspeção/lote.
--
-- Regras agora (servidor é a última barreira, o navegador só espelha):
--  * item existente com status diferente de PENDENTE fica preservado: só recebe os campos
--    comerciais do cabeçalho do PC (data, prazo, pagamento, frete, imposto, observação);
--  * item existente PENDENTE pode ser alterado, mas o status continua o gravado no banco
--    (mudança de status só por ml_estoque_pedido_status);
--  * item que não é PENDENTE não pode sair do pedido; PENDENTE que sai é marcado apagado
--    (mesma regra da exclusão individual);
--  * fornecedor não muda se o PC já tem item fora de PENDENTE;
--  * item novo nasce PENDENTE, sem dados de recebimento, com id sequencial sem colisão;
--  * pedido novo (p_codigo vazio) recebe o código no servidor, sob o mesmo lock.
create or replace function public.ml_estoque_pedido_salvar(p_codigo text, p_itens jsonb, p_usuario text default 'maquina')
returns jsonb language plpgsql set search_path to 'public' as $function$
declare
  v_codigo text := nullif(trim(coalesce(p_codigo,'')),'');
  v_novo boolean := false;
  v_item jsonb; v_atual jsonb; v_cab jsonb;
  v_id text; v_ids text[] := '{}';
  v_agora timestamptz := now();
  v_n int := 0; v_max int := 0; v_prox int := 0; v_preservados int := 0; v_novos int := 0; v_removidos int := 0;
  v_status text; v_forn_novo text; v_bloq record;
  c_cabecalho constant text[] := array['dataPedido','prazoEntrega','formaPagamento','valorFrete','valorImposto','frete','imposto','observacao'];
  c_recebimento constant text[] := array['status','dataChegada','dataConclusao','usuarioConclusao','dataStatus','itemNumero','anexo','nomeAnexo'];
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido deve possuir ao menos um item';
  end if;
  perform pg_advisory_xact_lock(hashtext('ml_estoque_pedido_seq'));

  if v_codigo is null then
    select coalesce(max((regexp_match(coalesce(registro->>'pedidoCodigo',registro->>'idPedido',''), '^PC-([0-9]+)$'))[1]::int),0)
      into v_max from public.ml_registros where colecao='estoque_pedidos';
    v_codigo := 'PC-'||lpad((v_max+1)::text,2,'0');
    v_novo := true;
  end if;

  -- trava as linhas atuais do PC durante a gravação
  perform 1 from public.ml_registros
   where colecao='estoque_pedidos' and coalesce(registro->>'pedidoCodigo',registro->>'idPedido')=v_codigo
   for update;

  -- fornecedor não pode mudar quando o PC já tem item fora de PENDENTE
  v_forn_novo := upper(trim(coalesce(p_itens->0->>'fornecedor','')));
  for v_bloq in
    select id, registro from public.ml_registros
     where colecao='estoque_pedidos' and not apagado
       and coalesce(registro->>'pedidoCodigo',registro->>'idPedido')=v_codigo
       and upper(trim(coalesce(nullif(trim(registro->>'status'),''),'PENDENTE'))) <> 'PENDENTE'
  loop
    if upper(trim(coalesce(v_bloq.registro->>'fornecedor',''))) <> v_forn_novo then
      raise exception 'O fornecedor do pedido % não pode ser alterado: o item % (%) está %.',
        v_codigo, coalesce(v_bloq.registro->>'produto',v_bloq.id), v_bloq.id, upper(trim(v_bloq.registro->>'status'));
    end if;
  end loop;

  -- próximo número de item: considera ids e itemNumero existentes, inclusive apagados
  select coalesce(max(greatest(
           coalesce((regexp_match(id, '-item-([0-9]+)$'))[1]::int, 0),
           case when coalesce(registro->>'itemNumero','') ~ '^[0-9]+$' then (registro->>'itemNumero')::int else 0 end)),0)
    into v_prox
    from public.ml_registros
   where colecao='estoque_pedidos'
     and (coalesce(registro->>'pedidoCodigo',registro->>'idPedido')=v_codigo or id like v_codigo||'-item-%');

  for v_item in select value from jsonb_array_elements(p_itens) loop
    v_n := v_n + 1;
    v_id := nullif(trim(coalesce(v_item->>'id','')),'');
    if v_id is not null then
      if v_novo then raise exception 'Pedido novo não pode referenciar item existente (%).', v_id; end if;
      if v_id = any(v_ids) then raise exception 'Item % repetido na gravação.', v_id; end if;
      select registro into v_atual from public.ml_registros
       where colecao='estoque_pedidos' and id=v_id and not apagado;
      if v_atual is null then
        raise exception 'Item % não encontrado ou já excluído. Atualize a tela e tente novamente.', v_id;
      end if;
      if coalesce(v_atual->>'pedidoCodigo',v_atual->>'idPedido') is distinct from v_codigo then
        raise exception 'Item % não pertence ao pedido %.', v_id, v_codigo;
      end if;
      v_status := upper(trim(coalesce(nullif(trim(v_atual->>'status'),''),'PENDENTE')));
      if v_status <> 'PENDENTE' then
        -- preservado: só o cabeçalho comercial do PC
        select coalesce(jsonb_object_agg(k, v_item->k), '{}'::jsonb) into v_cab
          from unnest(c_cabecalho) k where v_item ? k;
        v_item := v_atual || v_cab;
        v_preservados := v_preservados + 1;
      else
        -- editável: status, recebimento, número e anexo continuam os do banco
        v_item := v_atual || (v_item - c_recebimento);
      end if;
    else
      v_prox := v_prox + 1;
      v_id := v_codigo||'-item-'||lpad(v_prox::text,2,'0');
      while exists(select 1 from public.ml_registros where colecao='estoque_pedidos' and id=v_id) loop
        v_prox := v_prox + 1;
        v_id := v_codigo||'-item-'||lpad(v_prox::text,2,'0');
      end loop;
      v_item := (v_item - c_recebimento) || jsonb_build_object(
        'status','PENDENTE','itemNumero',v_prox,'dataCriacao',v_agora,'usuarioCompra',p_usuario);
      -- item novo em PC existente herda o anexo do pedido
      if not v_novo then
        v_cab := null;
        select jsonb_build_object('anexo',registro->'anexo','nomeAnexo',coalesce(registro->'nomeAnexo','""'::jsonb)) into v_cab
          from public.ml_registros
         where colecao='estoque_pedidos' and not apagado
           and coalesce(registro->>'pedidoCodigo',registro->>'idPedido')=v_codigo
           and jsonb_typeof(registro->'anexo')='object'
         limit 1;
        v_item := v_item || coalesce(v_cab, '{}'::jsonb);
      end if;
      v_novos := v_novos + 1;
    end if;
    v_ids := array_append(v_ids, v_id);
    v_item := v_item || jsonb_build_object('id',v_id,'pedidoCodigo',v_codigo,'idPedido',v_codigo,
                                           'atualizadoPor',p_usuario,'atualizadoEm',v_agora);
    insert into public.ml_registros(colecao,id,registro,atualizado_em,apagado)
    values('estoque_pedidos',v_id,v_item,v_agora,false)
    on conflict(colecao,id) do update set registro=excluded.registro, atualizado_em=excluded.atualizado_em
      where public.ml_registros.apagado = false;
  end loop;

  -- itens fora da lista: só PENDENTE pode sair
  for v_bloq in
    select id, registro from public.ml_registros
     where colecao='estoque_pedidos' and not apagado
       and coalesce(registro->>'pedidoCodigo',registro->>'idPedido')=v_codigo
       and not (id = any(v_ids))
       and upper(trim(coalesce(nullif(trim(registro->>'status'),''),'PENDENTE'))) <> 'PENDENTE'
  loop
    raise exception 'O item % (%) está % e não pode ser removido do pedido.',
      coalesce(v_bloq.registro->>'produto',v_bloq.id), v_bloq.id, upper(trim(v_bloq.registro->>'status'));
  end loop;

  update public.ml_registros set apagado=true, atualizado_em=v_agora,
    registro=registro||jsonb_build_object('atualizadoPor',p_usuario,'atualizadoEm',v_agora)
   where colecao='estoque_pedidos' and apagado=false
     and coalesce(registro->>'pedidoCodigo',registro->>'idPedido')=v_codigo and not(id=any(v_ids));
  get diagnostics v_removidos = row_count;

  insert into public.ml_registros(colecao,id,registro,atualizado_em,apagado)
  values('estoque_logs_compras','LOG-'||replace(v_codigo,'-','')||'-'||to_char(v_agora,'YYYYMMDDHH24MISSMS'),
    jsonb_build_object('id','LOG-'||replace(v_codigo,'-','')||'-'||to_char(v_agora,'YYYYMMDDHH24MISSMS'),
      'pedidoCodigo',v_codigo,'data',v_agora,'login',p_usuario,
      'log', case when v_novo then 'Pedido criado' else 'Pedido editado' end
             ||' com '||v_n||' item(ns): '||v_novos||' novo(s), '||v_preservados||' preservado(s) por status, '
             ||v_removidos||' pendente(s) removido(s)',
      'status', case when v_novo then 'CRIADO' else 'EDITADO' end),v_agora,false)
  on conflict do nothing;

  return jsonb_build_object('ok',true,'pedidoCodigo',v_codigo,'itens',v_n,'novos',v_novos,
                            'preservados',v_preservados,'removidos',v_removidos);
end $function$;
