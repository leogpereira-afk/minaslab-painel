-- Catálogo GerenciaLab: modelo de importação ganha a coluna LABORATORIO.
-- LABORATORIO vazio ou MinasLab = execução INTERNA; nome de laboratório parceiro ativo = EXTERNA
-- (comparação sem acento/maiúscula, aceita "Campo Análises"). Laboratório desconhecido = erro na linha.
-- Também passa a: localizar o parâmetro pelo ID do catálogo (GERENCIALAB_CATALOGO), gravar PRECO_MINIMO
-- e atualizar o vínculo grupo × parâmetro (catalogo_grupo_parametros).
-- Planilhas no modelo antigo (sem LABORATORIO) só atualizam preços, sem desfazer nomes/laboratórios.
-- Aplica um patch no ramo CATALOGO_GERENCIALAB de crm_process_importacao (função completa em
-- 20260914_importacoes_processamento_completo.sql). Pode ser executado mais de uma vez.
do $do$
declare
  d text;
  novo text := $n$elsif v_tipo = 'CATALOGO_GERENCIALAB' then
        -- Catálogo GerenciaLab: ID, GRUPO, PARAMETRO, PRECO, PRECO_MINIMO e LABORATORIO.
        -- LABORATORIO vazio ou MinasLab = execução interna; demais = laboratório parceiro cadastrado.
        v_ext:=nullif(btrim(coalesce(p->>'ID','')),'');
        v_nome:=nullif(btrim(coalesce(p->>'PARAMETRO','')),'');
        if v_nome is null then raise exception 'PARAMETRO ausente'; end if;
        v_grupo:=nullif(btrim(coalesce(p->>'GRUPO','')),'');
        begin v_valor:=nullif(replace(replace(regexp_replace(coalesce(p->>'PRECO',''),'[^0-9,.-]','','g'),'.',''),',','.'),'')::numeric; exception when others then v_valor:=null; end;
        begin v_preco_minimo:=nullif(replace(replace(regexp_replace(coalesce(p->>'PRECO_MINIMO',''),'[^0-9,.-]','','g'),'.',''),',','.'),'')::numeric; exception when others then v_preco_minimo:=null; end;
        v_lab:=nullif(btrim(coalesce(p->>'LABORATORIO','')),'');
        v_laboratorio_id:=null;
        v_tipo_execucao:='INTERNA';
        if v_lab is not null and translate(lower(v_lab),'áàâãäéèêëíìîïóòôõöúùûüç ','aaaaaeeeeiiiiooooouuuuc') not like 'minaslab%' then
          v_tipo_execucao:='EXTERNA';
          select l.id into v_laboratorio_id from public.laboratorios_parceiros l
           where l.deleted_at is null and l.ativo
             and (translate(lower(l.nome),'áàâãäéèêëíìîïóòôõöúùûüç ','aaaaaeeeeiiiiooooouuuuc') like translate(lower(v_lab),'áàâãäéèêëíìîïóòôõöúùûüç ','aaaaaeeeeiiiiooooouuuuc')||'%'
               or translate(lower(v_lab),'áàâãäéèêëíìîïóòôõöúùûüç ','aaaaaeeeeiiiiooooouuuuc') like translate(lower(l.nome),'áàâãäéèêëíìîïóòôõöúùûüç ','aaaaaeeeeiiiiooooouuuuc')||'%')
           order by (l.cpf_cnpj is not null) desc, l.created_at limit 1;
          if v_laboratorio_id is null then raise exception 'LABORATORIO "%" não cadastrado em Laboratórios parceiros', v_lab; end if;
        end if;
        v_grupo_id:=null;
        if v_grupo is not null then
          select id into v_grupo_id from public.grupos where deleted_at is null and lower(btrim(nome))=lower(v_grupo) order by created_at limit 1;
          if v_grupo_id is null then
            insert into public.grupos(nome,ativo,source_system) values(v_grupo,true,'GERENCIALAB_CATALOGO') returning id into v_grupo_id;
          end if;
        end if;
        v_parametro_id:=null;
        if v_ext is not null then
          select id into v_parametro_id from public.parametros where deleted_at is null and external_id=v_ext and source_system in ('GERENCIALAB_CATALOGO','GERENCIALAB')
           order by (source_system='GERENCIALAB_CATALOGO') desc, created_at limit 1;
        else
          select id into v_parametro_id from public.parametros where deleted_at is null and lower(btrim(nome_canonico))=lower(v_nome)
             and coalesce(execucao_padrao,'INTERNA')=v_tipo_execucao and laboratorio_parceiro_padrao_id is not distinct from v_laboratorio_id
           order by created_at limit 1;
        end if;
        if v_parametro_id is null then
          insert into public.parametros(nome_canonico,rotulo_original,ativo,source_system,external_id,preco,preco_minimo,execucao_padrao,laboratorio_parceiro_padrao_id)
          values(v_nome,v_nome,true,'GERENCIALAB_CATALOGO',v_ext,v_valor,coalesce(v_preco_minimo,0),v_tipo_execucao,v_laboratorio_id) returning id into v_parametro_id;
        elsif p ? 'LABORATORIO' then
          -- Modelo novo (com LABORATORIO): nome e laboratório da planilha passam a valer.
          update public.parametros set nome_canonico=v_nome,rotulo_original=v_nome,preco=coalesce(v_valor,preco),preco_minimo=coalesce(v_preco_minimo,preco_minimo),
            execucao_padrao=v_tipo_execucao,laboratorio_parceiro_padrao_id=v_laboratorio_id,external_id=coalesce(external_id,v_ext),updated_at=now() where id=v_parametro_id;
        else
          -- Modelo antigo (sem LABORATORIO): só preços, para não desfazer nomes e laboratórios já corrigidos.
          update public.parametros set preco=coalesce(v_valor,preco),preco_minimo=coalesce(v_preco_minimo,preco_minimo),external_id=coalesce(external_id,v_ext),updated_at=now() where id=v_parametro_id;
        end if;
        if v_grupo_id is not null then
          update public.catalogo_grupo_parametros set grupo_id=v_grupo_id,parametro_id=v_parametro_id,preco=coalesce(v_valor,preco),preco_minimo=coalesce(v_preco_minimo,preco_minimo),updated_at=now()
           where deleted_at is null and ((v_ext is not null and external_id=v_ext) or (v_ext is null and grupo_id=v_grupo_id and parametro_id=v_parametro_id));
          if not found then
            insert into public.catalogo_grupo_parametros(grupo_id,parametro_id,external_id,preco,preco_minimo,ativo,source_system)
            values(v_grupo_id,v_parametro_id,v_ext,coalesce(v_valor,0),coalesce(v_preco_minimo,0),true,'GERENCIALAB_CATALOGO');
          end if;
        end if;
        update public.importacao_linhas set status_validacao='VALIDO',entidade_alvo='parametros',entidade_alvo_id=v_parametro_id,erros='[]'::jsonb,aplicado_em=now() where id=r.id;
        v_aplicadas:=v_aplicadas+1;$n$;
begin
  d := pg_get_functiondef('public.crm_process_importacao(uuid)'::regprocedure);
  if d !~ 'elsif v_tipo = ''CATALOGO_GERENCIALAB'' then' then
    raise exception 'Ramo CATALOGO_GERENCIALAB não encontrado em crm_process_importacao';
  end if;
  d := regexp_replace(d, 'elsif v_tipo = ''CATALOGO_GERENCIALAB'' then.*?v_aplicadas:=v_aplicadas\+1;', novo);
  if position('v_preco_minimo numeric;' in d) = 0 then
    d := replace(d, E'  v_external_line text;\nbegin', E'  v_external_line text;\n  v_preco_minimo numeric;\n  v_grupo_id uuid;\n  v_grupo text;\nbegin');
  end if;
  if position('v_grupo text;' in d) = 0 then
    raise exception 'Não foi possível declarar as variáveis novas';
  end if;
  execute d;
end $do$;
