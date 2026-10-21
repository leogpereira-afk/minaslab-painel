-- Messenger do painel: conversas individuais e grupos entre os usuários do painel (ml_contas.usuario).
-- Quem acessa é só a edge function ml-messenger (service role): RLS ligado e nenhuma política.
-- Privacidade: só os membros leem a conversa (nem a direção lê conversa dos outros).

create table if not exists public.ml_conversas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('direta', 'grupo')),
  nome text,
  chave_direta text unique,              -- "usuarioA|usuarioB" em ordem alfabética: uma conversa individual por par
  criador text not null,
  ultima_msg_em timestamptz,
  ultima_msg_texto text not null default '',
  ultima_msg_autor text,
  apagada boolean not null default false,
  criado_em timestamptz not null default now(),
  check ((tipo = 'direta' and chave_direta is not null and nome is null) or (tipo = 'grupo' and chave_direta is null and length(btrim(nome)) > 0))
);
create index if not exists ml_conversas_ultima_idx on public.ml_conversas (ultima_msg_em desc nulls last) where not apagada;

create table if not exists public.ml_conversa_membros (
  conversa_id uuid not null references public.ml_conversas(id) on delete cascade,
  usuario text not null,
  papel text not null default 'membro' check (papel in ('admin', 'membro')),
  entrou_em timestamptz not null default now(),
  lido_ate bigint not null default 0,       -- seq da última mensagem que a pessoa já viu
  silenciado boolean not null default false,
  saiu_em timestamptz,
  primary key (conversa_id, usuario)
);
create index if not exists ml_conversa_membros_usuario_idx on public.ml_conversa_membros (usuario) where saiu_em is null;

create table if not exists public.ml_conversa_mensagens (
  seq bigint generated always as identity,
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.ml_conversas(id) on delete cascade,
  autor text,
  tipo text not null default 'mensagem' check (tipo in ('mensagem', 'sistema')),
  texto text not null check (length(btrim(texto)) > 0),
  apagada boolean not null default false,
  criado_em timestamptz not null default now()
);
create unique index if not exists ml_conversa_mensagens_seq_idx on public.ml_conversa_mensagens (seq);
create index if not exists ml_conversa_mensagens_conversa_idx on public.ml_conversa_mensagens (conversa_id, seq);

alter table public.ml_conversas enable row level security;
alter table public.ml_conversa_membros enable row level security;
alter table public.ml_conversa_mensagens enable row level security;
revoke all on public.ml_conversas, public.ml_conversa_membros, public.ml_conversa_mensagens from anon, authenticated;
