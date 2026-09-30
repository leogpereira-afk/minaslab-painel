-- Gestão de Estoque — integridade no servidor (auditoria 30/09/2026).
-- Só funções: nenhuma tabela nova, nenhum dado alterado.
--  1) status de pedido com transições válidas (como no legado) e sem pular o laudo/entrada;
--  2) entrada de lote vinda de pedido: lote + movimento + item INTEGRADO na MESMA transação (sem duplicidade);
--  3) status de validade do lote calculado no servidor (fuso America/Sao_Paulo), com os textos do legado;
--  4) inspeção de recebimento atômica: IRnn sequencial, nota/parecer recalculados, operador = usuário logado,
--     item vira CONCLUÍDO junto;
--  5) ID sequencial F-nn para fornecedor; data do "lote vencido" na retirada no fuso do Brasil.

create or replace function public.ml_estoque_hoje_br() returns date
language sql stable set search_path=public as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.ml_estoque_status_validade(p_validade text) returns text
language sql stable set search_path=public as $$
  select case
    when nullif(btrim(coalesce(p_validade,'')),'') is null then ''
    when p_validade !~ '^\d{4}-\d{2}-\d{2}' then 'Erro verificar'
    when left(p_validade,10)::date < public.ml_estoque_hoje_br() then 'Vencido'
    when left(p_validade,10)::date - public.ml_estoque_hoje_br() < 30 then 'Vencimento em 30 dias'
    else 'Dentro do prazo'
  end
$$;

create or replace function public.ml_estoque_log_compra(p_codigo text,p_item text,p_usuario text,p_texto text,p_status text)
returns void language plpgsql set search_path=public as $$
declare v_agora timestamptz:=clock_timestamp(); v_id text;
begin
  v_id:='LOG-'||replace(coalesce(p_codigo,''),'-','')||'-'||to_char(v_agora,'YYYYMMDDHH24MISSMS')||'-'||substr(md5(random()::text),1,4);
  insert into public.ml_registros(colecao,id,registro,atualizado_em,apagado)
  values('estoque_logs_compras',v_id,jsonb_build_object('id',v_id,'pedidoCodigo',p_codigo,'itemId',p_item,'data',v_agora,'login',p_usuario,'log',p_texto,'status',p_status),v_agora,false)
  on conflict do nothing;
end $$;

-- 1) status do item do pedido ------------------------------------------------------------
create or replace function public.ml_estoque_pedido_status(p_id text,p_status text,p_data_chegada text default null,p_usuario text default 'maquina')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_reg jsonb; v_agora timestamptz:=now(); v_codigo text; v_status text:=upper(trim(coalesce(p_status,''))); v_atual text;
begin
 if v_status='' then raise exception 'Status obrigatório'; end if;
 if v_status='CONCLUIDO' then v_status:='CONCLUÍDO'; end if;
 if v_status not in ('PENDENTE','AUTORIZADO','CONCLUÍDO','INTEGRADO','CANCELADO') then raise exception 'Status inválido: %',v_status; end if;
 select registro into v_reg from public.ml_registros where colecao='estoque_pedidos' and id=p_id and not apagado for update;
 if v_reg is null then raise exception 'Item do pedido não encontrado'; end if;
 v_codigo:=coalesce(v_reg->>'pedidoCodigo',v_reg->>'idPedido',p_id);
 v_atual:=upper(trim(coalesce(v_reg->>'status','PENDENTE')));
 if v_atual='CONCLUIDO' then v_atual:='CONCLUÍDO'; end if;
 if v_atual=v_status then return jsonb_build_object('ok',true,'registro',v_reg,'semAlteracao',true); end if;
 -- Fluxo do legado: PENDENTE → AUTORIZADO | CANCELADO | CONCLUÍDO(laudo); AUTORIZADO → CONCLUÍDO; CONCLUÍDO → INTEGRADO(entrada)
 if not ((v_atual='PENDENTE' and v_status in ('AUTORIZADO','CANCELADO','CONCLUÍDO'))
      or (v_atual='AUTORIZADO' and v_status='CONCLUÍDO')
      or (v_atual='CONCLUÍDO' and v_status='INTEGRADO')) then
   raise exception 'Transição de status não permitida: % → %',v_atual,v_status;
 end if;
 if v_status='CONCLUÍDO' and not exists(select 1 from public.ml_registros i where i.colecao='estoque_inspecoes' and not i.apagado
      and (i.registro->>'itemPedidoId'=p_id or (coalesce(i.registro->>'itemPedidoId','')='' and i.registro->>'idPedido'=v_codigo))) then
   raise exception 'Emita o laudo de inspeção antes de concluir o recebimento.';
 end if;
 if v_status='INTEGRADO' and not exists(select 1 from public.ml_registros l where l.colecao='estoque_lotes' and not l.apagado and l.registro->>'itemPedidoId'=p_id) then
   raise exception 'Nenhuma entrada de estoque vinculada a este item. Use Gerar Entrada.';
 end if;
 v_reg:=v_reg||jsonb_build_object('status',v_status,'atualizadoPor',p_usuario,'atualizadoEm',v_agora);
 if v_status='CONCLUÍDO' then
   v_reg:=v_reg||jsonb_build_object('dataChegada',coalesce(nullif(p_data_chegada,''),public.ml_estoque_hoje_br()::text),'dataConclusao',v_agora,'usuarioConclusao',p_usuario);
 end if;
 update public.ml_registros set registro=v_reg,atualizado_em=v_agora where colecao='estoque_pedidos' and id=p_id;
 perform public.ml_estoque_log_compra(v_codigo,p_id,p_usuario,'Status do item '||p_id||' alterado de '||v_atual||' para '||v_status,v_status);
 return jsonb_build_object('ok',true,'registro',v_reg);
end $$;

-- 2) + 3) entrada de lote (com vínculo atômico ao item do pedido) ------------------------------
create or replace function public.ml_estoque_lote_novo(p_lote jsonb,p_movimento jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare
  v_lote jsonb:=coalesce(p_lote,'{}'::jsonb);
  v_mov jsonb:=coalesce(p_movimento,'{}'::jsonb);
  v_num integer; v_id text; v_mov_id text; v_agora timestamptz:=now();
  v_item_id text:=nullif(btrim(coalesce(p_lote->>'itemPedidoId','')),'');
  v_item jsonb; v_codigo text; v_usuario text:=coalesce(nullif(p_lote->>'atualizadoPor',''),'maquina');
begin
  if v_item_id is not null then
    select registro into v_item from public.ml_registros where colecao='estoque_pedidos' and id=v_item_id and not apagado for update;
    if v_item is null then raise exception 'Item do pedido não encontrado.'; end if;
    v_codigo:=coalesce(v_item->>'pedidoCodigo',v_item->>'idPedido',v_item_id);
    if upper(coalesce(v_item->>'status',''))<>'CONCLUÍDO' then
      raise exception 'O item % do pedido % está % e não pode gerar entrada. Só item CONCLUÍDO (laudo emitido).',v_item_id,v_codigo,coalesce(v_item->>'status','PENDENTE');
    end if;
    if exists(select 1 from public.ml_registros l where l.colecao='estoque_lotes' and not l.apagado and l.registro->>'itemPedidoId'=v_item_id) then
      raise exception 'Este item do pedido % já possui entrada de estoque.',v_codigo;
    end if;
    v_lote:=v_lote||jsonb_build_object('pedidoCodigo',v_codigo);
  end if;

  perform pg_advisory_xact_lock(hashtext('estoque_lotes_codigo_ml'));
  select coalesce(max((regexp_match(id,'^ML-([0-9]+)$'))[1]::integer),0)+1
    into v_num from public.ml_registros
   where colecao='estoque_lotes' and apagado=false and id ~ '^ML-[0-9]+$';
  v_id:='ML-'||v_num::text;
  v_mov_id:=coalesce(nullif(v_mov->>'id',''),gen_random_uuid()::text);
  v_lote:=v_lote||jsonb_build_object('id',v_id,'codigoID',v_id,'codigoAuto',v_id,
                                     'statusValidade',public.ml_estoque_status_validade(v_lote->>'validade'));
  v_mov:=v_mov||jsonb_build_object('id',v_mov_id,'loteId',v_id,'codigoID',v_id);
  if v_item_id is not null then
    v_mov:=v_mov||jsonb_build_object('pedidoCodigo',v_codigo,'itemPedidoId',v_item_id);
  end if;
  insert into public.ml_registros(colecao,id,registro,apagado,atualizado_em) values('estoque_lotes',v_id,v_lote,false,v_agora);
  insert into public.ml_registros(colecao,id,registro,apagado,atualizado_em) values('estoque_movimentos',v_mov_id,v_mov,false,v_agora);

  if v_item_id is not null then
    update public.ml_registros
       set registro=v_item||jsonb_build_object('status','INTEGRADO','loteId',v_id,'dataIntegracao',v_agora,'atualizadoPor',v_usuario,'atualizadoEm',v_agora),
           atualizado_em=v_agora
     where colecao='estoque_pedidos' and id=v_item_id;
    perform public.ml_estoque_log_compra(v_codigo,v_item_id,v_usuario,'Entrada '||v_id||' gerada; item '||v_item_id||' INTEGRADO','INTEGRADO');
  end if;
  return jsonb_build_object('ok',true,'lote',v_lote,'movimento',v_mov,'itemIntegrado',v_item_id is not null);
end $$;

-- retirada/entrada: "lote vencido" no fuso do Brasil ------------------------------------------
create or replace function public.ml_estoque_movimentar(p_acao text,p_lote jsonb,p_movimento jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare
  v_id text; v_movimento_id text; v_atual jsonb; v_novo jsonb;
  v_saldo numeric; v_qtd numeric; v_agora timestamptz:=now();
begin
  v_id:=nullif(p_lote->>'id','');
  v_movimento_id:=nullif(p_movimento->>'id','');
  if v_id is null then raise exception 'Lote sem identificador'; end if;
  if v_movimento_id is null then raise exception 'Movimento sem identificador'; end if;

  if p_acao='entrada' then
    v_qtd:=coalesce((p_lote->>'totalRecebido')::numeric,(p_lote->>'totalAtual')::numeric,0);
    if v_qtd<=0 then raise exception 'Quantidade recebida inválida'; end if;
    v_novo:=p_lote;
    insert into public.ml_registros(colecao,id,registro,apagado,atualizado_em)
    values('estoque_lotes',v_id,v_novo,false,v_agora)
    on conflict(colecao,id) do nothing;
    if not found then raise exception 'Código de lote já existente. Atualize a página e tente novamente'; end if;
  elsif p_acao='retirada' then
    select registro into v_atual from public.ml_registros
    where colecao='estoque_lotes' and id=v_id and apagado=false for update;
    if v_atual is null then raise exception 'Lote não encontrado'; end if;
    v_saldo:=coalesce((v_atual->>'totalAtual')::numeric,(v_atual->>'qtdAtual')::numeric,0);
    v_qtd:=coalesce((p_movimento->>'quantidade')::numeric,0);
    if v_qtd<=0 then raise exception 'Quantidade inválida'; end if;
    if v_qtd>v_saldo then raise exception 'Quantidade maior que o saldo disponível'; end if;
    if nullif(v_atual->>'validade','') is not null and left(v_atual->>'validade',10)<public.ml_estoque_hoje_br()::text then
      raise exception 'Lote vencido não pode ser utilizado';
    end if;
    v_novo:=jsonb_set(v_atual,'{qtdRetirada}',to_jsonb(coalesce((v_atual->>'qtdRetirada')::numeric,0)+v_qtd),true);
    v_novo:=jsonb_set(v_novo,'{totalAtual}',to_jsonb(v_saldo-v_qtd),true);
    v_novo:=jsonb_set(v_novo,'{ultimaRetirada}',to_jsonb(v_agora::text),true);
    if coalesce(p_lote->>'dataAbertura','')<>'' and coalesce(v_atual->>'dataAbertura','')='' then
      v_novo:=jsonb_set(v_novo,'{dataAbertura}',to_jsonb(p_lote->>'dataAbertura'),true);
    end if;
    update public.ml_registros set registro=v_novo,apagado=false,atualizado_em=v_agora
    where colecao='estoque_lotes' and id=v_id;
  else
    raise exception 'Ação de estoque inválida';
  end if;

  insert into public.ml_registros(colecao,id,registro,apagado,atualizado_em)
  values('estoque_movimentos',v_movimento_id,p_movimento,false,v_agora)
  on conflict(colecao,id) do nothing;
  if not found then raise exception 'Movimento já registrado'; end if;

  return jsonb_build_object('ok',true,'lote',v_novo,'movimento',p_movimento);
end $$;

-- 4) inspeção de recebimento atômica ------------------------------------------------------------
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
  select coalesce(max(nullif(regexp_replace(coalesce(registro->>'idIrOrigem',registro->>'idIr',''),'\D','','g'),'')::integer),0)+1
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

-- 5) fornecedor com ID sequencial F-nn (como no legado) -------------------------------------------
create or replace function public.ml_estoque_fornecedor_salvar(p_registro jsonb,p_usuario text)
returns jsonb language plpgsql set search_path=public as $$
declare v_reg jsonb:=coalesce(p_registro,'{}'::jsonb); v_id text:=nullif(btrim(v_reg->>'id'),''); v_num integer; v_now timestamptz:=now();
begin
  if v_id is null then
    perform pg_advisory_xact_lock(hashtext('estoque_fornecedores_codigo_f'));
    select coalesce(max((regexp_match(id,'^F-([0-9]+)$'))[1]::integer),0)+1 into v_num
      from public.ml_registros where colecao='estoque_fornecedores' and id ~ '^F-[0-9]+$';
    v_id:='F-'||v_num::text;
  end if;
  v_reg:=v_reg||jsonb_build_object('id',v_id,'atualizadoPor',coalesce(nullif(p_usuario,''),'maquina'),'atualizadoEm',v_now);
  insert into public.ml_registros(colecao,id,registro,apagado,atualizado_em) values('estoque_fornecedores',v_id,v_reg,false,v_now)
  on conflict(colecao,id) do update set registro=excluded.registro,apagado=false,atualizado_em=excluded.atualizado_em;
  return v_reg;
end $$;
