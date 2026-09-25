create or replace function public.ml_estoque_pedido_salvar(p_codigo text, p_itens jsonb, p_usuario text default 'maquina')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_codigo text:=nullif(trim(coalesce(p_codigo,'')),''); v_item jsonb; v_id text; v_ids text[]:='{}'; v_agora timestamptz:=now(); v_n int:=0; v_max int:=0;
begin
 if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then raise exception 'Pedido deve possuir ao menos um item'; end if;
 perform pg_advisory_xact_lock(hashtext('ml_estoque_pedido_seq'));
 if v_codigo is null then
  select coalesce(max((regexp_match(coalesce(registro->>'pedidoCodigo',registro->>'idPedido',''), '^PC-([0-9]+)$'))[1]::int),0) into v_max from public.ml_registros where colecao='estoque_pedidos';
  v_codigo:='PC-'||lpad((v_max+1)::text,2,'0');
 end if;
 for v_item in select value from jsonb_array_elements(p_itens) loop
  v_n:=v_n+1; v_id:=coalesce(nullif(v_item->>'id',''),v_codigo||'-item-'||lpad(v_n::text,2,'0')); v_ids:=array_append(v_ids,v_id);
  v_item:=v_item||jsonb_build_object('id',v_id,'pedidoCodigo',v_codigo,'idPedido',v_codigo,'itemNumero',v_n,'atualizadoPor',p_usuario,'atualizadoEm',v_agora);
  insert into public.ml_registros(colecao,id,registro,atualizado_em,apagado) values('estoque_pedidos',v_id,v_item,v_agora,false)
  on conflict(colecao,id) do update set registro=excluded.registro,atualizado_em=excluded.atualizado_em,apagado=false;
 end loop;
 update public.ml_registros set apagado=true,atualizado_em=v_agora,registro=registro||jsonb_build_object('atualizadoPor',p_usuario,'atualizadoEm',v_agora)
 where colecao='estoque_pedidos' and apagado=false and coalesce(registro->>'pedidoCodigo',registro->>'idPedido')=v_codigo and not(id=any(v_ids));
 insert into public.ml_registros(colecao,id,registro,atualizado_em,apagado)
 values('estoque_logs_compras','LOG-'||replace(v_codigo,'-','')||'-'||to_char(v_agora,'YYYYMMDDHH24MISSMS'),jsonb_build_object('id','LOG-'||replace(v_codigo,'-','')||'-'||to_char(v_agora,'YYYYMMDDHH24MISSMS'),'pedidoCodigo',v_codigo,'data',v_agora,'login',p_usuario,'log','Pedido salvo/editado com '||v_n||' item(ns)','status','SALVO'),v_agora,false) on conflict do nothing;
 return jsonb_build_object('ok',true,'pedidoCodigo',v_codigo,'itens',v_n);
end $$;
