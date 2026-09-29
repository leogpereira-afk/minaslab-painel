-- Índices de cobertura para FKs estruturais usadas no catálogo analítico.
-- Não inclui FKs de auditoria created_by/updated_by/deleted_by, evitando indexação indiscriminada.
create index if not exists catalogo_grupo_parametros_grupo_id_idx
  on public.catalogo_grupo_parametros (grupo_id);

create index if not exists catalogo_grupo_parametros_parametro_id_idx
  on public.catalogo_grupo_parametros (parametro_id);

create index if not exists parametros_laboratorio_parceiro_padrao_id_idx
  on public.parametros (laboratorio_parceiro_padrao_id)
  where laboratorio_parceiro_padrao_id is not null;
