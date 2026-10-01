-- ============================================================================
-- Custo de insumos por parâmetro (CRM → Catálogo).
--
-- Pergunta que isto responde: "estamos cobrando direito?" — para cada
-- parâmetro, quanto se gasta de insumo por análise (ficha de consumo × último
-- preço pago nos Pedidos de Compra da Gestão de Estoque) contra o preço de
-- tabela do Catálogo.
--
-- REGRA DA CASA: a ficha de insumos só vale quando a execução é INTERNA.
--   - o banco recusa gravar ficha ativa em parâmetro que não é INTERNA;
--   - o custo só é calculado para parâmetros INTERNA;
--   - o volume conta só execuções INTERNO em amostra_parametros (terceirizado
--     e externo não consomem insumo da casa).
-- Parâmetro que vira EXTERNA não perde a ficha: ela fica guardada e ignorada,
-- e volta a valer se ele voltar a ser interno.
--
-- Os preços de compra moram em ml_registros (porta do painel, sem policy para
-- o CRM). As duas funções SECURITY DEFINER abaixo são a porta ESTREITA: só
-- devolvem nome do insumo, unidade e último preço, e só para quem já lê o
-- Catálogo (crm.read ou operational.read).
-- ============================================================================

-- ---------------------------------------------------------------- utilitários
create or replace function public.ml_norm_texto(p text)
returns text language sql immutable parallel safe
set search_path = pg_catalog, public
as $$
  select nullif(btrim(regexp_replace(upper(translate(coalesce(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')), '\s+', ' ', 'g')), '')
$$;

-- Família e fator para converter unidades compatíveis (mL↔L, g↔kg).
-- Unidades sem conversão conhecida formam família própria (só batem com elas mesmas).
create or replace function public.ml_unidade_familia(p text)
returns text language sql immutable parallel safe
set search_path = pg_catalog, public
as $$
  select case upper(btrim(coalesce(p, '')))
    when 'ML' then 'VOLUME' when 'L' then 'VOLUME' when 'UL' then 'VOLUME' when 'µL' then 'VOLUME'
    when 'G' then 'MASSA' when 'KG' then 'MASSA' when 'MG' then 'MASSA'
    when '' then 'UN'
    else upper(btrim(p)) end
$$;

create or replace function public.ml_unidade_fator(p text)
returns numeric language sql immutable parallel safe
set search_path = pg_catalog, public
as $$
  select case upper(btrim(coalesce(p, '')))
    when 'L' then 1000 when 'UL' then 0.001 when 'µL' then 0.001
    when 'KG' then 1000 when 'MG' then 0.001
    else 1 end::numeric
$$;

-- ---------------------------------------------------------------- tabela
create table if not exists public.parametro_insumos (
  id uuid primary key default gen_random_uuid(),
  parametro_id uuid not null references public.parametros(id),
  produto_base_id text not null,               -- código ML-nn do Produto Base (Gestão de Estoque)
  produto text not null,                       -- nome do insumo no momento do cadastro (preenchido pelo banco)
  quantidade numeric not null check (quantidade > 0),
  unidade text not null,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid()
);
comment on table public.parametro_insumos is
  'Ficha de consumo: quanto de cada insumo uma análise INTERNA do parâmetro consome. Só vale para execução INTERNA. Exclusão é lógica (ativo=false).';

create index if not exists parametro_insumos_parametro_idx on public.parametro_insumos (parametro_id) where ativo;
create unique index if not exists parametro_insumos_unico_ativo
  on public.parametro_insumos (parametro_id, produto_base_id) where ativo;

-- Regra INTERNA + produto existente + unidade compatível, decididos no banco.
create or replace function public.parametro_insumos_validar()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_exec text;
  v_apagado timestamptz;
  v_prod jsonb;
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if not new.ativo then
    return new; -- desativar sempre pode (inclusive depois que o parâmetro virou externo)
  end if;

  select execucao_padrao, deleted_at into v_exec, v_apagado
    from public.parametros where id = new.parametro_id;
  if not found or v_apagado is not null then
    raise exception 'Parâmetro não encontrado.' using errcode = 'P0001';
  end if;
  if upper(coalesce(v_exec, 'INTERNA')) <> 'INTERNA' then
    raise exception 'A ficha de insumos só pode ser usada em parâmetro de execução INTERNA.' using errcode = 'P0001';
  end if;

  select registro into v_prod from public.ml_registros
   where colecao = 'estoque_produtos_base' and id = new.produto_base_id and not apagado;
  if v_prod is null then
    raise exception 'Insumo não encontrado no cadastro de Produtos Base do estoque.' using errcode = 'P0001';
  end if;
  new.produto := coalesce(v_prod->>'produto', new.produto);
  new.unidade := coalesce(nullif(btrim(new.unidade), ''), v_prod->>'unidade', 'UN');
  if public.ml_unidade_familia(new.unidade) <> public.ml_unidade_familia(coalesce(v_prod->>'unidade', 'UN')) then
    raise exception 'Unidade % não é compatível com a unidade do insumo (%).', new.unidade, coalesce(v_prod->>'unidade', 'UN') using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists parametro_insumos_validar on public.parametro_insumos;
create trigger parametro_insumos_validar
  before insert or update on public.parametro_insumos
  for each row execute function public.parametro_insumos_validar();

alter table public.parametro_insumos enable row level security;

drop policy if exists parametro_insumos_select on public.parametro_insumos;
create policy parametro_insumos_select on public.parametro_insumos for select to authenticated
  using ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read')));
drop policy if exists parametro_insumos_insert on public.parametro_insumos;
create policy parametro_insumos_insert on public.parametro_insumos for insert to authenticated
  with check ((select public.has_permission('crm.write')));
drop policy if exists parametro_insumos_update on public.parametro_insumos;
create policy parametro_insumos_update on public.parametro_insumos for update to authenticated
  using ((select public.has_permission('crm.write'))) with check ((select public.has_permission('crm.write')));
-- Sem policy de DELETE de propósito: exclusão é ativo=false.

grant select, insert, update on public.parametro_insumos to authenticated;
revoke all on public.parametro_insumos from anon;

-- ---------------------------------------------------------------- insumos + último preço
-- Último preço pago: item de Pedido de Compra que saiu de PENDENTE (e não foi
-- cancelado/reprovado), com valor real (> R$ 0,01 — doação não é preço) e
-- conteúdo do kit informado. Mesma régua do Histórico de Preços do painel.
create or replace function public.crm_insumos_estoque()
returns table (
  produto_base_id text, produto text, grupo text, unidade text,
  custo_unitario numeric, preco_kit numeric, conteudo_kit numeric, unidade_compra text,
  fornecedor text, data_compra date, pedido text, situacao_preco text
)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if not ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read'))) then
    raise exception 'Sem permissão para consultar o catálogo.' using errcode = '42501';
  end if;
  return query
  with base as (
    select r.id as pid, r.registro->>'produto' as nome, upper(coalesce(r.registro->>'grupo', '')) as grp,
           coalesce(nullif(btrim(r.registro->>'unidade'), ''), 'UN') as un,
           public.ml_norm_texto(r.registro->>'produto') as chave
      from public.ml_registros r
     where r.colecao = 'estoque_produtos_base' and not r.apagado
  ), compras as (
    select distinct on (public.ml_norm_texto(p.registro->>'produto'))
           public.ml_norm_texto(p.registro->>'produto') as chave,
           (p.registro->>'valor')::numeric as valor,
           (p.registro->>'conteudoKit')::numeric as conteudo,
           coalesce(nullif(btrim(p.registro->>'unidade'), ''), 'UN') as un,
           p.registro->>'fornecedor' as forn,
           left(coalesce(p.registro->>'dataPedido', p.registro->>'dataCriacao'), 10) as dt,
           coalesce(p.registro->>'pedidoCodigo', p.registro->>'codigoPc', p.registro->>'idPedido') as pc
      from public.ml_registros p
     where p.colecao = 'estoque_pedidos' and not p.apagado
       and upper(coalesce(p.registro->>'status', 'PENDENTE')) not in ('PENDENTE', 'CANCELADO', 'REPROVADO', 'EXCLUÍDO', 'EXCLUIDO')
       and coalesce(p.registro->>'valor', '') ~ '^[0-9]+(\.[0-9]+)?$'
       and coalesce(p.registro->>'conteudoKit', '') ~ '^[0-9]+(\.[0-9]+)?$'
       and (p.registro->>'valor')::numeric > 0.01
       and (p.registro->>'conteudoKit')::numeric > 0
     order by public.ml_norm_texto(p.registro->>'produto'),
              left(coalesce(p.registro->>'dataPedido', p.registro->>'dataCriacao'), 10) desc nulls last,
              coalesce(p.registro->>'pedidoCodigo', p.registro->>'codigoPc', p.registro->>'idPedido') desc
  )
  select b.pid, b.nome, b.grp, b.un,
         case when c.chave is not null and public.ml_unidade_familia(c.un) = public.ml_unidade_familia(b.un)
              then round(c.valor / (c.conteudo * public.ml_unidade_fator(c.un)) * public.ml_unidade_fator(b.un), 6) end,
         c.valor, c.conteudo, c.un, c.forn,
         case when c.dt ~ '^\d{4}-\d{2}-\d{2}$' then c.dt::date end,
         c.pc,
         case when c.chave is null then 'SEM_COMPRA'
              when public.ml_unidade_familia(c.un) <> public.ml_unidade_familia(b.un) then 'UNIDADE_DIVERGENTE'
              else 'OK' end
    from base b left join compras c on c.chave = b.chave
   order by b.nome;
end $$;

-- ---------------------------------------------------------------- custo × preço
-- Parâmetros de mesmo nome existem por grupo (ex.: Coliformes Totais P/A em
-- Água e em Efluente): a função devolve os grupos para a tela distinguir.
drop function if exists public.crm_custo_parametros();
create function public.crm_custo_parametros()
returns table (
  parametro_id uuid, parametro text, grupos text, ativo boolean, preco numeric, preco_minimo numeric,
  itens_ficha integer, itens_sem_custo integer, custo_insumos numeric,
  margem numeric, margem_pct numeric, analises_internas bigint, analises_fora bigint
)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if not ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read'))) then
    raise exception 'Sem permissão para consultar o catálogo.' using errcode = '42501';
  end if;
  return query
  with ins as (select * from public.crm_insumos_estoque()),
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
  )
  select p.id, coalesce(p.nome_canonico, p.rotulo_original), g.nomes, p.ativo, p.preco, p.preco_minimo,
         coalesce(f.itens, 0), coalesce(f.sem_custo, 0),
         case when coalesce(f.itens, 0) > 0 then round(f.custo, 2) end,
         case when coalesce(f.itens, 0) > 0 and p.preco is not null then round(p.preco - coalesce(f.custo, 0), 2) end,
         case when coalesce(f.itens, 0) > 0 and p.preco > 0 then round((p.preco - coalesce(f.custo, 0)) / p.preco * 100, 1) end,
         coalesce(v.internas, 0), coalesce(v.fora, 0)
    from public.parametros p
    left join ficha f on f.pid = p.id
    left join vol v on v.pid = p.id
    left join grp g on g.pid = p.id
   where p.deleted_at is null
     and upper(coalesce(p.execucao_padrao, 'INTERNA')) = 'INTERNA'
   order by coalesce(v.internas, 0) desc, 2;
end $$;

revoke all on function public.crm_insumos_estoque() from public, anon;
revoke all on function public.crm_custo_parametros() from public, anon;
grant execute on function public.crm_insumos_estoque() to authenticated;
grant execute on function public.crm_custo_parametros() to authenticated;
revoke all on function public.parametro_insumos_validar() from public, anon, authenticated;
