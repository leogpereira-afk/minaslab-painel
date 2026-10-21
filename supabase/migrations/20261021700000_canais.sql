-- Canais MinasLab: notícias, comunicados e eventos da empresa, com curtidas e
-- comentários dos colaboradores. Só a Edge Function ml-canais (chave de
-- serviço) lê e grava; o navegador nunca fala com estas tabelas.
-- Aniversariantes e férias NÃO ficam aqui: são calculados na hora a partir do
-- RH (rh_pessoas / rh_ferias), devolvendo só nome, dia/mês e período.
-- Configuração (quem publica, quem não quer aparecer nos aniversários) fica em
-- ml_meta, chave "canais".

create table if not exists public.ml_canais_posts (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'noticia' check (tipo in ('noticia', 'comunicado', 'evento')),
  titulo text not null,
  texto text not null default '',
  imagem text not null default '',
  fixado boolean not null default false,
  autor text not null,
  autor_nome text not null default '',
  criado_em timestamptz not null default now(),
  editado_em timestamptz,
  apagado boolean not null default false
);
create index if not exists canais_posts_criado_idx on public.ml_canais_posts (apagado, fixado desc, criado_em desc);

-- post_ref: id do post (uuid) ou de um parabéns automático (aniv-AAAA-<pessoa>).
create table if not exists public.ml_canais_comentarios (
  id uuid primary key default gen_random_uuid(),
  post_ref text not null,
  usuario text not null,
  nome text not null default '',
  texto text not null,
  criado_em timestamptz not null default now(),
  apagado boolean not null default false
);
create index if not exists canais_coment_post_idx on public.ml_canais_comentarios (post_ref, criado_em);

create table if not exists public.ml_canais_curtidas (
  post_ref text not null,
  usuario text not null,
  nome text not null default '',
  criado_em timestamptz not null default now(),
  primary key (post_ref, usuario)
);

alter table public.ml_canais_posts enable row level security;
alter table public.ml_canais_comentarios enable row level security;
alter table public.ml_canais_curtidas enable row level security;
revoke all on public.ml_canais_posts, public.ml_canais_comentarios, public.ml_canais_curtidas from anon, authenticated;
