create or replace function public.financeiro_validar_conciliacao()
returns trigger
language plpgsql
as $$
declare
  mov_empresa uuid;
  mov_tipo text;
  mov_valor numeric;
  ja numeric;
  destino_empresa uuid;
begin
  if (new.recebimento_id is null) = (new.despesa_id is null) then
    raise exception 'Informe exatamente um recebimento ou uma despesa.';
  end if;

  select empresa_id,tipo,valor into mov_empresa,mov_tipo,mov_valor
  from public.movimentos_bancarios where id=new.movimento_id;
  if mov_empresa is null then raise exception 'Movimento não encontrado.'; end if;

  select coalesce(sum(valor_conciliado),0) into ja
  from public.conciliacoes where movimento_id=new.movimento_id;
  if new.valor_conciliado <= 0 or ja + new.valor_conciliado > mov_valor + 0.005 then
    raise exception 'Valor de conciliação inválido.';
  end if;

  if new.recebimento_id is not null then
    if mov_tipo <> 'CREDITO' then raise exception 'Recebimento exige crédito.'; end if;
    select empresa_id into destino_empresa from public.recebimentos where id=new.recebimento_id and apagado=false;
  else
    if mov_tipo <> 'DEBITO' then raise exception 'Despesa exige débito.'; end if;
    select empresa_id into destino_empresa from public.despesas where id=new.despesa_id and apagado=false;
  end if;

  if destino_empresa is null then raise exception 'Destino financeiro não encontrado.'; end if;
  if destino_empresa <> mov_empresa then raise exception 'Empresas divergentes na conciliação.'; end if;
  return new;
end;
$$;

drop trigger if exists trg_fin_conciliacao_validar on public.conciliacoes;
create trigger trg_fin_conciliacao_validar
before insert on public.conciliacoes
for each row execute function public.financeiro_validar_conciliacao();
