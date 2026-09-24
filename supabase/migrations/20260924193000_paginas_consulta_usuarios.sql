-- Permissões adicionais de leitura por usuário. A tabela mantém RLS habilitada.
alter table public.ml_contas
  add column if not exists paginas_consulta jsonb not null default '[]'::jsonb;
alter table public.ml_contas
  add constraint ml_contas_paginas_consulta_array
  check (jsonb_typeof(paginas_consulta) = 'array');
