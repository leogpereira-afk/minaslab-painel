-- ChatPro: ligação de usuários pelo nome ("Setor - Nome"; o ChatPro reaproveita
-- e-mails entre pessoas) e rotina que confere o estado das sessões na API.

create or replace function public.chatpro_ligar_usuarios() returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  update public.chatpro_usuarios u set perfil_id = x.perfil
  from (
    select cu.id,
      coalesce(
        (select min(p.id::text)::uuid from public.profiles p
          where coalesce(p.ativo, true)
            and lower(extensions.unaccent(split_part(btrim(p.nome), ' ', 1))) =
                lower(extensions.unaccent(split_part(btrim(case when cu.nome like '% - %' then substr(cu.nome, strpos(cu.nome, ' - ') + 3) else cu.nome end), ' ', 1)))
          having count(*) = 1),
        (select p.id from public.profiles p join auth.users au on au.id = p.id
          where coalesce(p.ativo, true) and lower(au.email) = lower(cu.email) limit 1)
      ) perfil
    from public.chatpro_usuarios cu where not cu.perfil_manual
  ) x
  where u.id = x.id and u.perfil_id is distinct from x.perfil;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.chatpro_ligar_usuarios() from public, anon, authenticated;

-- A função chatpro-chat aplica o estado vindo da API.
grant execute on function public.chatpro_registrar_sessao(jsonb, timestamptz) to service_role;

-- A cada 30 min confere as sessões abertas; uma vez por dia reaplica tudo.
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('chatpro-sessoes-30min', 'chatpro-sincronizar-diario');
end $$;
select cron.schedule('chatpro-sessoes-30min', '7,37 * * * *', $c$
  select net.http_post(url := 'https://reoghclxripktzpdwhiy.supabase.co/functions/v1/chatpro-chat',
    headers := jsonb_build_object('content-type','application/json','x-rotina-token',(select decrypted_secret from vault.decrypted_secrets where name='ml_chatpro_chat_token_rotina')),
    body := '{"acao":"sessoes"}'::jsonb, timeout_milliseconds := 150000);
$c$);
select cron.schedule('chatpro-sincronizar-diario', '20 7 * * *', $c$
  select net.http_post(url := 'https://reoghclxripktzpdwhiy.supabase.co/functions/v1/chatpro-chat',
    headers := jsonb_build_object('content-type','application/json','x-rotina-token',(select decrypted_secret from vault.decrypted_secrets where name='ml_chatpro_chat_token_rotina')),
    body := '{"acao":"sincronizar"}'::jsonb, timeout_milliseconds := 150000);
$c$);
