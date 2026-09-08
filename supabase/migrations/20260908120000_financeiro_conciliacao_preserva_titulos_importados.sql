create or replace function public.financeiro_aplicar_conciliacao()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  mov public.movimentos_bancarios%rowtype;
  rec public.recebimentos%rowtype;
  des public.despesas%rowtype;
  total_conciliado numeric := 0;
begin
  select * into mov from public.movimentos_bancarios where id = new.movimento_id;

  if new.recebimento_id is not null then
    select * into rec from public.recebimentos where id = new.recebimento_id;
    if rec.empresa_id is distinct from mov.empresa_id then
      raise exception 'Movimento e recebimento pertencem a empresas diferentes';
    end if;

    update public.recebimentos r
    set valor_conciliado = coalesce((select sum(c.valor_conciliado) from public.conciliacoes c where c.recebimento_id=r.id),0),
        conciliado = coalesce((select sum(c.valor_conciliado) from public.conciliacoes c where c.recebimento_id=r.id),0) >= greatest(coalesce(r.valor_recebido,0),0) - 0.005,
        updated_by = coalesce(new.conciliado_por,'sistema'), updated_at=now()
    where r.id=rec.id;
  elsif new.despesa_id is not null then
    select * into des from public.despesas where id = new.despesa_id;
    if des.empresa_id is distinct from mov.empresa_id then
      raise exception 'Movimento e despesa pertencem a empresas diferentes';
    end if;

    update public.despesas d
    set valor_conciliado = coalesce((select sum(c.valor_conciliado) from public.conciliacoes c where c.despesa_id=d.id),0),
        conciliado = coalesce((select sum(c.valor_conciliado) from public.conciliacoes c where c.despesa_id=d.id),0) >= greatest(coalesce(d.valor_pago,0),0) - 0.005,
        updated_by = coalesce(new.conciliado_por,'sistema'), updated_at=now()
    where d.id=des.id;
  end if;

  select coalesce(sum(valor_conciliado),0) into total_conciliado from public.conciliacoes where movimento_id=new.movimento_id;
  update public.movimentos_bancarios set conciliado=total_conciliado >= abs(mov.valor)-0.005, updated_at=now() where id=new.movimento_id;
  return new;
end;
$function$;
