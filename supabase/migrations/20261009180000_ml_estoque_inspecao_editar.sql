-- Editar uma inspeção de recebimento já emitida (correção de fabricante, lote, validade, NF, notas e observações).
-- Mantém IR, pedido, item e operador originais; recalcula nota/parecer quando as cinco notas vêm; registra quem editou e o log de compras.
create or replace function public.ml_estoque_inspecao_editar(p_id text, p_ir jsonb, p_usuario text default 'maquina')
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_agora timestamptz := now();
  v_usuario text := coalesce(nullif(btrim(p_usuario), ''), 'maquina');
  v_ir jsonb := coalesce(p_ir, '{}'::jsonb);
  v_atual jsonb; v_novo jsonb; v_nota integer := 0; v_n text; v_parecer text; i integer; v_notas boolean := false;
begin
  select registro into v_atual from public.ml_registros
   where colecao = 'estoque_inspecoes' and id = p_id and not apagado for update;
  if v_atual is null then raise exception 'Inspeção não encontrada'; end if;
  if coalesce(btrim(v_ir->>'dataRecebimento'), '') = '' or coalesce(btrim(v_ir->>'fabricante'), '') = ''
     or coalesce(btrim(v_ir->>'lote'), '') = '' or coalesce(btrim(v_ir->>'validade'), '') = '' then
    raise exception 'Data de recebimento, fabricante, lote e validade são obrigatórios.';
  end if;
  v_novo := v_atual || jsonb_build_object(
    'dataRecebimento', btrim(v_ir->>'dataRecebimento'), 'fabricante', upper(btrim(v_ir->>'fabricante')),
    'lote', upper(btrim(v_ir->>'lote')), 'validade', btrim(v_ir->>'validade'),
    'notaFiscal', upper(btrim(coalesce(v_ir->>'notaFiscal', v_atual->>'notaFiscal', ''))),
    'observacoes', coalesce(v_ir->>'observacoes', v_atual->>'observacoes', ''));
  v_notas := v_ir ? 'c1' and v_ir ? 'c2' and v_ir ? 'c3' and v_ir ? 'c4' and v_ir ? 'c5';
  if v_notas then
    for i in 1..5 loop
      v_n := v_ir->>('c' || i);
      if v_n is null or v_n !~ '^[0-3]$' then raise exception 'As cinco notas da inspeção devem ser inteiros de 0 a 3.'; end if;
      v_nota := v_nota + v_n::integer;
      v_novo := v_novo || jsonb_build_object('c' || i, v_n::integer);
    end loop;
    v_parecer := case when v_nota <= 7 then 'RUIM' when v_nota <= 10 then 'BOM' else 'ÓTIMO' end;
    v_novo := v_novo || jsonb_build_object('notaFinal', v_nota, 'parecer', v_parecer, 'statusQualidade', v_parecer);
  end if;
  v_novo := v_novo || jsonb_build_object('editadoPor', v_usuario, 'editadoEm', v_agora, 'atualizadoPor', v_usuario, 'atualizadoEm', v_agora);
  update public.ml_registros set registro = v_novo, atualizado_em = v_agora
   where colecao = 'estoque_inspecoes' and id = p_id;
  perform public.ml_estoque_log_compra(coalesce(v_atual->>'idPedido', ''), coalesce(v_atual->>'itemPedidoId', ''), v_usuario,
    'Inspeção ' || p_id || ' editada por ' || v_usuario, 'INSPEÇÃO EDITADA');
  return jsonb_build_object('ok', true, 'inspecao', v_novo);
end $$;
revoke all on function public.ml_estoque_inspecao_editar(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.ml_estoque_inspecao_editar(text, jsonb, text) to service_role;
