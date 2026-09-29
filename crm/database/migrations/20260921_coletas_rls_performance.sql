-- Evita recalcular has_permission para cada linha durante o carregamento de Coletas.
-- Subconsultas escalares sem correlação viram InitPlans e são avaliadas uma vez por consulta.

alter policy coletas_select on public.coletas
  using ((select public.has_permission('crm.read')));

alter policy agendamentos_select on public.agendamentos
  using ((select public.has_permission('crm.read')));

alter policy clientes_select on public.clientes
  using ((select public.has_permission('crm.read')));

alter policy enderecos_select on public.enderecos
  using ((select public.has_permission('crm.read')));

alter policy propostas_select on public.propostas
  using ((select public.has_permission('crm.read')));

alter policy ordens_servico_select on public.ordens_servico
  using ((select public.has_permission('operational.read')));

alter policy profiles_select on public.profiles
  using (
    id = (select auth.uid())
    or (select public.has_permission('admin.manage'))
    or (select public.has_permission('crm.read'))
    or (select public.has_permission('operational.read'))
  );