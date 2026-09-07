create table if not exists public.clientes_financeiro_mesclas (
  id uuid primary key default gen_random_uuid(),
  origem_id uuid not null references public.clientes_financeiro(id),
  destino_id uuid not null references public.clientes_financeiro(id),
  mesclado_em timestamptz not null default now(),
  recebimentos_ids uuid[] not null default '{}',
  despesas_ids uuid[] not null default '{}',
  notas_ids uuid[] not null default '{}',
  origem_snapshot jsonb,
  destino_snapshot jsonb,
  desmesclado_em timestamptz,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_clientes_financeiro_mesclas_origem on public.clientes_financeiro_mesclas(origem_id, ativo);

insert into public.clientes_financeiro_mesclas(origem_id,destino_id,mesclado_em,recebimentos_ids,despesas_ids,notas_ids,origem_snapshot,destino_snapshot)
select o.id,o.mesclado_para,o.mesclado_em,
       coalesce((select array_agg(r.id) from public.recebimentos r where r.cliente_id=o.mesclado_para and r.updated_at=o.mesclado_em),'{}'::uuid[]),
       coalesce((select array_agg(d.id) from public.despesas d where d.fornecedor_id=o.mesclado_para and d.updated_at=o.mesclado_em),'{}'::uuid[]),
       coalesce((select array_agg(n.id) from public.notas_fiscais n where n.cliente_id=o.mesclado_para and n.updated_at=o.mesclado_em),'{}'::uuid[]),
       to_jsonb(o), null
from public.clientes_financeiro o
where o.mesclado_para is not null
  and not exists (select 1 from public.clientes_financeiro_mesclas m where m.origem_id=o.id and m.ativo);

create or replace function public.mesclar_cliente_financeiro(p_origem uuid, p_destino uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o clientes_financeiro%rowtype; declare d clientes_financeiro%rowtype;
declare rids uuid[]; declare dids uuid[]; declare nids uuid[]; declare mid uuid;
begin
  if p_origem = p_destino then raise exception 'Origem e destino devem ser diferentes.'; end if;
  select * into o from clientes_financeiro where id=p_origem for update;
  if o.id is null then raise exception 'Cliente duplicado não encontrado.'; end if;
  select * into d from clientes_financeiro where id=p_destino for update;
  if d.id is null then raise exception 'Cliente destino não encontrado.'; end if;
  if o.mesclado_para is not null then raise exception 'Este cliente já está mesclado.'; end if;
  if d.mesclado_para is not null then raise exception 'O cliente destino já está mesclado em outro cadastro.'; end if;
  select coalesce(array_agg(id),'{}'::uuid[]) into rids from recebimentos where cliente_id=o.id;
  select coalesce(array_agg(id),'{}'::uuid[]) into dids from despesas where fornecedor_id=o.id;
  select coalesce(array_agg(id),'{}'::uuid[]) into nids from notas_fiscais where cliente_id=o.id;
  insert into clientes_financeiro_mesclas(origem_id,destino_id,recebimentos_ids,despesas_ids,notas_ids,origem_snapshot,destino_snapshot)
  values(o.id,d.id,rids,dids,nids,to_jsonb(o),to_jsonb(d)) returning id into mid;
  update recebimentos set cliente_id=d.id,cliente=d.nome,cnpj_cpf=coalesce(nullif(d.cnpj_cpf,''),cnpj_cpf),updated_at=now() where id=any(rids);
  update despesas set fornecedor_id=d.id,fornecedor=d.nome,cnpj_cpf=coalesce(nullif(d.cnpj_cpf,''),cnpj_cpf),updated_at=now() where id=any(dids);
  update notas_fiscais set cliente_id=d.id,nome_destinatario=case when tipo='SAIDA' then d.nome else nome_destinatario end,cnpj_destinatario=case when tipo='SAIDA' then coalesce(nullif(d.cnpj_cpf,''),cnpj_destinatario) else cnpj_destinatario end,updated_at=now() where id=any(nids);
  update clientes_financeiro set usa_minaslab=d.usa_minaslab or o.usa_minaslab,usa_mlab=d.usa_mlab or o.usa_mlab,email=coalesce(nullif(d.email,''),o.email),telefone=coalesce(nullif(d.telefone,''),o.telefone),updated_at=now() where id=d.id;
  update clientes_financeiro set ativo=false,mesclado_em=now(),mesclado_para=d.id,updated_at=now() where id=o.id;
  return jsonb_build_object('ok',true,'mesclaId',mid,'recebimentos',cardinality(rids),'despesas',cardinality(dids),'notas',cardinality(nids),'destino',d.id);
end $$;

create or replace function public.desmesclar_cliente_financeiro(p_origem uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m clientes_financeiro_mesclas%rowtype; declare o clientes_financeiro%rowtype; declare d clientes_financeiro%rowtype;
begin
  select * into m from clientes_financeiro_mesclas where origem_id=p_origem and ativo=true order by mesclado_em desc limit 1 for update;
  if m.id is null then raise exception 'Não existe histórico reversível desta mescla.'; end if;
  select * into o from clientes_financeiro where id=m.origem_id for update;
  select * into d from clientes_financeiro where id=m.destino_id for update;
  if o.id is null or d.id is null then raise exception 'Cadastro de origem ou destino não encontrado.'; end if;
  update recebimentos set cliente_id=o.id,cliente=o.nome,cnpj_cpf=coalesce(nullif(o.cnpj_cpf,''),cnpj_cpf),updated_at=now() where id=any(m.recebimentos_ids) and cliente_id=m.destino_id;
  update despesas set fornecedor_id=o.id,fornecedor=o.nome,cnpj_cpf=coalesce(nullif(o.cnpj_cpf,''),cnpj_cpf),updated_at=now() where id=any(m.despesas_ids) and fornecedor_id=m.destino_id;
  update notas_fiscais set cliente_id=o.id,nome_destinatario=case when tipo='SAIDA' then o.nome else nome_destinatario end,cnpj_destinatario=case when tipo='SAIDA' then coalesce(nullif(o.cnpj_cpf,''),cnpj_destinatario) else cnpj_destinatario end,updated_at=now() where id=any(m.notas_ids) and cliente_id=m.destino_id;
  update clientes_financeiro set ativo=true,mesclado_em=null,mesclado_para=null,updated_at=now() where id=o.id;
  if m.destino_snapshot is not null then
    update clientes_financeiro set usa_minaslab=coalesce((m.destino_snapshot->>'usa_minaslab')::boolean,usa_minaslab),usa_mlab=coalesce((m.destino_snapshot->>'usa_mlab')::boolean,usa_mlab),email=m.destino_snapshot->>'email',telefone=m.destino_snapshot->>'telefone',updated_at=now() where id=d.id;
  end if;
  update clientes_financeiro_mesclas set ativo=false,desmesclado_em=now() where id=m.id;
  return jsonb_build_object('ok',true,'recebimentos',cardinality(m.recebimentos_ids),'despesas',cardinality(m.despesas_ids),'notas',cardinality(m.notas_ids),'origem',m.origem_id,'destino',m.destino_id);
end $$;
revoke all on function public.mesclar_cliente_financeiro(uuid,uuid) from public, anon, authenticated;
revoke all on function public.desmesclar_cliente_financeiro(uuid) from public, anon, authenticated;
grant execute on function public.mesclar_cliente_financeiro(uuid,uuid) to service_role;
grant execute on function public.desmesclar_cliente_financeiro(uuid) to service_role;
