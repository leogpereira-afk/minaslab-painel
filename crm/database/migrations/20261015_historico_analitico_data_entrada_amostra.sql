-- Histórico Analítico: a amostra criada pela importação passa a receber
-- data_entrada = DATA_OS do arquivo (fallback: data da OS). Sem isso o filtro
-- por mês/ano de Amostras e Parâmetros não encontrava as amostras importadas
-- (ex.: setembro/2026 mostrava 49 de 471 amostras).
-- Aplicada no Supabase como "historico_analitico_data_entrada_amostra"; altera
-- trechos de crm_process_importacao por substituição de texto, com verificação.
do $mig$
declare
  d text := pg_get_functiondef('public.crm_process_importacao(uuid)'::regprocedure);
  s_sel text := 'select id into v_amostra_id from public.amostras where deleted_at is null and ordem_servico_id=v_os_id and referencia_amostra=v_ext order by created_at limit 1;';
  s_ins text := 'insert into public.amostras(ordem_servico_id,referencia_amostra,descricao,grupo_snapshot,servico_snapshot,source_system,external_id)
          values(v_os_id,v_ext,v_ext,nullif(p->>''GRUPO'',''''),nullif(p->>''SERVICO'',''''),''GERENCIALAB'',v_numero||''|''||v_ext) returning id into v_amostra_id;';
  s_upd text := 'update public.amostras set grupo_snapshot=coalesce(nullif(p->>''GRUPO'',''''),grupo_snapshot),';
begin
  if position(s_sel in d)=0 or position(s_ins in d)=0 or position(s_upd in d)=0 then
    raise exception 'Trechos esperados não encontrados em crm_process_importacao; nada alterado';
  end if;
  d := replace(d, s_sel, s_sel || '
        begin
          v_ts := case when coalesce(p->>''DATA_OS'','''') ~ ''^\d{2}/\d{2}/\d{4}''
                       then (to_timestamp(p->>''DATA_OS'', case when p->>''DATA_OS'' like ''%:%'' then ''DD/MM/YYYY HH24:MI'' else ''DD/MM/YYYY'' end)::timestamp at time zone ''America/Sao_Paulo'')
                  end;
        exception when others then v_ts := null;
        end;
        if v_ts is null then
          select coalesce(o.data_recepcao, o.data_agendamento) into v_ts from public.ordens_servico o where o.id = v_os_id;
        end if;');
  d := replace(d, s_ins, 'insert into public.amostras(ordem_servico_id,referencia_amostra,descricao,grupo_snapshot,servico_snapshot,source_system,external_id,data_entrada)
          values(v_os_id,v_ext,v_ext,nullif(p->>''GRUPO'',''''),nullif(p->>''SERVICO'',''''),''GERENCIALAB'',v_numero||''|''||v_ext,v_ts) returning id into v_amostra_id;');
  d := replace(d, s_upd, s_upd || 'data_entrada=coalesce(data_entrada,v_ts),');
  execute d;
end
$mig$;

-- Correção dos dados existentes (executada em 15/10/2026):
-- 573 amostras sem data receberam a DATA_OS das linhas de importação;
-- 18 restantes (importações antigas) receberam a data da OS.
