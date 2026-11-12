-- Melhoria: etapa "Verificar eficácia" e histórico das tratativas (Ana, 12/11/2026).
alter table public.satisfacao_respostas drop constraint if exists satisfacao_respostas_melhoria_status_check;
alter table public.satisfacao_respostas add constraint satisfacao_respostas_melhoria_status_check
  check (melhoria_status in ('AVALIAR', 'EM ANDAMENTO', 'VERIFICAR EFICACIA', 'IMPLEMENTADA', 'DESCARTADA', 'SEM SUGESTAO'));
alter table public.satisfacao_tratativas
  add column if not exists historico jsonb not null default '[]'::jsonb,
  add column if not exists eficacia_evidencia text,
  add column if not exists eficacia_data date;
