-- Assistente IA, etapa 3: lançamentos PROPOSTOS pela IA e confirmados pela pessoa.
-- A IA só cria a proposta; quem grava de verdade é a função da tela (ml-sync / ml-tarefas),
-- chamada com o crachá da própria pessoa quando ela clica em Confirmar.
create table if not exists public.ml_assistente_propostas (
  id uuid primary key default gen_random_uuid(),
  usuario text not null,
  conversa_id uuid not null references public.ml_assistente_conversas (id) on delete cascade,
  mensagem_id bigint references public.ml_assistente_mensagens (id) on delete cascade,
  tipo text not null check (tipo in ('compromisso', 'tarefa')),
  dados jsonb not null,
  status text not null default 'pendente' check (status in ('pendente', 'confirmada', 'descartada', 'falhou')),
  resultado jsonb,
  criada_em timestamptz not null default now(),
  decidida_em timestamptz
);
create index if not exists ml_assistente_propostas_mensagem_idx on public.ml_assistente_propostas (mensagem_id);
create index if not exists ml_assistente_propostas_conversa_idx on public.ml_assistente_propostas (conversa_id);
create index if not exists ml_assistente_propostas_usuario_idx on public.ml_assistente_propostas (usuario, criada_em desc);

alter table public.ml_assistente_propostas enable row level security;
revoke all on public.ml_assistente_propostas from anon, authenticated;
