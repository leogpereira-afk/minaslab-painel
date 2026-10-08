-- Gestão de Estoque: importação única da planilha do sistema antigo (08/10/2026).
-- Grava registros JÁ montados (com os códigos da planilha: F-nn, ML-nn, PC-nn, IR-nn) em ml_registros.
-- Segurança:
--  * não sobrescreve nada: se o (colecao, id) já existe, pula e conta como "pulado" (pode rodar de novo sem duplicar);
--  * só aceita coleções do estoque;
--  * só o service_role executa (nem anon nem usuário logado);
--  * os códigos seguintes continuam do maior número importado (as funções de código já usam max()+1).
create or replace function public.ml_estoque_importar_legado(p_colecao text, p_cols text[], p_rows jsonb, p_usuario text default 'importacao')
returns jsonb language plpgsql set search_path = public as $$
declare
  v_row jsonb; v_reg jsonb; v_i int; v_id text; v_agora timestamptz := now();
  v_ins int := 0; v_pul int := 0; v_lote jsonb; v_v jsonb;
begin
  if p_colecao not in ('estoque_fornecedores','estoque_produtos_base','estoque_pedidos','estoque_inspecoes','estoque_lotes',
                       'estoque_movimentos','estoque_logs_compras','estoque_tipos_documentos_fornecedor','estoque_regras_documentos_fornecedor') then
    raise exception 'Coleção não permitida na importação: %', p_colecao;
  end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'p_rows deve ser uma lista'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_reg := '{}'::jsonb;
    for v_i in 1..array_length(p_cols,1) loop
      v_v := v_row -> (v_i - 1);
      if v_v is not null and v_v <> 'null'::jsonb and v_v <> '""'::jsonb then
        v_reg := v_reg || jsonb_build_object(p_cols[v_i], v_v);
      end if;
    end loop;
    v_id := v_reg ->> 'id';
    if v_id is null then raise exception 'Linha sem id na coleção %', p_colecao; end if;
    if p_colecao = 'estoque_movimentos' then
      -- produto, lote e unidade do movimento vêm do lote quando não informados (arquivo menor)
      select registro into v_lote from public.ml_registros where colecao='estoque_lotes' and id = v_reg->>'loteId';
      if v_lote is not null then
        v_reg := jsonb_strip_nulls(jsonb_build_object('produto', v_lote->'produto', 'lote', v_lote->'lote', 'unidade', v_lote->'unidade') || v_reg);
      end if;
    end if;
    v_reg := v_reg || jsonb_build_object('atualizadoPor', p_usuario, 'atualizadoEm', v_agora, 'importadoEm', v_agora, 'origem', 'IMPORTACAO_LEGADO');
    insert into public.ml_registros(colecao, id, registro, apagado, atualizado_em)
    values (p_colecao, v_id, v_reg, false, v_agora)
    on conflict (colecao, id) do nothing;
    if found then v_ins := v_ins + 1; else v_pul := v_pul + 1; end if;
  end loop;
  return jsonb_build_object('colecao', p_colecao, 'inseridos', v_ins, 'pulados', v_pul);
end $$;
revoke all on function public.ml_estoque_importar_legado(text, text[], jsonb, text) from public, anon, authenticated;
grant execute on function public.ml_estoque_importar_legado(text, text[], jsonb, text) to service_role;
