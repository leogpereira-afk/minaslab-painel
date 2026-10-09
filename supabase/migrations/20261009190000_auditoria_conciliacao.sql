-- Trilha de auditoria da conciliação: toda gravação, alteração ou remoção de um vínculo (conciliacoes)
-- passa a ficar registrada em audit_log, com o que existia antes e depois e quem fez (quando se sabe).
-- A auditoria NUNCA derruba a conciliação: se o registro falhar, a operação segue.
create or replace function public.financeiro_auditar_conciliacao()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  usuario text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  -- Quem desfez: a função de desfazer informa em ml.usuario (mesma transação). Quem conciliou: conciliado_por.
  usuario := coalesce(nullif(current_setting('ml.usuario', true), ''), case when tg_op <> 'DELETE' then new.conciliado_por end);
  begin
    insert into public.audit_log (table_name, record_id, action, before_data, after_data, source_system, metadata)
    values (
      'conciliacoes', r.id, tg_op,
      case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
      case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
      'financeiro',
      jsonb_build_object(
        'usuario', usuario,
        'movimento_id', r.movimento_id,
        'recebimento_id', r.recebimento_id,
        'despesa_id', r.despesa_id,
        'valor_conciliado', r.valor_conciliado,
        'valor_movimento', r.valor_movimento
      )
    );
  exception when others then
    null;
  end;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_fin_conciliacao_auditar on public.conciliacoes;
create trigger trg_fin_conciliacao_auditar
  after insert or update or delete on public.conciliacoes
  for each row execute function public.financeiro_auditar_conciliacao();

-- Desfazer com autoria: apaga os vínculos e registra QUEM desfez, na mesma transação.
create or replace function public.financeiro_desfazer_conciliacao(
  p_coluna text, p_id uuid, p_usuario text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  removidas jsonb;
begin
  if p_coluna not in ('movimento_id', 'recebimento_id', 'despesa_id') then
    raise exception 'Coluna inválida para desfazer conciliação.';
  end if;
  perform set_config('ml.usuario', coalesce(nullif(p_usuario, ''), 'direcao'), true);
  execute format(
    'with d as (delete from public.conciliacoes where %I = $1 returning id, movimento_id, recebimento_id, despesa_id, valor_conciliado, valor_movimento) select coalesce(jsonb_agg(to_jsonb(d)), ''[]''::jsonb) from d',
    p_coluna
  ) into removidas using p_id;
  return removidas;
end;
$$;

revoke all on function public.financeiro_desfazer_conciliacao(text, uuid, text) from public, anon, authenticated;
