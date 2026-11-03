-- Relatórios › Propostas por Rede de Laboratórios Parceiros: a maioria das propostas não tinha laboratório ligado
-- (em out/2026 só 8 de 89), porque as propostas vêm do GerenciaLab sem essa informação.
-- O laboratório passa a vir também do que foi executado: proposta → contrato → OS → parâmetros (laboratório de cada análise).
-- Ligações já existentes (escolhidas na proposta) são mantidas; só acrescenta as que faltam.

create or replace function public.crm_proposta_laboratorios_sincronizar()
returns integer language sql security definer set search_path = public as $$
  with m as (
    select distinct p.id proposta_id, ap.laboratorio_parceiro_id lab
      from public.propostas p
      join public.contratos k on k.deleted_at is null
       and (k.numero_contrato = p.numero_proposta or k.proposta_origem_referencia = p.numero_proposta or k.proposta_origem_id = p.id)
      join public.ordens_servico os on os.contrato_id = k.id and os.deleted_at is null
      join public.amostras a on a.ordem_servico_id = os.id and a.deleted_at is null
      join public.amostra_parametros ap on ap.amostra_id = a.id and ap.deleted_at is null and ap.laboratorio_parceiro_id is not null
     where p.deleted_at is null),
  ins as (
    insert into public.proposta_laboratorios (proposta_id, laboratorio_id)
    select m.proposta_id, m.lab from m
     where not exists (select 1 from public.proposta_laboratorios pl where pl.proposta_id = m.proposta_id and pl.laboratorio_id = m.lab)
    returning 1)
  select count(*)::int from ins
$$;

create or replace function public.trg_proposta_laboratorios_sincronizar()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.crm_proposta_laboratorios_sincronizar(); return null; end $$;

drop trigger if exists trg_amostra_parametros_prop_labs on public.amostra_parametros;
create trigger trg_amostra_parametros_prop_labs after insert on public.amostra_parametros
  for each statement execute function public.trg_proposta_laboratorios_sincronizar();
drop trigger if exists trg_ordens_servico_prop_labs on public.ordens_servico;
create trigger trg_ordens_servico_prop_labs after update of contrato_id on public.ordens_servico
  for each statement execute function public.trg_proposta_laboratorios_sincronizar();

select public.crm_proposta_laboratorios_sincronizar();

-- Propostas sem nenhum laboratório (vindas do GerenciaLab, ainda sem OS) ficam com MinasLab, como nas importações anteriores.
create or replace function public.crm_proposta_laboratorios_sincronizar()
returns integer language sql security definer set search_path = public as $$
  with m as (
    select distinct p.id proposta_id, ap.laboratorio_parceiro_id lab
      from public.propostas p
      join public.contratos k on k.deleted_at is null
       and (k.numero_contrato = p.numero_proposta or k.proposta_origem_referencia = p.numero_proposta or k.proposta_origem_id = p.id)
      join public.ordens_servico os on os.contrato_id = k.id and os.deleted_at is null
      join public.amostras a on a.ordem_servico_id = os.id and a.deleted_at is null
      join public.amostra_parametros ap on ap.amostra_id = a.id and ap.deleted_at is null and ap.laboratorio_parceiro_id is not null
     where p.deleted_at is null
    union
    select p.id, (select id from public.laboratorios_parceiros where nome = 'MinasLab' and deleted_at is null and ativo order by created_at limit 1)
      from public.propostas p
     where p.deleted_at is null and not exists (select 1 from public.proposta_laboratorios pl where pl.proposta_id = p.id)),
  ins as (
    insert into public.proposta_laboratorios (proposta_id, laboratorio_id)
    select m.proposta_id, m.lab from m
     where m.lab is not null and not exists (select 1 from public.proposta_laboratorios pl where pl.proposta_id = m.proposta_id and pl.laboratorio_id = m.lab)
    returning 1)
  select count(*)::int from ins
$$;
-- Não sincroniza no insert de propostas: o formulário grava os laboratórios escolhidos logo depois.
drop trigger if exists trg_propostas_prop_labs on public.propostas;
select public.crm_proposta_laboratorios_sincronizar();
