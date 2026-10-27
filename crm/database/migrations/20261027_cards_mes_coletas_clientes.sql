-- Cards por mês: ajustes no banco.
-- 1) crm_coletas_list: o filtro de Mês passa a valer para o mês do ANO ATUAL (fuso de São Paulo),
--    em vez de somar o mesmo mês de todos os anos (mesma regra do Dashboard).
-- 2) crm_clientes_list_v2: "Oportunidades abertas" e "Valor em negociação" passam a seguir
--    p_year/p_month (pela data de criação da oportunidade).
-- Feito por substituição no corpo atual para não mudar assinatura nem o restante da lógica.

do $mig$
declare d text; n text;
begin
  d := pg_get_functiondef('public.crm_coletas_list(text,text,text,integer,uuid,text,integer,integer)'::regprocedure);
  n := replace(d, $a$extract(month from timezone('America/Sao_Paulo',b.ocorrida_em))::int=p.mon$a$,
                  $a$date_trunc('month',timezone('America/Sao_Paulo',b.ocorrida_em))=make_date(extract(year from p.local_now)::int,p.mon,1)$a$);
  n := replace(n, $a$extract(month from timezone('America/Sao_Paulo',ocorrida_em))::int=(select mon from params)$a$,
                  $a$date_trunc('month',timezone('America/Sao_Paulo',ocorrida_em))=make_date(extract(year from (select local_now from params))::int,(select mon from params),1)$a$);
  if n = d then raise exception 'crm_coletas_list: trecho não encontrado'; end if;
  execute n;

  d := pg_get_functiondef('public.crm_clientes_list_v2(text,text,text,text,integer,integer,integer,integer)'::regprocedure);
  n := replace(d, $a$and upper(coalesce(estagio,'')) not in ('GANHO','PERDIDO')),$a$,
                  $a$and upper(coalesce(estagio,'')) not in ('GANHO','PERDIDO') and (p_year is null or extract(year from timezone('America/Sao_Paulo',created_at))=p_year) and (p_month is null or extract(month from timezone('America/Sao_Paulo',created_at))=p_month)),$a$);
  if n = d then raise exception 'crm_clientes_list_v2: trecho não encontrado'; end if;
  execute n;
end
$mig$;
