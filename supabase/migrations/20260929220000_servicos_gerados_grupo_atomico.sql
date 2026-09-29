-- Serviços Gerados: agrupar, adicionar ao grupo e desagrupar numa transação só.
-- Antes, a Edge Function gravava em 3 a 4 passos soltos; um erro no meio deixava
-- grupo sem itens, itens sem referência ou referência herdada depois do grupo
-- desfeito. As validações de negócio continuam na função ml-financeiro-servicos-grupar;
-- aqui ficam só as escritas, atômicas.
--
-- Referência de pagamento: ao entrar num grupo a OS recebe a referência do grupo e
-- o valor anterior fica no histórico (origem AGRUPAMENTO). Ao sair, ela volta ao
-- valor anterior. Sem isso a conferência voltava a somar OS desagrupadas pela
-- referência e acusava divergência falsa.

create or replace function public.servicos_gerados_grupo_criar(
  p_grupo jsonb,
  p_itens jsonb,
  p_referencia text,
  p_usuario text
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_ids uuid[];
  v_ref text := nullif(btrim(coalesce(p_referencia, '')), '');
begin
  select array_agg((i->>'servico_id')::uuid) into v_ids from jsonb_array_elements(p_itens) i;
  if coalesce(array_length(v_ids, 1), 0) < 2 then
    raise exception 'Selecione pelo menos duas OS para agrupar.';
  end if;

  insert into public.servicos_gerados_grupos_faturamento
    (empresa_id, cliente_chave, cliente_nome, cnpj_cpf, tipo, status, referencia_pagamento, valor_total,
     data_vencimento, data_emissao, numero_nf, forma_pagamento, status_faturamento)
  values
    ((p_grupo->>'empresa_id')::uuid, p_grupo->>'cliente_chave', p_grupo->>'cliente_nome', p_grupo->>'cnpj_cpf',
     coalesce(p_grupo->>'tipo', 'FATURAMENTO'), 'ABERTO', v_ref,
     (select coalesce(sum((i->>'valor')::numeric), 0) from jsonb_array_elements(p_itens) i),
     (p_grupo->>'data_vencimento')::date, (p_grupo->>'data_emissao')::date, p_grupo->>'numero_nf',
     p_grupo->>'forma_pagamento', p_grupo->>'status_faturamento')
  returning id into v_id;

  insert into public.servicos_gerados_grupos_itens (grupo_id, servico_id, valor)
  select v_id, (i->>'servico_id')::uuid, coalesce((i->>'valor')::numeric, 0)
  from jsonb_array_elements(p_itens) i;

  if v_ref is not null then
    insert into public.servicos_gerados_historico (servico_id, campo, valor_anterior, valor_novo, origem, usuario)
    select s.id, 'referencia_pagamento', s.referencia_pagamento, v_ref, 'AGRUPAMENTO', p_usuario
    from public.servicos_gerados s
    where s.id = any(v_ids) and s.referencia_pagamento is distinct from v_ref;

    update public.servicos_gerados
       set referencia_pagamento = v_ref, pagamento_referencia = v_ref, updated_at = now(), updated_by = p_usuario
     where id = any(v_ids);
  end if;

  return v_id;
end
$$;

create or replace function public.servicos_gerados_grupo_adicionar(
  p_grupo_id uuid,
  p_itens jsonb,
  p_usuario text
) returns numeric
language plpgsql
set search_path = ''
as $$
declare
  g public.servicos_gerados_grupos_faturamento%rowtype;
  v_ids uuid[];
  v_total numeric;
begin
  select * into g from public.servicos_gerados_grupos_faturamento where id = p_grupo_id for update;
  if not found then raise exception 'Agrupamento não encontrado.'; end if;
  if g.status <> 'ABERTO' then raise exception 'Somente agrupamentos abertos podem receber novas OS.'; end if;
  if g.nota_fiscal_id is not null or g.recebimento_id is not null then
    raise exception 'Este agrupamento já possui nota fiscal ou recebimento e não aceita novas OS.';
  end if;

  select array_agg((i->>'servico_id')::uuid) into v_ids from jsonb_array_elements(p_itens) i;
  if coalesce(array_length(v_ids, 1), 0) < 1 then raise exception 'Selecione ao menos uma OS.'; end if;

  insert into public.servicos_gerados_grupos_itens (grupo_id, servico_id, valor)
  select p_grupo_id, (i->>'servico_id')::uuid, coalesce((i->>'valor')::numeric, 0)
  from jsonb_array_elements(p_itens) i;

  if g.referencia_pagamento is not null then
    insert into public.servicos_gerados_historico (servico_id, campo, valor_anterior, valor_novo, origem, usuario)
    select s.id, 'referencia_pagamento', s.referencia_pagamento, g.referencia_pagamento, 'AGRUPAMENTO', p_usuario
    from public.servicos_gerados s
    where s.id = any(v_ids) and s.referencia_pagamento is distinct from g.referencia_pagamento;
  end if;

  -- As novas OS herdam os dados compartilhados que o grupo já tem.
  update public.servicos_gerados s set
    data_vencimento      = coalesce(g.data_vencimento, s.data_vencimento),
    data_emissao         = coalesce(g.data_emissao, s.data_emissao),
    numero_nf            = coalesce(g.numero_nf, s.numero_nf),
    forma_pagamento      = coalesce(g.forma_pagamento, s.forma_pagamento),
    status_faturamento   = coalesce(g.status_faturamento, s.status_faturamento),
    referencia_pagamento = coalesce(g.referencia_pagamento, s.referencia_pagamento),
    pagamento_referencia = coalesce(g.referencia_pagamento, s.pagamento_referencia),
    updated_at = now(),
    updated_by = p_usuario
  where s.id = any(v_ids);

  select coalesce(sum(valor), 0) into v_total from public.servicos_gerados_grupos_itens where grupo_id = p_grupo_id;
  update public.servicos_gerados_grupos_faturamento set valor_total = v_total, updated_at = now() where id = p_grupo_id;
  return v_total;
end
$$;

-- p_servico_id nulo desfaz o grupo inteiro; informado, retira só aquela OS
-- (e desfaz o grupo se sobrar menos de duas).
create or replace function public.servicos_gerados_grupo_desfazer(
  p_grupo_id uuid,
  p_servico_id uuid,
  p_usuario text
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g public.servicos_gerados_grupos_faturamento%rowtype;
  v_membros uuid[];
  v_liberar uuid[];
  v_encerra boolean;
  v_total numeric := 0;
  r record;
  v_anterior text;
begin
  select * into g from public.servicos_gerados_grupos_faturamento where id = p_grupo_id for update;
  if not found then raise exception 'Agrupamento não encontrado.'; end if;
  if g.nota_fiscal_id is not null or g.recebimento_id is not null then
    raise exception 'Este agrupamento possui nota fiscal ou recebimento vinculado. Desvincule o documento financeiro antes de desagrupar.';
  end if;

  select array_agg(servico_id) into v_membros from public.servicos_gerados_grupos_itens where grupo_id = p_grupo_id;
  if p_servico_id is not null and not (p_servico_id = any(coalesce(v_membros, '{}'))) then
    raise exception 'Esta OS não pertence a este agrupamento.';
  end if;

  v_encerra := p_servico_id is null or coalesce(array_length(v_membros, 1), 0) - 1 < 2;
  v_liberar := case when v_encerra then v_membros else array[p_servico_id] end;

  -- Devolve a referência que cada OS tinha antes de entrar no grupo.
  for r in
    select s.id, s.referencia_pagamento from public.servicos_gerados s
    where s.id = any(v_liberar) and g.referencia_pagamento is not null and s.referencia_pagamento = g.referencia_pagamento
  loop
    select h.valor_anterior into v_anterior
      from public.servicos_gerados_historico h
     where h.servico_id = r.id and h.campo = 'referencia_pagamento' and h.origem = 'AGRUPAMENTO' and h.valor_novo = r.referencia_pagamento
     order by h.criado_em desc limit 1;
    if found then
      update public.servicos_gerados
         set referencia_pagamento = v_anterior, pagamento_referencia = v_anterior, updated_at = now(), updated_by = p_usuario
       where id = r.id;
      insert into public.servicos_gerados_historico (servico_id, campo, valor_anterior, valor_novo, origem, usuario)
      values (r.id, 'referencia_pagamento', r.referencia_pagamento, v_anterior, 'DESAGRUPAMENTO', p_usuario);
    end if;
  end loop;

  if v_encerra then
    delete from public.servicos_gerados_grupos_faturamento where id = p_grupo_id; -- itens saem em cascata
  else
    delete from public.servicos_gerados_grupos_itens where grupo_id = p_grupo_id and servico_id = p_servico_id;
    select coalesce(sum(valor), 0) into v_total from public.servicos_gerados_grupos_itens where grupo_id = p_grupo_id;
    update public.servicos_gerados_grupos_faturamento set valor_total = v_total, updated_at = now() where id = p_grupo_id;
  end if;

  return jsonb_build_object(
    'grupoEncerrado', v_encerra,
    'itensLiberados', coalesce(array_length(v_liberar, 1), 0),
    'itensRestantes', case when v_encerra then 0 else coalesce(array_length(v_membros, 1), 0) - 1 end,
    'valorTotal', v_total
  );
end
$$;

revoke all on function public.servicos_gerados_grupo_criar(jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.servicos_gerados_grupo_adicionar(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.servicos_gerados_grupo_desfazer(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.servicos_gerados_grupo_criar(jsonb, jsonb, text, text) to service_role;
grant execute on function public.servicos_gerados_grupo_adicionar(uuid, jsonb, text) to service_role;
grant execute on function public.servicos_gerados_grupo_desfazer(uuid, uuid, text) to service_role;
