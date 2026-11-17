-- E-mail no painel (Léo, 16/11/2026): cada pessoa conecta as PRÓPRIAS caixas
-- (Hostinger e Gmail) e lê/envia pelo painel. Os e-mails continuam no servidor
-- de e-mail (IMAP); aqui fica só a conta conectada.
--
-- Segurança:
-- - a senha (da caixa Hostinger ou a "senha de app" do Gmail) fica CIFRADA com
--   AES-256-GCM pela Edge Function ml-email; a chave mora no Vault (ml_email_chave)
--   e só a função (service_role) a lê;
-- - a tabela não tem política de RLS: ninguém lê pelo navegador. Só a ml-email,
--   que confere o crachá e devolve apenas as contas do próprio usuário.

create table if not exists public.ml_email_contas (
  id uuid primary key default gen_random_uuid(),
  usuario text not null,                 -- dono (ml_contas.usuario)
  email text not null,
  provedor text not null check (provedor in ('hostinger', 'gmail')),
  nome_exibicao text,                    -- nome no "De:" (padrão: nome do login)
  senha_cifra text not null,
  assinatura_ativa boolean not null default true,
  cargo_assinatura text,                 -- só se a pessoa quiser trocar o cargo do RH
  ordem int not null default 0,
  ultimo_erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (usuario, email)
);
create index if not exists ml_email_contas_usuario_idx on public.ml_email_contas (usuario);

alter table public.ml_email_contas enable row level security;
revoke all on public.ml_email_contas from anon, authenticated;

-- Chave da cifra no Vault (criada uma vez).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ml_email_chave') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'ml_email_chave', 'Chave AES-256 das senhas das caixas de e-mail (ml-email)');
  end if;
end $$;

create or replace function public.ml_email_chave()
returns text
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') <> 'service_role' then
    raise exception 'sem permissão';
  end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'ml_email_chave');
end $function$;

revoke all on function public.ml_email_chave() from public, anon, authenticated;
grant execute on function public.ml_email_chave() to service_role;
