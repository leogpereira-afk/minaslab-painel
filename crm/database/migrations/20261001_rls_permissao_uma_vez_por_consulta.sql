-- Auditoria 2026-10-01: as regras de leitura chamavam has_permission() uma vez por LINHA.
-- Envolver a chamada num SELECT escalar faz o Postgres avaliá-la uma vez por consulta
-- (InitPlan). Mesma técnica de 20260921_coletas_rls_performance.sql; não muda quem vê o quê.
-- Ex.: filtros de Amostras caíram de 6,2 s para 0,09 s; lista de OS de 2,3 s para 0,13 s.
do $$
declare
  r record;
  nova text;
begin
  for r in
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and qual ~ 'has_permission'
      and qual !~ '\(\s*SELECT\s+(public\.)?has_permission'
  loop
    nova := regexp_replace(r.qual, 'has_permission\(''([a-z._]+)''::text\)', '(select public.has_permission(''\1''::text))', 'g');
    execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, nova);
  end loop;
end $$;
