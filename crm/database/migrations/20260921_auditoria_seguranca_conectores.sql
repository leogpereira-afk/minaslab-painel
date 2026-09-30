-- Auditoria 2026-09-21: tornar explícito o bloqueio direto aos dados privados dos conectores.
drop policy if exists "deny_direct_client_access" on public.chatpro_eventos;
create policy "deny_direct_client_access" on public.chatpro_eventos
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "deny_direct_client_access" on public.google_calendar_integrations;
create policy "deny_direct_client_access" on public.google_calendar_integrations
  for all to anon, authenticated using (false) with check (false);

-- Índices nos relacionamentos operacionais; colunas puramente de auditoria permanecem sem índice.
create index if not exists idx_licitacoes_cliente_id on public.licitacoes(cliente_id);
create index if not exists idx_licitacoes_contrato_id on public.licitacoes(contrato_id);
create index if not exists idx_licitacoes_proposta_id on public.licitacoes(proposta_id);
create index if not exists idx_licitacoes_responsavel_id on public.licitacoes(responsavel_id);
create index if not exists idx_licitacao_prazos_licitacao_id on public.licitacao_prazos(licitacao_id);
create index if not exists idx_licitacao_prazos_tarefa_id on public.licitacao_prazos(tarefa_id);
create index if not exists idx_licitacao_prazos_responsavel_id on public.licitacao_prazos(responsavel_id);
create index if not exists idx_licitacao_documentos_licitacao_id on public.licitacao_documentos(licitacao_id);
create index if not exists idx_licitacao_concorrentes_licitacao_id on public.licitacao_concorrentes(licitacao_id);
create index if not exists idx_licitacao_responsaveis_usuario_id on public.licitacao_responsaveis(usuario_id);
