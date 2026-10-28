-- Token interno (gerado aqui, guardado no cofre) para o cron chamar a função chatpro-chat.
do $$ begin
  if not exists (select 1 from vault.secrets where name='ml_chatpro_chat_token_rotina') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'ml_chatpro_chat_token_rotina', 'Chamada interna (cron/SQL) da função chatpro-chat');
  end if;
end $$;

create or replace function public.ml_chatpro_conferir_rotina(p_token text) returns boolean
language sql security definer set search_path = pg_catalog, public as $$
  select coalesce(p_token,'') <> '' and exists(select 1 from vault.decrypted_secrets where name='ml_chatpro_chat_token_rotina' and decrypted_secret = p_token);
$$;
revoke all on function public.ml_chatpro_conferir_rotina(text) from public, anon, authenticated;
grant execute on function public.ml_chatpro_conferir_rotina(text) to service_role;
