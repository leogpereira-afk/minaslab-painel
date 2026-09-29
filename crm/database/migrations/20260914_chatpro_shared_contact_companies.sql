alter table public.chatpro_eventos add column if not exists resolution_status text;

create or replace function public.chatpro_resolve_or_create_atendimento(
  p_phone text,p_cliente_id uuid default null,p_contato_id uuid default null,p_resumo text default null
) returns table(lead_id uuid,atendimento_id uuid,cliente_id uuid,contato_id uuid,lead_created boolean,atendimento_created boolean)
language plpgsql security definer set search_path='pg_catalog','public' as $$
declare
  v_phone text;v_lead_id uuid;v_atendimento_id uuid;v_lead_created boolean:=false;v_atendimento_created boolean:=false;v_nome text;
begin
  v_phone:=public.normalize_phone_e164(p_phone);
  if v_phone is null then raise exception 'invalid_phone'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(p_cliente_id::text,v_phone),0));
  if p_cliente_id is not null then
    select l.id into v_lead_id from public.leads l where l.deleted_at is null and l.ativo and lower(l.status)='em atendimento' and l.cliente_convertido_id=p_cliente_id order by coalesce(l.data_primeiro_atendimento,l.created_at) desc,l.created_at desc limit 1;
  else
    select l.id into v_lead_id from public.leads l where l.deleted_at is null and l.ativo and lower(l.status)='em atendimento' and l.cliente_convertido_id is null and public.normalize_phone_e164(l.telefone_whatsapp)=v_phone order by coalesce(l.data_primeiro_atendimento,l.created_at) desc,l.created_at desc limit 1;
  end if;
  if v_lead_id is null then
    if p_cliente_id is not null then select coalesce(nullif(c.nome_fantasia,''),nullif(c.razao_social,'')) into v_nome from public.clientes c where c.id=p_cliente_id and c.deleted_at is null; end if;
    insert into public.leads(nome,telefone_whatsapp,origem,assunto,resumo,status,data_primeiro_atendimento,cliente_convertido_id,source_system)
    values(v_nome,v_phone,'WhatsApp',case when p_cliente_id is null then 'WhatsApp / ChatPro — selecionar empresa' else 'WhatsApp / ChatPro' end,nullif(left(coalesce(p_resumo,''),2000),''),'Em atendimento',now(),p_cliente_id,'CHATPRO')
    returning id into v_lead_id;v_lead_created:=true;
  end if;
  select a.id into v_atendimento_id from public.atendimentos a where a.lead_id=v_lead_id order by a.created_at asc limit 1;
  if v_atendimento_id is null then
    insert into public.atendimentos(lead_id,cliente_id,contato_id,ocorrido_em,canal,assunto,resumo,source_system)
    values(v_lead_id,p_cliente_id,p_contato_id,now(),'WhatsApp',case when p_cliente_id is null then 'WhatsApp / ChatPro — selecionar empresa' else 'WhatsApp / ChatPro' end,nullif(left(coalesce(p_resumo,''),2000),''),'CHATPRO')
    returning id into v_atendimento_id;v_atendimento_created:=true;
  end if;
  return query select v_lead_id,v_atendimento_id,p_cliente_id,p_contato_id,v_lead_created,v_atendimento_created;
end $$;

do $$
declare e record; f record; v_new jsonb; v_text text; v_kind text; v_sent boolean;
begin
 for e in select * from public.chatpro_eventos ce where ce.erro='telefone_ambiguo' and not exists(select 1 from public.interacoes i where i.external_id=ce.event_key) order by ce.recebido_em
 loop
  v_new:=coalesce(e.payload->'new','{}'::jsonb);
  v_text:=nullif(coalesce(v_new->>'message',v_new->>'alt_message',e.payload->>'text'),'');
  v_sent:=lower(coalesce(v_new->>'from_me','false'))='true';
  v_kind:=case when lower(coalesce(v_new->>'type',v_new->>'file_type','')) like '%audio%' then 'AUDIO' when lower(coalesce(v_new->>'type',v_new->>'file_type','')) like '%image%' then 'IMAGE' when lower(coalesce(v_new->>'type',v_new->>'file_type','')) like '%video%' then 'VIDEO' when nullif(v_new->>'url','') is not null then 'DOCUMENT' else 'TEXT' end;
  select * into f from public.chatpro_resolve_or_create_atendimento(e.phone,null,null,v_text);
  insert into public.interacoes(lead_id,cliente_id,contato_id,tipo,descricao,source_system,external_id,phone_e164,direction,message_kind,message_text,media_url,media_mime,media_name,chat_session_id,chat_instance_id,delivery_status,ocorrido_em)
  values(f.lead_id,null,null,'WHATSAPP','ChatPro | '||case when v_sent then 'Enviada' else 'Recebida' end||': '||coalesce(v_text,case when v_kind='AUDIO' then 'Áudio' when v_kind='IMAGE' then 'Imagem' when v_kind='VIDEO' then 'Vídeo' else coalesce(v_new->>'title','Anexo') end),'CHATPRO',e.event_key,public.normalize_phone_e164(e.phone),case when v_sent then 'SENT' else 'RECEIVED' end,v_kind,v_text,nullif(v_new->>'url',''),nullif(v_new->>'file_type',''),nullif(v_new->>'title',''),nullif(v_new->>'session_id',''),nullif(v_new->>'instance_id',''),nullif(v_new->>'status',''),e.recebido_em)
  on conflict do nothing;
  update public.chatpro_eventos set erro=null,resolution_status='AMBIGUO',processado_em=coalesce(processado_em,now()) where id=e.id;
 end loop;
end $$;