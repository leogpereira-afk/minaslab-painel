-- Assistente de IA do painel (Claude). Só a função ml-assistente (service role) lê e grava:
-- RLS ligada e nenhuma política, e anon/authenticated sem permissão nenhuma.

create table if not exists public.ml_assistente_conversas (
  id uuid primary key default gen_random_uuid(),
  usuario text not null,
  titulo text not null default 'Nova conversa',
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index if not exists ml_assistente_conversas_usuario_idx
  on public.ml_assistente_conversas (usuario, atualizada_em desc);

create table if not exists public.ml_assistente_mensagens (
  id bigint generated always as identity primary key,
  conversa_id uuid not null references public.ml_assistente_conversas (id) on delete cascade,
  papel text not null check (papel in ('user', 'assistant')),
  texto text not null,
  fontes jsonb not null default '[]'::jsonb,
  modelo text,
  criada_em timestamptz not null default now()
);
create index if not exists ml_assistente_mensagens_conversa_idx
  on public.ml_assistente_mensagens (conversa_id, id);

-- Uso por pessoa e por dia: limite diário e teto de gasto do mês (estimado pelos tokens).
create table if not exists public.ml_assistente_uso (
  usuario text not null,
  dia date not null,
  perguntas integer not null default 0,
  buscas integer not null default 0,
  tokens_entrada bigint not null default 0,
  tokens_saida bigint not null default 0,
  custo_usd numeric(12, 6) not null default 0,
  primary key (usuario, dia)
);
create index if not exists ml_assistente_uso_dia_idx on public.ml_assistente_uso (dia);

alter table public.ml_assistente_conversas enable row level security;
alter table public.ml_assistente_mensagens enable row level security;
alter table public.ml_assistente_uso enable row level security;

revoke all on public.ml_assistente_conversas from anon, authenticated;
revoke all on public.ml_assistente_mensagens from anon, authenticated;
revoke all on public.ml_assistente_uso from anon, authenticated;

-- Soma atômica do uso (evita perder contagem com duas perguntas ao mesmo tempo).
create or replace function public.ml_assistente_registrar_uso(
  p_usuario text, p_perguntas integer, p_buscas integer,
  p_tokens_entrada bigint, p_tokens_saida bigint, p_custo numeric
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ml_assistente_uso as u (usuario, dia, perguntas, buscas, tokens_entrada, tokens_saida, custo_usd)
  values (p_usuario, (now() at time zone 'America/Sao_Paulo')::date, p_perguntas, p_buscas, p_tokens_entrada, p_tokens_saida, p_custo)
  on conflict (usuario, dia) do update set
    perguntas = u.perguntas + excluded.perguntas,
    buscas = u.buscas + excluded.buscas,
    tokens_entrada = u.tokens_entrada + excluded.tokens_entrada,
    tokens_saida = u.tokens_saida + excluded.tokens_saida,
    custo_usd = u.custo_usd + excluded.custo_usd;
$$;
revoke all on function public.ml_assistente_registrar_uso(text, integer, integer, bigint, bigint, numeric) from public, anon, authenticated;
