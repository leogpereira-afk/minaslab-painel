create index if not exists idx_leads_whatsapp_e164_open
  on public.leads ((public.normalize_phone_e164(telefone_whatsapp)))
  where deleted_at is null and ativo is true and lower(status) = 'em atendimento' and telefone_whatsapp is not null;

create or replace function public.chatpro_resolve_or_create_atendimento(
  p_phone text,
  p_cliente_id uuid default null,
  p_contato_id uuid default null,
  p_resumo text default null
)
returns table(
  lead_id uuid,
  atendimento_id uuid,
  cliente_id uuid,
  contato_id uuid,
  lead_created boolean,
  atendimento_created boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_phone text;
  v_lead_id uuid;
  v_atendimento_id uuid;
  v_lead_created boolean := false;
  v_atendimento_created boolean := false;
  v_nome text;
begin
  v_phone := public.normalize_phone_e164(p_phone);
  if v_phone is null then raise exception 'invalid_phone'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(p_cliente_id::text, v_phone), 0));

  if p_cliente_id is not null then
    select l.id into v_lead_id
    from public.leads l
    where l.deleted_at is null and l.ativo is true
      and lower(l.status) = 'em atendimento'
      and l.cliente_convertido_id = p_cliente_id
    order by coalesce(l.data_primeiro_atendimento, l.created_at) desc, l.created_at desc
    limit 1;
  else
    select l.id into v_lead_id
    from public.leads l
    where l.deleted_at is null and l.ativo is true
      and lower(l.status) = 'em atendimento'
      and public.normalize_phone_e164(l.telefone_whatsapp) = v_phone
    order by coalesce(l.data_primeiro_atendimento, l.created_at) desc, l.created_at desc
    limit 1;
  end if;

  if v_lead_id is null then
    if p_cliente_id is not null then
      select coalesce(nullif(c.nome_fantasia, ''), nullif(c.razao_social, '')) into v_nome
      from public.clientes c
      where c.id = p_cliente_id and c.deleted_at is null;
    end if;

    insert into public.leads (
      nome, telefone_whatsapp, origem, assunto, resumo, status,
      data_primeiro_atendimento, cliente_convertido_id, source_system
    ) values (
      v_nome, v_phone, 'WhatsApp', 'WhatsApp / ChatPro',
      nullif(left(coalesce(p_resumo, ''), 2000), ''), 'Em atendimento',
      now(), p_cliente_id, 'CHATPRO'
    ) returning id into v_lead_id;
    v_lead_created := true;
  end if;

  select a.id into v_atendimento_id
  from public.atendimentos a
  where a.lead_id = v_lead_id
  order by a.created_at asc
  limit 1;

  if v_atendimento_id is null then
    insert into public.atendimentos (
      lead_id, cliente_id, contato_id, ocorrido_em, canal, assunto, resumo, source_system
    ) values (
      v_lead_id, p_cliente_id, p_contato_id, now(), 'WhatsApp', 'WhatsApp / ChatPro',
      nullif(left(coalesce(p_resumo, ''), 2000), ''), 'CHATPRO'
    ) returning id into v_atendimento_id;
    v_atendimento_created := true;
  end if;

  return query select v_lead_id, v_atendimento_id, p_cliente_id, p_contato_id,
                      v_lead_created, v_atendimento_created;
end;
$$;

revoke all on function public.chatpro_resolve_or_create_atendimento(text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.chatpro_resolve_or_create_atendimento(text, uuid, uuid, text) to service_role;
