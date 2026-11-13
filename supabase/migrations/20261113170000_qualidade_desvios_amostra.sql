-- Qualidade › Manuseio de itens de ensaio (ISO/IEC 17025 · 7.4; PT 009 e PT 010).
-- Desvio no recebimento (7.4.3): item fora das condições especificadas → consulta ao cliente, decisão
-- registrada e ressalva no relatório quando o ensaio segue assim mesmo. Formulário FM-LAB-117.
create table if not exists public.qualidade_desvios_amostra (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                        -- "DES 001/2026"
  data date not null,
  os_referencia text,                                 -- OS / amostra
  cliente_nome text,
  matriz text,
  tipos text[] not null default '{}',                 -- TEMPERATURA, INTEGRIDADE, VOLUME, PRAZO, IDENTIFICACAO, PRESERVACAO, FRASCO, OUTRO
  descricao text not null,
  condicao_encontrada text,                           -- ex.: "12,4 °C na chegada"
  condicao_especificada text,                         -- ex.: "≤ 10 °C"
  cliente_consultado_em date,
  consulta_meio text,
  consulta_com text,                                  -- quem do cliente foi consultado
  decisao text check (decisao in ('PROSSEGUIR_COM_RESSALVA', 'NOVA_AMOSTRA', 'CANCELAR', 'AGUARDANDO')),
  ressalva text,                                      -- texto que vai no relatório de ensaio (7.8.2.1 / 7.4.3)
  responsavel text,
  observacao text,
  encerrado boolean not null default false,
  historico jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(), criado_por text,
  atualizado_em timestamptz not null default now(), atualizado_por text
);
alter table public.qualidade_desvios_amostra enable row level security;
create index if not exists qualidade_desvios_amostra_data on public.qualidade_desvios_amostra (data desc);
