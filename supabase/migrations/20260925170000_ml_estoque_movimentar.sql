create or replace function public.ml_estoque_movimentar(p_acao text, p_lote jsonb, p_movimento jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id text; v_atual jsonb; v_novo jsonb; v_saldo numeric; v_qtd numeric; v_agora timestamptz := now();
begin
  v_id := coalesce(p_lote->>'id','');
  if v_id = '' then raise exception 'Lote sem identificador'; end if;
  if p_acao = 'entrada' then
    v_qtd := coalesce((p_lote->>'totalRecebido')::numeric,(p_lote->>'totalAtual')::numeric,0);
    if v_qtd <= 0 then raise exception 'Quantidade recebida inválida'; end if;
    v_novo := p_lote;
    insert into public.ml_registros(colecao,id,registro,apagado,atualizado_em)
    values('estoque_lotes',v_id,v_novo,false,v_agora)
    on conflict(colecao,id) do update set registro=excluded.registro,apagado=false,atualizado_em=excluded.atualizado_em;
  elsif p_acao = 'retirada' then
    select registro into v_atual from public.ml_registros where colecao='estoque_lotes' and id=v_id and apagado=false for update;
    if v_atual is null then raise exception 'Lote não encontrado'; end if;
    v_saldo := coalesce((v_atual->>'totalAtual')::numeric,(v_atual->>'qtdAtual')::numeric,0);
    v_qtd := coalesce((p_movimento->>'quantidade')::numeric,0);
    if v_qtd <= 0 then raise exception 'Quantidade inválida'; end if;
    if v_qtd > v_saldo then raise exception 'Quantidade maior que o saldo disponível'; end if;
    if nullif(v_atual->>'validade','') is not null and left(v_atual->>'validade',10) < current_date::text then raise exception 'Lote vencido não pode ser utilizado'; end if;
    v_novo := jsonb_set(v_atual,'{qtdRetirada}',to_jsonb(coalesce((v_atual->>'qtdRetirada')::numeric,0)+v_qtd),true);
    v_novo := jsonb_set(v_novo,'{totalAtual}',to_jsonb(v_saldo-v_qtd),true);
    v_novo := jsonb_set(v_novo,'{ultimaRetirada}',to_jsonb(v_agora::text),true);
    if coalesce(p_lote->>'dataAbertura','')<>'' and coalesce(v_atual->>'dataAbertura','')='' then
      v_novo := jsonb_set(v_novo,'{dataAbertura}',to_jsonb(p_lote->>'dataAbertura'),true);
    end if;
    update public.ml_registros set registro=v_novo,apagado=false,atualizado_em=v_agora where colecao='estoque_lotes' and id=v_id;
  else
    raise exception 'Ação de estoque inválida';
  end if;
  insert into public.ml_registros(colecao,id,registro,apagado,atualizado_em)
  values('estoque_movimentos',p_movimento->>'id',p_movimento,false,v_agora)
  on conflict(colecao,id) do update set registro=excluded.registro,apagado=false,atualizado_em=excluded.atualizado_em;
  return jsonb_build_object('ok',true,'lote',v_novo,'movimento',p_movimento);
end;
$$;
