-- Gestão de Estoque: CNPJ de fornecedor único (só dígitos) e entrada vinculada a pedido não pode ser excluída.
-- Já aplicada no banco; este arquivo registra o que está em produção.

CREATE OR REPLACE FUNCTION public.ml_estoque_fornecedor_salvar(p_registro jsonb, p_usuario text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_reg jsonb:=coalesce(p_registro,'{}'::jsonb); v_id text:=nullif(btrim(v_reg->>'id'),''); v_num integer; v_now timestamptz:=now(); v_cnpj text; v_dup text;
begin
  if v_id is null then
    perform pg_advisory_xact_lock(hashtext('estoque_fornecedores_codigo_f'));
    select coalesce(max((regexp_match(id,'^F-([0-9]+)$'))[1]::integer),0)+1 into v_num
      from public.ml_registros where colecao='estoque_fornecedores' and id ~ '^F-[0-9]+$';
    v_id:='F-'||v_num::text;
  else
    perform pg_advisory_xact_lock(hashtext('estoque_fornecedores_codigo_f'));
  end if;
  v_cnpj:=regexp_replace(coalesce(v_reg->>'cnpj',''),'\D','','g');
  if v_cnpj<>'' then
    select f.id||' — '||coalesce(f.registro->>'nome','') into v_dup
      from public.ml_registros f
     where f.colecao='estoque_fornecedores' and not f.apagado and f.id<>v_id
       and regexp_replace(coalesce(f.registro->>'cnpj',''),'\D','','g')=v_cnpj
     limit 1;
    if v_dup is not null then raise exception 'Já existe fornecedor cadastrado com este CNPJ: %', v_dup; end if;
  end if;
  v_reg:=v_reg||jsonb_build_object('id',v_id,'atualizadoPor',coalesce(nullif(p_usuario,''),'maquina'),'atualizadoEm',v_now);
  insert into public.ml_registros(colecao,id,registro,apagado,atualizado_em) values('estoque_fornecedores',v_id,v_reg,false,v_now)
  on conflict(colecao,id) do update set registro=excluded.registro,apagado=false,atualizado_em=excluded.atualizado_em;
  return v_reg;
end $function$;

CREATE OR REPLACE FUNCTION public.ml_estoque_lote_excluir_seguro(p_id text, p_usuario text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_lote_row public.ml_registros%rowtype;
  v_lote jsonb;
  v_agora timestamptz := now();
  v_mov_count integer := 0;
  v_entrada_count integer := 0;
  v_bloqueio_count integer := 0;
  v_audit_id text := gen_random_uuid()::text;
begin
  select * into v_lote_row
  from public.ml_registros
  where colecao='estoque_lotes' and id=p_id
  for update;

  if not found or v_lote_row.apagado then
    raise exception 'Lote não encontrado ou já excluído.';
  end if;

  v_lote := v_lote_row.registro;

  if nullif(btrim(coalesce(v_lote->>'itemPedidoId','')),'') is not null then
    raise exception 'Exclusão bloqueada: esta entrada veio do pedido % e está vinculada ao item INTEGRADO dele. Por segurança ela não pode ser excluída.', coalesce(v_lote->>'pedidoCodigo', v_lote->>'itemPedidoId');
  end if;

  select count(*),
         count(*) filter (
           where upper(coalesce(registro->>'tipo',''))='ENTRADA'
              or upper(coalesce(registro->>'acao',''))='CADASTRO NOVO'
         ),
         count(*) filter (
           where not (
             upper(coalesce(registro->>'tipo',''))='ENTRADA'
             or upper(coalesce(registro->>'acao',''))='CADASTRO NOVO'
             or (
               upper(coalesce(registro->>'tipo',''))='AJUSTE'
               and upper(coalesce(registro->>'acao',''))='EDIÇÃO DE LOTE'
             )
           )
         )
    into v_mov_count, v_entrada_count, v_bloqueio_count
  from public.ml_registros
  where colecao='estoque_movimentos'
    and apagado=false
    and (
      registro->>'loteId'=p_id
      or registro->>'codigoID'=p_id
      or registro->>'codigoAuto'=p_id
    );

  if v_entrada_count = 0 then
    raise exception 'Exclusão bloqueada: não foi possível confirmar a movimentação inicial deste lote com segurança.';
  end if;

  if v_bloqueio_count > 0
     or coalesce((v_lote->>'qtdRetirada')::numeric,0) > 0 then
    raise exception 'Exclusão bloqueada: o lote possui retirada, baixa ou movimentação posterior vinculada.';
  end if;

  update public.ml_registros
     set registro = registro || jsonb_build_object(
           'excluidoPor', coalesce(nullif(p_usuario,''),'maquina'),
           'excluidoEm', v_agora
         ),
         apagado=true,
         atualizado_em=v_agora
   where colecao='estoque_lotes' and id=p_id and apagado=false;

  update public.ml_registros
     set registro = registro || jsonb_build_object(
           'revertidoPorExclusao', true,
           'excluidoPor', coalesce(nullif(p_usuario,''),'maquina'),
           'excluidoEm', v_agora
         ),
         apagado=true,
         atualizado_em=v_agora
   where colecao='estoque_movimentos'
     and apagado=false
     and (
       registro->>'loteId'=p_id
       or registro->>'codigoID'=p_id
       or registro->>'codigoAuto'=p_id
     );

  insert into public.ml_registros(colecao,id,registro,apagado,atualizado_em)
  values(
    'estoque_movimentos',
    v_audit_id,
    jsonb_build_object(
      'id',v_audit_id,
      'loteId',p_id,
      'codigoID',p_id,
      'produto',v_lote->>'produto',
      'lote',v_lote->>'lote',
      'tipo','AUDITORIA',
      'acao','EXCLUSÃO DE ENTRADA',
      'quantidade',0,
      'movimentosRevertidos',v_mov_count,
      'registroExcluido',v_lote,
      'criadoEm',v_agora,
      'atualizadoPor',coalesce(nullif(p_usuario,''),'maquina'),
      'atualizadoEm',v_agora
    ),
    false,
    v_agora
  );

  return jsonb_build_object(
    'ok',true,
    'id',p_id,
    'movimentosRevertidos',v_mov_count,
    'auditoriaId',v_audit_id
  );
end;
$function$;
