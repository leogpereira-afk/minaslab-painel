-- Anexos das tarefas. O arquivo fica no bucket PRIVADO ml-arquivos (pasta tarefas/<id da tarefa>/); aqui só o cadastro.
-- Quem lê e grava é a função ml-tarefas (service role): quem vê a tarefa baixa por link assinado de curta duração.
create table if not exists public.ml_tarefa_anexos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.ml_tarefas(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  tipo text not null default 'application/octet-stream',
  tamanho integer not null check (tamanho > 0),
  caminho text not null unique,
  autor text not null,
  apagado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists ml_tarefa_anexos_tarefa_idx on public.ml_tarefa_anexos (tarefa_id, criado_em) where not apagado;
alter table public.ml_tarefa_anexos enable row level security;
revoke all on public.ml_tarefa_anexos from anon, authenticated;
