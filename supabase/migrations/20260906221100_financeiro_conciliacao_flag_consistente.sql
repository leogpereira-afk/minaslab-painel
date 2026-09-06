create or replace function public.financeiro_proteger_flag_conciliado()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  total_conciliado numeric := 0;
begin
  if new.conciliado is distinct from old.conciliado then
    select coalesce(sum(valor_conciliado),0) into total_conciliado
    from public.conciliacoes where movimento_id = new.id;
    new.conciliado := total_conciliado >= new.valor - 0.005;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fin_movimento_conciliado_guard on public.movimentos_bancarios;
create trigger trg_fin_movimento_conciliado_guard
before update of conciliado on public.movimentos_bancarios
for each row execute function public.financeiro_proteger_flag_conciliado();
