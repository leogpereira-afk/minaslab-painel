alter table public.interacoes
  add column if not exists phone_e164 text,
  add column if not exists direction text,
  add column if not exists message_kind text not null default 'TEXT',
  add column if not exists message_text text,
  add column if not exists media_url text,
  add column if not exists media_mime text,
  add column if not exists media_name text,
  add column if not exists chat_session_id text,
  add column if not exists chat_instance_id text,
  add column if not exists delivery_status text;

do $$ begin
  alter table public.interacoes add constraint interacoes_direction_check
    check (direction is null or direction in ('RECEIVED','SENT'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.interacoes add constraint interacoes_message_kind_check
    check (message_kind in ('TEXT','AUDIO','IMAGE','VIDEO','DOCUMENT','OTHER'));
exception when duplicate_object then null; end $$;

create index if not exists interacoes_chatpro_phone_time_idx
  on public.interacoes (phone_e164, ocorrido_em desc)
  where source_system = 'CHATPRO';

with events as (
  select distinct on (coalesce(payload->'new'->>'id', event_key))
    coalesce(payload->'new'->>'id', event_key) as message_id,
    phone as event_phone,
    payload->'new' as msg
  from public.chatpro_eventos
  where erro is null
  order by coalesce(payload->'new'->>'id', event_key), recebido_em desc
)
update public.interacoes i set
  phone_e164 = coalesce(i.phone_e164,
    case when regexp_replace(coalesce(e.msg->>'phone', e.msg->>'number', e.msg->>'from', e.event_phone, ''), '\D', '', 'g') <> ''
      then '+' || regexp_replace(coalesce(e.msg->>'phone', e.msg->>'number', e.msg->>'from', e.event_phone, ''), '\D', '', 'g') end),
  direction = coalesce(i.direction, case when lower(coalesce(e.msg->>'from_me','false'))='true' then 'SENT' else 'RECEIVED' end),
  message_text = coalesce(i.message_text, nullif(coalesce(e.msg->>'message', e.msg->>'text', e.msg->>'caption'),'')),
  media_url = coalesce(i.media_url, nullif(e.msg->>'url','')),
  media_mime = coalesce(i.media_mime, nullif(e.msg->>'file_type','')),
  media_name = coalesce(i.media_name, nullif(coalesce(e.msg->>'title', e.msg->>'filename'),'') ),
  chat_session_id = coalesce(i.chat_session_id, nullif(e.msg->>'session_id','')),
  chat_instance_id = coalesce(i.chat_instance_id, nullif(e.msg->>'instance_id','')),
  delivery_status = coalesce(i.delivery_status, nullif(e.msg->>'status','')),
  message_kind = case
    when lower(coalesce(e.msg->>'type', e.msg->>'file_type','')) like '%audio%' then 'AUDIO'
    when lower(coalesce(e.msg->>'type', e.msg->>'file_type','')) like '%image%' then 'IMAGE'
    when lower(coalesce(e.msg->>'type', e.msg->>'file_type','')) like '%video%' then 'VIDEO'
    when nullif(e.msg->>'url','') is not null then 'DOCUMENT'
    else coalesce(i.message_kind,'TEXT') end
from events e
where i.source_system='CHATPRO'
  and coalesce(i.external_id,'')=e.message_id;

update public.interacoes
set
  direction = coalesce(direction, case when descricao like '%Enviada:%' then 'SENT' else 'RECEIVED' end),
  message_text = coalesce(message_text, regexp_replace(descricao, '^ChatPro \| (Recebida|Enviada):\s*', '')),
  message_kind = coalesce(message_kind,'TEXT')
where source_system='CHATPRO';