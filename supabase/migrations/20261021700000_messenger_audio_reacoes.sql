-- Messenger: duração do áudio (mensagem de voz) e reações (emoji) nas mensagens.
alter table public.ml_conversa_mensagens add column if not exists anexo_duracao integer;

create table if not exists public.ml_conversa_reacoes (
  mensagem_id uuid not null references public.ml_conversa_mensagens(id) on delete cascade,
  conversa_id uuid not null references public.ml_conversas(id) on delete cascade,
  usuario text not null,
  emoji text not null check (length(emoji) between 1 and 16),
  criado_em timestamptz not null default now(),
  primary key (mensagem_id, usuario, emoji)
);
create index if not exists ml_conversa_reacoes_conversa_idx on public.ml_conversa_reacoes (conversa_id, criado_em desc);
alter table public.ml_conversa_reacoes enable row level security;
revoke all on public.ml_conversa_reacoes from anon, authenticated;
