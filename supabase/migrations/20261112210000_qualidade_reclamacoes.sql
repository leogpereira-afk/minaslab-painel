-- Qualidade › Reclamações (ISO/IEC 17025 · 7.9; PG 013; formulário FM-LAB-113, antigo RRC).
-- Só a Edge Function ml-qualidade (service role) lê e grava: RLS ligado, sem políticas.
create table if not exists public.qualidade_reclamacoes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                       -- protocolo "RRC 001/2026", gerado pelo servidor
  tipo text not null default 'RECLAMACAO' check (tipo in ('RECLAMACAO', 'SUGESTAO')),
  etapa text not null default 'RECEBIDA' check (etapa in ('RECEBIDA', 'VALIDACAO', 'INVESTIGACAO', 'RESPOSTA', 'ENCERRADA')),
  recebida_em date not null default (now() at time zone 'America/Sao_Paulo')::date,
  canal text,                                        -- EMAIL, WHATSAPP, TELEFONE, SITE, PRESENCIAL, OUTRO
  cliente_id uuid,                                   -- cliente do CRM (opcional)
  cliente_nome text,
  cnpj_cpf text,
  reclamante text,
  contato text,
  email text,
  os_referencia text,                                -- OS / relatório de ensaio citado
  ocorrido_em date,
  descricao text not null,
  recebida_por text,                                 -- conta do painel
  classificacao text not null default 'MEDIA' check (classificacao in ('CRITICA', 'ALTA', 'MEDIA', 'BAIXA')),
  acao_imediata text,
  -- 7.9.3 b / 7.9.4: validação e confirmação de recebimento ao reclamante
  procedente boolean,
  validacao text,
  confirmada_em date,
  confirmada_meio text,
  prazo_confirmacao date,
  prazo_resposta date,
  responsavel text,
  -- investigação, ação e eficácia
  analise text,
  nc_id uuid references public.qualidade_nc(id) on delete set null,
  acao text,
  eficacia text,
  -- 7.9.6 / 7.9.7: decisão por quem não está envolvido e comunicação do encerramento
  envolvidos text[] not null default '{}',
  resposta text,
  respondida_em date,
  respondida_meio text,
  analisado_por text, analisado_em date,
  aprovado_por text, aprovado_em date,
  observacao text,
  encerramento text,                                 -- encerramento / análise de tendência
  encerrada_em timestamptz,
  encerrada_por text,
  historico jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  criado_por text,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
alter table public.qualidade_reclamacoes enable row level security;
create index if not exists qualidade_reclamacoes_recebida on public.qualidade_reclamacoes (recebida_em desc);
