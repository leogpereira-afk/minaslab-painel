-- Qualidade › Documentos: tipo PT (procedimento técnico) para a Lista Mestra do SGQ.
-- Aplicada em 06/11/2026; em seguida, 485 documentos da Lista Mestra (atualização 28/09/2026) foram importados.
alter table public.qualidade_documentos drop constraint if exists qualidade_documentos_tipo_check;
alter table public.qualidade_documentos add constraint qualidade_documentos_tipo_check
  check (tipo in ('PG','PT','POP','IT','FOR','MQ','OUTRO'));
