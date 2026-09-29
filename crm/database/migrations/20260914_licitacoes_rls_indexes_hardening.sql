-- Endurecimento das políticas do módulo de Licitações e índices das novas FKs.
create index if not exists licitacao_oportunidades_licitacao_id_idx
  on public.licitacao_oportunidades(licitacao_id);
create index if not exists licitacao_oportunidades_revisada_por_idx
  on public.licitacao_oportunidades(revisada_por);

-- A tabela de controle é exclusiva do service_role usado pela Edge Function.
create policy pncp_sync_controle_no_client_access
  on public.pncp_sync_controle
  for all
  to authenticated
  using (false)
  with check (false);

do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'licitacoes',
    'licitacao_responsaveis',
    'licitacao_prazos',
    'licitacao_concorrentes',
    'licitacao_documentos',
    'licitacao_oportunidades'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', tabela || '_write', tabela);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_permission(''crm.write''))',
      tabela || '_insert', tabela
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_permission(''crm.write'')) with check (public.has_permission(''crm.write''))',
      tabela || '_update', tabela
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_permission(''crm.write''))',
      tabela || '_delete', tabela
    );
  end loop;
end $$;
