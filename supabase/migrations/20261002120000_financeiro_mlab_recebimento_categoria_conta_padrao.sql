-- M Lab: todo recebimento ligado a nota fiscal (NFS-e emitida) nasce com
-- categoria "SERVIÇOS REALIZADOS" e conta bancária "C6 S.A".
-- Só preenche o que estiver vazio; nunca sobrescreve escolha manual.

create or replace function public.recebimentos_mlab_padrao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_nome text;
  v_cat record;
  v_conta record;
begin
  if coalesce(btrim(new.numero_nf), '') = '' then
    return new;
  end if;
  if new.categoria_id is not null and new.conta_bancaria_id is not null then
    return new;
  end if;

  select nome into v_nome from public.empresas where id = new.empresa_id;
  if v_nome is null or v_nome !~* 'm\s*lab' or v_nome ~* 'minas' then
    return new;
  end if;

  if new.categoria_id is null then
    select id, nome into v_cat
    from public.categorias_financeiras
    where empresa_id = new.empresa_id
      and upper(nome) = 'SERVIÇOS REALIZADOS'
      and upper(coalesce(tipo, '')) = 'RECEITA'
    order by created_at nulls last
    limit 1;
    if found then
      new.categoria_id := v_cat.id;
      new.categoria_texto := coalesce(new.categoria_texto, v_cat.nome);
    end if;
  end if;

  if new.conta_bancaria_id is null then
    select id, nome into v_conta
    from public.contas_bancarias
    where empresa_id = new.empresa_id
      and ativa
      and upper(nome) = 'C6 S.A'
    order by created_at nulls last
    limit 1;
    if found then
      new.conta_bancaria_id := v_conta.id;
      new.conta_bancaria_texto := coalesce(new.conta_bancaria_texto, v_conta.nome);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_recebimentos_mlab_padrao on public.recebimentos;
create trigger trg_recebimentos_mlab_padrao
  before insert or update of numero_nf, categoria_id, conta_bancaria_id on public.recebimentos
  for each row execute function public.recebimentos_mlab_padrao();

-- Regularização dos recebimentos já existentes da M Lab com nota e sem categoria/conta.
update public.recebimentos r
set categoria_id = coalesce(r.categoria_id, c.id),
    categoria_texto = coalesce(r.categoria_texto, c.nome),
    conta_bancaria_id = coalesce(r.conta_bancaria_id, b.id),
    conta_bancaria_texto = coalesce(r.conta_bancaria_texto, b.nome)
from public.empresas e
left join lateral (
  select id, nome from public.categorias_financeiras
  where empresa_id = e.id and upper(nome) = 'SERVIÇOS REALIZADOS' and upper(coalesce(tipo, '')) = 'RECEITA'
  order by created_at nulls last limit 1
) c on true
left join lateral (
  select id, nome from public.contas_bancarias
  where empresa_id = e.id and ativa and upper(nome) = 'C6 S.A'
  order by created_at nulls last limit 1
) b on true
where e.id = r.empresa_id
  and e.nome ~* 'm\s*lab' and e.nome !~* 'minas'
  and not coalesce(r.apagado, false)
  and coalesce(btrim(r.numero_nf), '') <> ''
  and (r.categoria_id is null or r.conta_bancaria_id is null);
