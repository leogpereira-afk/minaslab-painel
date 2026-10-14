-- Acompanhamento de Provedores (FM-LAB-060)
-- Envios de amostras para laboratórios terceirizados: rastreio, prazo em dias
-- úteis, custo de análise + frete e entrega do resultado ao cliente.
-- Provedor = cadastro de Laboratórios Parceiros; OS, proposta e cliente
-- ligados ao CRM quando existirem (os números originais ficam guardados).

insert into public.laboratorios_parceiros (nome, ativo, observacoes)
select v.nome, true, 'Cadastrado pela migração do Acompanhamento de Provedores (FM-LAB-060)'
from (values ('Sintezis'), ('GMO')) v(nome)
where not exists (select 1 from public.laboratorios_parceiros l where l.deleted_at is null and lower(l.nome) = lower(v.nome));

-- Soma dias úteis (seg–sex) a uma data. Feriados não são considerados.
create or replace function public.provedor_somar_dias_uteis(p_data date, p_dias integer)
returns date
language plpgsql
immutable
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_data date := p_data;
  v_resto integer := coalesce(p_dias, 0);
begin
  if p_data is null or p_dias is null then return null; end if;
  while v_resto > 0 loop
    v_data := v_data + 1;
    if extract(isodow from v_data) < 6 then v_resto := v_resto - 1; end if;
  end loop;
  return v_data;
end;
$$;

create table public.provedor_envios (
  id uuid primary key default gen_random_uuid(),
  laboratorio_parceiro_id uuid references public.laboratorios_parceiros(id),
  provedor_nome text,
  ordem_servico_id uuid references public.ordens_servico(id),
  numero_os text,
  proposta_id uuid references public.propostas(id),
  numero_proposta text,
  cliente_id uuid references public.clientes(id),
  grupo text,
  amostras text,
  data_recebimento date,
  data_envio date,
  data_chegada date,
  prazo_dias integer check (prazo_dias is null or prazo_dias between 0 and 365),
  prazo_tipo text not null default 'UTEIS' check (prazo_tipo in ('UTEIS', 'CORRIDOS')),
  previsao_resultado date,
  data_prevista date,
  data_resultado date,
  data_envio_cliente date,
  proposta_provedor text,
  valor_proposta_provedor numeric(12,2) check (valor_proposta_provedor is null or valor_proposta_provedor >= 0),
  transportadora text,
  codigo_rastreio text,
  valor_frete numeric(12,2) check (valor_frete is null or valor_frete >= 0),
  relatorio_provedor text,
  status text not null default 'AGUARDANDO_ENVIO'
    check (status in ('AGUARDANDO_ENVIO', 'ENVIADA', 'NO_PROVEDOR', 'RESULTADO_RECEBIDO', 'ENVIADO_CLIENTE', 'CANCELADA')),
  observacoes text,
  ativo boolean not null default true,
  source_system text not null default 'CRM',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_at timestamptz,
  constraint provedor_envios_provedor_chk check (laboratorio_parceiro_id is not null or nullif(btrim(provedor_nome), '') is not null)
);

comment on column public.provedor_envios.valor_proposta_provedor is 'Valor da proposta do provedor (FM-LAB-060 col. K). Pode se repetir em vários envios da mesma proposta; somar sem repetir proposta.';
comment on table public.provedor_envios is 'Acompanhamento de envios de amostras para provedores externos (FM-LAB-060). data_prevista = previsão manual ou chegada/envio + prazo.';

create index provedor_envios_lab_idx on public.provedor_envios (laboratorio_parceiro_id) where deleted_at is null;
create index provedor_envios_status_idx on public.provedor_envios (status, data_prevista) where deleted_at is null;
create index provedor_envios_envio_idx on public.provedor_envios (data_envio desc) where deleted_at is null;
create index provedor_envios_os_idx on public.provedor_envios (ordem_servico_id) where ordem_servico_id is not null;
create index provedor_envios_proposta_idx on public.provedor_envios (proposta_id) where proposta_id is not null;
create index provedor_envios_cliente_idx on public.provedor_envios (cliente_id) where cliente_id is not null;
create index provedor_envios_created_by_idx on public.provedor_envios (created_by);
create index provedor_envios_updated_by_idx on public.provedor_envios (updated_by);

-- Prazo previsto e vínculos com o CRM calculados no banco, para a tela e os
-- indicadores usarem sempre a mesma regra.
create or replace function public.provedor_envios_preparar()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_base date;
begin
  new.updated_at := now();
  new.numero_os := nullif(btrim(new.numero_os), '');
  new.numero_proposta := nullif(btrim(new.numero_proposta), '');

  if new.ordem_servico_id is null and new.numero_os is not null then
    select o.id into new.ordem_servico_id from public.ordens_servico o
     where o.deleted_at is null and lower(btrim(o.numero_os)) = lower(new.numero_os) limit 1;
  end if;
  if new.proposta_id is null and new.numero_proposta is not null then
    select p.id into new.proposta_id from public.propostas p
     where p.deleted_at is null and lower(btrim(p.numero_proposta)) = lower(new.numero_proposta) limit 1;
  end if;
  if new.cliente_id is null and new.ordem_servico_id is not null then
    select o.cliente_id into new.cliente_id from public.ordens_servico o where o.id = new.ordem_servico_id;
  end if;
  if new.cliente_id is null and new.proposta_id is not null then
    select p.cliente_id into new.cliente_id from public.propostas p where p.id = new.proposta_id;
  end if;
  if new.laboratorio_parceiro_id is not null and nullif(btrim(new.provedor_nome), '') is null then
    select l.nome into new.provedor_nome from public.laboratorios_parceiros l where l.id = new.laboratorio_parceiro_id;
  end if;

  v_base := coalesce(new.data_chegada, new.data_envio);
  new.data_prevista := coalesce(
    new.previsao_resultado,
    case when new.prazo_tipo = 'CORRIDOS' then v_base + new.prazo_dias
         else public.provedor_somar_dias_uteis(v_base, new.prazo_dias) end
  );
  return new;
end;
$$;

create trigger trg_provedor_envios_preparar
before insert or update on public.provedor_envios
for each row execute function public.provedor_envios_preparar();

alter table public.provedor_envios enable row level security;

create policy provedor_envios_read on public.provedor_envios
  for select to authenticated
  using ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read')));
create policy provedor_envios_insert on public.provedor_envios
  for insert to authenticated
  with check ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')));
create policy provedor_envios_update on public.provedor_envios
  for update to authenticated
  using ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')))
  with check ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')));
create policy provedor_envios_delete on public.provedor_envios
  for delete to authenticated
  using ((select public.has_permission('crm.write')));

revoke all on public.provedor_envios from anon;
grant select, insert, update, delete on public.provedor_envios to authenticated, service_role;
revoke execute on function public.provedor_envios_preparar() from public, anon, authenticated;
