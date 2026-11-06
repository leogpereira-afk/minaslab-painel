-- Laboratório › Qualidade › Documentos externos (CDOE, PG 005 · ISO/IEC 17025 8.3): a planilha
-- "Controle de Documentos de Origem Externa" dentro do painel, com verificação de atualização trimestral.
-- resultado (verificação de atualização): VIGENTE (em dia) · ATUALIZAR (há versão mais nova)
--   · CANCELADA (cancelada/revogada) · CONFERIR (não confirmado na fonte) · VALIDADE (licença/certificado).
-- Acesso só pela Edge Function ml-qualidade: RLS ligado e sem políticas.
-- Aplicada em 06/11/2026 com os 129 documentos do CDOE rev.00 (seed 20261106_cdoe_documentos_externos.json).
-- Também desfaz o tipo EXT incluído em qualidade_documentos no mesmo dia (os externos saíram da lista mestra).
create table if not exists public.qualidade_documentos_externos (
  id uuid primary key default gen_random_uuid(),
  item int,
  documento text not null,
  controlado_por text,
  data_registro date,
  data_verificacao date,
  proxima_verificacao date,
  local_uso text,
  resultado text not null default 'VIGENTE' check (resultado in ('VIGENTE','ATUALIZAR','CANCELADA','CONFERIR','VALIDADE')),
  versao_vigente text,
  observacao text,
  fonte text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(), criado_por text,
  atualizado_em timestamptz not null default now(), atualizado_por text
);
alter table public.qualidade_documentos_externos enable row level security;

delete from public.qualidade_documentos where tipo = 'EXT';
alter table public.qualidade_documentos drop constraint if exists qualidade_documentos_tipo_check;
alter table public.qualidade_documentos add constraint qualidade_documentos_tipo_check
  check (tipo in ('PG','PT','POP','IT','FOR','MQ','OUTRO'));
