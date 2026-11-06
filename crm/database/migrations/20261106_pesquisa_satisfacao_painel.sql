-- Pesquisa de satisfação também pelo painel (Laboratório › Qualidade), sem precisar de acesso ao CRM.
-- O envio feito no painel guarda o usuário do painel; se ele tiver vínculo com o CRM, guarda também o perfil do CRM.
-- Insatisfação: tarefa no CRM (quando há perfil do CRM, e ela aparece no painel pelo espelho) ou direto nas Tarefas do painel.
alter table public.satisfacao_envios add column if not exists enviado_por_painel text;
alter table public.satisfacao_tratativas add column if not exists responsavel_painel text;
alter table public.satisfacao_tratativas add column if not exists tarefa_painel_id uuid references public.ml_tarefas(id) on delete set null;

create or replace function public.satisfacao_pesquisa_responder(p_token text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e record; v_id uuid; v_notas jsonb := '{}'::jsonb; it jsonb; v_n int; v_nps int; v_col int; v_ins boolean;
  v_motivo text := ''; v_tarefa uuid; v_tarefa_painel uuid; v_empresa text; v_txt text; v_desc text; v_painel text;
begin
  select se.*, coalesce(se.empresa_nome, c.nome_fantasia, c.razao_social) empresa
    into e from public.satisfacao_envios se left join public.clientes c on c.id = se.cliente_id
   where se.token = p_token for update of se;
  if not found or e.cancelado_em is not null or e.expira_em < now() then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  if e.respondido_em is not null then return jsonb_build_object('ok', false, 'motivo', 'respondida'); end if;

  for it in select * from jsonb_array_elements(public.satisfacao_itens()) loop
    v_n := nullif(p_dados->'notas'->>(it->>0), '')::int;
    if v_n is null or v_n not between 1 and 5 then return jsonb_build_object('ok', false, 'motivo', 'incompleta', 'item', it->>1); end if;
    v_notas := v_notas || jsonb_build_object(it->>0, v_n);
    if v_n <= 2 then v_motivo := v_motivo || format('%s: nota %s. ', it->>1, v_n); end if;
  end loop;
  v_col := nullif(p_dados->>'nota_coleta', '')::int;
  if v_col is not null and v_col not between 1 and 5 then v_col := null; end if;
  if v_col is not null and v_col <= 2 then v_motivo := v_motivo || format('Processo de coleta: nota %s. ', v_col); end if;
  v_nps := nullif(p_dados->>'nps', '')::int;
  if v_nps is null or v_nps not between 0 and 10 then return jsonb_build_object('ok', false, 'motivo', 'incompleta', 'item', 'Recomendação (0 a 10)'); end if;
  if v_nps <= 6 then v_motivo := format('Recomendação %s/10. ', v_nps) || v_motivo; end if;
  v_ins := v_motivo <> '';
  v_empresa := coalesce(nullif(btrim(left(p_dados->>'empresa', 200)), ''), e.empresa);

  insert into public.satisfacao_respostas (envio_id, cliente_id, ordem_servico_id, empresa_nome, servicos, notas, nota_coleta, nps,
      gostou, mudaria, melhorar, explicacao_nps, autoriza_anonimo, insatisfeito, melhoria_status, origem)
  values (e.id, e.cliente_id, e.ordem_servico_id, v_empresa,
      coalesce((select array_agg(left(x, 80)) from jsonb_array_elements_text(coalesce(p_dados->'servicos', '[]'::jsonb)) x), '{}'),
      v_notas, v_col, v_nps,
      nullif(btrim(left(p_dados->>'gostou', 2000)), ''), nullif(btrim(left(p_dados->>'mudaria', 2000)), ''),
      nullif(btrim(left(p_dados->>'melhorar', 2000)), ''), nullif(btrim(left(p_dados->>'explicacao_nps', 2000)), ''),
      coalesce((p_dados->>'autoriza_anonimo')::boolean, false), v_ins,
      case when coalesce(btrim(p_dados->>'mudaria'), '') = '' and coalesce(btrim(p_dados->>'melhorar'), '') = '' then 'SEM SUGESTAO' else 'AVALIAR' end,
      'LINK')
  returning id into v_id;
  update public.satisfacao_envios set respondido_em = now() where id = e.id;

  v_txt := concat_ws(' | ', nullif(btrim(p_dados->>'gostou'), ''), nullif(btrim(p_dados->>'melhorar'), ''), nullif(btrim(p_dados->>'explicacao_nps'), ''));
  if e.cliente_id is not null then
    insert into public.satisfacao_nps (cliente_id, contato_id, ordem_servico_id, nota, comentario, canal, respondido_em, responsavel_id, origem)
    values (e.cliente_id, e.contato_id, e.ordem_servico_id, v_nps, nullif(v_txt, ''), 'PESQUISA', now(), e.enviado_por, 'PESQUISA_SATISFACAO');
  end if;

  -- Usuário do painel de quem enviou (direto, ou pelo vínculo do CRM).
  v_painel := coalesce(e.enviado_por_painel, (select v.usuario_painel from public.crm_sso_vinculos v where v.crm_user_id = e.enviado_por limit 1));

  if v_ins then
    v_desc := 'Pesquisa de satisfação: ' || v_motivo || coalesce(E'\nComentário: ' || nullif(v_txt, ''), '') ||
              E'\nRegistrar causa, ação e retorno ao cliente em Laboratório › Qualidade › Pesquisa de satisfação › Tratativas (ou no CRM, Pós-venda).';
    if e.cliente_id is not null and e.enviado_por is not null then
      insert into public.tarefas (responsavel_id, titulo, descricao, prazo, status, prioridade, cliente_id, created_by)
      values (e.enviado_por, left('Tratar insatisfação — ' || coalesce(v_empresa, 'cliente'), 200), v_desc,
              now() + interval '5 days', 'PENDENTE', 'ALTA', e.cliente_id, e.enviado_por)
      returning id into v_tarefa;
      insert into public.tarefa_responsaveis (tarefa_id, usuario_id, status) values (v_tarefa, e.enviado_por, 'PENDENTE') on conflict do nothing;
    elsif v_painel is not null then
      perform set_config('ml.tarefa_origem', 'crm', true);  -- não espelhar de volta para o CRM
      insert into public.ml_tarefas (titulo, descricao, proprietario, responsavel, prazo, urgente, status, marcadores)
      values (left('Tratar insatisfação — ' || coalesce(v_empresa, 'cliente'), 200), v_desc, v_painel, v_painel,
              now() + interval '5 days', true, 'nova', array['Qualidade'])
      returning id into v_tarefa_painel;
      insert into public.ml_notificacoes (usuario, tipo, titulo, corpo, link, ref_tipo, ref_id)
      values (v_painel, 'tarefa_nova', 'Pesquisa respondida — insatisfação', left(coalesce(v_empresa, 'Cliente') || ' · recomendação ' || v_nps || '/10', 200),
              '/tarefas?abrir=' || v_tarefa_painel, 'tarefa', v_tarefa_painel);
    end if;
    insert into public.satisfacao_tratativas (resposta_id, cliente_id, motivo, prazo, responsavel_id, responsavel_painel, tarefa_id, tarefa_painel_id)
    values (v_id, e.cliente_id, btrim(v_motivo), (now() at time zone 'America/Sao_Paulo')::date + 5, e.enviado_por, v_painel, v_tarefa, v_tarefa_painel);
  elsif v_painel is not null then
    insert into public.ml_notificacoes (usuario, tipo, titulo, corpo, link, ref_tipo, ref_id)
    values (v_painel, 'pesquisa_satisfacao', 'Pesquisa de satisfação respondida',
            left(coalesce(v_empresa, 'Cliente') || ' · recomendação ' || v_nps || '/10', 200), '/laboratorio?secao=qualidade&aba=satisfacao', 'satisfacao', v_id);
  end if;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.satisfacao_pesquisa_responder(text, jsonb) to anon, authenticated;
