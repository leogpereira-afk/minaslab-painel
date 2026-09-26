create or replace function public.ml_estoque_pedido_status(p_id text,p_status text,p_data_chegada text default null,p_usuario text default 'maquina')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_reg jsonb; v_agora timestamptz:=now(); v_codigo text; v_status text:=upper(trim(coalesce(p_status,''))); v_log text;
begin
 if v_status='' then raise exception 'Status obrigatório'; end if;
 select registro into v_reg from public.ml_registros where colecao='estoque_pedidos' and id=p_id and not apagado for update;
 if v_reg is null then raise exception 'Item do pedido não encontrado'; end if;
 v_codigo:=coalesce(v_reg->>'pedidoCodigo',v_reg->>'idPedido',p_id);
 v_reg:=v_reg||jsonb_build_object('status',v_status,'atualizadoPor',p_usuario,'atualizadoEm',v_agora);
 if v_status in ('CONCLUÍDO','CONCLUIDO') then
   v_reg:=v_reg||jsonb_build_object('dataChegada',coalesce(nullif(p_data_chegada,''),v_agora::date::text),'dataConclusao',v_agora,'usuarioConclusao',p_usuario);
 end if;
 update public.ml_registros set registro=v_reg,atualizado_em=v_agora where colecao='estoque_pedidos' and id=p_id;
 v_log:='Status do item '||p_id||' alterado para '||v_status;
 insert into public.ml_registros(colecao,id,registro,atualizado_em,apagado)
 values('estoque_logs_compras','LOG-'||replace(v_codigo,'-','')||'-'||to_char(v_agora,'YYYYMMDDHH24MISSMS'),
 jsonb_build_object('id','LOG-'||replace(v_codigo,'-','')||'-'||to_char(v_agora,'YYYYMMDDHH24MISSMS'),'pedidoCodigo',v_codigo,'itemId',p_id,'data',v_agora,'login',p_usuario,'log',v_log,'status',v_status),v_agora,false)
 on conflict do nothing;
 return jsonb_build_object('ok',true,'registro',v_reg);
end $$;