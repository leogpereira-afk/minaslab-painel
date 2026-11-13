-- Qualidade › Pessoal e competência (ISO/IEC 17025 · 6.2; PT 001 – Capacitação do pessoal).
-- Registros: RT (treinamento) e PAT (planejados), AVET (eficácia por participante), AUTZ (autorização)
-- e MC (matriz de competências: o que cada colaborador está liberado a executar).
-- Só a Edge Function ml-qualidade (service role) lê e grava: RLS ligado, sem políticas.
create table if not exists public.qualidade_treinamentos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                        -- "TRE 001/2026"
  status text not null default 'REALIZADO' check (status in ('PLANEJADO', 'REALIZADO', 'CANCELADO')),
  origem text not null default 'EVENTUAL' check (origem in ('PAT', 'EVENTUAL', 'INTEGRACAO', 'NC', 'DOCUMENTO', 'EXTERNO')),
  tipo text not null default 'INTERNO' check (tipo in ('INTERNO', 'EXTERNO')),
  tema text not null,
  objetivo text,
  data date,                                          -- data em que foi (ou será) realizado
  carga_horaria text,
  local text,
  instrutor text,                                     -- quem ministrou (nome livre: interno ou externo)
  responsavel text,                                   -- conta do painel responsável
  documentos text[] not null default '{}',            -- códigos da Lista Mestra treinados (PG, POP, IT…)
  participantes jsonb not null default '[]'::jsonb,   -- [{ id, nome, cargo }]
  nc_id uuid references public.qualidade_nc(id) on delete set null,
  eficacia_prevista date,                             -- 1 mês após o treinamento (PT 001)
  observacao text,
  historico jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(), criado_por text,
  atualizado_em timestamptz not null default now(), atualizado_por text
);
create table if not exists public.qualidade_treinamento_eficacia (
  id uuid primary key default gen_random_uuid(),
  treinamento_id uuid not null references public.qualidade_treinamentos(id) on delete cascade,
  pessoa_id text not null,
  nome text, cargo text,
  data_avaliacao date not null,
  avaliadores text[] not null default '{}',
  nota_conhecimento smallint check (nota_conhecimento between 1 and 5),
  nota_aplicacao smallint check (nota_aplicacao between 1 and 5),
  nota_resultados smallint check (nota_resultados between 1 and 5),
  nota_geral smallint check (nota_geral between 1 and 5),
  melhorias text,
  eficaz boolean not null,
  plano_causa text, plano_acao text, plano_responsavel text, plano_data date,
  plano_verificacao text, plano_verificado_em date,
  aprovado_por text, aprovado_em date,
  criado_em timestamptz not null default now(), criado_por text,
  atualizado_em timestamptz not null default now(), atualizado_por text,
  unique (treinamento_id, pessoa_id)
);
create table if not exists public.qualidade_autorizacoes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                        -- "AUTZ 001/2026"
  pessoa_id text not null,
  nome text, cargo text,
  atividades text not null,                           -- uma atividade por linha
  fundamentacao text,                                 -- treinamentos, CCOM, experiência que sustentam a autorização
  autorizado_por text,
  data_autorizacao date not null,
  revisar_em date,
  revogada_em date, revogada_motivo text,
  criado_em timestamptz not null default now(), criado_por text,
  atualizado_em timestamptz not null default now(), atualizado_por text
);
create table if not exists public.qualidade_matriz (
  id uuid primary key default gen_random_uuid(),
  pessoa_id text not null,
  documento text not null,                            -- código da Lista Mestra (ex.: POP-CQ-011)
  documento_titulo text,
  status text not null default 'LIBERADO' check (status in ('LIBERADO', 'EM_TREINAMENTO', 'NAO_APLICA')),
  liberado_em date,
  origem text,                                        -- ex.: "TRE 004/2026" quando veio do treinamento eficaz
  observacao text,
  atualizado_em timestamptz not null default now(), atualizado_por text,
  unique (pessoa_id, documento)
);
alter table public.qualidade_treinamentos enable row level security;
alter table public.qualidade_treinamento_eficacia enable row level security;
alter table public.qualidade_autorizacoes enable row level security;
alter table public.qualidade_matriz enable row level security;
create index if not exists qualidade_treinamentos_data on public.qualidade_treinamentos (data desc);
