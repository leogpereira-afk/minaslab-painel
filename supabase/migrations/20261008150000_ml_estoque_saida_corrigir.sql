-- Correção de saída (baixa) lançada errada, sem apagar histórico.
-- EXCLUIR: devolve a quantidade ao lote (estorno), marca a saída original como cancelada e grava um movimento de estorno.
-- EDITAR : estorno da saída original + nova saída corrigida (quantidade, responsável e/ou lote), com a data original.
-- Tudo na mesma transação e com os lotes travados, como em ml_estoque_movimentar. Quem pode chamar é decidido no ml-sync.
create or replace function public.ml_estoque_saida_corrigir(
  p_movimento_id text, p_acao text, p_motivo text, p_usuario text, p_novo jsonb default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_agora timestamptz := now();
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_mov jsonb; v_qtd numeric; v_lote_id text; v_lote jsonb; v_total numeric; v_recebido numeric;
  v_est_id text; v_estorno jsonb;
  v_alvo_id text; v_alvo jsonb; v_nq numeric; v_resp text; v_saldo numeric; v_novo_id text; v_novo_mov jsonb;
begin
  if p_acao not in ('excluir', 'editar') then raise exception 'Ação de correção inválida'; end if;
  if length(v_motivo) < 5 then raise exception 'Informe o motivo da correção (mínimo 5 caracteres)'; end if;

  select registro into v_mov from public.ml_registros
  where colecao = 'estoque_movimentos' and id = p_movimento_id and apagado = false for update;
  if v_mov is null then raise exception 'Saída não encontrada'; end if;
  if upper(coalesce(v_mov->>'tipo', '')) <> 'SAIDA' or upper(coalesce(v_mov->>'acao', '')) not like 'RETIRADA%' then
    raise exception 'Só é possível corrigir saídas (retiradas)';
  end if;
  if coalesce((v_mov->>'cancelado')::boolean, false) then raise exception 'Esta saída já foi corrigida ou cancelada'; end if;

  v_qtd := coalesce((v_mov->>'quantidade')::numeric, 0);
  v_lote_id := nullif(v_mov->>'loteId', '');
  if v_qtd <= 0 then raise exception 'Saída com quantidade inválida'; end if;
  if v_lote_id is null then raise exception 'Esta saída não tem lote vinculado; corrija pelo cadastro do lote'; end if;

  select registro into v_lote from public.ml_registros
  where colecao = 'estoque_lotes' and id = v_lote_id and apagado = false for update;
  if v_lote is null then raise exception 'Lote da saída não encontrado'; end if;

  -- estorno: devolve ao lote
  v_total := coalesce((v_lote->>'totalAtual')::numeric, (v_lote->>'qtdAtual')::numeric, 0) + v_qtd;
  v_recebido := nullif(v_lote->>'totalRecebido', '')::numeric;
  if v_recebido is not null and v_total > v_recebido + 0.000001 then
    raise exception 'O estorno deixaria o saldo acima do total recebido do lote; confira o lote antes de corrigir';
  end if;
  v_lote := jsonb_set(v_lote, '{totalAtual}', to_jsonb(v_total), true);
  v_lote := jsonb_set(v_lote, '{qtdRetirada}', to_jsonb(greatest(0, coalesce((v_lote->>'qtdRetirada')::numeric, 0) - v_qtd)), true);
  v_lote := v_lote || jsonb_build_object('atualizadoPor', p_usuario, 'atualizadoEm', v_agora);

  v_est_id := 'EST-' || replace(gen_random_uuid()::text, '-', '');
  v_estorno := jsonb_build_object(
    'id', v_est_id, 'loteId', v_lote_id, 'codigoID', v_mov->'codigoID', 'produto', v_mov->'produto', 'lote', v_mov->'lote',
    'unidade', v_mov->'unidade', 'quantidade', v_qtd, 'tipo', 'ESTORNO', 'acao', 'ESTORNO DE SAÍDA',
    'movimentoOrigemId', p_movimento_id, 'motivo', v_motivo, 'responsavel', p_usuario,
    'criadoEm', v_agora, 'atualizadoPor', p_usuario, 'atualizadoEm', v_agora);

  if p_acao = 'editar' then
    v_alvo_id := coalesce(nullif(p_novo->>'loteId', ''), v_lote_id);
    v_nq := coalesce(nullif(p_novo->>'quantidade', '')::numeric, v_qtd);
    v_resp := coalesce(nullif(btrim(p_novo->>'responsavel'), ''), v_mov->>'responsavel', '');
    if v_nq <= 0 then raise exception 'Quantidade inválida'; end if;
    if v_alvo_id = v_lote_id then
      v_alvo := v_lote;
    else
      select registro into v_alvo from public.ml_registros
      where colecao = 'estoque_lotes' and id = v_alvo_id and apagado = false for update;
      if v_alvo is null then raise exception 'Lote escolhido não encontrado'; end if;
      if nullif(v_alvo->>'validade', '') is not null and left(v_alvo->>'validade', 10) < public.ml_estoque_hoje_br()::text then
        raise exception 'Lote vencido não pode ser utilizado';
      end if;
    end if;
    v_saldo := coalesce((v_alvo->>'totalAtual')::numeric, (v_alvo->>'qtdAtual')::numeric, 0);
    if v_nq > v_saldo + 0.000001 then raise exception 'Quantidade maior que o saldo disponível'; end if;
    v_alvo := jsonb_set(v_alvo, '{totalAtual}', to_jsonb(v_saldo - v_nq), true);
    v_alvo := jsonb_set(v_alvo, '{qtdRetirada}', to_jsonb(coalesce((v_alvo->>'qtdRetirada')::numeric, 0) + v_nq), true);
    v_alvo := v_alvo || jsonb_build_object('atualizadoPor', p_usuario, 'atualizadoEm', v_agora);

    v_novo_id := replace(gen_random_uuid()::text, '-', '');
    v_novo_mov := jsonb_build_object(
      'id', v_novo_id, 'loteId', v_alvo_id, 'codigoID', coalesce(v_alvo->'codigoID', v_alvo->'codigoAuto'), 'produto', v_alvo->'produto',
      'lote', v_alvo->'lote', 'unidade', v_alvo->'unidade', 'tipo', 'SAIDA', 'acao', 'RETIRADA (BAIXA)', 'quantidade', v_nq,
      'responsavel', v_resp, 'observacao', 'Correção da saída ' || p_movimento_id || ': ' || v_motivo,
      'corrigeMovimentoId', p_movimento_id, 'criadoEm', coalesce(v_mov->>'criadoEm', v_agora::text),
      'corrigidoEm', v_agora, 'atualizadoPor', p_usuario, 'atualizadoEm', v_agora);

    if v_alvo_id = v_lote_id then
      update public.ml_registros set registro = v_alvo, atualizado_em = v_agora
      where colecao = 'estoque_lotes' and id = v_lote_id;
    else
      update public.ml_registros set registro = v_lote, atualizado_em = v_agora
      where colecao = 'estoque_lotes' and id = v_lote_id;
      update public.ml_registros set registro = v_alvo, atualizado_em = v_agora
      where colecao = 'estoque_lotes' and id = v_alvo_id;
    end if;
    insert into public.ml_registros(colecao, id, registro, apagado, atualizado_em)
    values ('estoque_movimentos', v_novo_id, v_novo_mov, false, v_agora);
  else
    update public.ml_registros set registro = v_lote, atualizado_em = v_agora
    where colecao = 'estoque_lotes' and id = v_lote_id;
  end if;

  insert into public.ml_registros(colecao, id, registro, apagado, atualizado_em)
  values ('estoque_movimentos', v_est_id, v_estorno, false, v_agora);

  v_mov := v_mov || jsonb_build_object('cancelado', true, 'canceladoPor', p_usuario, 'canceladoEm', v_agora,
    'motivoCancelamento', v_motivo, 'correcao', p_acao, 'estornoId', v_est_id, 'corrigidoPorMovimentoId', v_novo_id);
  update public.ml_registros set registro = v_mov, atualizado_em = v_agora
  where colecao = 'estoque_movimentos' and id = p_movimento_id;

  return jsonb_build_object('ok', true, 'acao', p_acao, 'estornoId', v_est_id, 'novoMovimentoId', v_novo_id);
end $$;
revoke all on function public.ml_estoque_saida_corrigir(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ml_estoque_saida_corrigir(text, text, text, text, jsonb) to service_role;
