-- MinasLab Academy — Etapa 3 (aprendizagem): questões e gabaritos, atribuições,
-- progresso das aulas, tentativas de prova corrigidas NO BANCO, certificados e
-- notificações internas. Aditiva à migração de fundação (20261005120000).
--
-- Segurança: igual à fundação — RLS ligado e sem policy; só as Edge Functions
-- (service_role) acessam; toda escrita passa por funções ml_ac_* que conferem o
-- dono do registro. O gabarito mora em tabela própria e NUNCA é devolvido ao
-- colaborador. Nota, aprovação e conclusão só nascem dentro destas funções.
--
-- Reversão: ver o final deste arquivo.

-- ---------------------------------------------------------------- questões
create table if not exists public.ml_ac_questoes (
  id        uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.ml_ac_versoes(id) on delete cascade,
  ordem     int  not null check (ordem >= 1),
  -- tipo é texto livre validado por check: associação/ordenação entram depois
  -- só ampliando esta lista e a função de correção.
  tipo      text not null check (tipo in ('multipla','vf','multiplas')),
  enunciado text not null default '',
  feedback  text not null default '',
  unique (versao_id, ordem)
);
create table if not exists public.ml_ac_opcoes (
  id         uuid primary key default gen_random_uuid(),
  versao_id  uuid not null references public.ml_ac_versoes(id) on delete cascade,
  questao_id uuid not null references public.ml_ac_questoes(id) on delete cascade,
  ordem      int  not null check (ordem >= 1),
  texto      text not null default '',
  unique (questao_id, ordem)
);
create table if not exists public.ml_ac_gabaritos (
  opcao_id  uuid primary key references public.ml_ac_opcoes(id) on delete cascade,
  versao_id uuid not null references public.ml_ac_versoes(id) on delete cascade
);
do $$ declare t text; begin
  foreach t in array array['ml_ac_questoes','ml_ac_opcoes','ml_ac_gabaritos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_bloqueio', t);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.ml_ac_conteudo_imutavel()', t || '_bloqueio', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- aprendizagem
create table if not exists public.ml_ac_atribuicoes (
  id             uuid primary key default gen_random_uuid(),
  pessoa_id      text not null,
  treinamento_id uuid not null references public.ml_ac_treinamentos(id) on delete restrict,
  versao_id      uuid not null references public.ml_ac_versoes(id) on delete restrict,
  origem         text not null check (origem in ('publico','manual')),
  obrigatorio    boolean not null default false,
  atribuida_em   timestamptz not null default now(),
  prazo_em       date,
  status         text not null default 'pendente' check (status in ('pendente','em_andamento','concluida')),
  iniciada_em    timestamptz,
  concluida_em   timestamptz,
  valida_ate     date,
  ultima_aula_id uuid references public.ml_ac_aulas(id) on delete restrict,
  unique (pessoa_id, versao_id)
);
create index if not exists ml_ac_atribuicoes_pessoa_idx on public.ml_ac_atribuicoes (pessoa_id, status);
create index if not exists ml_ac_atribuicoes_treinamento_idx on public.ml_ac_atribuicoes (treinamento_id, pessoa_id);

create table if not exists public.ml_ac_progresso (
  atribuicao_id uuid not null references public.ml_ac_atribuicoes(id) on delete restrict,
  aula_id       uuid not null references public.ml_ac_aulas(id) on delete restrict,
  aberta_em     timestamptz not null default now(),
  concluida_em  timestamptz,
  resposta      text not null default '',
  primary key (atribuicao_id, aula_id)
);

create table if not exists public.ml_ac_tentativas (
  id            uuid primary key default gen_random_uuid(),
  atribuicao_id uuid not null references public.ml_ac_atribuicoes(id) on delete restrict,
  numero        int  not null check (numero >= 1),
  iniciada_em   timestamptz not null default now(),
  enviada_em    timestamptz,
  nota          numeric(5,2) check (nota between 0 and 100),
  aprovado      boolean,
  unique (atribuicao_id, numero)
);
-- No máximo uma tentativa aberta por atribuição (retomar em vez de abrir outra).
create unique index if not exists ml_ac_tentativas_uma_aberta on public.ml_ac_tentativas (atribuicao_id) where enviada_em is null;

create table if not exists public.ml_ac_respostas (
  tentativa_id uuid not null references public.ml_ac_tentativas(id) on delete restrict,
  questao_id   uuid not null references public.ml_ac_questoes(id) on delete restrict,
  opcoes       uuid[] not null default '{}',
  correta      boolean not null,
  primary key (tentativa_id, questao_id)
);

create table if not exists public.ml_ac_certificados (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null unique,
  atribuicao_id     uuid not null unique references public.ml_ac_atribuicoes(id) on delete restrict,
  pessoa_id         text not null,
  pessoa_nome       text not null,
  treinamento_titulo text not null,
  versao_numero     int  not null,
  responsavel_nome  text not null default '',
  carga_horaria_min int,
  nota              numeric(5,2),
  emitido_em        timestamptz not null default now()
);
create index if not exists ml_ac_certificados_pessoa_idx on public.ml_ac_certificados (pessoa_id);

create table if not exists public.ml_ac_notificacoes (
  id        uuid primary key default gen_random_uuid(),
  pessoa_id text not null,
  tipo      text not null,
  titulo    text not null,
  corpo     text not null default '',
  link      text not null default '',
  criada_em timestamptz not null default now(),
  lida_em   timestamptz
);
create index if not exists ml_ac_notificacoes_pessoa_idx on public.ml_ac_notificacoes (pessoa_id, criada_em desc);

-- ---------------------------------------------------------------- imutabilidade do histórico
create or replace function public.ml_ac_historico_imutavel() returns trigger
language plpgsql set search_path = public as $$
declare aberta boolean;
begin
  if tg_table_name = 'ml_ac_certificados' then
    raise exception 'Certificado emitido não pode ser alterado nem apagado.';
  end if;
  if tg_table_name = 'ml_ac_tentativas' then
    if tg_op = 'DELETE' then raise exception 'Tentativas fazem parte do histórico e não podem ser apagadas.'; end if;
    if old.enviada_em is not null then raise exception 'Tentativa já enviada não pode ser alterada.'; end if;
    return new;
  end if;
  if tg_table_name = 'ml_ac_respostas' then
    select enviada_em is null into aberta from public.ml_ac_tentativas where id = case when tg_op = 'DELETE' then old.tentativa_id else new.tentativa_id end;
    if tg_op = 'INSERT' and aberta then return new; end if;
    raise exception 'Respostas fazem parte do histórico e não podem ser alteradas.';
  end if;
  if tg_table_name = 'ml_ac_atribuicoes' and tg_op = 'DELETE' then
    raise exception 'Atribuições fazem parte do histórico e não podem ser apagadas.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
do $$ declare t text; begin
  foreach t in array array['ml_ac_certificados','ml_ac_tentativas','ml_ac_respostas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_historico', t);
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.ml_ac_historico_imutavel()', t || '_historico', t);
  end loop;
end $$;
drop trigger if exists ml_ac_respostas_historico_ins on public.ml_ac_respostas;
create trigger ml_ac_respostas_historico_ins before insert on public.ml_ac_respostas for each row execute function public.ml_ac_historico_imutavel();
drop trigger if exists ml_ac_atribuicoes_historico on public.ml_ac_atribuicoes;
create trigger ml_ac_atribuicoes_historico before delete on public.ml_ac_atribuicoes for each row execute function public.ml_ac_historico_imutavel();

-- ---------------------------------------------------------------- acesso
do $$ declare t text; begin
  foreach t in array array['ml_ac_questoes','ml_ac_opcoes','ml_ac_gabaritos','ml_ac_atribuicoes','ml_ac_progresso',
    'ml_ac_tentativas','ml_ac_respostas','ml_ac_certificados','ml_ac_notificacoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- regras de publicação (substitui a da fundação)
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
  if v.modalidade in ('gestor','hibrida') then
    p := array_append(p, 'A avaliação do gestor ainda não está disponível (próxima etapa): use "Somente conclusão das aulas" ou "Prova automática".');
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
  select count(*) into n from public.ml_ac_questoes where versao_id = p_versao;
  if v.modalidade = 'automatica' then
    if n = 0 then p := array_append(p, 'Prova automática: cadastre ao menos uma questão.'); end if;
    if v.nota_minima is null then p := array_append(p, 'Prova automática: defina a nota mínima.'); end if;
    if v.max_tentativas is null then p := array_append(p, 'Prova automática: defina o limite de tentativas.'); end if;
    for r in select q.id, q.ordem, q.tipo, q.enunciado,
                    (select count(*) from public.ml_ac_opcoes o where o.questao_id = q.id) as nop,
                    (select count(*) from public.ml_ac_opcoes o where o.questao_id = q.id and char_length(trim(o.texto)) = 0) as vazias,
                    (select count(*) from public.ml_ac_gabaritos g join public.ml_ac_opcoes o on o.id = g.opcao_id where o.questao_id = q.id) as certas
             from public.ml_ac_questoes q where q.versao_id = p_versao order by q.ordem loop
      if char_length(trim(r.enunciado)) = 0 then p := array_append(p, format('Questão %s sem enunciado.', r.ordem)); end if;
      if r.nop < 2 then p := array_append(p, format('Questão %s precisa de ao menos 2 opções.', r.ordem)); end if;
      if r.tipo = 'vf' and r.nop <> 2 then p := array_append(p, format('Questão %s (verdadeiro/falso) deve ter exatamente 2 opções.', r.ordem)); end if;
      if r.vazias > 0 then p := array_append(p, format('Questão %s tem opção sem texto.', r.ordem)); end if;
      if r.tipo in ('multipla','vf') and r.certas <> 1 then p := array_append(p, format('Questão %s deve ter exatamente 1 resposta correta.', r.ordem)); end if;
      if r.tipo = 'multiplas' and r.certas < 1 then p := array_append(p, format('Questão %s deve ter ao menos 1 resposta correta.', r.ordem)); end if;
    end loop;
  elsif n > 0 then
    p := array_append(p, 'Há questões cadastradas, mas o critério não é "Prova automática": remova as questões ou mude o critério.');
  end if;
  if v.exige_qualidade and v.validada_qualidade_por is null then p := array_append(p, 'Aguardando validação da Qualidade.'); end if;
  if v.carga_horaria_min is not null and v.carga_horaria_validada_por is null then p := array_append(p, 'Carga horária informada ainda não foi validada pela Qualidade (valide ou remova).'); end if;
  return p;
end $$;

-- ---------------------------------------------------------------- salvar versão (substitui: agora inclui questões)
create or replace function public.ml_ac_versao_salvar(p_usuario text, p_versao uuid, p_dados jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v public.ml_ac_versoes; m jsonb; a jsonb; mat jsonb; q jsonb; o jsonb; mid uuid; qid uuid; oid uuid;
        i int := 0; j int; k int; tipo text; url text; cont jsonb;
begin
  select * into v from public.ml_ac_versoes where id = p_versao for update;
  if not found then raise exception 'Versão não encontrada.'; end if;
  if v.status <> 'rascunho' then raise exception 'Só versões em rascunho podem ser editadas. Crie uma nova versão.'; end if;
  if p_dados->>'modalidade' not in ('nenhuma','automatica','gestor','hibrida') then raise exception 'Modalidade inválida.'; end if;
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
  delete from public.ml_ac_gabaritos where versao_id = p_versao;
  delete from public.ml_ac_opcoes where versao_id = p_versao;
  delete from public.ml_ac_questoes where versao_id = p_versao;
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
  i := 0;
  for q in select * from jsonb_array_elements(coalesce(p_dados->'questoes','[]'::jsonb)) loop
    i := i + 1;
    if q->>'tipo' not in ('multipla','vf','multiplas') then raise exception 'Tipo de questão inválido na questão %.', i; end if;
    if jsonb_array_length(coalesce(q->'opcoes','[]'::jsonb)) > 10 then raise exception 'Questão %: no máximo 10 opções.', i; end if;
    insert into public.ml_ac_questoes (versao_id, ordem, tipo, enunciado, feedback)
      values (p_versao, i, q->>'tipo', left(trim(coalesce(q->>'enunciado','')), 3000), left(trim(coalesce(q->>'feedback','')), 3000)) returning id into qid;
    k := 0;
    for o in select * from jsonb_array_elements(coalesce(q->'opcoes','[]'::jsonb)) loop
      k := k + 1;
      insert into public.ml_ac_opcoes (versao_id, questao_id, ordem, texto) values (p_versao, qid, k, left(trim(coalesce(o->>'texto','')), 500)) returning id into oid;
      if coalesce((o->>'correta')::boolean, false) then insert into public.ml_ac_gabaritos (opcao_id, versao_id) values (oid, p_versao); end if;
    end loop;
  end loop;
  update public.ml_ac_treinamentos set atualizado_em = now() where id = v.treinamento_id;
  perform public.ml_ac_evento(p_usuario, 'VERSAO_SALVA', 'versao', p_versao::text, jsonb_build_object('numero', v.numero));
end $$;

-- ---------------------------------------------------------------- nova versão (substitui: copia também as questões)
create or replace function public.ml_ac_nova_versao(p_usuario text, p_treinamento uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare atual public.ml_ac_versoes; novo uuid; m record; q record; o record; mid uuid; qid uuid; oid uuid;
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
  for q in select * from public.ml_ac_questoes where versao_id = atual.id order by ordem loop
    insert into public.ml_ac_questoes (versao_id, ordem, tipo, enunciado, feedback) values (novo, q.ordem, q.tipo, q.enunciado, q.feedback) returning id into qid;
    for o in select * from public.ml_ac_opcoes where questao_id = q.id order by ordem loop
      insert into public.ml_ac_opcoes (versao_id, questao_id, ordem, texto) values (novo, qid, o.ordem, o.texto) returning id into oid;
      if exists (select 1 from public.ml_ac_gabaritos where opcao_id = o.id) then insert into public.ml_ac_gabaritos (opcao_id, versao_id) values (oid, novo); end if;
    end loop;
  end loop;
  perform public.ml_ac_evento(p_usuario, 'NOVA_VERSAO_CRIADA', 'versao', novo::text, jsonb_build_object('baseadaEm', atual.id, 'treinamentoId', p_treinamento));
  return novo;
end $$;

-- ---------------------------------------------------------------- notificações
create or replace function public.ml_ac_notificar(p_pessoa text, p_tipo text, p_titulo text, p_corpo text default '', p_link text default '')
returns void language sql security definer set search_path = public as $$
  insert into public.ml_ac_notificacoes (pessoa_id, tipo, titulo, corpo, link) values (p_pessoa, p_tipo, p_titulo, coalesce(p_corpo,''), coalesce(p_link,''));
$$;

-- ---------------------------------------------------------------- atribuições
-- p_pessoas: [{id, setor, cargo}] dos colaboradores ATIVOS do RH (lido no servidor).
-- Cria a atribuição da versão publicada para quem está no público e ainda não tem
-- nenhuma atribuição daquele treinamento (nova versão NÃO reatribui sozinha:
-- convocar reciclagem é decisão explícita, etapa seguinte).
create or replace function public.ml_ac_atribuir(p_pessoas jsonb, p_treinamento uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare pe jsonb; t record; n int := 0; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  for t in select tr.id, tr.titulo, ver.id vid, ver.obrigatorio, ver.prazo_dias
           from public.ml_ac_treinamentos tr join public.ml_ac_versoes ver on ver.treinamento_id = tr.id and ver.status = 'publicada'
           where tr.status = 'publicado' and (p_treinamento is null or tr.id = p_treinamento) loop
    for pe in select * from jsonb_array_elements(coalesce(p_pessoas,'[]'::jsonb)) loop
      continue when nullif(pe->>'id','') is null;
      continue when exists (select 1 from public.ml_ac_atribuicoes a where a.pessoa_id = pe->>'id' and a.treinamento_id = t.id);
      continue when not exists (select 1 from public.ml_ac_publico p where p.treinamento_id = t.id and (
          p.tipo = 'todos'
          or (p.tipo = 'colaborador' and p.valor = pe->>'id')
          or (p.tipo = 'setor' and lower(trim(p.valor)) = lower(trim(coalesce(pe->>'setor',''))))
          or (p.tipo = 'cargo' and lower(trim(p.valor)) = lower(trim(coalesce(pe->>'cargo',''))))
          or (p.tipo = 'grupo' and exists (select 1 from public.ml_ac_grupo_membros m join public.ml_ac_grupos g on g.id = m.grupo_id
                                            where g.ativo and g.id::text = p.valor and m.pessoa_id = pe->>'id'))));
      insert into public.ml_ac_atribuicoes (pessoa_id, treinamento_id, versao_id, origem, obrigatorio, prazo_em)
        values (pe->>'id', t.id, t.vid, 'publico', t.obrigatorio, case when t.prazo_dias is not null then hoje + t.prazo_dias end);
      perform public.ml_ac_notificar(pe->>'id', 'ATRIBUICAO', 'Novo treinamento: ' || t.titulo,
        case when t.obrigatorio then 'Treinamento obrigatório.' else 'Treinamento disponível.' end, '/academy/minha');
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- Colaborador escolhe um treinamento do catálogo (opcional e dentro do seu público).
create or replace function public.ml_ac_matricular(p_usuario text, p_pessoa jsonb, p_treinamento uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare t public.ml_ac_treinamentos; v public.ml_ac_versoes; pe jsonb := p_pessoa; aid uuid; no_publico boolean; sem_publico boolean;
begin
  select * into t from public.ml_ac_treinamentos where id = p_treinamento and status = 'publicado';
  if not found then raise exception 'Treinamento indisponível.'; end if;
  select * into v from public.ml_ac_versoes where treinamento_id = t.id and status = 'publicada';
  select id into aid from public.ml_ac_atribuicoes where pessoa_id = pe->>'id' and treinamento_id = t.id order by atribuida_em desc limit 1;
  if aid is not null then return aid; end if;
  sem_publico := not exists (select 1 from public.ml_ac_publico where treinamento_id = t.id);
  no_publico := exists (select 1 from public.ml_ac_publico p where p.treinamento_id = t.id and (
          p.tipo = 'todos' or (p.tipo = 'colaborador' and p.valor = pe->>'id')
          or (p.tipo = 'setor' and lower(trim(p.valor)) = lower(trim(coalesce(pe->>'setor',''))))
          or (p.tipo = 'cargo' and lower(trim(p.valor)) = lower(trim(coalesce(pe->>'cargo',''))))
          or (p.tipo = 'grupo' and exists (select 1 from public.ml_ac_grupo_membros m join public.ml_ac_grupos g on g.id = m.grupo_id
                                            where g.ativo and g.id::text = p.valor and m.pessoa_id = pe->>'id'))));
  if not (no_publico or sem_publico) then raise exception 'Este treinamento não está disponível para o seu perfil.'; end if;
  insert into public.ml_ac_atribuicoes (pessoa_id, treinamento_id, versao_id, origem, obrigatorio, prazo_em)
    values (pe->>'id', t.id, v.id, 'manual', false, null) returning id into aid;
  perform public.ml_ac_evento(p_usuario, 'MATRICULA_MANUAL', 'atribuicao', aid::text, jsonb_build_object('pessoaId', pe->>'id'));
  return aid;
end $$;

-- ---------------------------------------------------------------- progresso e conclusão
create or replace function public.ml_ac_avaliar_conclusao(p_usuario text, p_atribuicao uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.ml_ac_atribuicoes; v public.ml_ac_versoes; total int; feitas int; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into a from public.ml_ac_atribuicoes where id = p_atribuicao for update;
  if not found or a.status = 'concluida' then return; end if;
  select * into v from public.ml_ac_versoes where id = a.versao_id;
  select count(*) into total from public.ml_ac_aulas where versao_id = a.versao_id;
  select count(*) into feitas from public.ml_ac_progresso p join public.ml_ac_aulas au on au.id = p.aula_id
    where p.atribuicao_id = a.id and au.versao_id = a.versao_id and p.concluida_em is not null;
  if total = 0 or feitas < total then return; end if;
  if v.modalidade = 'automatica' and not exists (select 1 from public.ml_ac_tentativas where atribuicao_id = a.id and aprovado) then return; end if;
  update public.ml_ac_atribuicoes set status = 'concluida', concluida_em = now(),
      valida_ate = case when v.validade_meses is not null then hoje + make_interval(months => v.validade_meses) end
    where id = a.id;
  perform public.ml_ac_evento(p_usuario, 'TREINAMENTO_CONCLUIDO', 'atribuicao', a.id::text, jsonb_build_object('pessoaId', a.pessoa_id, 'versaoId', a.versao_id));
  perform public.ml_ac_notificar(a.pessoa_id, 'CONCLUSAO', 'Treinamento concluído', 'Seu certificado está disponível em Meus Certificados.', '/academy/certificados');
end $$;

-- Abre (p_concluir = false) ou conclui (true) uma aula. Só mexe no que é do dono da atribuição.
create or replace function public.ml_ac_aula_registrar(p_usuario text, p_pessoa text, p_atribuicao uuid, p_aula uuid, p_concluir boolean, p_resposta text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.ml_ac_atribuicoes;
begin
  select * into a from public.ml_ac_atribuicoes where id = p_atribuicao and pessoa_id = p_pessoa for update;
  if not found then raise exception 'Treinamento não encontrado.'; end if;
  if not exists (select 1 from public.ml_ac_aulas where id = p_aula and versao_id = a.versao_id) then raise exception 'Aula não pertence a este treinamento.'; end if;
  if a.status = 'concluida' then return; end if; -- evidência já fechada
  insert into public.ml_ac_progresso (atribuicao_id, aula_id, concluida_em, resposta)
    values (p_atribuicao, p_aula, case when p_concluir then now() end, left(coalesce(p_resposta,''), 10000))
    on conflict (atribuicao_id, aula_id) do update set
      concluida_em = coalesce(public.ml_ac_progresso.concluida_em, case when p_concluir then now() end),
      resposta = case when p_resposta is null then public.ml_ac_progresso.resposta else left(p_resposta, 10000) end;
  update public.ml_ac_atribuicoes set ultima_aula_id = p_aula, iniciada_em = coalesce(iniciada_em, now()),
      status = case when status = 'pendente' then 'em_andamento' else status end where id = p_atribuicao;
  if p_concluir then perform public.ml_ac_avaliar_conclusao(p_usuario, p_atribuicao); end if;
end $$;

-- ---------------------------------------------------------------- prova automática (correção no banco)
create or replace function public.ml_ac_tentativa_iniciar(p_usuario text, p_pessoa text, p_atribuicao uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.ml_ac_atribuicoes; v public.ml_ac_versoes; total int; feitas int; usadas int; aberta public.ml_ac_tentativas; nova uuid;
begin
  select * into a from public.ml_ac_atribuicoes where id = p_atribuicao and pessoa_id = p_pessoa for update;
  if not found then raise exception 'Treinamento não encontrado.'; end if;
  select * into v from public.ml_ac_versoes where id = a.versao_id;
  if v.modalidade <> 'automatica' then raise exception 'Este treinamento não tem prova automática.'; end if;
  if exists (select 1 from public.ml_ac_tentativas where atribuicao_id = a.id and aprovado) then raise exception 'Você já foi aprovado nesta prova.'; end if;
  select * into aberta from public.ml_ac_tentativas where atribuicao_id = a.id and enviada_em is null;
  if found then return jsonb_build_object('tentativaId', aberta.id, 'numero', aberta.numero, 'retomada', true); end if;
  select count(*) into total from public.ml_ac_aulas where versao_id = a.versao_id;
  select count(*) into feitas from public.ml_ac_progresso p join public.ml_ac_aulas au on au.id = p.aula_id
    where p.atribuicao_id = a.id and au.versao_id = a.versao_id and p.concluida_em is not null;
  if feitas < total then raise exception 'Conclua todas as aulas antes de fazer a prova.'; end if;
  select count(*) into usadas from public.ml_ac_tentativas where atribuicao_id = a.id and enviada_em is not null;
  if usadas >= v.max_tentativas then raise exception 'Limite de tentativas atingido (%). Procure o RH.', v.max_tentativas; end if;
  insert into public.ml_ac_tentativas (atribuicao_id, numero) values (a.id, usadas + 1) returning id into nova;
  perform public.ml_ac_evento(p_usuario, 'TENTATIVA_INICIADA', 'atribuicao', a.id::text, jsonb_build_object('numero', usadas + 1));
  return jsonb_build_object('tentativaId', nova, 'numero', usadas + 1, 'retomada', false);
end $$;

-- p_respostas: [{questaoId, opcoes:[uuid,...]}]. Nota, aprovação e acerto são calculados AQUI.
create or replace function public.ml_ac_tentativa_enviar(p_usuario text, p_pessoa text, p_tentativa uuid, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.ml_ac_tentativas; a public.ml_ac_atribuicoes; v public.ml_ac_versoes; q record; resp jsonb; escolhidas uuid[]; certas uuid[];
        total int := 0; acertos int := 0; ok boolean; v_nota numeric(5,2); v_aprov boolean; det jsonb := '[]'::jsonb; usadas int;
begin
  select * into t from public.ml_ac_tentativas where id = p_tentativa for update;
  if not found then raise exception 'Tentativa não encontrada.'; end if;
  select * into a from public.ml_ac_atribuicoes where id = t.atribuicao_id;
  if a.pessoa_id <> p_pessoa then raise exception 'Tentativa não encontrada.'; end if;
  if t.enviada_em is not null then raise exception 'Esta tentativa já foi enviada.'; end if;
  select * into v from public.ml_ac_versoes where id = a.versao_id;
  for q in select * from public.ml_ac_questoes where versao_id = a.versao_id order by ordem loop
    total := total + 1;
    select r into resp from jsonb_array_elements(coalesce(p_respostas,'[]'::jsonb)) r where r->>'questaoId' = q.id::text limit 1;
    select coalesce(array_agg(distinct x::uuid), '{}') into escolhidas from jsonb_array_elements_text(coalesce(resp->'opcoes','[]'::jsonb)) x;
    if (select count(*) from public.ml_ac_opcoes o where o.questao_id = q.id and o.id = any(escolhidas)) <> coalesce(array_length(escolhidas,1),0) then
      raise exception 'Resposta inválida na questão %.', q.ordem;
    end if;
    select coalesce(array_agg(g.opcao_id), '{}') into certas from public.ml_ac_gabaritos g join public.ml_ac_opcoes o on o.id = g.opcao_id where o.questao_id = q.id;
    ok := coalesce(array_length(escolhidas,1),0) > 0
          and (select coalesce(array_agg(e order by e), '{}') from unnest(escolhidas) e) = (select coalesce(array_agg(c order by c), '{}') from unnest(certas) c);
    if ok then acertos := acertos + 1; end if;
    insert into public.ml_ac_respostas (tentativa_id, questao_id, opcoes, correta) values (t.id, q.id, escolhidas, ok);
    det := det || jsonb_build_array(jsonb_build_object('questaoId', q.id, 'ordem', q.ordem, 'correta', ok, 'feedback', q.feedback));
  end loop;
  if total = 0 then raise exception 'Esta prova não tem questões.'; end if;
  v_nota := round(100.0 * acertos / total, 2);
  v_aprov := v_nota >= v.nota_minima;
  update public.ml_ac_tentativas set enviada_em = now(), nota = v_nota, aprovado = v_aprov where id = t.id;
  select count(*) into usadas from public.ml_ac_tentativas where atribuicao_id = a.id and enviada_em is not null;
  perform public.ml_ac_evento(p_usuario, 'TENTATIVA_ENVIADA', 'atribuicao', a.id::text, jsonb_build_object('numero', t.numero, 'nota', v_nota, 'aprovado', v_aprov));
  perform public.ml_ac_notificar(a.pessoa_id, 'RESULTADO', case when v_aprov then 'Aprovado na prova' else 'Resultado da prova disponível' end,
    format('Nota %s (mínima %s).', v_nota, v.nota_minima), '/academy/treinamento/' || a.id);
  if v_aprov then perform public.ml_ac_avaliar_conclusao(p_usuario, a.id); end if;
  return jsonb_build_object('nota', v_nota, 'aprovado', v_aprov, 'notaMinima', v.nota_minima, 'acertos', acertos, 'total', total,
    'tentativasRestantes', greatest(v.max_tentativas - usadas, 0), 'detalhes', det);
end $$;

-- ---------------------------------------------------------------- certificado
-- Só existe para atribuição CONCLUÍDA (aulas + aprovação, quando há prova). Idempotente.
create or replace function public.ml_ac_certificado_emitir(p_usuario text, p_pessoa text, p_atribuicao uuid, p_pessoa_nome text, p_responsavel_nome text)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.ml_ac_atribuicoes; v public.ml_ac_versoes; t public.ml_ac_treinamentos; cid uuid; nota_final numeric;
begin
  select * into a from public.ml_ac_atribuicoes where id = p_atribuicao and pessoa_id = p_pessoa;
  if not found then raise exception 'Treinamento não encontrado.'; end if;
  if a.status <> 'concluida' then raise exception 'O certificado só é emitido após cumprir todos os critérios do treinamento.'; end if;
  select id into cid from public.ml_ac_certificados where atribuicao_id = a.id;
  if found then return cid; end if;
  select * into v from public.ml_ac_versoes where id = a.versao_id;
  select * into t from public.ml_ac_treinamentos where id = a.treinamento_id;
  select max(nota) into nota_final from public.ml_ac_tentativas where atribuicao_id = a.id and aprovado;
  insert into public.ml_ac_certificados (codigo, atribuicao_id, pessoa_id, pessoa_nome, treinamento_titulo, versao_numero, responsavel_nome, carga_horaria_min, nota)
    values ('ML-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
            a.id, a.pessoa_id, left(trim(p_pessoa_nome), 200), v.titulo, v.numero, left(trim(coalesce(p_responsavel_nome,'')), 200),
            case when v.carga_horaria_validada_por is not null then v.carga_horaria_min end, nota_final)
    returning id into cid;
  perform public.ml_ac_evento(p_usuario, 'CERTIFICADO_EMITIDO', 'atribuicao', a.id::text, jsonb_build_object('certificadoId', cid));
  return cid;
end $$;

-- ---------------------------------------------------------------- permissões das funções
do $$ declare f text; begin
  foreach f in array array[
    'ml_ac_problemas_versao(uuid)','ml_ac_versao_salvar(text,uuid,jsonb)','ml_ac_nova_versao(text,uuid)',
    'ml_ac_notificar(text,text,text,text,text)','ml_ac_atribuir(jsonb,uuid)','ml_ac_matricular(text,jsonb,uuid)',
    'ml_ac_avaliar_conclusao(text,uuid)','ml_ac_aula_registrar(text,text,uuid,uuid,boolean,text)',
    'ml_ac_tentativa_iniciar(text,text,uuid)','ml_ac_tentativa_enviar(text,text,uuid,jsonb)',
    'ml_ac_certificado_emitir(text,text,uuid,text,text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- REVERSÃO (só se ainda não houver dados reais de aprendizagem; apaga tentativas e certificados!):
--   drop table if exists public.ml_ac_notificacoes, public.ml_ac_certificados, public.ml_ac_respostas, public.ml_ac_tentativas,
--     public.ml_ac_progresso, public.ml_ac_atribuicoes, public.ml_ac_gabaritos, public.ml_ac_opcoes, public.ml_ac_questoes cascade;
--   (depois reaplicar as funções ml_ac_problemas_versao, ml_ac_versao_salvar e ml_ac_nova_versao da migração 20261005120000)
