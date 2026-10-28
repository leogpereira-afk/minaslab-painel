-- E-mail: endereços da própria MinasLab (minaslab.net/.online...) nunca viram
-- atendimento nem são ligados a cliente (há cadastro de teste com contato@).
-- Formulários do site chegam "de" contato@ e são tratados na função (usa o e-mail do visitante).
create or replace function public.email_interno(p_email text) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select coalesce(lower(p_email), '') ~ '@([a-z0-9-]+\.)*minaslab\.';
$$;

create or replace function public.email_vincular(
  p_email text, p_nome text, p_assunto text, p_in_reply_to text, p_referencias text[],
  p_automatica boolean, p_pode_criar boolean)
returns table(lead_id uuid, cliente_id uuid, contato_id uuid, criado boolean)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_lead uuid; v_cli uuid; v_cont uuid; v_nome text; v_empresa text;
begin
  select m.lead_id into v_lead from public.email_mensagens m
   where m.lead_id is not null and (m.message_id = p_in_reply_to or m.message_id = any(coalesce(p_referencias, '{}')))
   order by m.recebido_em desc limit 1;
  if public.email_interno(v_email) then
    return query select v_lead, null::uuid, null::uuid, false; return;
  end if;

  if v_email <> '' then
    select c.id, c.cliente_id, c.nome into v_cont, v_cli, v_nome from public.contatos c
     where c.deleted_at is null and coalesce(c.ativo, true) and lower(btrim(c.email)) = v_email
     order by c.principal desc nulls last, c.updated_at desc limit 1;
    if v_cli is null then
      select k.id into v_cli from public.clientes k
       where k.deleted_at is null and lower(btrim(k.email_principal)) = v_email
       order by k.updated_at desc limit 1;
    end if;
  end if;
  if v_cli is not null then
    select coalesce(nullif(btrim(k.nome_fantasia), ''), nullif(btrim(k.razao_social), '')) into v_empresa from public.clientes k where k.id = v_cli;
  end if;

  if v_lead is null and v_email <> '' then
    select l.id into v_lead from public.leads l
     where l.deleted_at is null and coalesce(l.ativo, true)
       and lower(l.status) not in ('encerrado', 'convertido')
       and (lower(btrim(l.email_contato)) = v_email or (v_cont is not null and l.contato_convertido_id = v_cont))
     order by coalesce(l.updated_at, l.created_at) desc limit 1;
  end if;

  if v_lead is not null then
    return query select v_lead, v_cli, v_cont, false; return;
  end if;
  if not p_pode_criar or v_email = '' or (p_automatica and v_cli is null) then
    return query select null::uuid, v_cli, v_cont, false; return;
  end if;

  insert into public.leads(nome, email_contato, empresa_contato, origem, assunto, resumo, status, data_primeiro_atendimento,
                           cliente_convertido_id, contato_convertido_id, source_system)
  values (coalesce(nullif(btrim(v_nome), ''), nullif(btrim(p_nome), ''), v_email), v_email, v_empresa, 'E-mail',
          left(coalesce(nullif(btrim(p_assunto), ''), 'E-mail recebido'), 300), null, 'Em atendimento', now(), v_cli, v_cont, 'EMAIL')
  returning id into v_lead;
  insert into public.atendimentos(lead_id, cliente_id, contato_id, ocorrido_em, canal, assunto, resumo, source_system)
  values (v_lead, v_cli, v_cont, now(), 'E-mail', left(coalesce(nullif(btrim(p_assunto), ''), 'E-mail recebido'), 300), null, 'EMAIL');
  return query select v_lead, v_cli, v_cont, true;
end $$;
revoke all on function public.email_vincular(text, text, text, text, text[], boolean, boolean) from public, anon, authenticated;

-- Desfaz o atendimento criado por engano a partir dos formulários "Trabalhe no Minaslab".
do $$
declare v_lead uuid;
begin
  for v_lead in select l.id from public.leads l where l.source_system = 'EMAIL' and l.email_contato = 'contato@minaslab.net' loop
    update public.email_mensagens set lead_id = null, cliente_id = null, contato_id = null where lead_id = v_lead;
    delete from public.interacoes where lead_id = v_lead and source_system = 'EMAIL';
    delete from public.atendimentos where lead_id = v_lead and source_system = 'EMAIL';
    update public.leads set deleted_at = now(), ativo = false where id = v_lead;
  end loop;
  update public.email_mensagens m set lead_id = null, cliente_id = null, contato_id = null
   where m.lead_id is null and public.email_interno(case when m.direcao = 'RECEIVED' then m.de_email else m.para[1] end);
end $$;
