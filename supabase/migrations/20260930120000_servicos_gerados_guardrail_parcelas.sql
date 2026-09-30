-- Serviços Gerados: a trava de status das OS agrupadas passa a entender parcelas do Omie.
-- Antes, com a OS vinculada a uma parcela (ex.: 003/003), o total do grupo era comparado
-- com o valor dessa parcela só (divergência falsa) e uma parcela paga marcava o grupo
-- inteiro como PAGO. Agora as parcelas do mesmo pedido, NF, cliente e quantidade de
-- parcelas são somadas, e o status é o do conjunto — mesma regra da conferência
-- (ml-financeiro-servicos-sync-v2).

create or replace function public.guardrail_status_pagamento_grupo()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  gid uuid; v_total numeric; v_recs int; v_rec uuid; r public.recebimentos%rowtype;
  v_parc text; v_tot int; v_ped text;
  v_status text; v_valor numeric; v_qtd int;
begin
  if new.pagamento_manual=true or new.status_pagamento is not distinct from old.status_pagamento then return new; end if;
  select grupo_id into gid from public.servicos_gerados_grupos_itens where servico_id=new.id limit 1;
  if gid is null then return new; end if;
  select sum(coalesce(s.valor_faturar,s.valor_original,0)), count(distinct s.recebimento_id) filter(where s.recebimento_id is not null), min(s.recebimento_id::text)::uuid
    into v_total,v_recs,v_rec
    from public.servicos_gerados_grupos_itens gi join public.servicos_gerados s on s.id=gi.servico_id and s.apagado=false where gi.grupo_id=gid;
  if v_recs<>1 or v_rec is null then return new; end if;
  select * into r from public.recebimentos where id=v_rec and apagado=false;
  if not found then return new; end if;

  v_status := upper(coalesce(r.status,''));
  v_valor := coalesce(r.valor_previsto,0);
  v_qtd := 1;

  v_parc := coalesce(nullif(btrim(r.numero_parcela),''), r.dados_omie->>'numero_parcela');
  v_ped := ltrim(coalesce(r.dados_omie->>'numero_pedido', r.codigo_lancamento_integracao, ''),'0');
  if upper(coalesce(r.origem,''))='OMIE' and v_parc ~ '^\s*\d+\s*/\s*\d+\s*$' and v_ped<>'' then
    v_tot := split_part(regexp_replace(v_parc,'\s','','g'),'/',2)::int;
    if v_tot>1 then
      with irmas as (
        select distinct on (split_part(regexp_replace(coalesce(nullif(btrim(x.numero_parcela),''),x.dados_omie->>'numero_parcela'),'\s','','g'),'/',1)::int)
               upper(coalesce(x.status,'')) st, coalesce(x.valor_previsto,0) valor
          from public.recebimentos x
         where x.apagado=false and upper(coalesce(x.origem,''))='OMIE' and x.empresa_id=r.empresa_id
           and ltrim(coalesce(x.dados_omie->>'numero_pedido', x.codigo_lancamento_integracao, ''),'0')=v_ped
           and ltrim(upper(coalesce(x.numero_nf,'')),'0')=ltrim(upper(coalesce(r.numero_nf,'')),'0')
           and regexp_replace(coalesce(x.cnpj_cpf,''),'\D','','g')=regexp_replace(coalesce(r.cnpj_cpf,''),'\D','','g')
           and coalesce(nullif(btrim(x.numero_parcela),''),x.dados_omie->>'numero_parcela') ~ '^\s*\d+\s*/\s*\d+\s*$'
           and split_part(regexp_replace(coalesce(nullif(btrim(x.numero_parcela),''),x.dados_omie->>'numero_parcela'),'\s','','g'),'/',2)::int=v_tot
         order by split_part(regexp_replace(coalesce(nullif(btrim(x.numero_parcela),''),x.dados_omie->>'numero_parcela'),'\s','','g'),'/',1)::int,
                  (upper(coalesce(x.status,''))='CANCELADO'), x.id
      ), ativas as (select * from irmas where st<>'CANCELADO')
      select case
               when not exists(select 1 from ativas) then 'CANCELADO'
               when bool_and(st='PAGO') then 'PAGO'
               when bool_or(st='VENCIDO') then 'VENCIDO'
               when bool_or(st in ('PAGO','PARCIAL')) then 'PARCIAL'
               else 'A RECEBER' end,
             coalesce(sum(valor),0), greatest(count(*),1)
        into v_status, v_valor, v_qtd
        from ativas;
      if v_status='CANCELADO' then
        select coalesce(sum(valor),0), greatest(count(*),1) into v_valor, v_qtd from irmas;
      end if;
    end if;
  end if;

  -- Tolerância de 1 centavo por parcela: o Omie arredonda cada parcela.
  if v_status='PAGO' then new.status_pagamento:='PAGO';
  elsif abs(coalesce(v_total,0)-v_valor)>0.01*v_qtd then new.status_pagamento:='DIVERGENCIA';
  elsif v_status='VENCIDO' then new.status_pagamento:='VENCIDO';
  elsif v_status='CANCELADO' then new.status_pagamento:='CANCELADO';
  elsif v_status='PARCIAL' then new.status_pagamento:='PARCIAL';
  else new.status_pagamento:='A RECEBER'; end if;
  return new;
end $function$;
