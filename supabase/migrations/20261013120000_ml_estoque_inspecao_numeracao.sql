-- Corrige a numeração do próximo IR. A importação do legado gravou inspeções com id IR139..IR151 e guardou o número
-- antigo em idIrOrigem (até 138); como a função só olhava idIrOrigem/idIr, o próximo IR caía em IR139 e dava
-- "duplicate key ml_registros_pkey". Agora considera o maior número entre id, idIr e idIrOrigem.
create or replace function public.ml_estoque_inspecao_registrar(p_ir jsonb,p_item_id text,p_data_chegada text default null,p_usuario text default 'maquina')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_ir jsonb:=coalesce(p_ir,'{}'::jsonb); v_item jsonb; v_status text; v_codigo text; v_agora timestamptz:=now();
  v_usuario text:=coalesce(nullif(p_usuario,''),'maquina'); v_num integer; v_idir text; v_nota integer:=0; v_n text; v_parecer text; i integer;
begin
  select registro into v_item from public.ml_registros where colecao='estoque_pedidos' and id=p_item_id and not apagado for update;
  if v_item is null then raise exception 'Item do pedido não encontrado.'; end if;
  v_codigo:=coalesce(v_item->>'pedidoCodigo',v_item->>'idPedido',p_item_id);
  v_status:=upper(trim(coalesce(v_item->>'status','PENDENTE')));
  if v_status not in ('PENDENTE','AUTORIZADO') then raise exception 'O item está % e não pode receber nova inspeção.',v_status; end if;
  if exists(select 1 from public.ml_registros where colecao='estoque_inspecoes' and not apagado and registro->>'itemPedidoId'=p_item_id) then
    raise exception 'Este item do pedido já possui inspeção registrada.';
  end if;
  if coalesce(btrim(v_ir->>'dataRecebimento'),'')='' or coalesce(btrim(v_ir->>'fabricante'),'')='' or coalesce(btrim(v_ir->>'lote'),'')='' or coalesce(btrim(v_ir->>'validade'),'')='' then
    raise exception 'Data de recebimento, fabricante, lote e validade são obrigatórios.';
  end if;
  for i in 1..5 loop
    v_n:=v_ir->>('c'||i);
    if v_n is null or v_n !~ '^[0-3]$' then raise exception 'As cinco notas da inspeção devem ser inteiros de 0 a 3.'; end if;
    v_nota:=v_nota+v_n::integer;
  end loop;
  v_parecer:=case when v_nota<=7 then 'RUIM' when v_nota<=10 then 'BOM' else 'ÓTIMO' end;

  perform pg_advisory_xact_lock(hashtext('estoque_inspecoes_codigo_ir'));
  select coalesce(max(greatest(
           coalesce(nullif(regexp_replace(id,'\D','','g'),'')::integer,0),
           coalesce(nullif(regexp_replace(coalesce(registro->>'idIr',''),'\D','','g'),'')::integer,0),
           coalesce(nullif(regexp_replace(coalesce(registro->>'idIrOrigem',''),'\D','','g'),'')::integer,0))),0)+1
    into v_num from public.ml_registros where colecao='estoque_inspecoes';
  v_idir:='IR'||v_num::text;
  v_ir:=v_ir||jsonb_build_object('id',v_idir,'idIr',v_idir,'idPedido',v_codigo,'itemPedidoId',p_item_id,
        'produto',v_item->>'produto','fornecedor',v_item->>'fornecedor',
        'fabricante',upper(btrim(v_ir->>'fabricante')),'lote',upper(btrim(v_ir->>'lote')),
        'notaFinal',v_nota,'parecer',v_parecer,'statusQualidade',v_parecer,
        'operador',v_usuario,'atualizadoPor',v_usuario,'atualizadoEm',v_agora,'origem','GESTAO_ESTOQUE');
  insert into public.ml_registros(colecao,id,registro,apagado,atualizado_em) values('estoque_inspecoes',v_idir,v_ir,false,v_agora);

  v_item:=v_item||jsonb_build_object('status','CONCLUÍDO','atualizadoPor',v_usuario,'atualizadoEm',v_agora,
        'dataChegada',coalesce(nullif(p_data_chegada,''),nullif(v_ir->>'dataRecebimento',''),public.ml_estoque_hoje_br()::text),
        'dataConclusao',v_agora,'usuarioConclusao',v_usuario);
  update public.ml_registros set registro=v_item,atualizado_em=v_agora where colecao='estoque_pedidos' and id=p_item_id;
  perform public.ml_estoque_log_compra(v_codigo,p_item_id,v_usuario,'Inspeção '||v_idir||' emitida ('||v_nota||'/15 '||v_parecer||'); item '||p_item_id||' CONCLUÍDO','CONCLUÍDO');
  return jsonb_build_object('ok',true,'inspecao',v_ir,'item',v_item);
end $$;
