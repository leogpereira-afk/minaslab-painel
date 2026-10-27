-- Amostras e Parâmetros: parâmetro não pode duplicar na mesma amostra.
-- A importação do Histórico Analítico procurava o parâmetro já existente por parametro_id + método + unidade;
-- linhas antigas (origem GERENCIALAB_ANALITICO) tinham unidade em outro formato (ex.: "&#x00B5;g/L") ou parâmetro
-- de catálogo diferente, e a reimportação criava outra linha. Passa a procurar por parâmetro (id ou nome) + método.

do $mig$
declare d text; n text;
begin
  d := pg_get_functiondef('public.crm_process_importacao(uuid)'::regprocedure);
  n := replace(d,
    $a$and amostra_id=v_amostra_id and parametro_id=v_parametro_id and coalesce(metodo,'')=coalesce(p->>'METODO','') and coalesce(unidade,'')=coalesce(p->>'UNIDADE','') order by created_at limit 1;$a$,
    $a$and amostra_id=v_amostra_id and (parametro_id=v_parametro_id or lower(btrim(coalesce(parametro_rotulo_snapshot,'')))=lower(btrim(coalesce(v_nome,'')))) and lower(btrim(coalesce(metodo,'')))=lower(btrim(coalesce(p->>'METODO',''))) order by (source_system='GERENCIALAB') desc, created_at desc limit 1;$a$);
  if n = d then raise exception 'crm_process_importacao: trecho não encontrado'; end if;
  execute n;
end
$mig$;

-- Limpeza: mantém 1 por amostra + parâmetro + método (prioriza a linha da importação mais recente do GerenciaLab).
with ranked as (
  select id, row_number() over (
           partition by amostra_id, lower(btrim(coalesce(parametro_rotulo_snapshot,''))), lower(btrim(coalesce(metodo,'')))
           order by (source_system='GERENCIALAB') desc, updated_at desc, created_at desc) rn
    from public.amostra_parametros where deleted_at is null)
update public.amostra_parametros ap set deleted_at=now(), updated_at=now()
  from ranked where ranked.id=ap.id and ranked.rn>1;
