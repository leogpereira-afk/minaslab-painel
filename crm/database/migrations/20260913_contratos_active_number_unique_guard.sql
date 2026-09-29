-- Preserva revisões/histórico encerrado, mas impede dois contratos ATIVOS
-- com o mesmo número externo ao mesmo tempo.
create unique index if not exists contratos_numero_ativo_unique_idx
  on public.contratos (numero_contrato)
  where deleted_at is null
    and upper(coalesce(status,''))='ATIVO'
    and nullif(numero_contrato,'') is not null;
