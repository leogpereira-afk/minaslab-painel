create table if not exists public.categorias_omie_codigos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  categoria_id uuid not null references public.categorias_financeiras(id) on delete cascade,
  codigo_omie text not null,
  descricao_omie text not null,
  natureza text,
  receita boolean not null default false,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id,codigo_omie)
);

alter table public.categorias_omie_codigos enable row level security;
revoke all on table public.categorias_omie_codigos from anon, authenticated;

with origem as (
  select distinct on (r.registro->>'descricao', case when coalesce((r.registro->>'receita')::boolean,false) then 'RECEITA' else 'DESPESA' end)
         e.id empresa_id,
         r.registro->>'descricao' nome,
         case when coalesce((r.registro->>'receita')::boolean,false) then 'RECEITA' else 'DESPESA' end tipo,
         not coalesce((r.registro->>'inativa')::boolean,false) ativa
  from public.ml_registros r
  cross join lateral (select id from public.empresas where usa_omie=true and ativa=true limit 1) e
  where r.colecao='fin_categorias' and r.apagado is not true
    and coalesce(r.registro->>'descricao','')<>''
  order by r.registro->>'descricao', case when coalesce((r.registro->>'receita')::boolean,false) then 'RECEITA' else 'DESPESA' end, r.atualizado_em desc
)
insert into public.categorias_financeiras (empresa_id,nome,tipo,ativa,created_at,updated_at)
select o.empresa_id,o.nome,o.tipo,o.ativa,now(),now()
from origem o
where not exists (
  select 1 from public.categorias_financeiras c
  where c.empresa_id=o.empresa_id and c.nome=o.nome and c.tipo=o.tipo
);

insert into public.categorias_omie_codigos (empresa_id,categoria_id,codigo_omie,descricao_omie,natureza,receita,ativa,created_at,updated_at)
select e.id,
       c.id,
       r.registro->>'codigo',
       r.registro->>'descricao',
       nullif(r.registro->>'natureza',''),
       coalesce((r.registro->>'receita')::boolean,false),
       not coalesce((r.registro->>'inativa')::boolean,false),
       now(),now()
from public.ml_registros r
cross join lateral (select id from public.empresas where usa_omie=true and ativa=true limit 1) e
join public.categorias_financeiras c
  on c.empresa_id=e.id
 and c.nome=r.registro->>'descricao'
 and c.tipo=case when coalesce((r.registro->>'receita')::boolean,false) then 'RECEITA' else 'DESPESA' end
where r.colecao='fin_categorias' and r.apagado is not true
  and coalesce(r.registro->>'codigo','')<>''
  and coalesce(r.registro->>'descricao','')<>''
  and not exists (
    select 1 from public.categorias_omie_codigos m
    where m.empresa_id=e.id and m.codigo_omie=r.registro->>'codigo'
  );

create or replace function public.financeiro_vincular_categoria_omie()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.categoria_id is null and coalesce(new.categoria_texto,'')<>'' then
    select m.categoria_id into new.categoria_id
    from public.categorias_omie_codigos m
    where m.empresa_id=new.empresa_id
      and m.codigo_omie=new.categoria_texto
      and m.ativa=true
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recebimentos_vincular_categoria_omie on public.recebimentos;
create trigger trg_recebimentos_vincular_categoria_omie
before insert or update of empresa_id,categoria_texto,categoria_id on public.recebimentos
for each row execute function public.financeiro_vincular_categoria_omie();

drop trigger if exists trg_despesas_vincular_categoria_omie on public.despesas;
create trigger trg_despesas_vincular_categoria_omie
before insert or update of empresa_id,categoria_texto,categoria_id on public.despesas
for each row execute function public.financeiro_vincular_categoria_omie();
