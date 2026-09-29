-- Garante documento normalizado em todos os cadastros e consolida duplicidades reais por CPF/CNPJ.
-- Regra: somente CPF/CNPJ com 11 ou 14 dígitos é chave confiável de deduplicação.

create or replace function public.normalize_cpf_cnpj(p_documento text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  with d as (
    select regexp_replace(coalesce(p_documento,''), '[^0-9]', '', 'g') as digits
  )
  select case when length(digits) in (11,14) then digits else null end from d;
$$;

create or replace function public.sync_cliente_documento_normalizado()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.cpf_cnpj_normalizado := public.normalize_cpf_cnpj(coalesce(new.cpf_cnpj_original,new.cpf_cnpj_normalizado));
  return new;
end;
$$;

drop trigger if exists trg_clientes_sync_documento_normalizado on public.clientes;
create trigger trg_clientes_sync_documento_normalizado
before insert or update of cpf_cnpj_original, cpf_cnpj_normalizado on public.clientes
for each row execute function public.sync_cliente_documento_normalizado();

-- Consolida somente duplicidades ativas com documento válido idêntico.
do $$
declare
  g record;
  d record;
  survivor uuid;
begin
  for g in
    select public.normalize_cpf_cnpj(coalesce(cpf_cnpj_original,cpf_cnpj_normalizado)) as doc
    from public.clientes
    where deleted_at is null
      and public.normalize_cpf_cnpj(coalesce(cpf_cnpj_original,cpf_cnpj_normalizado)) is not null
    group by 1
    having count(*) > 1
  loop
    select id into survivor
    from public.clientes
    where deleted_at is null
      and public.normalize_cpf_cnpj(coalesce(cpf_cnpj_original,cpf_cnpj_normalizado)) = g.doc
    order by
      ((case when nullif(razao_social,'') is not null then 1 else 0 end) +
       (case when nullif(nome_fantasia,'') is not null then 1 else 0 end) +
       (case when nullif(email_principal,'') is not null then 1 else 0 end) +
       (case when nullif(telefone_principal,'') is not null then 1 else 0 end) +
       (case when nullif(external_id,'') is not null then 1 else 0 end)) desc,
      created_at asc
    limit 1;

    for d in
      select * from public.clientes
      where deleted_at is null
        and id <> survivor
        and public.normalize_cpf_cnpj(coalesce(cpf_cnpj_original,cpf_cnpj_normalizado)) = g.doc
      order by created_at asc
    loop
      update public.clientes s set
        tipo_pessoa = coalesce(s.tipo_pessoa,d.tipo_pessoa),
        cpf_cnpj_original = coalesce(nullif(s.cpf_cnpj_original,''),d.cpf_cnpj_original),
        cpf_cnpj_normalizado = g.doc,
        razao_social = coalesce(nullif(s.razao_social,''),d.razao_social),
        nome_fantasia = coalesce(nullif(s.nome_fantasia,''),d.nome_fantasia),
        telefone_principal = coalesce(nullif(s.telefone_principal,''),d.telefone_principal),
        email_principal = coalesce(nullif(s.email_principal,''),d.email_principal),
        segmento = coalesce(nullif(s.segmento,''),d.segmento),
        origem = coalesce(nullif(s.origem,''),d.origem),
        responsavel_comercial_id = coalesce(s.responsavel_comercial_id,d.responsavel_comercial_id),
        status_comercial = coalesce(nullif(s.status_comercial,''),d.status_comercial),
        observacoes_comerciais = coalesce(nullif(s.observacoes_comerciais,''),d.observacoes_comerciais),
        external_id = coalesce(nullif(s.external_id,''),d.external_id),
        updated_at = now()
      where s.id = survivor;

      update public.agendamentos set cliente_id=survivor where cliente_id=d.id;
      update public.atendimentos set cliente_id=survivor where cliente_id=d.id;
      update public.contatos set cliente_id=survivor where cliente_id=d.id;
      update public.contratos set cliente_id=survivor where cliente_id=d.id;
      update public.enderecos set cliente_id=survivor where cliente_id=d.id;
      update public.interacoes set cliente_id=survivor where cliente_id=d.id;
      update public.leads set cliente_convertido_id=survivor where cliente_convertido_id=d.id;
      update public.licitacoes set cliente_id=survivor where cliente_id=d.id;
      update public.oportunidades set cliente_id=survivor where cliente_id=d.id;
      update public.ordens_servico set cliente_id=survivor where cliente_id=d.id;
      update public.propostas set cliente_id=survivor where cliente_id=d.id;
      update public.recorrencias_clientes set cliente_id=survivor where cliente_id=d.id;
      update public.satisfacao_nps set cliente_id=survivor where cliente_id=d.id;
      update public.tarefas set cliente_id=survivor where cliente_id=d.id;

      update public.clientes
      set deleted_at=now(), ativo=false, updated_at=now()
      where id=d.id;
    end loop;
  end loop;
end $$;

-- Backfill seguro dos documentos normalizados após a consolidação.
update public.clientes
set cpf_cnpj_normalizado = public.normalize_cpf_cnpj(coalesce(cpf_cnpj_original,cpf_cnpj_normalizado)),
    updated_at = now()
where deleted_at is null;

create unique index if not exists clientes_cpf_cnpj_normalizado_active_unique_idx
on public.clientes(cpf_cnpj_normalizado)
where deleted_at is null and nullif(cpf_cnpj_normalizado,'') is not null;
