-- E-mail estilo webmail no CRM (página /email).
--   * html: corpo original (exibido num quadro isolado, sem scripts e sem imagens externas até o usuário pedir);
--   * lido / lido_em / lido_por: controle de não lidos dentro do CRM;
--   * email_ligar(): liga um e-mail a um atendimento existente, ou cria um atendimento a partir dele.

alter table public.email_mensagens
  add column if not exists html text,
  add column if not exists lido boolean not null default false,
  add column if not exists lido_em timestamptz,
  add column if not exists lido_por uuid references public.profiles(id) on delete set null;
-- O que já foi lido antes desta tela (enviados e e-mails antigos) não aparece como não lido.
update public.email_mensagens set lido = true where direcao = 'SENT' or recebido_em < now() - interval '2 days';
create index if not exists email_mensagens_pasta_idx on public.email_mensagens(direcao, recebido_em desc);

-- Marcar como lido/não lido (só a coluna de leitura; o resto continua só pelo servidor).
create or replace function public.email_marcar_lido(p_ids uuid[], p_lido boolean) returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  if not public.has_permission('crm.read') then raise exception 'sem permissão'; end if;
  update public.email_mensagens set lido = p_lido, lido_em = case when p_lido then now() end, lido_por = case when p_lido then auth.uid() end
   where id = any(p_ids) and lido is distinct from p_lido;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.email_marcar_lido(uuid[], boolean) from public, anon;
grant execute on function public.email_marcar_lido(uuid[], boolean) to authenticated;

-- Liga o e-mail (e a conversa dele) a um atendimento; sem p_lead, cria um atendimento a partir do e-mail.
create or replace function public.email_ligar(p_email uuid, p_lead uuid default null) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  m public.email_mensagens%rowtype; v_lead uuid := p_lead; r record; v_quem text; v_cli uuid; v_cont uuid;
begin
  if not public.has_permission('crm.write') then raise exception 'sem permissão'; end if;
  select * into m from public.email_mensagens where id = p_email;
  if not found then raise exception 'e-mail não encontrado'; end if;
  v_quem := case when m.direcao = 'RECEIVED' then m.de_email else m.para[1] end;
  if v_lead is null then
    if public.email_interno(v_quem) then raise exception 'e-mail interno da MinasLab'; end if;
    select * into r from public.email_vincular(v_quem, m.de_nome, m.assunto, null, '{}', false, true);
    v_lead := r.lead_id;
  end if;
  if v_lead is null then raise exception 'não foi possível criar o atendimento'; end if;
  select l.cliente_convertido_id, l.contato_convertido_id into v_cli, v_cont from public.leads l where l.id = v_lead and l.deleted_at is null;
  if not found then raise exception 'atendimento não encontrado'; end if;

  -- O e-mail e as respostas da mesma conversa (mesmas referências) vão juntos.
  update public.email_mensagens e set lead_id = v_lead, cliente_id = v_cli, contato_id = v_cont
   where e.id = p_email or (e.lead_id is null and (e.message_id = any(m.referencias) or e.in_reply_to = m.message_id or m.message_id = any(e.referencias)));
  insert into public.interacoes(lead_id, cliente_id, contato_id, usuario_id, ocorrido_em, tipo, descricao, source_system, external_id, direction, message_kind, message_text)
  select v_lead, v_cli, v_cont, auth.uid(), e.recebido_em, 'EMAIL',
         left(case when e.direcao = 'RECEIVED' then 'E-mail recebido' else 'E-mail enviado' end || coalesce(': ' || nullif(e.assunto, ''), ''), 500),
         'EMAIL', 'email:' || e.message_id, e.direcao, 'TEXT', left(coalesce(e.texto_resumido, e.texto), 4000)
    from public.email_mensagens e
   where e.lead_id = v_lead and not exists (select 1 from public.interacoes i where i.source_system = 'EMAIL' and i.external_id = 'email:' || e.message_id);
  update public.leads set updated_at = now(), email_contato = coalesce(nullif(email_contato, ''), case when public.email_interno(v_quem) then null else v_quem end) where id = v_lead;
  return v_lead;
end $$;
revoke all on function public.email_ligar(uuid, uuid) from public, anon;
grant execute on function public.email_ligar(uuid, uuid) to authenticated;

-- email_registrar: guarda o html e, quando o e-mail já existe sem html (lido antes desta versão), completa.
create or replace function public.email_registrar(p jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_id uuid; v_dir text := p->>'direcao'; r record; v_lead uuid := nullif(p->>'lead_id', '')::uuid;
  v_cli uuid; v_cont uuid; v_criado boolean := false; v_quem text; v_refs text[];
begin
  select id into v_id from public.email_mensagens where message_id = p->>'message_id';
  if v_id is not null then
    update public.email_mensagens set html = left(p->>'html', 400000)
     where id = v_id and html is null and nullif(p->>'html', '') is not null;
    return jsonb_build_object('duplicado', true, 'id', v_id);
  end if;
  v_refs := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'referencias', '[]'::jsonb)) x), '{}');
  if v_lead is null then
    v_quem := case when v_dir = 'RECEIVED' then p->>'de_email' else (p->'para'->>0) end;
    select * into r from public.email_vincular(v_quem, case when v_dir = 'RECEIVED' then p->>'de_nome' end, p->>'assunto',
      p->>'in_reply_to', v_refs,
      -- Histórico (primeira leitura) segue a regra das automáticas: só cria se o remetente for cadastrado.
      coalesce((p->>'automatica')::boolean, false) or coalesce((p->>'historico')::boolean, false), v_dir = 'RECEIVED');
    v_lead := r.lead_id; v_cli := r.cliente_id; v_cont := r.contato_id; v_criado := coalesce(r.criado, false);
  else
    select l.cliente_convertido_id, l.contato_convertido_id into v_cli, v_cont from public.leads l where l.id = v_lead;
  end if;

  insert into public.email_mensagens(caixa, pasta, uid, message_id, in_reply_to, referencias, direcao, de_email, de_nome, para, cc,
     assunto, texto, texto_resumido, html, anexos, automatica, recebido_em, lead_id, cliente_id, contato_id, enviado_por, lido)
  values (p->>'caixa', coalesce(p->>'pasta', 'INBOX'), nullif(p->>'uid', '')::bigint, p->>'message_id', nullif(p->>'in_reply_to', ''), v_refs, v_dir,
     lower(nullif(p->>'de_email', '')), nullif(p->>'de_nome', ''),
     coalesce((select array_agg(lower(x)) from jsonb_array_elements_text(coalesce(p->'para', '[]'::jsonb)) x), '{}'),
     coalesce((select array_agg(lower(x)) from jsonb_array_elements_text(coalesce(p->'cc', '[]'::jsonb)) x), '{}'),
     left(p->>'assunto', 500), left(p->>'texto', 100000), left(p->>'texto_resumido', 20000), left(nullif(p->>'html', ''), 400000),
     coalesce(p->'anexos', '[]'::jsonb), coalesce((p->>'automatica')::boolean, false), coalesce(public.chatpro_ts(p->>'recebido_em'), now()),
     v_lead, v_cli, v_cont, nullif(p->>'enviado_por', '')::uuid,
     v_dir = 'SENT' or coalesce((p->>'historico')::boolean, false))
  returning id into v_id;

  if v_lead is not null then
    insert into public.interacoes(lead_id, cliente_id, contato_id, usuario_id, ocorrido_em, tipo, descricao, source_system, external_id, direction, message_kind, message_text)
    values (v_lead, v_cli, v_cont, nullif(p->>'enviado_por', '')::uuid, coalesce(public.chatpro_ts(p->>'recebido_em'), now()), 'EMAIL',
      left(case when v_dir = 'RECEIVED' then 'E-mail recebido' else 'E-mail enviado' end || coalesce(': ' || nullif(p->>'assunto', ''), ''), 500),
      'EMAIL', 'email:' || (p->>'message_id'), v_dir, 'TEXT', left(coalesce(p->>'texto_resumido', p->>'texto'), 4000));
    update public.leads set updated_at = now() where id = v_lead;
  end if;
  return jsonb_build_object('id', v_id, 'lead_id', v_lead, 'atendimento_novo', v_criado);
end $$;
revoke all on function public.email_registrar(jsonb) from public, anon, authenticated;
grant execute on function public.email_registrar(jsonb) to service_role;

-- Relê os últimos 30 dias para trazer o html dos e-mails gravados antes desta versão
-- (os já gravados não se repetem; só ganham o html).
update public.email_estado set ultimo_uid = 0;
