-- CRM: custo TOTAL por análise = insumos + mão de obra + equipamento + outros + despesas fixas.
-- Só adição: tabelas novas e novas COLUNAS no fim de crm_custo_parametros(); as colunas que já existiam
-- (custo_insumos, margem, margem_pct...) continuam significando "só insumos", então a tela já publicada segue funcionando.
--
-- Como o custo total é montado (decidido com o Léo em 01/10/2026):
--   mão de obra   = minutos_mao_obra / 60 × custo_hora            (custo_hora é um valor geral da casa)
--   equipamento   = custo_equipamento (R$ por análise, informado por parâmetro)
--   outros        = outros_custos     (R$ por análise: energia, água, calibração...)
--   subtotal      = insumos + mão de obra + equipamento + outros
--   despesas fixas= subtotal × pct_despesas_fixas / 100           (percentual geral da casa)
--   custo total   = subtotal + despesas fixas
-- Valores zerados = "não informado": o total fica igual ao custo de insumos, sem inventar número.
--
-- REGRA DA CASA mantida: só vale para parâmetro de execução INTERNA (o banco recusa o resto).

-- ---------------------------------------------------------------- configuração geral (uma linha só)
create table if not exists public.crm_custo_config (
  id boolean primary key default true check (id),           -- trava: só existe uma linha
  custo_hora numeric not null default 0 check (custo_hora >= 0),
  pct_despesas_fixas numeric not null default 0 check (pct_despesas_fixas >= 0 and pct_despesas_fixas <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
comment on table public.crm_custo_config is
  'Valores gerais do custo por análise: custo da hora de mão de obra (R$/h) e percentual de despesas fixas sobre o custo. Linha única.';
insert into public.crm_custo_config (id) values (true) on conflict (id) do nothing;

create or replace function public.crm_custo_config_tocar()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists crm_custo_config_tocar on public.crm_custo_config;
create trigger crm_custo_config_tocar before update on public.crm_custo_config
  for each row execute function public.crm_custo_config_tocar();

alter table public.crm_custo_config enable row level security;
drop policy if exists crm_custo_config_select on public.crm_custo_config;
create policy crm_custo_config_select on public.crm_custo_config for select to authenticated
  using ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read')));
drop policy if exists crm_custo_config_update on public.crm_custo_config;
create policy crm_custo_config_update on public.crm_custo_config for update to authenticated
  using ((select public.has_permission('crm.write'))) with check ((select public.has_permission('crm.write')));
-- Sem INSERT/DELETE de propósito: a linha única já existe e não se apaga.
grant select, update on public.crm_custo_config to authenticated;
revoke all on public.crm_custo_config from anon;
revoke all on function public.crm_custo_config_tocar() from public, anon, authenticated;

-- ---------------------------------------------------------------- custos por parâmetro (uma linha por parâmetro)
create table if not exists public.parametro_custos_extras (
  parametro_id uuid primary key references public.parametros(id),
  minutos_mao_obra numeric not null default 0 check (minutos_mao_obra >= 0),
  custo_equipamento numeric not null default 0 check (custo_equipamento >= 0),
  outros_custos numeric not null default 0 check (outros_custos >= 0),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid()
);
comment on table public.parametro_custos_extras is
  'Custos por análise além dos insumos: minutos de mão de obra, equipamento (R$) e outros (R$). Só para parâmetro de execução INTERNA. Para "zerar", grave 0.';

create or replace function public.parametro_custos_extras_validar()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_exec text;
  v_apagado timestamptz;
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  -- Zerar sempre pode (inclusive depois que o parâmetro virou externo).
  if new.minutos_mao_obra = 0 and new.custo_equipamento = 0 and new.outros_custos = 0 then
    return new;
  end if;
  select execucao_padrao, deleted_at into v_exec, v_apagado
    from public.parametros where id = new.parametro_id;
  if not found or v_apagado is not null then
    raise exception 'Parâmetro não encontrado.' using errcode = 'P0001';
  end if;
  if upper(coalesce(v_exec, 'INTERNA')) <> 'INTERNA' then
    raise exception 'Os custos da análise só podem ser usados em parâmetro de execução INTERNA.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists parametro_custos_extras_validar on public.parametro_custos_extras;
create trigger parametro_custos_extras_validar before insert or update on public.parametro_custos_extras
  for each row execute function public.parametro_custos_extras_validar();

alter table public.parametro_custos_extras enable row level security;
drop policy if exists parametro_custos_extras_select on public.parametro_custos_extras;
create policy parametro_custos_extras_select on public.parametro_custos_extras for select to authenticated
  using ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read')));
drop policy if exists parametro_custos_extras_insert on public.parametro_custos_extras;
create policy parametro_custos_extras_insert on public.parametro_custos_extras for insert to authenticated
  with check ((select public.has_permission('crm.write')));
drop policy if exists parametro_custos_extras_update on public.parametro_custos_extras;
create policy parametro_custos_extras_update on public.parametro_custos_extras for update to authenticated
  using ((select public.has_permission('crm.write'))) with check ((select public.has_permission('crm.write')));
-- Sem DELETE de propósito: para limpar, grave zeros.
grant select, insert, update on public.parametro_custos_extras to authenticated;
revoke all on public.parametro_custos_extras from anon;
revoke all on function public.parametro_custos_extras_validar() from public, anon, authenticated;

-- ---------------------------------------------------------------- custo × preço (colunas novas no fim)
drop function if exists public.crm_custo_parametros();
create function public.crm_custo_parametros()
returns table (
  parametro_id uuid, parametro text, grupos text, ativo boolean, preco numeric, preco_minimo numeric,
  itens_ficha integer, itens_sem_custo integer, custo_insumos numeric,
  margem numeric, margem_pct numeric, analises_internas bigint, analises_fora bigint,
  minutos_mao_obra numeric, custo_equipamento numeric, outros_custos numeric,
  custo_mao_obra numeric, custo_despesas_fixas numeric, custo_total numeric,
  margem_total numeric, margem_total_pct numeric
)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if not ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read'))) then
    raise exception 'Sem permissão para consultar o catálogo.' using errcode = '42501';
  end if;
  return query
  with cfg as (select c.custo_hora as ch, c.pct_despesas_fixas as pct from public.crm_custo_config c where c.id),
  ins as (select * from public.crm_insumos_estoque()),
  ficha as (
    select f.parametro_id as pid, count(*)::int as itens,
           count(*) filter (where i.custo_unitario is null)::int as sem_custo,
           sum(f.quantidade * public.ml_unidade_fator(f.unidade) / public.ml_unidade_fator(i.unidade) * i.custo_unitario) as custo
      from public.parametro_insumos f
      left join ins i on i.produto_base_id = f.produto_base_id
     where f.ativo
     group by f.parametro_id
  ), vol as (
    select ap.parametro_id as pid,
           count(*) filter (where upper(ap.tipo_execucao) = 'INTERNO') as internas,
           count(*) filter (where upper(coalesce(ap.tipo_execucao, '')) <> 'INTERNO') as fora
      from public.amostra_parametros ap
     where ap.deleted_at is null
     group by ap.parametro_id
  ), grp as (
    select c.parametro_id as pid, string_agg(distinct g.nome, ', ' order by g.nome) as nomes
      from public.catalogo_grupo_parametros c join public.grupos g on g.id = c.grupo_id
     where c.deleted_at is null
     group by c.parametro_id
  ), base as (
    select p.id as pid,
           coalesce(f.itens, 0) as itens, coalesce(f.sem_custo, 0) as sem_custo, f.custo as insumos,
           coalesce(f.custo, 0) as insumos_zero,
           coalesce(x.minutos_mao_obra, 0) as minutos, coalesce(x.custo_equipamento, 0) as equip, coalesce(x.outros_custos, 0) as outros,
           round(coalesce(x.minutos_mao_obra, 0) / 60.0 * coalesce((select ch from cfg), 0), 4) as mao_obra,
           (coalesce(f.itens, 0) > 0 or coalesce(x.minutos_mao_obra, 0) + coalesce(x.custo_equipamento, 0) + coalesce(x.outros_custos, 0) > 0) as tem_custo
      from public.parametros p
      left join ficha f on f.pid = p.id
      left join public.parametro_custos_extras x on x.parametro_id = p.id
     where p.deleted_at is null
       and upper(coalesce(p.execucao_padrao, 'INTERNA')) = 'INTERNA'
  ), tot as (
    select b.*, b.insumos_zero + b.mao_obra + b.equip + b.outros as subtotal from base b
  )
  select p.id, coalesce(p.nome_canonico, p.rotulo_original), g.nomes, p.ativo, p.preco, p.preco_minimo,
         t.itens, t.sem_custo,
         case when t.itens > 0 then round(t.insumos, 2) end,
         case when t.itens > 0 and p.preco is not null then round(p.preco - coalesce(t.insumos, 0), 2) end,
         case when t.itens > 0 and p.preco > 0 then round((p.preco - coalesce(t.insumos, 0)) / p.preco * 100, 1) end,
         coalesce(v.internas, 0), coalesce(v.fora, 0),
         t.minutos, t.equip, t.outros,
         t.mao_obra,
         case when t.tem_custo then round(t.subtotal * coalesce((select pct from cfg), 0) / 100, 4) end,
         case when t.tem_custo then round(t.subtotal * (1 + coalesce((select pct from cfg), 0) / 100), 2) end,
         case when t.tem_custo and p.preco is not null
              then round(p.preco - t.subtotal * (1 + coalesce((select pct from cfg), 0) / 100), 2) end,
         case when t.tem_custo and p.preco > 0
              then round((p.preco - t.subtotal * (1 + coalesce((select pct from cfg), 0) / 100)) / p.preco * 100, 1) end
    from public.parametros p
    join tot t on t.pid = p.id
    left join vol v on v.pid = p.id
    left join grp g on g.pid = p.id
   where p.deleted_at is null
     and upper(coalesce(p.execucao_padrao, 'INTERNA')) = 'INTERNA'
   order by coalesce(v.internas, 0) desc, 2;
end $$;

revoke all on function public.crm_custo_parametros() from public, anon;
grant execute on function public.crm_custo_parametros() to authenticated;
