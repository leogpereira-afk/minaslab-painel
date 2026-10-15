-- Importações grandes (ex.: Histórico Analítico com ~3.600 linhas) passavam de 8 s,
-- o limite padrão do papel authenticated. Só esta rotina ganha até 60 s.
alter function public.crm_process_importacao(uuid) set statement_timeout = '60s';

-- Busca de parâmetro por nome feita a cada linha do Histórico Analítico.
create index if not exists parametros_nome_lookup_idx
  on public.parametros (lower(coalesce(nome_canonico, rotulo_original, '')))
  where deleted_at is null;

notify pgrst, 'reload config';
