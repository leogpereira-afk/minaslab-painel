-- Tarefas do painel (estilo Bitrix24): proprietário, responsável, participantes, observadores,
-- lista de verificação, bate-papo da tarefa e notificações.
-- Prefixo ml_ porque o CRM já tem sua própria tabela "tarefas" (não mexer nela).
-- Quem acessa é só a edge function ml-tarefas (service role): RLS ligado e nenhuma política.
-- As pessoas são os usuários do painel (ml_contas.usuario).

create table if not exists public.ml_tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) > 0),
  descricao text not null default '',
  proprietario text not null,
  responsavel text not null,
  prazo timestamptz,
  urgente boolean not null default false,
  status text not null default 'nova' check (status in ('nova', 'em_andamento', 'aguardando', 'concluida')),
  iniciada_em timestamptz,
  concluida_em timestamptz,
  concluida_por text,
  tarefa_pai_id uuid references public.ml_tarefas(id) on delete set null,
  marcadores text[] not null default '{}',
  apagada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists ml_tarefas_responsavel_idx on public.ml_tarefas (responsavel) where not apagada;
create index if not exists ml_tarefas_proprietario_idx on public.ml_tarefas (proprietario) where not apagada;
create index if not exists ml_tarefas_prazo_idx on public.ml_tarefas (prazo) where not apagada;
create index if not exists ml_tarefas_pai_idx on public.ml_tarefas (tarefa_pai_id);

create table if not exists public.ml_tarefa_pessoas (
  tarefa_id uuid not null references public.ml_tarefas(id) on delete cascade,
  usuario text not null,
  papel text not null check (papel in ('participante', 'observador')),
  criado_em timestamptz not null default now(),
  primary key (tarefa_id, usuario)
);
create index if not exists tarefa_pessoas_usuario_idx on public.ml_tarefa_pessoas (usuario);

create table if not exists public.ml_tarefa_checklist (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.ml_tarefas(id) on delete cascade,
  grupo text not null default 'Lista de verificação',
  texto text not null check (length(btrim(texto)) > 0),
  feito boolean not null default false,
  feito_por text,
  feito_em timestamptz,
  ordem integer not null default 0
);
create index if not exists tarefa_checklist_tarefa_idx on public.ml_tarefa_checklist (tarefa_id, ordem);

-- O bate-papo da tarefa: mensagens das pessoas e avisos do sistema ("alterou o prazo...").
create table if not exists public.ml_tarefa_mensagens (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.ml_tarefas(id) on delete cascade,
  autor text,
  tipo text not null default 'mensagem' check (tipo in ('mensagem', 'sistema')),
  texto text not null,
  criado_em timestamptz not null default now()
);
create index if not exists tarefa_mensagens_tarefa_idx on public.ml_tarefa_mensagens (tarefa_id, criado_em);

-- Última vez que cada pessoa abriu a tarefa: dá o "não lidas" e o "visualizado por".
create table if not exists public.ml_tarefa_leituras (
  tarefa_id uuid not null references public.ml_tarefas(id) on delete cascade,
  usuario text not null,
  visto_em timestamptz not null default now(),
  primary key (tarefa_id, usuario)
);

-- Sino de notificações, compartilhado por Tarefas e, adiante, Calendário e Messenger.
create table if not exists public.ml_notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario text not null,
  tipo text not null,
  titulo text not null,
  corpo text not null default '',
  link text not null default '',
  ref_tipo text,
  ref_id uuid,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists notificacoes_usuario_idx on public.ml_notificacoes (usuario, lida, criado_em desc);

alter table public.ml_tarefas enable row level security;
alter table public.ml_tarefa_pessoas enable row level security;
alter table public.ml_tarefa_checklist enable row level security;
alter table public.ml_tarefa_mensagens enable row level security;
alter table public.ml_tarefa_leituras enable row level security;
alter table public.ml_notificacoes enable row level security;
revoke all on public.ml_tarefas, public.ml_tarefa_pessoas, public.ml_tarefa_checklist, public.ml_tarefa_mensagens, public.ml_tarefa_leituras, public.ml_notificacoes from anon, authenticated;
