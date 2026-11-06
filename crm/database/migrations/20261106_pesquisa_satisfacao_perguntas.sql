-- Pesquisa de satisfação: perguntas editáveis pela Qualidade (painel › Laboratório › Qualidade › Perguntas).
-- Tipos: ESCALA (nota 1–5, pode aceitar "não se aplica"), TEXTO (resposta aberta) e SERVICO (opções de "Serviço utilizado").
-- A recomendação 0–10 (NPS) é fixa: é o indicador principal. Pergunta retirada fica inativa (o histórico guarda o texto).

create table if not exists public.satisfacao_perguntas (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  texto text not null,
  tipo text not null check (tipo in ('ESCALA','TEXTO','SERVICO')),
  permite_na boolean not null default false,
  obrigatoria boolean not null default true,
  ordem int not null default 100,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
create table if not exists public.satisfacao_config (
  id smallint primary key default 1 check (id = 1),
  revisao text not null default '01',
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
insert into public.satisfacao_config (id, revisao) values (1, '01') on conflict (id) do nothing;
alter table public.satisfacao_respostas add column if not exists textos jsonb not null default '{}'::jsonb;

alter table public.satisfacao_perguntas enable row level security;
alter table public.satisfacao_config enable row level security;
create policy satisfacao_perguntas_select on public.satisfacao_perguntas for select to authenticated using (public.has_permission('crm.read') or public.has_permission('operational.read'));
create policy satisfacao_config_select on public.satisfacao_config for select to authenticated using (public.has_permission('crm.read') or public.has_permission('operational.read'));
grant select on public.satisfacao_perguntas, public.satisfacao_config to authenticated;

insert into public.satisfacao_perguntas (chave, texto, tipo, permite_na, obrigatoria, ordem) values
  ('atendimento_inicial', 'Facilidade no atendimento inicial', 'ESCALA', false, true, 10),
  ('clareza_orcamentos', 'Clareza das informações e orçamentos', 'ESCALA', false, true, 20),
  ('agilidade_prazos', 'Agilidade no atendimento e cumprimento de prazos', 'ESCALA', false, true, 30),
  ('equipe', 'Competência e cordialidade da equipe', 'ESCALA', false, true, 40),
  ('confiabilidade', 'Confiabilidade dos resultados', 'ESCALA', false, true, 50),
  ('relatorios', 'Qualidade dos relatórios emitidos', 'ESCALA', false, true, 60),
  ('requisitos', 'Cumprimento dos requisitos técnicos e normativos', 'ESCALA', false, true, 70),
  ('custo_beneficio', 'Custo-benefício dos serviços prestados', 'ESCALA', false, true, 80),
  ('satisfacao_geral', 'Satisfação geral com o laboratório', 'ESCALA', false, true, 90),
  ('coleta', 'Processo de coleta/amostragem (se aplicável)', 'ESCALA', true, false, 100),
  ('gostou', 'O que você mais gostou em nossos serviços?', 'TEXTO', false, false, 10),
  ('mudaria', 'Se pudesse mudar uma coisa em nossos serviços, o que seria?', 'TEXTO', false, false, 20),
  ('melhorar', 'O que podemos melhorar para atendê-lo ainda melhor?', 'TEXTO', false, false, 30),
  ('srv_coleta', 'Coleta e amostragem', 'SERVICO', false, false, 10),
  ('srv_fq', 'Análises físico-químicas', 'SERVICO', false, false, 20),
  ('srv_mb', 'Análises microbiológicas', 'SERVICO', false, false, 30),
  ('srv_consultoria', 'Consultoria técnica', 'SERVICO', false, false, 40),
  ('srv_outro', 'Outro', 'SERVICO', false, false, 90)
on conflict (chave) do nothing;

-- Formulário vigente (o que a página do cliente mostra).
create or replace function public.satisfacao_formulario()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'revisao', (select revisao from public.satisfacao_config where id = 1),
    'escala', coalesce((select jsonb_agg(jsonb_build_object('chave', chave, 'texto', texto, 'na', permite_na, 'obrigatoria', obrigatoria) order by ordem, criado_em)
                 from public.satisfacao_perguntas where ativa and tipo = 'ESCALA'), '[]'::jsonb),
    'textos', coalesce((select jsonb_agg(jsonb_build_object('chave', chave, 'texto', texto, 'obrigatoria', obrigatoria) order by ordem, criado_em)
                 from public.satisfacao_perguntas where ativa and tipo = 'TEXTO'), '[]'::jsonb),
    'servicos', coalesce((select jsonb_agg(texto order by ordem, criado_em) from public.satisfacao_perguntas where ativa and tipo = 'SERVICO'), '[]'::jsonb))
$$;

-- Compatibilidade: lista [chave, texto] das notas 1–5 ativas.
create or replace function public.satisfacao_itens()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_array(chave, texto) order by ordem, criado_em), '[]'::jsonb)
    from public.satisfacao_perguntas where ativa and tipo = 'ESCALA'
$$;

create or replace function public.satisfacao_pesquisa_abrir(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e record;
begin
  select se.*, coalesce(se.empresa_nome, c.nome_fantasia, c.razao_social) empresa, o.numero_os, k.numero_contrato
    into e from public.satisfacao_envios se
    left join public.clientes c on c.id = se.cliente_id
    left join public.ordens_servico o on o.id = se.ordem_servico_id
    left join public.contratos k on k.id = se.contrato_id
   where se.token = p_token;
  if not found or e.cancelado_em is not null then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  if e.respondido_em is not null then return jsonb_build_object('ok', false, 'motivo', 'respondida'); end if;
  if e.expira_em < now() then return jsonb_build_object('ok', false, 'motivo', 'expirada'); end if;
  return jsonb_build_object('ok', true, 'empresa', e.empresa, 'os', e.numero_os, 'contrato', e.numero_contrato)
         || public.satisfacao_formulario() || jsonb_build_object('itens', public.satisfacao_itens());
end $$;

create or replace function public.satisfacao_pesquisa_responder(p_token text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e record; v_id uuid; v_notas jsonb := '{}'::jsonb; v_textos jsonb := '{}'::jsonb; q record; v_n int; v_nps int; v_ins boolean;
  v_motivo text := ''; v_tarefa uuid; v_tarefa_painel uuid; v_empresa text; v_txt text; v_desc text; v_painel text; v_raw text; v_sug boolean := false;
begin
  select se.*, coalesce(se.empresa_nome, c.nome_fantasia, c.razao_social) empresa
    into e from public.satisfacao_envios se left join public.clientes c on c.id = se.cliente_id
   where se.token = p_token for update of se;
  if not found or e.cancelado_em is not null or e.expira_em < now() then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  if e.respondido_em is not null then return jsonb_build_object('ok', false, 'motivo', 'respondida'); end if;

  for q in select * from public.satisfacao_perguntas where ativa and tipo = 'ESCALA' order by ordem, criado_em loop
    v_raw := coalesce(p_dados->'notas'->>q.chave, case when q.chave = 'coleta' then p_dados->>'nota_coleta' end);
    v_n := case when v_raw ~ '^\d+$' then v_raw::int end;
    if v_n is null or v_n not between 1 and 5 then
      if q.obrigatoria and not q.permite_na then return jsonb_build_object('ok', false, 'motivo', 'incompleta', 'item', q.texto); end if;
      continue;
    end if;
    v_notas := v_notas || jsonb_build_object(q.chave, v_n);
    if v_n <= 2 then v_motivo := v_motivo || format('%s: nota %s. ', q.texto, v_n); end if;
  end loop;
  for q in select * from public.satisfacao_perguntas where ativa and tipo = 'TEXTO' order by ordem, criado_em loop
    v_raw := nullif(btrim(left(coalesce(p_dados->'textos'->>q.chave, p_dados->>q.chave), 2000)), '');
    if v_raw is null and q.obrigatoria then return jsonb_build_object('ok', false, 'motivo', 'incompleta', 'item', q.texto); end if;
    if v_raw is not null then
      v_textos := v_textos || jsonb_build_object(q.chave, v_raw);
      if q.chave <> 'gostou' then v_sug := true; end if;
    end if;
  end loop;
  v_nps := case when p_dados->>'nps' ~ '^\d+$' then (p_dados->>'nps')::int end;
  if v_nps is null or v_nps not between 0 and 10 then return jsonb_build_object('ok', false, 'motivo', 'incompleta', 'item', 'Recomendação (0 a 10)'); end if;
  if v_nps <= 6 then v_motivo := format('Recomendação %s/10. ', v_nps) || v_motivo; end if;
  v_ins := v_motivo <> '';
  v_empresa := coalesce(nullif(btrim(left(p_dados->>'empresa', 200)), ''), e.empresa);

  insert into public.satisfacao_respostas (envio_id, cliente_id, ordem_servico_id, empresa_nome, servicos, notas, nota_coleta, nps, textos,
      gostou, mudaria, melhorar, explicacao_nps, autoriza_anonimo, insatisfeito, melhoria_status, origem)
  values (e.id, e.cliente_id, e.ordem_servico_id, v_empresa,
      coalesce((select array_agg(left(x, 80)) from jsonb_array_elements_text(coalesce(p_dados->'servicos', '[]'::jsonb)) x), '{}'),
      v_notas, (v_notas->>'coleta')::smallint, v_nps, v_textos,
      v_textos->>'gostou', v_textos->>'mudaria', v_textos->>'melhorar', nullif(btrim(left(p_dados->>'explicacao_nps', 2000)), ''),
      coalesce((p_dados->>'autoriza_anonimo')::boolean, false), v_ins,
      case when v_sug then 'AVALIAR' else 'SEM SUGESTAO' end, 'LINK')
  returning id into v_id;
  update public.satisfacao_envios set respondido_em = now() where id = e.id;

  v_txt := (select string_agg(value, ' | ') from jsonb_each_text(v_textos));
  v_txt := concat_ws(' | ', v_txt, nullif(btrim(p_dados->>'explicacao_nps'), ''));
  if e.cliente_id is not null then
    insert into public.satisfacao_nps (cliente_id, contato_id, ordem_servico_id, nota, comentario, canal, respondido_em, responsavel_id, origem)
    values (e.cliente_id, e.contato_id, e.ordem_servico_id, v_nps, nullif(v_txt, ''), 'PESQUISA', now(), e.enviado_por, 'PESQUISA_SATISFACAO');
  end if;

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
      perform set_config('ml.tarefa_origem', 'crm', true);
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
grant execute on function public.satisfacao_pesquisa_abrir(text) to anon, authenticated;

-- Respostas antigas (antes do editor): as telas leem gostou/mudaria/melhorar e nota_coleta como reserva.
