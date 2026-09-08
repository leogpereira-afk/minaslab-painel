create or replace function public.financeiro_proteger_flag_conciliado()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  total_conciliado numeric := 0;
  omie_conciliado boolean := false;
begin
  if new.conciliado is distinct from old.conciliado then
    omie_conciliado := new.origem = 'OMIE'
      and coalesce(new.dados_omie->>'cSituacao','') = 'Conciliado'
      and coalesce(new.dados_omie->>'cOrigem','') not in ('Conta Recebida','Conta Paga');

    if omie_conciliado then
      new.conciliado := true;
    else
      select coalesce(sum(valor_conciliado),0) into total_conciliado
      from public.conciliacoes where movimento_id = new.id;
      new.conciliado := total_conciliado >= new.valor - 0.005;
    end if;
  end if;
  return new;
end;
$$;
