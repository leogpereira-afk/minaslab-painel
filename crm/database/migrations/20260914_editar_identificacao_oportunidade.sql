create or replace function public.crm_update_oportunidade_identity(
 p_oportunidade_id uuid,p_cliente_id uuid,p_numero_proposta_gerencialab text
) returns void language plpgsql security definer set search_path='pg_catalog','public' as $$
declare v_old public.oportunidades%rowtype;v_user uuid:=auth.uid();v_number text:=btrim(coalesce(p_numero_proposta_gerencialab,''));
begin
 if v_user is null or not public.has_permission('crm.write') then raise exception 'permission_denied'; end if;
 if p_cliente_id is null then raise exception 'cliente_obrigatorio'; end if;
 if v_number='' then raise exception 'numero_proposta_gerencialab_obrigatorio'; end if;
 select * into v_old from public.oportunidades where id=p_oportunidade_id and deleted_at is null for update;
 if not found then raise exception 'oportunidade_nao_encontrada'; end if;
 if v_old.cliente_id is distinct from p_cliente_id and exists(
   select 1 from public.propostas p where p.oportunidade_id=p_oportunidade_id and p.deleted_at is null
   and ((upper(coalesce(p.status,''))='APROVADA' and p.data_aceite is null)
     or (upper(coalesce(p.status,''))='RECUSADA' and p.data_recusa is null))
 ) then raise exception 'corrija_as_datas_de_decisao_das_propostas_vinculadas_antes_de_trocar_o_cliente';
 end if;
 update public.oportunidades set cliente_id=p_cliente_id,titulo=v_number,numero_proposta_gerencialab=v_number,updated_by=v_user where id=p_oportunidade_id;
 if v_old.cliente_id is distinct from p_cliente_id then
   update public.propostas set cliente_id=p_cliente_id,updated_by=v_user where oportunidade_id=p_oportunidade_id and deleted_at is null;
   update public.tarefas set cliente_id=p_cliente_id,updated_by=v_user where oportunidade_id=p_oportunidade_id and deleted_at is null;
   update public.leads set cliente_convertido_id=p_cliente_id,updated_by=v_user
   where id in(select distinct i.lead_id from public.interacoes i where i.oportunidade_id=p_oportunidade_id and i.lead_id is not null);
 end if;
 insert into public.interacoes(oportunidade_id,cliente_id,usuario_id,tipo,descricao)
 values(p_oportunidade_id,p_cliente_id,v_user,'EDICAO','Cliente e/ou número da proposta GerenciaLab da oportunidade atualizados.');
end $$;
revoke all on function public.crm_update_oportunidade_identity(uuid,uuid,text) from public;
grant execute on function public.crm_update_oportunidade_identity(uuid,uuid,text) to authenticated;