alter table clientes_financeiro add column if not exists mesclado_em timestamptz;
alter table clientes_financeiro add column if not exists mesclado_para uuid references clientes_financeiro(id);

create or replace function mesclar_cliente_financeiro(p_origem uuid, p_destino uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare o clientes_financeiro%rowtype;
declare d clientes_financeiro%rowtype;
declare nr int; declare nd int; declare nn int;
begin
  if p_origem = p_destino then raise exception 'Origem e destino devem ser diferentes.'; end if;
  select * into o from clientes_financeiro where id=p_origem for update;
  select * into d from clientes_financeiro where id=p_destino for update;
  if not found then raise exception 'Cliente destino não encontrado.'; end if;
  if o.id is null then raise exception 'Cliente duplicado não encontrado.'; end if;
  update recebimentos set cliente_id=d.id, cliente=d.nome, cnpj_cpf=coalesce(nullif(d.cnpj_cpf,''),cnpj_cpf), updated_at=now() where cliente_id=o.id;
  get diagnostics nr = row_count;
  update despesas set fornecedor_id=d.id, fornecedor=d.nome, cnpj_cpf=coalesce(nullif(d.cnpj_cpf,''),cnpj_cpf), updated_at=now() where fornecedor_id=o.id;
  get diagnostics nd = row_count;
  update notas_fiscais set cliente_id=d.id, nome_destinatario=case when tipo='SAIDA' then d.nome else nome_destinatario end, cnpj_destinatario=case when tipo='SAIDA' then coalesce(nullif(d.cnpj_cpf,''),cnpj_destinatario) else cnpj_destinatario end, updated_at=now() where cliente_id=o.id;
  get diagnostics nn = row_count;
  update clientes_financeiro set usa_minaslab=d.usa_minaslab or o.usa_minaslab, usa_mlab=d.usa_mlab or o.usa_mlab, email=coalesce(nullif(d.email,''),o.email), telefone=coalesce(nullif(d.telefone,''),o.telefone), updated_at=now() where id=d.id;
  update clientes_financeiro set ativo=false, mesclado_em=now(), mesclado_para=d.id, updated_at=now() where id=o.id;
  return jsonb_build_object('ok',true,'recebimentos',nr,'despesas',nd,'notas',nn,'destino',d.id);
end $$;
revoke all on function mesclar_cliente_financeiro(uuid,uuid) from public, anon, authenticated;
