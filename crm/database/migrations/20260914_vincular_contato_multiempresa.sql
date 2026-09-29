create or replace function public.crm_link_or_create_contact(
  p_cliente_id uuid,
  p_nome text,
  p_telefone text default null,
  p_email text default null,
  p_funcao_papel text default 'Solicitante',
  p_principal boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
  v_phone text := nullif(regexp_replace(coalesce(p_telefone,''), '\\D', '', 'g'),'');
  v_email text := nullif(lower(trim(coalesce(p_email,''))),'');
begin
  if auth.uid() is null or not public.has_permission('crm.write') then
    raise exception 'permission_denied';
  end if;
  if p_cliente_id is null or not exists(select 1 from public.clientes where id=p_cliente_id and deleted_at is null) then
    raise exception 'cliente_invalido';
  end if;
  if nullif(trim(coalesce(p_nome,'')),'') is null then
    raise exception 'nome_obrigatorio';
  end if;

  select c.id into v_contact_id
  from public.contatos c
  where c.deleted_at is null
    and (
      (v_phone is not null and (
        regexp_replace(coalesce(c.whatsapp,''), '\\D', '', 'g') = v_phone
        or regexp_replace(coalesce(c.telefone,''), '\\D', '', 'g') = v_phone
      ))
      or (v_phone is null and v_email is not null and lower(c.email)=v_email)
    )
  order by case when c.cliente_id=p_cliente_id then 0 else 1 end, c.created_at
  limit 1;

  if v_contact_id is null then
    insert into public.contatos(cliente_id,nome,telefone,whatsapp,email,funcao_papel,principal,ativo,source_system,created_by)
    values(p_cliente_id,trim(p_nome),nullif(trim(coalesce(p_telefone,'')),''),nullif(trim(coalesce(p_telefone,'')),''),nullif(trim(coalesce(p_email,'')),''),nullif(trim(coalesce(p_funcao_papel,'')),''),p_principal,true,'CRM',auth.uid())
    returning id into v_contact_id;
  else
    update public.contatos
       set nome=coalesce(nullif(trim(p_nome),''),nome),
           telefone=coalesce(nullif(trim(coalesce(p_telefone,'')),''),telefone),
           whatsapp=coalesce(nullif(trim(coalesce(p_telefone,'')),''),whatsapp),
           email=coalesce(nullif(trim(coalesce(p_email,'')),''),email),
           funcao_papel=coalesce(nullif(trim(coalesce(p_funcao_papel,'')),''),funcao_papel),
           ativo=true,
           updated_by=auth.uid()
     where id=v_contact_id;
  end if;

  insert into public.contato_empresas(contato_id,cliente_id,principal,origem,created_by)
  values(v_contact_id,p_cliente_id,p_principal,'CRM',auth.uid())
  on conflict(contato_id,cliente_id) do update
  set principal=excluded.principal;

  return v_contact_id;
end;
$$;
revoke all on function public.crm_link_or_create_contact(uuid,text,text,text,text,boolean) from public;
grant execute on function public.crm_link_or_create_contact(uuid,text,text,text,text,boolean) to authenticated;
