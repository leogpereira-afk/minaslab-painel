-- Pedido de compra (Gestão de Estoque): cancelamento PARCIAL, desfazer o
-- parcial e REATIVAR item cancelado. Pedido do Léo, 19/11/2026: "se eu cancelar
-- errado, tem como voltar sem precisar pedir?" e "pedi 4, vou cancelar 2 e
-- continuar com 2 sem atrapalhar a inspeção e a entrada no estoque".
--
-- O item segue sendo UMA linha: o parcial reduz `quantidadeKits` e o `valor`
-- (total do item) na proporção. A inspeção e o "Gerar Entrada" já leem o
-- item como está, então seguem com a quantidade que sobrou. O que foi
-- cancelado fica no próprio item (`cancelamentosParciais`) e no log do pedido.
-- Nada se apaga: reativar e desfazer também ficam registrados.

create or replace function public.ml_estoque_pedido_cancelar_parcial(
  p_id text, p_quantidade numeric, p_motivo text, p_observacao text default '', p_usuario text default 'maquina', p_valor_novo numeric default null)
returns jsonb language plpgsql set search_path to 'public' as $function$
declare
  v_reg jsonb; v_codigo text; v_agora timestamptz := now(); v_status text;
  v_motivo text := btrim(coalesce(p_motivo, '')); v_obs text := btrim(coalesce(p_observacao, ''));
  v_usuario text := coalesce(nullif(btrim(p_usuario), ''), 'maquina');
  v_qtd numeric; v_valor numeric; v_resta numeric; v_valor_novo numeric; v_hist jsonb; v_informado boolean := p_valor_novo is not null;
begin
  if v_motivo = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
  if upper(v_motivo) = 'OUTRO' and length(v_obs) < 5 then raise exception 'Em "Outro", descreva o motivo na observação (mínimo 5 caracteres).'; end if;
  select registro into v_reg from public.ml_registros where colecao = 'estoque_pedidos' and id = p_id and not apagado for update;
  if v_reg is null then raise exception 'Item do pedido não encontrado.'; end if;
  v_status := upper(trim(coalesce(nullif(trim(v_reg->>'status'), ''), 'PENDENTE')));
  if v_status not in ('PENDENTE', 'AUTORIZADO') then
    raise exception 'Só dá para cancelar parte de um item PENDENTE ou AUTORIZADO (este item está %).', v_status;
  end if;
  v_qtd := case when coalesce(v_reg->>'quantidadeKits', '') ~ '^[0-9]+([.][0-9]+)?$' then (v_reg->>'quantidadeKits')::numeric else 0 end;
  v_valor := case when coalesce(v_reg->>'valor', '') ~ '^[0-9]+([.][0-9]+)?$' then (v_reg->>'valor')::numeric else 0 end;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe quantos quer cancelar.'; end if;
  if p_quantidade >= v_qtd then
    raise exception 'Para cancelar tudo (% de %), use "Cancelar item inteiro".', p_quantidade, v_qtd;
  end if;
  if v_informado and p_valor_novo < 0 then raise exception 'O novo valor não pode ser negativo.'; end if;
  v_resta := trim_scale(v_qtd - p_quantidade);
  -- Valor: o informado (o fornecedor pode cobrar diferente) ou o proporcional.
  v_valor_novo := case when v_informado then round(p_valor_novo, 2) else round(v_valor * v_resta / v_qtd, 2) end;
  v_codigo := coalesce(v_reg->>'pedidoCodigo', v_reg->>'idPedido', p_id);
  v_hist := coalesce(v_reg->'cancelamentosParciais', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'quantidade', p_quantidade, 'quantidadeAntes', v_qtd, 'quantidadeDepois', v_resta,
    'valorAntes', v_valor, 'valorDepois', v_valor_novo, 'valorInformado', v_informado, 'motivo', v_motivo, 'observacao', v_obs,
    'usuario', v_usuario, 'em', v_agora));
  v_reg := v_reg || jsonb_build_object(
    'quantidadeKits', v_resta, 'valor', v_valor_novo,
    'quantidadeOriginal', coalesce(v_reg->'quantidadeOriginal', to_jsonb(v_qtd)),
    'valorOriginal', coalesce(v_reg->'valorOriginal', to_jsonb(v_valor)),
    'cancelamentosParciais', v_hist, 'atualizadoPor', v_usuario, 'atualizadoEm', v_agora);
  update public.ml_registros set registro = v_reg, atualizado_em = v_agora where colecao = 'estoque_pedidos' and id = p_id;
  perform public.ml_estoque_log_compra(v_codigo, p_id, v_usuario,
    'Cancelamento parcial do item ' || p_id || ': ' || p_quantidade || ' de ' || v_qtd || ' ' || coalesce(v_reg->>'unidade', 'UN')
    || ' (fica ' || v_resta || '; valor ' || v_valor || ' → ' || v_valor_novo || case when v_informado then ' informado' else '' end || ') por ' || v_usuario || ': ' || v_motivo
    || case when v_obs <> '' then ' — ' || v_obs else '' end, 'CANCELAMENTO PARCIAL');
  return jsonb_build_object('ok', true, 'item', v_reg, 'pedidoCodigo', v_codigo);
end $function$;

-- Desfaz o ÚLTIMO cancelamento parcial: devolve quantidade e valor de antes.
create or replace function public.ml_estoque_pedido_desfazer_parcial(
  p_id text, p_motivo text, p_usuario text default 'maquina')
returns jsonb language plpgsql set search_path to 'public' as $function$
declare
  v_reg jsonb; v_codigo text; v_agora timestamptz := now(); v_status text; v_ult jsonb; v_hist jsonb;
  v_motivo text := btrim(coalesce(p_motivo, '')); v_usuario text := coalesce(nullif(btrim(p_usuario), ''), 'maquina');
  v_qtd numeric; v_cancelada numeric; v_valor numeric; v_valor_cancelado numeric;
begin
  if length(v_motivo) < 5 then raise exception 'Diga por que está desfazendo (mínimo 5 caracteres).'; end if;
  select registro into v_reg from public.ml_registros where colecao = 'estoque_pedidos' and id = p_id and not apagado for update;
  if v_reg is null then raise exception 'Item do pedido não encontrado.'; end if;
  v_status := upper(trim(coalesce(nullif(trim(v_reg->>'status'), ''), 'PENDENTE')));
  if v_status not in ('PENDENTE', 'AUTORIZADO') then
    raise exception 'Só dá para desfazer em item PENDENTE ou AUTORIZADO (este item está %).', v_status;
  end if;
  v_hist := coalesce(v_reg->'cancelamentosParciais', '[]'::jsonb);
  if jsonb_array_length(v_hist) = 0 then raise exception 'Este item não tem cancelamento parcial para desfazer.'; end if;
  v_ult := v_hist->(jsonb_array_length(v_hist) - 1);
  -- Soma o que foi cancelado ao que o item tem HOJE (e não volta a um número
  -- velho gravado): se a quantidade foi editada depois, a edição se mantém.
  v_qtd := coalesce(nullif(v_reg->>'quantidadeKits', '')::numeric, 0);
  v_cancelada := coalesce((v_ult->>'quantidade')::numeric, 0);
  v_valor := coalesce(nullif(v_reg->>'valor', '')::numeric, 0);
  v_valor_cancelado := coalesce((v_ult->>'valorAntes')::numeric, 0) - coalesce((v_ult->>'valorDepois')::numeric, 0);
  v_codigo := coalesce(v_reg->>'pedidoCodigo', v_reg->>'idPedido', p_id);
  v_reg := v_reg || jsonb_build_object(
    'quantidadeKits', trim_scale(v_qtd + v_cancelada), 'valor', round(v_valor + v_valor_cancelado, 2),
    'cancelamentosParciais', v_hist - (jsonb_array_length(v_hist) - 1),
    'parciaisDesfeitos', coalesce(v_reg->'parciaisDesfeitos', '[]'::jsonb)
      || jsonb_build_array(v_ult || jsonb_build_object('desfeitoPor', v_usuario, 'desfeitoEm', v_agora, 'motivoDesfazer', v_motivo)),
    'atualizadoPor', v_usuario, 'atualizadoEm', v_agora);
  if jsonb_array_length(v_reg->'cancelamentosParciais') = 0 then
    v_reg := v_reg - 'quantidadeOriginal' - 'valorOriginal';
  end if;
  update public.ml_registros set registro = v_reg, atualizado_em = v_agora where colecao = 'estoque_pedidos' and id = p_id;
  perform public.ml_estoque_log_compra(v_codigo, p_id, v_usuario,
    'Cancelamento parcial desfeito no item ' || p_id || ': volta ' || v_cancelada || ' (fica ' || (v_qtd + v_cancelada) || ') por ' || v_usuario || ': ' || v_motivo,
    'PARCIAL DESFEITO');
  return jsonb_build_object('ok', true, 'item', v_reg, 'pedidoCodigo', v_codigo);
end $function$;

-- Reativa item CANCELADO por inteiro: volta a PENDENTE. O cancelamento sai do
-- item, mas fica guardado em `cancelamentosDesfeitos` e no log do pedido.
create or replace function public.ml_estoque_pedido_reativar(
  p_id text, p_motivo text, p_usuario text default 'maquina')
returns jsonb language plpgsql set search_path to 'public' as $function$
declare
  v_reg jsonb; v_codigo text; v_agora timestamptz := now(); v_status text;
  v_motivo text := btrim(coalesce(p_motivo, '')); v_usuario text := coalesce(nullif(btrim(p_usuario), ''), 'maquina');
begin
  if length(v_motivo) < 5 then raise exception 'Diga por que está reativando (mínimo 5 caracteres).'; end if;
  select registro into v_reg from public.ml_registros where colecao = 'estoque_pedidos' and id = p_id and not apagado for update;
  if v_reg is null then raise exception 'Item do pedido não encontrado.'; end if;
  v_status := upper(trim(coalesce(nullif(trim(v_reg->>'status'), ''), 'PENDENTE')));
  if v_status <> 'CANCELADO' then raise exception 'Só item CANCELADO pode ser reativado (este item está %).', v_status; end if;
  v_codigo := coalesce(v_reg->>'pedidoCodigo', v_reg->>'idPedido', p_id);
  v_reg := (v_reg - 'motivoCancelamento' - 'observacaoCancelamento' - 'canceladoPor' - 'canceladoEm')
    || jsonb_build_object('status', 'PENDENTE',
      'cancelamentosDesfeitos', coalesce(v_reg->'cancelamentosDesfeitos', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'motivo', v_reg->>'motivoCancelamento', 'observacao', v_reg->>'observacaoCancelamento',
        'canceladoPor', v_reg->>'canceladoPor', 'canceladoEm', v_reg->>'canceladoEm',
        'reativadoPor', v_usuario, 'reativadoEm', v_agora, 'motivoReativacao', v_motivo)),
      'atualizadoPor', v_usuario, 'atualizadoEm', v_agora);
  update public.ml_registros set registro = v_reg, atualizado_em = v_agora where colecao = 'estoque_pedidos' and id = p_id;
  perform public.ml_estoque_log_compra(v_codigo, p_id, v_usuario,
    'Item ' || p_id || ' reativado (volta a PENDENTE) por ' || v_usuario || ': ' || v_motivo, 'REATIVADO');
  return jsonb_build_object('ok', true, 'item', v_reg, 'pedidoCodigo', v_codigo);
end $function$;

-- Mesmo acesso das outras funções do pedido: só o servidor (ml-sync, service_role).
revoke all on function public.ml_estoque_pedido_cancelar_parcial(text, numeric, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.ml_estoque_pedido_desfazer_parcial(text, text, text) from public, anon, authenticated;
revoke all on function public.ml_estoque_pedido_reativar(text, text, text) from public, anon, authenticated;
grant execute on function public.ml_estoque_pedido_cancelar_parcial(text, numeric, text, text, text, numeric) to service_role;
grant execute on function public.ml_estoque_pedido_desfazer_parcial(text, text, text) to service_role;
grant execute on function public.ml_estoque_pedido_reativar(text, text, text) to service_role;
