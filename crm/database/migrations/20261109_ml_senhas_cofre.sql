-- Senhas e acessos (painel › Administração): cofre de logins dos sites e sistemas da MinasLab.
-- Senha cifrada (AES-256-GCM) pela função ml-senhas com a chave do Vault "ml_senhas_chave" (gerada no banco,
-- lida só pelo service_role). RLS ligado sem políticas: tudo passa pela função, que confere quem vê.
-- (Aplicada em 09/11/2026 — ver o conteúdo completo na migração ml_senhas_cofre do Supabase.)
create table if not exists public.ml_senhas (
  id uuid primary key default gen_random_uuid(), nome text not null, url text, usuario_login text,
  categoria text not null default 'OUTROS', observacao text, dois_fatores text,
  setores text[] not null default '{}', pessoas text[] not null default '{}',
  senha_cifra text, senha_trocada_em timestamptz, origem text, apagado boolean not null default false,
  criado_em timestamptz not null default now(), criado_por text, atualizado_em timestamptz not null default now(), atualizado_por text);
create table if not exists public.ml_senhas_setores (nome text primary key, membros text[] not null default '{}', atualizado_em timestamptz not null default now(), atualizado_por text);
create table if not exists public.ml_senhas_historico (
  id uuid primary key default gen_random_uuid(), senha_id uuid not null references public.ml_senhas(id),
  acao text not null, usuario text not null, em timestamptz not null default now(), detalhe text, senha_anterior_cifra text);
create index if not exists ml_senhas_historico_senha on public.ml_senhas_historico (senha_id, em desc);
alter table public.ml_senhas enable row level security;
alter table public.ml_senhas_setores enable row level security;
alter table public.ml_senhas_historico enable row level security;
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'ml_senhas_chave') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'ml_senhas_chave', 'Chave AES-256-GCM do cofre Senhas e acessos (ml-senhas)');
  end if;
end $$;
create or replace function public.ml_senhas_chave() returns text
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') <> 'service_role' then raise exception 'sem permissão'; end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'ml_senhas_chave');
end $$;
