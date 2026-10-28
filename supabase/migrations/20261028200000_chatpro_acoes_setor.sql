-- ChatPro, parte 2: setor do atendimento, envio de arquivos e ações pelo CRM.
--
-- Setor = departamento da conversa no ChatPro; sem departamento, o setor de
-- quem atende ("Financeiro - Ana Cláudia" -> Financeiro). Atendimentos que não
-- são do Comercial aparecem em Atendimentos, mas ficam fora das contagens
-- comerciais (Novos, Em andamento, Empresa a definir).

create table if not exists public.chatpro_departamentos (
  id text primary key,
  nome text,
  atualizado_em timestamptz not null default now()
);
alter table public.chatpro_departamentos enable row level security;
drop policy if exists chatpro_departamentos_select on public.chatpro_departamentos;
create policy chatpro_departamentos_select on public.chatpro_departamentos for select to authenticated using ((select public.has_permission('crm.read')));
revoke all on public.chatpro_departamentos from anon;
grant select on public.chatpro_departamentos to authenticated;

alter table public.leads
  add column if not exists chatpro_setor text,
  add column if not exists chatpro_contato_enviado text;

-- Setor da sessão: departamento; senão o prefixo do nome de quem atende.
create or replace function public.chatpro_setor_sessao(p_departamento text, p_usuario text) returns text
language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(
    (select nullif(btrim(d.nome), '') from public.chatpro_departamentos d where d.id = p_departamento),
    (select nullif(btrim(split_part(u.nome, ' - ', 1)), '') from public.chatpro_usuarios u where u.id = p_usuario and u.nome like '% - %')
  );
$$;

-- Reaplica também o setor (mesma regra do resto do resumo da sessão).
create or replace function public.chatpro_sincronizar_lead(p_lead uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare s public.chatpro_sessoes%rowtype; v_perfil uuid;
begin
  if p_lead is null then return; end if;
  select * into s from public.chatpro_sessoes where lead_id = p_lead
   order by coalesce(aberta_em, ultima_atualizacao) desc nulls last, ultima_atualizacao desc nulls last limit 1;
  if found then
    select perfil_id into v_perfil from public.chatpro_usuarios where id = s.responsavel_chatpro;
    update public.leads l set
      chatpro_sessao_id = s.id,
      chatpro_situacao = case when s.aberta is false then 'FINALIZADO' else 'ABERTO' end,
      chatpro_aberto_em = s.aberta_em,
      chatpro_finalizado_em = case when s.aberta is false then coalesce(s.finalizada_em, s.ultima_atualizacao) end,
      chatpro_finalizado_por = case when s.aberta is false then
        (select coalesce(u.nome, u.email) from public.chatpro_usuarios u where u.id = coalesce(s.finalizado_por_chatpro, s.responsavel_chatpro)) end,
      chatpro_responsavel = (select coalesce(u.nome, u.email) from public.chatpro_usuarios u where u.id = s.responsavel_chatpro),
      chatpro_protocolo = s.protocolo,
      chatpro_motivo = case when s.motivo_id is null then null else coalesce((select m.nome from public.chatpro_motivos m where m.id = s.motivo_id), 'Motivo não identificado') end,
      chatpro_nps = coalesce(s.nps, case when s.nps_nota > 0 then s.nps_nota::text end),
      chatpro_setor = coalesce(public.chatpro_setor_sessao(s.departamento_id, s.responsavel_chatpro), l.chatpro_setor),
      responsavel_id = coalesce(v_perfil, l.responsavel_id)
    where l.id = p_lead;
  end if;
  perform public.chatpro_completar_cadastro_lead(p_lead);
end $$;
revoke all on function public.chatpro_sincronizar_lead(uuid) from public, anon, authenticated;
revoke all on function public.chatpro_setor_sessao(text, text) from public, anon, authenticated;

-- A função chatpro-chat confere a permissão de quem pediu a ação.
create or replace function public.crm_usuario_tem_permissao(p_usuario uuid, p_permissao text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.profile_roles pr
    join public.roles r on r.id = pr.role_id and r.ativo
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    join public.profiles pf on pf.id = pr.profile_id and pf.ativo
    where pr.profile_id = p_usuario and lower(p.codigo) = lower(p_permissao)
  );
$$;
revoke all on function public.crm_usuario_tem_permissao(uuid, text) from public, anon, authenticated;
grant execute on function public.crm_usuario_tem_permissao(uuid, text) to service_role;

-- Contatos a enviar ao ChatPro: atendimentos ligados a um cliente cujo nome
-- (Nome - Empresa) ainda não foi enviado ou mudou.
create or replace function public.chatpro_contatos_pendentes(p_limite integer default 50)
returns table(lead_id uuid, chatpro_lead_id text, nome text, empresa text, email text)
language sql stable security definer set search_path = pg_catalog, public as $$
  with base as (
    select l.id, l.nome, l.empresa_contato, l.email_contato, l.chatpro_contato_enviado,
      (select s.chatpro_lead_id from public.chatpro_sessoes s where s.lead_id = l.id and s.chatpro_lead_id is not null
        order by coalesce(s.aberta_em, s.ultima_atualizacao) desc nulls last limit 1) cl
    from public.leads l
    where l.deleted_at is null and l.cliente_convertido_id is not null and l.chatpro_situacao is not null
  )
  select b.id, b.cl, b.nome, b.empresa_contato, b.email_contato from base b
  where b.cl is not null and nullif(btrim(coalesce(b.nome, b.empresa_contato, '')), '') is not null
    and b.chatpro_contato_enviado is distinct from concat_ws('|', b.nome, b.empresa_contato, b.email_contato)
  order by b.id limit greatest(1, least(p_limite, 500));
$$;
revoke all on function public.chatpro_contatos_pendentes(integer) from public, anon, authenticated;
grant execute on function public.chatpro_contatos_pendentes(integer) to service_role;

-- Arquivos enviados pelo CRM ao WhatsApp (proposta, laudo...). Privado: a
-- função gera um link temporário só para o ChatPro buscar o arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chatpro-envios', 'chatpro-envios', false, 16777216,
  array['application/pdf','image/jpeg','image/png','image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.ms-excel'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists chatpro_envios_insert on storage.objects;
create policy chatpro_envios_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'chatpro-envios' and (select public.has_permission('crm.write')));

-- Rotina: envia nome/empresa ao ChatPro de hora em hora.
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'chatpro-contatos-hora';
end $$;
select cron.schedule('chatpro-contatos-hora', '52 * * * *', $c$
  select net.http_post(url := 'https://reoghclxripktzpdwhiy.supabase.co/functions/v1/chatpro-chat',
    headers := jsonb_build_object('content-type','application/json','x-rotina-token',(select decrypted_secret from vault.decrypted_secrets where name='ml_chatpro_chat_token_rotina')),
    body := '{"acao":"contatos"}'::jsonb, timeout_milliseconds := 150000);
$c$);

-- A função chatpro-chat reaplica o resumo ao ligar uma conversa nova.
grant execute on function public.chatpro_sincronizar_lead(uuid) to service_role;
