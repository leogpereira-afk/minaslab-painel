-- Regra aprovada de importação/cadastro: o mesmo CPF/CNPJ normalizado representa um único cliente ativo.
-- Registros históricos soft-deleted permanecem permitidos.
create unique index if not exists clientes_cpf_cnpj_normalizado_active_unique_idx
  on public.clientes (cpf_cnpj_normalizado)
  where deleted_at is null
    and nullif(cpf_cnpj_normalizado,'') is not null;
