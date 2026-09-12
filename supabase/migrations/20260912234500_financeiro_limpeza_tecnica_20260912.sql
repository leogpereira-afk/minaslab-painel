-- Limpeza técnica do Financeiro após homologação final.
-- Remove apenas estrutura temporária comprovadamente vazia e sem dependências produtivas.

DROP TABLE IF EXISTS public._servicos_import_temp_chunks;
