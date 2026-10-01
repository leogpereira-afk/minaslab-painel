-- MinasLab Academy — Etapa 2 (fundação): treinamentos, versões, módulos, aulas,
-- públicos, grupos, vínculos conta↔colaborador e trilha de auditoria.
--
-- Segurança: RLS ligado e SEM policy; o navegador nunca fala com estas tabelas.
-- Só as Edge Functions ml-academy-* (service_role) leem e gravam, e toda escrita
-- passa por funções SQL que validam e registram o evento na mesma transação.
-- Tudo leva o prefixo ml_ac_ (o projeto é compartilhado com outros sistemas).
--
-- Recuperação: ver docs/ACADEMY-IMPLANTACAO.md (script de reversão ao final).

create table if not exists public.ml_ac_vinculos (
  usuario    text primary key references public.ml_contas(usuario) on update cascade on delete restrict,
  pessoa_id  text not null unique,
  criado_por text not null,
  criado_em  timestamptz not null default now()
);

create table if not exists public.ml_ac_categorias (
  id    text primary key,
  nome  text not null unique,
  ordem int  not null default 0,
  ativa boolean not null default true
);
insert into public.ml_ac_categorias (id, nome, ordem) values
  ('integracao', 'Integração', 1),
  ('procedimentos-pops', 'Procedimentos e POPs', 2),
  ('reciclagem', 'Reciclagem', 3),
  ('qualidade-iso17025', 'Qualidade e ISO/IEC 17025', 4),
  ('gestao-tempo-desenvolvimento', 'Gestão do tempo e desenvolvimento', 5),
  ('comercial-atendimento', 'Comercial e atendimento', 6),
  ('sistemas-internos', 'Sistemas internos', 7)
on conflict (id) do nothing;

create table if not exists public.ml_ac_treinamentos (
  id                      uuid primary key default gen_random_uuid(),
  categoria_id            text not null references public.ml_ac_categorias(id),
  titulo                  text not null check (char_length(trim(titulo)) between 3 and 200),
  descricao               text not null default '',
  responsavel_pessoa_id   text,
  status                  text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  criado_por              text not null,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);
create index if not exists ml_ac_treinamentos_categoria_idx on public.ml_ac_treinamentos (categoria_id);

-- Uma versão é o que o colaborador realiza. Depois de publicada ela é imutável:
-- conteúdo e critérios ficam congelados para o histórico de quem a concluiu.
create table if not exists public.ml_ac_versoes (
  id                      uuid primary key default gen_random_uuid(),
  treinamento_id          uuid not null references public.ml_ac_treinamentos(id) on delete restrict,
  numero                  int  not null check (numero >= 1),
  status                  text not null default 'rascunho' check (status in ('rascunho','publicada','substituida','arquivada')),
  titulo                  text not null default '',
  descricao               text not null default '',
  modalidade              text not null default 'nenhuma' check (modalidade in ('nenhuma','automatica','gestor','hibrida')),
  nota_minima             numeric(5,2) check (nota_minima between 0 and 100),
  max_tentativas          int check (max_tentativas >= 1),
  obrigatorio             boolean not null default false,
  prazo_dias              int check (prazo_dias >= 1),
  validade_meses          int check (validade_meses >= 1),
  carga_horaria_min       int check (carga_horaria_min >= 1),
  carga_horaria_validada_por text,
  exige_qualidade         boolean not null default false,
  validada_qualidade_por  text,
  validada_qualidade_em   timestamptz,
  notas_versao            text not null default '',
  criado_por              text not null,
  criado_em               timestamptz not null default now(),
  publicada_por           text,
  publicada_em            timestamptz,
  unique (treinamento_id, numero)
);
create unique index if not exists ml_ac_versoes_um_rascunho on public.ml_ac_versoes (treinamento_id) where status = 'rascunho';
create unique index if not exists ml_ac_versoes_uma_publicada on public.ml_ac_versoes (treinamento_id) where status = 'publicada';

create table if not exists public.ml_ac_modulos (
  id        uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.ml_ac_versoes(id) on delete cascade,
  ordem     int  not null check (ordem >= 1),
  titulo    text not null default '',
  descricao text not null default '',
  unique (versao_id, ordem)
);

create table if not exists public.ml_ac_aulas (
  id          uuid primary key default gen_random_uuid(),
  versao_id   uuid not null references public.ml_ac_versoes(id) on delete cascade,
  modulo_id   uuid not null references public.ml_ac_modulos(id) on delete cascade,
  ordem       int  not null check (ordem >= 1),
  titulo      text not null default '',
  tipo        text not null check (tipo in ('texto','imagem','video','pdf','apresentacao','link','caso','pratica')),
  conteudo    jsonb not null default '{}'::jsonb,
  duracao_min int check (duracao_min >= 0),
  unique (modulo_id, ordem)
);
create index if not exists ml_ac_aulas_versao_idx on public.ml_ac_aulas (versao_id);

create table if not exists public.ml_ac_materiais (
  id        uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.ml_ac_versoes(id) on delete cascade,
  ordem     int  not null check (ordem >= 1),
  titulo    text not null default '',
  url       text not null default '',
  unique (versao_id, ordem)
);

create table if not exists public.ml_ac_grupos (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null unique check (char_length(trim(nome)) >= 2),
  descricao text not null default '',
  ativo boolean not null default true
);
create table if not exists public.ml_ac_grupo_membros (
  grupo_id  uuid not null references public.ml_ac_grupos(id) on delete cascade,
  pessoa_id text not null,
  primary key (grupo_id, pessoa_id)
);

-- Público do treinamento. As atribuições individuais (com prazo) nascem na
-- etapa de aprendizagem; aqui só se define QUEM é alvo.
create table if not exists public.ml_ac_publico (
  id             uuid primary key default gen_random_uuid(),
  treinamento_id uuid not null references public.ml_ac_treinamentos(id) on delete cascade,
  tipo           text not null check (tipo in ('todos','colaborador','cargo','setor','grupo')),
  valor          text not null check (char_length(trim(valor)) >= 1),
  unique (treinamento_id, tipo, valor)
);

-- Trilha de auditoria: só inclui, nunca altera nem apaga.
create table if not exists public.ml_ac_eventos (
  id         bigint generated always as identity primary key,
  em         timestamptz not null default now(),
  usuario    text not null,
  evento     text not null,
  entidade   text not null,
  entidade_id text not null,
  dados      jsonb not null default '{}'::jsonb
);
create index if not exists ml_ac_eventos_entidade_idx on public.ml_ac_eventos (entidade, entidade_id, em desc);

-- ---------------------------------------------------------------- imutabilidade
create or replace function public.ml_ac_eventos_imutavel() returns trigger
language plpgsql set search_path = public as $$
begin raise exception 'A trilha de auditoria não pode ser alterada.'; end $$;
drop trigger if exists ml_ac_eventos_bloqueio on public.ml_ac_eventos;
create trigger ml_ac_eventos_bloqueio before update or delete on public.ml_ac_eventos
  for each row execute function public.ml_ac_eventos_imutavel();

create or replace function public.ml_ac_versao_imutavel() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'rascunho' then raise exception 'Versão publicada não pode ser apagada (preserva o histórico).'; end if;
    return old;
  end if;
  if old.status = 'rascunho' then return new; end if;
  if old.status = 'publicada' and new.status in ('substituida','arquivada')
     and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then return new; end if;
  raise exception 'Versão publicada é imutável. Crie uma nova versão.';
end $$;
drop trigger if exists ml_ac_versoes_bloqueio on public.ml_ac_versoes;
create trigger ml_ac_versoes_bloqueio before update or delete on public.ml_ac_versoes
  for each row execute function public.ml_ac_versao_imutavel();

create or replace function public.ml_ac_conteudo_imutavel() returns trigger
language plpgsql set search_path = public as $$
declare vid uuid; st text;
begin
  vid := case when tg_op = 'DELETE' then old.versao_id else new.versao_id end;
  select status into st from public.ml_ac_versoes where id = vid;
  if st is not null and st <> 'rascunho' then
    raise exception 'O conteúdo de uma versão publicada não pode ser alterado. Crie uma nova versão.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
do $$ declare t text; begin
  foreach t in array array['ml_ac_modulos','ml_ac_aulas','ml_ac_materiais'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_bloqueio', t);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.ml_ac_conteudo_imutavel()', t || '_bloqueio', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- acesso
do $$ declare t text; begin
  foreach t in array array['ml_ac_vinculos','ml_ac_categorias','ml_ac_treinamentos','ml_ac_versoes','ml_ac_modulos',
    'ml_ac_aulas','ml_ac_materiais','ml_ac_grupos','ml_ac_grupo_membros','ml_ac_publico','ml_ac_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;
revoke all on sequence public.ml_ac_eventos_id_seq from anon, authenticated;
grant usage, select on sequence public.ml_ac_eventos_id_seq to service_role;

-- ---------------------------------------------------------------- funções
create or replace function public.ml_ac_evento(p_usuario text, p_evento text, p_entidade text, p_id text, p_dados jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.ml_ac_eventos (usuario, evento, entidade, entidade_id, dados) values (p_usuario, p_evento, p_entidade, p_id, coalesce(p_dados,'{}'::jsonb));
$$;

-- Lista de pendências que impedem a publicação (a regra mora aqui, no banco).
create or replace function public.ml_ac_problemas_versao(p_versao uuid)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare v public.ml_ac_versoes; t public.ml_ac_treinamentos; p text[] := '{}'; r record; n int;
begin
  select * into v from public.ml_ac_versoes where id = p_versao;
  if not found then raise exception 'Versão não encontrada.'; end if;
  select * into t from public.ml_ac_treinamentos where id = v.treinamento_id;
  if char_length(trim(v.titulo)) < 3 then p := array_append(p, 'Informe o título (mínimo 3 letras).'); end if;
  if char_length(trim(v.descricao)) = 0 then p := array_append(p, 'Informe a descrição.'); end if;
  if t.responsavel_pessoa_id is null then p := array_append(p, 'Defina o responsável pelo conteúdo.'); end if;
  if v.modalidade <> 'nenhuma' then
    p := array_append(p, 'Provas e avaliações do gestor ainda não estão disponíveis (próximas etapas): use a modalidade "Somente conclusão das aulas".');
  end if;
  select count(*) into n from public.ml_ac_aulas where versao_id = p_versao;
  if n = 0 then p := array_append(p, 'Cadastre ao menos uma aula.'); end if;
  for r in select m.ordem, m.titulo, (select count(*) from public.ml_ac_aulas a where a.modulo_id = m.id) as aulas
           from public.ml_ac_modulos m where m.versao_id = p_versao order by m.ordem loop
    if char_length(trim(r.titulo)) = 0 then p := array_append(p, format('Módulo %s sem título.', r.ordem)); end if;
    if r.aulas = 0 then p := array_append(p, format('Módulo %s não tem aulas.', r.ordem)); end if;
  end loop;
  for r in select m.ordem mo, a.ordem ao, a.titulo, a.tipo, a.conteudo
           from public.ml_ac_aulas a join public.ml_ac_modulos m on m.id = a.modulo_id where a.versao_id = p_versao order by m.ordem, a.ordem loop
    if char_length(trim(r.titulo)) = 0 then p := array_append(p, format('Aula %s.%s sem título.', r.mo, r.ao)); end if;
    if r.tipo = 'texto' and char_length(trim(coalesce(r.conteudo->>'texto',''))) = 0 then p := array_append(p, format('Aula %s.%s: escreva o texto.', r.mo, r.ao)); end if;
    if r.tipo in ('imagem','video','pdf','apresentacao','link') and coalesce(r.conteudo->>'url','') !~* '^https://' then p := array_append(p, format('Aula %s.%s: informe um link https.', r.mo, r.ao)); end if;
    if r.tipo in ('caso','pratica') and char_length(trim(coalesce(r.conteudo->>'enunciado',''))) = 0 then p := array_append(p, format('Aula %s.%s: escreva o enunciado.', r.mo, r.ao)); end if;
  end loop;
  if v.exige_qualidade and v.validada_qualidade_por is null then p := array_append(p, 'Aguardando validação da Qualidade.'); end if;
  if v.carga_horaria_min is not null and v.carga_horaria_validada_por is null then p := array_append(p, 'Carga horária informada ainda não foi validada pela Qualidade (valide ou remova).'); end if;
  return p;
end $$;

create or replace function public.ml_ac_treinamento_criar(p_usuario text, p_titulo text, p_categoria text)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid; vid uuid;
begin
  if nullif(trim(p_usuario),'') is null then raise exception 'Usuário obrigatório.'; end if;
  insert into public.ml_ac_treinamentos (categoria_id, titulo, criado_por) values (p_categoria, trim(p_titulo), p_usuario) returning id into tid;
  insert into public.ml_ac_versoes (treinamento_id, numero, titulo, criado_por) values (tid, 1, trim(p_titulo), p_usuario) returning id into vid;
  perform public.ml_ac_evento(p_usuario, 'TREINAMENTO_CRIADO', 'treinamento', tid::text, jsonb_build_object('titulo', trim(p_titulo), 'versaoId', vid));
  return tid;
end $$;

create or replace function public.ml_ac_treinamento_meta(p_usuario text, p_id uuid, p_categoria text, p_responsavel text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ml_ac_treinamentos set categoria_id = p_categoria, responsavel_pessoa_id = nullif(trim(coalesce(p_responsavel,'')),''), atualizado_em = now()
   where id = p_id and status <> 'arquivado';
  if not found then raise exception 'Treinamento não encontrado ou arquivado.'; end if;
  perform public.ml_ac_evento(p_usuario, 'TREINAMENTO_DADOS_ALTERADOS', 'treinamento', p_id::text, jsonb_build_object('categoria', p_categoria, 'responsavel', p_responsavel));
end $$;

create or replace function public.ml_ac_versao_salvar(p_usuario text, p_versao uuid, p_dados jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v public.ml_ac_versoes; m jsonb; a jsonb; mat jsonb; mid uuid; i int := 0; j int; tipo text; url text; cont jsonb;
begin
  select * into v from public.ml_ac_versoes where id = p_versao for update;
  if not found then raise exception 'Versão não encontrada.'; end if;
  if v.status <> 'rascunho' then raise exception 'Só versões em rascunho podem ser editadas. Crie uma nova versão.'; end if;
  if p_dados->>'modalidade' not in ('nenhuma','automatica','gestor','hibrida') then raise exception 'Modalidade inválida.'; end if;
  -- Qualquer edição invalida a validação anterior da Qualidade.
  update public.ml_ac_versoes set
    titulo = left(trim(coalesce(p_dados->>'titulo','')), 200),
    descricao = left(trim(coalesce(p_dados->>'descricao','')), 5000),
    modalidade = p_dados->>'modalidade',
    nota_minima = nullif(trim(coalesce(p_dados->>'notaMinima','')), '')::numeric,
    max_tentativas = nullif(trim(coalesce(p_dados->>'maxTentativas','')), '')::int,
    obrigatorio = coalesce((p_dados->>'obrigatorio')::boolean, false),
    prazo_dias = nullif(trim(coalesce(p_dados->>'prazoDias','')), '')::int,
    validade_meses = nullif(trim(coalesce(p_dados->>'validadeMeses','')), '')::int,
    carga_horaria_min = nullif(trim(coalesce(p_dados->>'cargaHorariaMin','')), '')::int,
    exige_qualidade = coalesce((p_dados->>'exigeQualidade')::boolean, false),
    notas_versao = left(trim(coalesce(p_dados->>'notasVersao','')), 2000),
    carga_horaria_validada_por = null, validada_qualidade_por = null, validada_qualidade_em = null
  where id = p_versao;
  delete from public.ml_ac_aulas where versao_id = p_versao;
  delete from public.ml_ac_modulos where versao_id = p_versao;
  delete from public.ml_ac_materiais where versao_id = p_versao;
  for m in select * from jsonb_array_elements(coalesce(p_dados->'modulos','[]'::jsonb)) loop
    i := i + 1;
    insert into public.ml_ac_modulos (versao_id, ordem, titulo, descricao)
      values (p_versao, i, left(trim(coalesce(m->>'titulo','')), 200), left(trim(coalesce(m->>'descricao','')), 2000)) returning id into mid;
    j := 0;
    for a in select * from jsonb_array_elements(coalesce(m->'aulas','[]'::jsonb)) loop
      j := j + 1;
      tipo := a->>'tipo';
      if tipo not in ('texto','imagem','video','pdf','apresentacao','link','caso','pratica') then raise exception 'Tipo de aula inválido: %', coalesce(tipo,'(vazio)'); end if;
      url := nullif(trim(coalesce(a->'conteudo'->>'url','')), '');
      if url is not null and url !~* '^https://[^ ]+$' then raise exception 'Links devem começar com https:// (aula %.%).', i, j; end if;
      cont := jsonb_strip_nulls(jsonb_build_object(
        'texto', left(a->'conteudo'->>'texto', 50000), 'url', left(url, 2000),
        'enunciado', left(a->'conteudo'->>'enunciado', 10000), 'orientacoes', left(a->'conteudo'->>'orientacoes', 10000)));
      insert into public.ml_ac_aulas (versao_id, modulo_id, ordem, titulo, tipo, conteudo, duracao_min)
        values (p_versao, mid, j, left(trim(coalesce(a->>'titulo','')), 200), tipo, cont, nullif(trim(coalesce(a->>'duracaoMin','')), '')::int);
    end loop;
  end loop;
  i := 0;
  for mat in select * from jsonb_array_elements(coalesce(p_dados->'materiais','[]'::jsonb)) loop
    i := i + 1;
    url := trim(coalesce(mat->>'url',''));
    if url !~* '^https://[^ ]+$' then raise exception 'Material %: o link deve começar com https://.', i; end if;
    insert into public.ml_ac_materiais (versao_id, ordem, titulo, url) values (p_versao, i, left(trim(coalesce(mat->>'titulo','')), 200), left(url, 2000));
  end loop;
  update public.ml_ac_treinamentos set atualizado_em = now() where id = v.treinamento_id;
  perform public.ml_ac_evento(p_usuario, 'VERSAO_SALVA', 'versao', p_versao::text, jsonb_build_object('numero', v.numero));
end $$;

create or replace function public.ml_ac_versao_validar_qualidade(p_usuario text, p_versao uuid, p_carga_validada boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v public.ml_ac_versoes;
begin
  select * into v from public.ml_ac_versoes where id = p_versao for update;
  if not found or v.status <> 'rascunho' then raise exception 'Só versões em rascunho podem ser validadas.'; end if;
  update public.ml_ac_versoes set validada_qualidade_por = p_usuario, validada_qualidade_em = now(),
    carga_horaria_validada_por = case when p_carga_validada and carga_horaria_min is not null then p_usuario end
   where id = p_versao;
  perform public.ml_ac_evento(p_usuario, 'VERSAO_VALIDADA_QUALIDADE', 'versao', p_versao::text, jsonb_build_object('cargaValidada', p_carga_validada and v.carga_horaria_min is not null));
end $$;

create or replace function public.ml_ac_versao_publicar(p_usuario text, p_versao uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.ml_ac_versoes; p text[];
begin
  select * into v from public.ml_ac_versoes where id = p_versao for update;
  if not found then raise exception 'Versão não encontrada.'; end if;
  if v.status <> 'rascunho' then raise exception 'Esta versão já foi publicada.'; end if;
  p := public.ml_ac_problemas_versao(p_versao);
  if array_length(p, 1) > 0 then raise exception 'Não é possível publicar: %', array_to_string(p, ' '); end if;
  update public.ml_ac_versoes set status = 'substituida' where treinamento_id = v.treinamento_id and status = 'publicada';
  update public.ml_ac_versoes set status = 'publicada', publicada_por = p_usuario, publicada_em = now() where id = p_versao;
  update public.ml_ac_treinamentos set status = 'publicado', titulo = v.titulo, descricao = v.descricao, atualizado_em = now() where id = v.treinamento_id;
  perform public.ml_ac_evento(p_usuario, 'VERSAO_PUBLICADA', 'versao', p_versao::text, jsonb_build_object('numero', v.numero, 'treinamentoId', v.treinamento_id));
end $$;

create or replace function public.ml_ac_nova_versao(p_usuario text, p_treinamento uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare atual public.ml_ac_versoes; novo uuid; m record; mid uuid;
begin
  select * into atual from public.ml_ac_versoes where treinamento_id = p_treinamento and status = 'publicada';
  if not found then raise exception 'Só é possível criar nova versão a partir de uma versão publicada.'; end if;
  if exists (select 1 from public.ml_ac_versoes where treinamento_id = p_treinamento and status = 'rascunho') then
    raise exception 'Já existe uma versão em rascunho para este treinamento.'; end if;
  insert into public.ml_ac_versoes (treinamento_id, numero, titulo, descricao, modalidade, nota_minima, max_tentativas, obrigatorio,
      prazo_dias, validade_meses, carga_horaria_min, exige_qualidade, criado_por)
    values (p_treinamento, (select max(numero) + 1 from public.ml_ac_versoes where treinamento_id = p_treinamento), atual.titulo, atual.descricao,
      atual.modalidade, atual.nota_minima, atual.max_tentativas, atual.obrigatorio, atual.prazo_dias, atual.validade_meses,
      atual.carga_horaria_min, atual.exige_qualidade, p_usuario) returning id into novo;
  for m in select * from public.ml_ac_modulos where versao_id = atual.id order by ordem loop
    insert into public.ml_ac_modulos (versao_id, ordem, titulo, descricao) values (novo, m.ordem, m.titulo, m.descricao) returning id into mid;
    insert into public.ml_ac_aulas (versao_id, modulo_id, ordem, titulo, tipo, conteudo, duracao_min)
      select novo, mid, ordem, titulo, tipo, conteudo, duracao_min from public.ml_ac_aulas where modulo_id = m.id;
  end loop;
  insert into public.ml_ac_materiais (versao_id, ordem, titulo, url) select novo, ordem, titulo, url from public.ml_ac_materiais where versao_id = atual.id;
  perform public.ml_ac_evento(p_usuario, 'NOVA_VERSAO_CRIADA', 'versao', novo::text, jsonb_build_object('baseadaEm', atual.id, 'treinamentoId', p_treinamento));
  return novo;
end $$;

create or replace function public.ml_ac_treinamento_arquivar(p_usuario text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ml_ac_treinamentos set status = 'arquivado', atualizado_em = now() where id = p_id and status <> 'arquivado';
  if not found then raise exception 'Treinamento não encontrado ou já arquivado.'; end if;
  update public.ml_ac_versoes set status = 'arquivada' where treinamento_id = p_id and status = 'publicada';
  perform public.ml_ac_evento(p_usuario, 'TREINAMENTO_ARQUIVADO', 'treinamento', p_id::text, '{}'::jsonb);
end $$;

create or replace function public.ml_ac_publico_salvar(p_usuario text, p_treinamento uuid, p_itens jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  if not exists (select 1 from public.ml_ac_treinamentos where id = p_treinamento and status <> 'arquivado') then raise exception 'Treinamento não encontrado ou arquivado.'; end if;
  delete from public.ml_ac_publico where treinamento_id = p_treinamento;
  for it in select * from jsonb_array_elements(coalesce(p_itens,'[]'::jsonb)) loop
    if it->>'tipo' not in ('todos','colaborador','cargo','setor','grupo') or nullif(trim(coalesce(it->>'valor','')),'') is null then raise exception 'Público inválido.'; end if;
    insert into public.ml_ac_publico (treinamento_id, tipo, valor) values (p_treinamento, it->>'tipo', trim(it->>'valor')) on conflict do nothing;
  end loop;
  perform public.ml_ac_evento(p_usuario, 'PUBLICO_ALTERADO', 'treinamento', p_treinamento::text, jsonb_build_object('itens', coalesce(p_itens,'[]'::jsonb)));
end $$;

create or replace function public.ml_ac_grupo_salvar(p_usuario text, p_id uuid, p_nome text, p_descricao text, p_ativo boolean, p_membros jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid := p_id; mem text;
begin
  if gid is null then
    insert into public.ml_ac_grupos (nome, descricao, ativo) values (trim(p_nome), coalesce(p_descricao,''), coalesce(p_ativo,true)) returning id into gid;
  else
    update public.ml_ac_grupos set nome = trim(p_nome), descricao = coalesce(p_descricao,''), ativo = coalesce(p_ativo,true) where id = gid;
    if not found then raise exception 'Grupo não encontrado.'; end if;
  end if;
  delete from public.ml_ac_grupo_membros where grupo_id = gid;
  for mem in select jsonb_array_elements_text(coalesce(p_membros,'[]'::jsonb)) loop
    insert into public.ml_ac_grupo_membros (grupo_id, pessoa_id) values (gid, mem) on conflict do nothing;
  end loop;
  perform public.ml_ac_evento(p_usuario, 'GRUPO_SALVO', 'grupo', gid::text, jsonb_build_object('nome', trim(p_nome)));
  return gid;
end $$;

create or replace function public.ml_ac_vinculo_salvar(p_usuario text, p_conta text, p_pessoa text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(coalesce(p_pessoa,'')),'') is null then
    delete from public.ml_ac_vinculos where usuario = p_conta;
  else
    insert into public.ml_ac_vinculos (usuario, pessoa_id, criado_por) values (p_conta, trim(p_pessoa), p_usuario)
      on conflict (usuario) do update set pessoa_id = excluded.pessoa_id, criado_por = excluded.criado_por, criado_em = now();
  end if;
  perform public.ml_ac_evento(p_usuario, 'VINCULO_ALTERADO', 'conta', p_conta, jsonb_build_object('pessoaId', p_pessoa));
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'ml_ac_evento(text,text,text,text,jsonb)','ml_ac_problemas_versao(uuid)','ml_ac_treinamento_criar(text,text,text)',
    'ml_ac_treinamento_meta(text,uuid,text,text)','ml_ac_versao_salvar(text,uuid,jsonb)','ml_ac_versao_validar_qualidade(text,uuid,boolean)',
    'ml_ac_versao_publicar(text,uuid)','ml_ac_nova_versao(text,uuid)','ml_ac_treinamento_arquivar(text,uuid)',
    'ml_ac_publico_salvar(text,uuid,jsonb)','ml_ac_grupo_salvar(text,uuid,text,text,boolean,jsonb)','ml_ac_vinculo_salvar(text,text,text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- REVERSÃO (só se a Academy ainda não tiver dados reais; apaga tudo do módulo):
--   drop table if exists public.ml_ac_eventos, public.ml_ac_publico, public.ml_ac_grupo_membros, public.ml_ac_grupos,
--     public.ml_ac_materiais, public.ml_ac_aulas, public.ml_ac_modulos, public.ml_ac_versoes, public.ml_ac_treinamentos,
--     public.ml_ac_categorias, public.ml_ac_vinculos cascade;
--   (depois: drop function public.ml_ac_* ...)
