-- Renomear (ou unir) um TIPO DE FORNECEDOR / PROVEDOR em tudo de uma vez, na mesma transação:
--   fornecedores que usam o tipo, regras documentais do tipo e a lista cadastrada em Configurações (estoque_config).
-- Se o nome novo já existir, os dois tipos são unidos; uma regra do tipo antigo que repetiria uma regra ativa do tipo novo
-- (mesmo documento) é apagada de forma lógica, para não ficar regra duplicada. Fica um registro em estoque_auditoria.
create or replace function public.ml_estoque_tipo_fornecedor_renomear(p_antigo text, p_novo text, p_usuario text default 'maquina')
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_ant text := upper(btrim(coalesce(p_antigo, '')));
  v_novo text := upper(btrim(coalesce(p_novo, '')));
  v_agora timestamptz := now();
  v_forn int := 0; v_reg int := 0; v_unidas int := 0;
  r record; v_cfg jsonb; v_lista text[]; v_item text;
begin
  if v_ant = '' or v_novo = '' then raise exception 'Informe o tipo atual e o novo nome'; end if;
  if v_ant = v_novo then raise exception 'O nome novo é igual ao atual'; end if;
  perform pg_advisory_xact_lock(hashtext('ml_tipo_fornecedor'));

  with u as (
    update public.ml_registros
       set registro = registro || jsonb_build_object('tipoFornecedor', v_novo, 'atualizadoPor', p_usuario, 'atualizadoEm', v_agora),
           atualizado_em = v_agora
     where colecao = 'estoque_fornecedores' and not apagado
       and upper(btrim(coalesce(registro->>'tipoFornecedor', ''))) = v_ant
    returning 1)
  select count(*) into v_forn from u;

  for r in
    select id, registro from public.ml_registros
     where colecao = 'estoque_regras_documentos_fornecedor' and not apagado
       and upper(btrim(coalesce(registro->>'tipoFornecedor', ''))) = v_ant
     for update
  loop
    if upper(coalesce(r.registro->>'ativo', 'SIM')) <> 'NÃO' and exists (
         select 1 from public.ml_registros x
          where x.colecao = 'estoque_regras_documentos_fornecedor' and not x.apagado and x.id <> r.id
            and upper(btrim(coalesce(x.registro->>'tipoFornecedor', ''))) = v_novo
            and coalesce(x.registro->>'tipoDocumentoId', '') = coalesce(r.registro->>'tipoDocumentoId', '')
            and upper(coalesce(x.registro->>'ativo', 'SIM')) <> 'NÃO') then
      update public.ml_registros
         set apagado = true, atualizado_em = v_agora,
             registro = r.registro || jsonb_build_object('atualizadoPor', p_usuario, 'atualizadoEm', v_agora, 'unidaPara', v_novo)
       where colecao = 'estoque_regras_documentos_fornecedor' and id = r.id;
      v_unidas := v_unidas + 1;
    else
      update public.ml_registros
         set registro = r.registro || jsonb_build_object('tipoFornecedor', v_novo, 'atualizadoPor', p_usuario, 'atualizadoEm', v_agora),
             atualizado_em = v_agora
       where colecao = 'estoque_regras_documentos_fornecedor' and id = r.id;
      v_reg := v_reg + 1;
    end if;
  end loop;

  -- lista cadastrada em Configurações: tira o nome antigo, garante o novo, sem repetir
  select registro into v_cfg from public.ml_registros where colecao = 'estoque_config' and id = 'config-principal' and not apagado for update;
  v_lista := array[]::text[];
  if v_cfg is not null then
    for v_item in select btrim(x) from unnest(regexp_split_to_array(coalesce(v_cfg->>'tiposFornecedor', ''), E'\r?\n')) x loop
      if v_item <> '' and upper(v_item) <> v_ant and not (upper(v_item) = any (select upper(y) from unnest(v_lista) y)) then
        v_lista := v_lista || v_item;
      end if;
    end loop;
  end if;
  if not (v_novo = any (select upper(y) from unnest(v_lista) y)) then v_lista := v_lista || v_novo; end if;
  insert into public.ml_registros(colecao, id, registro, apagado, atualizado_em)
  values ('estoque_config', 'config-principal',
          coalesce(v_cfg, jsonb_build_object('id', 'config-principal')) || jsonb_build_object('tiposFornecedor', array_to_string(v_lista, E'\n'), 'atualizadoPor', p_usuario, 'atualizadoEm', v_agora),
          false, v_agora)
  on conflict (colecao, id) do update set registro = excluded.registro, apagado = false, atualizado_em = excluded.atualizado_em;

  insert into public.ml_registros(colecao, id, registro, apagado, atualizado_em)
  values ('estoque_auditoria', 'AUD-TIPOFORN-' || replace(gen_random_uuid()::text, '-', ''),
          jsonb_build_object('evento', 'TIPO_FORNECEDOR_RENOMEADO', 'de', v_ant, 'para', v_novo, 'fornecedores', v_forn,
                             'regras', v_reg, 'regrasUnidas', v_unidas, 'usuario', p_usuario, 'data', v_agora),
          false, v_agora);

  return jsonb_build_object('ok', true, 'de', v_ant, 'para', v_novo, 'fornecedores', v_forn, 'regras', v_reg, 'regrasUnidas', v_unidas);
end $$;
revoke all on function public.ml_estoque_tipo_fornecedor_renomear(text, text, text) from public, anon, authenticated;
grant execute on function public.ml_estoque_tipo_fornecedor_renomear(text, text, text) to service_role;
