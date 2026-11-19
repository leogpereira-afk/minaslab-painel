-- Cancelar item de pedido de compra com motivo (e observação opcional). Só item PENDENTE, como antes.
-- Grava motivo, observação, quem cancelou e quando no próprio item, registra no histórico do pedido e devolve todos os itens
-- do pedido (a tela usa para montar o PDF "Controle de Cancelamento").
create or replace function public.ml_estoque_pedido_cancelar(p_id text, p_motivo text, p_observacao text default '', p_usuario text default 'maquina')
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_reg jsonb; v_codigo text; v_agora timestamptz := now();
  v_motivo text := btrim(coalesce(p_motivo, '')); v_obs text := btrim(coalesce(p_observacao, ''));
  v_usuario text := coalesce(nullif(btrim(p_usuario), ''), 'maquina'); v_status text; v_itens jsonb;
begin
  if v_motivo = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
  if upper(v_motivo) = 'OUTRO' and length(v_obs) < 5 then raise exception 'Em "Outro", descreva o motivo na observação (mínimo 5 caracteres).'; end if;
  select registro into v_reg from public.ml_registros where colecao = 'estoque_pedidos' and id = p_id and not apagado for update;
  if v_reg is null then raise exception 'Item do pedido não encontrado.'; end if;
  v_status := upper(trim(coalesce(nullif(trim(v_reg->>'status'), ''), 'PENDENTE')));
  if v_status <> 'PENDENTE' then raise exception 'Somente item PENDENTE pode ser cancelado (este item está %).', v_status; end if;
  v_codigo := coalesce(v_reg->>'pedidoCodigo', v_reg->>'idPedido', p_id);
  v_reg := v_reg || jsonb_build_object('status', 'CANCELADO', 'motivoCancelamento', v_motivo, 'observacaoCancelamento', v_obs,
            'canceladoPor', v_usuario, 'canceladoEm', v_agora, 'atualizadoPor', v_usuario, 'atualizadoEm', v_agora);
  update public.ml_registros set registro = v_reg, atualizado_em = v_agora where colecao = 'estoque_pedidos' and id = p_id;
  perform public.ml_estoque_log_compra(v_codigo, p_id, v_usuario,
    'Item ' || p_id || ' cancelado por ' || v_usuario || ': ' || v_motivo || case when v_obs <> '' then ' — ' || v_obs else '' end, 'CANCELADO');
  select coalesce(jsonb_agg(registro order by id), '[]'::jsonb) into v_itens from public.ml_registros
   where colecao = 'estoque_pedidos' and not apagado and coalesce(registro->>'pedidoCodigo', registro->>'idPedido') = v_codigo;
  return jsonb_build_object('ok', true, 'item', v_reg, 'itens', v_itens, 'pedidoCodigo', v_codigo);
end $$;
revoke all on function public.ml_estoque_pedido_cancelar(text, text, text, text) from public, anon, authenticated;
grant execute on function public.ml_estoque_pedido_cancelar(text, text, text, text) to service_role;
