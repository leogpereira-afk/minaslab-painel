-- Pesquisa de Satisfação de Clientes (PG 012 · PSC · Rev. 01), substituindo o Google Forms.
-- A Qualidade gera um link por cliente/OS; o cliente responde sem login; a resposta cai no CRM
-- (Pós-venda › Pesquisa de satisfação) e no painel (Laboratório › Qualidade).
-- Insatisfação (recomendação 0–6 ou algum item com nota 1–2) abre tratativa com prazo de 5 dias (ISO 17025 · 7.9)
-- e uma tarefa para quem enviou a pesquisa.

create table if not exists public.satisfacao_envios (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  cliente_id uuid references public.clientes(id) on delete set null,
  ordem_servico_id uuid references public.ordens_servico(id) on delete set null,
  contato_id uuid references public.contatos(id) on delete set null,
  empresa_nome text,
  canal text not null default 'LINK' check (canal in ('LINK','WHATSAPP','EMAIL')),
  destino text,
  enviado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  enviado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '60 days',
  respondido_em timestamptz,
  cancelado_em timestamptz
);
create index if not exists satisfacao_envios_cliente_idx on public.satisfacao_envios (cliente_id);

create table if not exists public.satisfacao_respostas (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid unique references public.satisfacao_envios(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  ordem_servico_id uuid references public.ordens_servico(id) on delete set null,
  empresa_nome text,
  servicos text[] not null default '{}',
  notas jsonb not null default '{}'::jsonb,           -- itens 1–5 (chaves fixas, ver satisfacao_itens())
  nota_coleta smallint check (nota_coleta between 1 and 5),
  nps smallint check (nps between 0 and 10),
  gostou text, mudaria text, melhorar text, explicacao_nps text,
  autoriza_anonimo boolean not null default false,
  insatisfeito boolean not null default false,
  melhoria_status text not null default 'AVALIAR' check (melhoria_status in ('AVALIAR','EM ANDAMENTO','IMPLEMENTADA','DESCARTADA','SEM SUGESTAO')),
  origem text not null default 'LINK' check (origem in ('LINK','GOOGLE_FORMS','MANUAL')),
  respondido_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists satisfacao_respostas_data_idx on public.satisfacao_respostas (respondido_em desc) where deleted_at is null;

create table if not exists public.satisfacao_tratativas (
  id uuid primary key default gen_random_uuid(),
  resposta_id uuid not null references public.satisfacao_respostas(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  motivo text not null,
  prazo date not null,
  status text not null default 'ABERTA' check (status in ('ABERTA','EM ANDAMENTO','CONCLUIDA')),
  responsavel_id uuid references public.profiles(id) on delete set null,
  tarefa_id uuid references public.tarefas(id) on delete set null,
  causa text, acao text, retorno_cliente text,
  concluida_em timestamptz, concluida_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.satisfacao_envios enable row level security;
alter table public.satisfacao_respostas enable row level security;
alter table public.satisfacao_tratativas enable row level security;

do $p$ declare t text; begin
  foreach t in array array['satisfacao_envios','satisfacao_respostas','satisfacao_tratativas'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.has_permission(''crm.read'') or public.has_permission(''operational.read''))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.has_permission(''crm.write'') or public.has_permission(''operational.read''))', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.has_permission(''crm.write'') or public.has_permission(''operational.read'')) with check (public.has_permission(''crm.write'') or public.has_permission(''operational.read''))', t);
  end loop;
end $p$;
grant select, insert, update on public.satisfacao_envios, public.satisfacao_respostas, public.satisfacao_tratativas to authenticated;

-- Itens avaliados de 1 a 5 (mesma ordem do formulário PG 012).
create or replace function public.satisfacao_itens()
returns jsonb language sql immutable as $$
  select '[["atendimento_inicial","Facilidade no atendimento inicial"],
           ["clareza_orcamentos","Clareza das informações e orçamentos"],
           ["agilidade_prazos","Agilidade no atendimento e cumprimento de prazos"],
           ["equipe","Competência e cordialidade da equipe"],
           ["confiabilidade","Confiabilidade dos resultados"],
           ["relatorios","Qualidade dos relatórios emitidos"],
           ["requisitos","Cumprimento dos requisitos técnicos e normativos"],
           ["custo_beneficio","Custo-benefício dos serviços prestados"],
           ["satisfacao_geral","Satisfação geral com o laboratório"]]'::jsonb
$$;

-- Público (link): dados para abrir o formulário.
create or replace function public.satisfacao_pesquisa_abrir(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e record;
begin
  select se.*, coalesce(se.empresa_nome, c.nome_fantasia, c.razao_social) empresa, o.numero_os
    into e from public.satisfacao_envios se
    left join public.clientes c on c.id = se.cliente_id
    left join public.ordens_servico o on o.id = se.ordem_servico_id
   where se.token = p_token;
  if not found or e.cancelado_em is not null then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  if e.respondido_em is not null then return jsonb_build_object('ok', false, 'motivo', 'respondida'); end if;
  if e.expira_em < now() then return jsonb_build_object('ok', false, 'motivo', 'expirada'); end if;
  return jsonb_build_object('ok', true, 'empresa', e.empresa, 'os', e.numero_os, 'itens', public.satisfacao_itens());
end $$;

-- Público (link): grava a resposta. Uma resposta por link.
create or replace function public.satisfacao_pesquisa_responder(p_token text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e record; v_id uuid; v_notas jsonb := '{}'::jsonb; it jsonb; v_n int; v_nps int; v_col int; v_ins boolean;
  v_motivo text := ''; v_tarefa uuid; v_empresa text; v_txt text;
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
      coalesce((select array_agg(left(x, 80)) from jsonb_array_elements_text(coalesce(p_dados->'servicos', '[]'::jsonb)) x limit 10), '{}'),
      v_notas, v_col, v_nps,
      nullif(btrim(left(p_dados->>'gostou', 2000)), ''), nullif(btrim(left(p_dados->>'mudaria', 2000)), ''),
      nullif(btrim(left(p_dados->>'melhorar', 2000)), ''), nullif(btrim(left(p_dados->>'explicacao_nps', 2000)), ''),
      coalesce((p_dados->>'autoriza_anonimo')::boolean, false), v_ins,
      case when coalesce(btrim(p_dados->>'mudaria'), '') = '' and coalesce(btrim(p_dados->>'melhorar'), '') = '' then 'SEM SUGESTAO' else 'AVALIAR' end,
      'LINK')
  returning id into v_id;
  update public.satisfacao_envios set respondido_em = now() where id = e.id;

  -- Alimenta o NPS do Pós-venda.
  if e.cliente_id is not null then
    v_txt := concat_ws(' | ', nullif(btrim(p_dados->>'gostou'), ''), nullif(btrim(p_dados->>'melhorar'), ''), nullif(btrim(p_dados->>'explicacao_nps'), ''));
    insert into public.satisfacao_nps (cliente_id, contato_id, ordem_servico_id, nota, comentario, canal, respondido_em, responsavel_id, origem)
    values (e.cliente_id, e.contato_id, e.ordem_servico_id, v_nps, nullif(v_txt, ''), 'PESQUISA', now(), e.enviado_por, 'PESQUISA_SATISFACAO');
  end if;

  if v_ins then
    if e.cliente_id is not null then
      insert into public.tarefas (responsavel_id, titulo, descricao, prazo, status, prioridade, cliente_id, created_by)
      values (e.enviado_por, left('Tratar insatisfação — ' || coalesce(v_empresa, 'cliente'), 200),
              'Pesquisa de satisfação: ' || v_motivo || coalesce(E'\nComentário: ' || nullif(v_txt, ''), '') ||
              E'\nRegistrar causa, ação e retorno ao cliente em Pós-venda › Pesquisa de satisfação › Tratativas.',
              now() + interval '5 days', 'PENDENTE', 'ALTA', e.cliente_id, e.enviado_por)
      returning id into v_tarefa;
      if e.enviado_por is not null then
        insert into public.tarefa_responsaveis (tarefa_id, usuario_id, status) values (v_tarefa, e.enviado_por, 'PENDENTE') on conflict do nothing;
      end if;
    end if;
    insert into public.satisfacao_tratativas (resposta_id, cliente_id, motivo, prazo, responsavel_id, tarefa_id)
    values (v_id, e.cliente_id, btrim(v_motivo), (now() at time zone 'America/Sao_Paulo')::date + 5, e.enviado_por, v_tarefa);
  end if;

  -- Aviso no painel para quem enviou.
  insert into public.ml_notificacoes (usuario, tipo, titulo, corpo, link, ref_tipo, ref_id)
  select v.usuario_painel, 'pesquisa_satisfacao',
         case when v_ins then 'Pesquisa respondida — insatisfação' else 'Pesquisa de satisfação respondida' end,
         left(coalesce(v_empresa, 'Cliente') || ' · recomendação ' || v_nps || '/10', 200), '/laboratorio?secao=qualidade', 'satisfacao', v_id
    from public.crm_sso_vinculos v where v.crm_user_id = e.enviado_por and v_tarefa is null;

  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.satisfacao_pesquisa_abrir(text) from public;
revoke execute on function public.satisfacao_pesquisa_responder(text, jsonb) from public;
grant execute on function public.satisfacao_pesquisa_abrir(text) to anon, authenticated;
grant execute on function public.satisfacao_pesquisa_responder(text, jsonb) to anon, authenticated;

-- Vínculo opcional com contrato (além da OS, também opcional).
alter table public.satisfacao_envios add column if not exists contrato_id uuid references public.contratos(id) on delete set null;
alter table public.satisfacao_respostas add column if not exists contrato_id uuid references public.contratos(id) on delete set null;
-- satisfacao_pesquisa_abrir passa a devolver também o número do contrato; a resposta herda o contrato do envio
-- (trigger trg_satisfacao_resposta_contrato). Ver migração aplicada "pesquisa_satisfacao_contrato_opcional".
