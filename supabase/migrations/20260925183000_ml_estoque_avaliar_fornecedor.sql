create or replace function public.ml_estoque_avaliar_fornecedor(p_avaliacao jsonb,p_fornecedor_id text,p_usuario text default 'maquina')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_fornecedor jsonb; v_id text; v_agora timestamptz:=now(); v_tipo text; v_periodicidade text; v_proxima date; v_data date;
begin
 if p_fornecedor_id is null or trim(p_fornecedor_id)='' then raise exception 'Fornecedor obrigatório'; end if;
 v_id:=coalesce(nullif(p_avaliacao->>'id',''),'AV-'||replace(gen_random_uuid()::text,'-',''));
 select registro into v_fornecedor from public.ml_registros where colecao='estoque_fornecedores' and id=p_fornecedor_id and not apagado for update;
 if v_fornecedor is null then raise exception 'Fornecedor não encontrado'; end if;
 v_tipo:=upper(coalesce(p_avaliacao->>'tipoAvaliacao',p_avaliacao->>'tipo','INICIAL'));
 v_data:=coalesce(nullif(p_avaliacao->>'dataAvaliacao','')::date,current_date);
 v_periodicidade:=upper(coalesce(v_fornecedor->>'periodicidade',''));
 if v_periodicidade='SEMESTRAL' then v_proxima:=(v_data + interval '6 months')::date; end if;
 p_avaliacao:=p_avaliacao||jsonb_build_object('id',v_id,'fornecedorId',p_fornecedor_id,'dataAvaliacao',v_data,'atualizadoPor',p_usuario,'atualizadoEm',v_agora);
 insert into public.ml_registros(colecao,id,registro,atualizado_em,apagado) values('estoque_avaliacoes_fornecedor',v_id,p_avaliacao,v_agora,false)
 on conflict(colecao,id) do update set registro=excluded.registro,atualizado_em=excluded.atualizado_em,apagado=false;
 v_fornecedor:=v_fornecedor||jsonb_build_object('dataUltimaAvaliacao',v_data,'resultadoQualificacao',coalesce(p_avaliacao->>'resultadoFinal',p_avaliacao->>'resultado',''),'statusReavaliacao',case when v_proxima is null then coalesce(v_fornecedor->>'statusReavaliacao','') else 'REGULAR' end,'atualizadoPor',p_usuario,'atualizadoEm',v_agora);
 if v_proxima is not null then v_fornecedor:=v_fornecedor||jsonb_build_object('dataProximaAvaliacao',v_proxima); end if;
 update public.ml_registros set registro=v_fornecedor,atualizado_em=v_agora where colecao='estoque_fornecedores' and id=p_fornecedor_id;
 return jsonb_build_object('ok',true,'avaliacao',p_avaliacao,'fornecedor',v_fornecedor);
end $$;