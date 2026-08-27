-- ============================================================================
-- Schema do Painel MinasLab no Supabase — projeto "Projetos Léo"
-- (ref reoghclxripktzpdwhiy), COMPARTILHADO com bsq_, domo_, dmd_ e pdb_.
-- Todo objeto daqui leva o prefixo ml_ — criar sem prefixo pisaria em
-- produção alheia sem avisar ("create table if not exists" NÃO avisa).
--
-- RLS ligado e SEM policy: só a Edge Function (service_role) acessa. O
-- navegador nunca fala com o Postgres direto.
-- ============================================================================

-- Cofre genérico: coleção/id/registro (compromissos, coletas, carros,
-- licitacoes, mkt, compras, manutencoes, equipamentos, rh_pessoas, rh_ferias,
-- rh_vencimentos...).
create table if not exists public.ml_registros (
  colecao       text not null,
  id            text not null,
  registro      jsonb not null,
  atualizado_em timestamptz not null default now(),
  apagado       boolean not null default false,   -- lápide: apagar é marcar, nunca deletar
  primary key (colecao, id)
);
create index if not exists ml_registros_colecao_idx
  on public.ml_registros (colecao);
-- Pulls incrementais varrem por data; sem este índice é varredura completa.
create index if not exists ml_registros_atualizado_idx
  on public.ml_registros (colecao, atualizado_em);
alter table public.ml_registros enable row level security;

-- Config global do app (UMA linha — check(id) impede a segunda).
create table if not exists public.ml_config_global (
  id            boolean primary key default true check (id),
  config        jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.ml_config_global enable row level security;

-- Chave/valor: contador "rev" do pull econômico e o freio do login.
create table if not exists public.ml_meta (
  chave         text primary key,
  valor         jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.ml_meta enable row level security;

-- As contas de quem entra no painel. Tabela PRÓPRIA, fora de ml_registros, de
-- propósito: o list genérico da porta de dados nunca alcança hash de senha.
create table if not exists public.ml_contas (
  usuario    text primary key,
  nome       text not null,
  papel      text not null check (papel in ('direcao', 'equipe', 'leitura')),
  senha      jsonb not null,           -- { hash, salt, iter } PBKDF2-SHA256
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
alter table public.ml_contas enable row level security;

-- Arquivos/anexos (reservado; bucket PRIVADO: só a service_role lê e grava).
insert into storage.buckets (id, name, public)
values ('ml-arquivos', 'ml-arquivos', false)
on conflict (id) do nothing;

-- O FREIO do login, ATÔMICO: consome a ficha na MESMA operação que confere a
-- janela (ler-depois-gravar deixou 16 senhas passarem no mesmo segundo na
-- Impresilk). Devolve quantas tentativas houve na janela de 15 minutos;
-- a Edge Function barra acima de 8.
create or replace function public.ml_freio(p_chave text, p_janela_seg int default 900)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  insert into public.ml_meta (chave, valor, atualizado_em)
  values (p_chave, jsonb_build_object('n', 1, 'desde', extract(epoch from now())), now())
  on conflict (chave) do update set
    valor = case
      when (public.ml_meta.valor->>'desde')::numeric < extract(epoch from now()) - p_janela_seg
        then jsonb_build_object('n', 1, 'desde', extract(epoch from now()))
      else jsonb_build_object(
        'n', coalesce((public.ml_meta.valor->>'n')::int, 0) + 1,
        'desde', (public.ml_meta.valor->>'desde')::numeric
      )
    end,
    atualizado_em = now()
  returning (valor->>'n')::int into n;
  return n;
end
$$;
revoke all on function public.ml_freio(text, int) from anon, authenticated;
