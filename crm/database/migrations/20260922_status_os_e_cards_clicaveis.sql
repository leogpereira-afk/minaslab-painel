create or replace function public.crm_normalize_os_status(p_status text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when nullif(btrim(coalesce(p_status,'')),'') is null then null
    when upper(btrim(p_status)) like '%LABORATÓRIO%' or upper(btrim(p_status)) like '%LABORATORIO%' then 'EM ANDAMENTO'
    when upper(btrim(p_status)) like '%EM COLETA%' then 'AGENDADA'
    when upper(btrim(p_status)) like '%REVISÃO%' or upper(btrim(p_status)) like '%REVISAO%' then 'CONCLUÍDA'
    when upper(btrim(p_status)) like '%CANCEL%' then 'CANCELADA'
    when upper(btrim(p_status)) like '%CONCLU%' then 'CONCLUÍDA'
    else upper(btrim(p_status))
  end
$$;

revoke all on function public.crm_normalize_os_status(text) from public, anon;
grant execute on function public.crm_normalize_os_status(text) to authenticated;

CREATE OR REPLACE FUNCTION public.crm_process_importacao(p_importacao_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_tipo text;
  v_status text;
  v_total integer := 0;
  v_aplicadas integer := 0;
  v_erros integer := 0;
  v_ignoradas integer := 0;
  r record;
  p jsonb;
  v_doc text;
  v_ext text;
  v_cliente_id uuid;
  v_proposta_id uuid;
  v_contrato_id uuid;
  v_os_id uuid;
  v_amostra_id uuid;
  v_parametro_id uuid;
  v_laboratorio_id uuid;
  v_lead_id uuid;
  v_numero text;
  v_numero_raw text;
  v_suffix text;
  v_nome text;
  v_status_item text;
  v_data date;
  v_data_fim date;
  v_responsavel_coleta text;
  v_ts timestamptz;
  v_valor numeric;
  v_tipo_pessoa text;
  v_ativo boolean;
  v_tipo_execucao text;
  v_lab text;
  v_external_line text;
begin
  if v_user is null or not public.has_permission('imports.manage') then
    raise exception 'Permissão imports.manage necessária';
  end if;

  select tipo_importacao, status, total_linhas
    into v_tipo, v_status, v_total
  from public.importacoes
  where id = p_importacao_id
  for update;

  if not found then
    raise exception 'Importação não encontrada';
  end if;

  if v_status = 'APLICADA' then
    return jsonb_build_object('status','APLICADA','total',v_total,'aplicadas',v_total,'erros',0,'idempotente',true);
  end if;

  update public.importacoes set status = 'PROCESSANDO' where id = p_importacao_id;

  for r in
    select * from public.importacao_linhas
    where importacao_id = p_importacao_id
    order by numero_linha
  loop
    if r.aplicado_em is not null then
      v_aplicadas := v_aplicadas + 1;
      continue;
    end if;

    p := coalesce(r.payload_normalizado, r.payload_bruto, '{}'::jsonb);
    v_external_line := p_importacao_id::text || ':' || r.numero_linha::text;

    begin
      if v_tipo = 'GERENCIALAB_CLIENTES' then
        v_doc := regexp_replace(coalesce(p->>'CPF_CNPJ',''), '[^0-9]', '', 'g');
        v_ext := nullif(btrim(coalesce(p->>'ID_CLIENTE','')), '');
        v_nome := nullif(btrim(coalesce(p->>'RAZAO_SOCIAL', p->>'CLIENTE','')), '');
        if v_doc = '' and v_ext is null then
          raise exception 'Cliente sem CPF/CNPJ e sem ID_CLIENTE';
        end if;
        v_tipo_pessoa := case when length(v_doc)=11 then 'PF' when length(v_doc)=14 then 'PJ' else null end;
        v_ativo := upper(coalesce(p->>'STATUS','ATIVO')) not in ('INATIVO','INATIVA','0','FALSE','NÃO','NAO');

        select id into v_cliente_id
        from public.clientes
        where deleted_at is null
          and ((v_doc <> '' and cpf_cnpj_normalizado = v_doc)
            or (v_doc = '' and v_ext is not null and source_system='GERENCIALAB' and external_id=v_ext))
        order by created_at asc limit 1;

        if v_cliente_id is null then
          insert into public.clientes(tipo_pessoa,cpf_cnpj_original,cpf_cnpj_normalizado,razao_social,nome_fantasia,telefone_principal,email_principal,ativo,source_system,external_id,created_by,updated_by)
          values(v_tipo_pessoa,nullif(p->>'CPF_CNPJ',''),nullif(v_doc,''),v_nome,nullif(p->>'NOME_FANTASIA',''),nullif(p->>'TELEFONE',''),nullif(p->>'EMAIL',''),v_ativo,'GERENCIALAB',v_ext,v_user,v_user)
          returning id into v_cliente_id;
        else
          update public.clientes set
            tipo_pessoa=coalesce(v_tipo_pessoa,tipo_pessoa),
            cpf_cnpj_original=coalesce(nullif(p->>'CPF_CNPJ',''),cpf_cnpj_original),
            cpf_cnpj_normalizado=coalesce(nullif(v_doc,''),cpf_cnpj_normalizado),
            razao_social=coalesce(v_nome,razao_social),
            nome_fantasia=coalesce(nullif(p->>'NOME_FANTASIA',''),nome_fantasia),
            telefone_principal=coalesce(nullif(p->>'TELEFONE',''),telefone_principal),
            email_principal=coalesce(nullif(p->>'EMAIL',''),email_principal),
            ativo=v_ativo,
            external_id=coalesce(v_ext,external_id),
            updated_by=v_user,
            updated_at=now()
          where id=v_cliente_id;
        end if;

        update public.importacao_linhas set status_validacao='VALIDO', entidade_alvo='clientes', entidade_alvo_id=v_cliente_id,
          classificacao_conflito=case when r.entidade_alvo_id is null then 'RECONCILIADO_OU_CRIADO' else classificacao_conflito end,
          erros='[]'::jsonb, aplicado_em=now() where id=r.id;
        v_aplicadas := v_aplicadas + 1;

      elsif v_tipo = 'GERENCIALAB_PROPOSTAS' then
        v_numero_raw := btrim(coalesce(p->>'NUMERO_PROPOSTA',''));
        v_numero := substring(v_numero_raw from '([0-9]{8}/[0-9]{4})');
        if v_numero is null then raise exception 'NUMERO_PROPOSTA inválido: %', v_numero_raw; end if;
        v_suffix := upper(btrim(replace(v_numero_raw,v_numero,'')));
        if v_suffix like 'REVISAD%' then
          update public.importacao_linhas set status_validacao='VALIDO', classificacao_conflito='REVISAO_DESCARTADA', entidade_alvo='propostas', erros='[]'::jsonb, aplicado_em=now() where id=r.id;
          v_ignoradas := v_ignoradas + 1;
          continue;
        end if;
        v_doc := regexp_replace(coalesce(p->>'CPF_CNPJ',''), '[^0-9]', '', 'g');
        select id into v_cliente_id from public.clientes where deleted_at is null and cpf_cnpj_normalizado=v_doc order by created_at limit 1;
        if v_cliente_id is null then raise exception 'Cliente não localizado pelo CPF/CNPJ %', coalesce(p->>'CPF_CNPJ',''); end if;
        v_status_item := case when v_suffix in ('RECUSADA','RECUSADO','APROVADA','APROVADO','RASCUNHO') then v_suffix else upper(nullif(btrim(coalesce(p->>'STATUS','')),'')) end;
        if v_status_item='RECUSADO' then v_status_item:='RECUSADA'; end if;
        if v_status_item='APROVADO' then v_status_item:='APROVADA'; end if;
        begin
          v_data := case when coalesce(p->>'VALIDADE','') ~ '^\d{2}/\d{2}/\d{4}$' then to_date(p->>'VALIDADE','DD/MM/YYYY') when coalesce(p->>'VALIDADE','') ~ '^\d{4}-\d{2}-\d{2}$' then (p->>'VALIDADE')::date else null end;
        exception when others then v_data:=null; end;
        begin
          v_ts := case when coalesce(p->>'DATA_ENVIO','') ~ '^\d{2}/\d{2}/\d{4}$' then to_timestamp(p->>'DATA_ENVIO','DD/MM/YYYY') when coalesce(p->>'DATA_ENVIO','') ~ '^\d{4}-\d{2}-\d{2}' then (p->>'DATA_ENVIO')::timestamptz else null end;
        exception when others then v_ts:=null; end;
        begin
          v_valor := nullif(replace(replace(regexp_replace(coalesce(p->>'VALOR',''),'[^0-9,.-]','','g'),'.',''),',','.'),'')::numeric;
        exception when others then v_valor:=null; end;

        select id into v_proposta_id from public.propostas where deleted_at is null and lower(btrim(numero_proposta))=lower(v_numero) order by created_at limit 1;
        if v_proposta_id is null then
          insert into public.propostas(cliente_id,numero_proposta,solicitante_snapshot_nome,valor,status,validade,data_envio,ativo,source_system,external_id,created_by,updated_by)
          values(v_cliente_id,v_numero,nullif(p->>'SOLICITANTE',''),v_valor,v_status_item,v_data,v_ts,true,'GERENCIALAB',v_numero,v_user,v_user)
          returning id into v_proposta_id;
        else
          update public.propostas set cliente_id=v_cliente_id,solicitante_snapshot_nome=coalesce(nullif(p->>'SOLICITANTE',''),solicitante_snapshot_nome),
            valor=coalesce(v_valor,valor),status=coalesce(v_status_item,status),validade=coalesce(v_data,validade),data_envio=coalesce(v_ts,data_envio),
            source_system=coalesce(source_system,'GERENCIALAB'),external_id=coalesce(external_id,v_numero),updated_by=v_user,updated_at=now()
          where id=v_proposta_id;
        end if;
        update public.importacao_linhas set status_validacao='VALIDO', entidade_alvo='propostas', entidade_alvo_id=v_proposta_id,
          classificacao_conflito=case when v_numero_raw<>v_numero then 'NUMERO_NORMALIZADO' else 'RECONCILIADO_OU_CRIADO' end,
          payload_normalizado=p || jsonb_build_object('NUMERO_PROPOSTA',v_numero,'STATUS',v_status_item), erros='[]'::jsonb, aplicado_em=now() where id=r.id;
        v_aplicadas := v_aplicadas + 1;

      elsif v_tipo = 'GERENCIALAB_DASHBOARD' then
        v_numero := nullif(btrim(coalesce(p->>'NUMERO_OS','')), '');
        if v_numero is null then raise exception 'NUMERO_OS ausente'; end if;
        v_doc := regexp_replace(coalesce(p->>'CPF_CNPJ',''), '[^0-9]', '', 'g');
        select id into v_cliente_id from public.clientes where deleted_at is null and cpf_cnpj_normalizado=v_doc order by created_at limit 1;
        if v_cliente_id is null then raise exception 'Cliente não localizado pelo CPF/CNPJ %', coalesce(p->>'CPF_CNPJ',''); end if;
        v_contrato_id := null;
        if nullif(btrim(coalesce(p->>'NUMERO_CONTRATO','')),'') is not null then
          select id into v_contrato_id from public.contratos where deleted_at is null and numero_contrato=btrim(p->>'NUMERO_CONTRATO') order by created_at desc limit 1;
        end if;
        begin
          v_valor := nullif(replace(replace(regexp_replace(coalesce(p->>'VALOR_OS',''),'[^0-9,.-]','','g'),'.',''),',','.'),'')::numeric;
        exception when others then v_valor:=0; end;
        begin
          v_ts := case when coalesce(p->>'DATA_OS','') ~ '^\d{2}/\d{2}/\d{4}' then to_timestamp(p->>'DATA_OS',case when p->>'DATA_OS' like '%:%' then 'DD/MM/YYYY HH24:MI' else 'DD/MM/YYYY' end) else null end;
        exception when others then v_ts:=null; end;
        v_status_item := public.crm_normalize_os_status(p->>'STATUS_OS');
        select id into v_os_id from public.ordens_servico where deleted_at is null and lower(btrim(numero_os))=lower(v_numero) limit 1;
        if v_os_id is null then
          insert into public.ordens_servico(contrato_id,cliente_id,numero_os,status_os,data_recepcao,source_system,external_id,valor,origem_cadastro)
          values(v_contrato_id,v_cliente_id,v_numero,v_status_item,v_ts,'GERENCIALAB',v_numero,coalesce(v_valor,0),'IMPORTACAO') returning id into v_os_id;
        else
          update public.ordens_servico set contrato_id=coalesce(v_contrato_id,contrato_id),cliente_id=v_cliente_id,status_os=coalesce(v_status_item,status_os),data_recepcao=coalesce(v_ts,data_recepcao),valor=coalesce(v_valor,valor),sincronizada_em=now(),updated_at=now() where id=v_os_id;
        end if;
        update public.importacao_linhas set status_validacao='VALIDO',entidade_alvo='ordens_servico',entidade_alvo_id=v_os_id,erros='[]'::jsonb,aplicado_em=now() where id=r.id;
        v_aplicadas:=v_aplicadas+1;

      elsif v_tipo = 'GERENCIALAB_CONTRATOS' then
        v_numero:=nullif(btrim(coalesce(p->>'NUMERO_CONTRATO','')),'');
        if v_numero is null then raise exception 'NUMERO_CONTRATO ausente'; end if;
        v_doc:=regexp_replace(coalesce(p->>'CPF_CNPJ',''),'[^0-9]','','g');
        select id into v_cliente_id from public.clientes where deleted_at is null and cpf_cnpj_normalizado=v_doc order by created_at limit 1;
        if v_cliente_id is null then raise exception 'Cliente não localizado pelo CPF/CNPJ %',coalesce(p->>'CPF_CNPJ',''); end if;
        v_proposta_id:=null;
        if nullif(btrim(coalesce(p->>'NUMERO_PROPOSTA','')),'') is not null then select id into v_proposta_id from public.propostas where deleted_at is null and numero_proposta=btrim(p->>'NUMERO_PROPOSTA') order by created_at desc limit 1; end if;
        begin v_data:=case when coalesce(p->>'DATA_INICIO','')~'^\d{2}/\d{2}/\d{4}$' then to_date(p->>'DATA_INICIO','DD/MM/YYYY') when coalesce(p->>'DATA_INICIO','')~'^\d{4}-\d{2}-\d{2}$' then (p->>'DATA_INICIO')::date else null end; exception when others then v_data:=null; end;
        begin v_data_fim:=case when coalesce(p->>'DATA_FIM','')~'^\d{2}/\d{2}/\d{4}$' then to_date(p->>'DATA_FIM','DD/MM/YYYY') when coalesce(p->>'DATA_FIM','')~'^\d{4}-\d{2}-\d{2}$' then (p->>'DATA_FIM')::date else null end; exception when others then v_data_fim:=null; end;
        v_ext:=nullif(upper(btrim(coalesce(p->>'RESP_PELA_COLETA',''))),'');
        if v_ext is null then
          v_responsavel_coleta:=null;
        elsif v_ext like '%CLIENTE%' then
          v_responsavel_coleta:='CLIENTE';
        elsif v_ext like '%MINASLAB%' or v_ext like '%LABORAT%' then
          v_responsavel_coleta:='MINASLAB';
        else
          raise exception 'RESP_PELA_COLETA inválido: %', p->>'RESP_PELA_COLETA';
        end if;
        select id into v_contrato_id from public.contratos where deleted_at is null and numero_contrato=v_numero order by created_at desc limit 1;
        v_ativo:=upper(coalesce(p->>'ATIVO',p->>'STATUS','ATIVO')) not in ('INATIVO','INATIVA','0','FALSE','NÃO','NAO','ENCERRADO','CANCELADO');
        if v_contrato_id is null then
          insert into public.contratos(numero_contrato,cliente_id,proposta_origem_referencia,proposta_origem_id,periodicidade,status,data_inicio,data_fim,responsavel_coleta,source_system,external_id,ativo)
          values(v_numero,v_cliente_id,nullif(p->>'NUMERO_PROPOSTA',''),v_proposta_id,nullif(p->>'PERIODICIDADE',''),nullif(p->>'STATUS',''),v_data,v_data_fim,v_responsavel_coleta,'GERENCIALAB',coalesce(nullif(p->>'ID_GERENCIALAB',''),v_numero),v_ativo) returning id into v_contrato_id;
        else
          update public.contratos set cliente_id=v_cliente_id,proposta_origem_referencia=coalesce(nullif(p->>'NUMERO_PROPOSTA',''),proposta_origem_referencia),proposta_origem_id=coalesce(v_proposta_id,proposta_origem_id),periodicidade=coalesce(nullif(p->>'PERIODICIDADE',''),periodicidade),status=coalesce(nullif(p->>'STATUS',''),status),data_inicio=coalesce(v_data,data_inicio),data_fim=coalesce(v_data_fim,data_fim),responsavel_coleta=coalesce(v_responsavel_coleta,responsavel_coleta),external_id=coalesce(nullif(p->>'ID_GERENCIALAB',''),external_id),ativo=v_ativo,updated_at=now() where id=v_contrato_id;
        end if;
        update public.importacao_linhas set status_validacao='VALIDO',entidade_alvo='contratos',entidade_alvo_id=v_contrato_id,erros='[]'::jsonb,aplicado_em=now() where id=r.id;
        v_aplicadas:=v_aplicadas+1;

      elsif v_tipo = 'CATALOGO_GERENCIALAB' then
        v_ext:=nullif(btrim(coalesce(p->>'ID','')),'');
        v_nome:=nullif(btrim(coalesce(p->>'PARAMETRO','')),'');
        if v_nome is null then raise exception 'PARAMETRO ausente'; end if;
        begin v_valor:=nullif(replace(replace(regexp_replace(coalesce(p->>'PRECO',''),'[^0-9,.-]','','g'),'.',''),',','.'),'')::numeric; exception when others then v_valor:=null; end;
        select id into v_parametro_id from public.parametros where deleted_at is null and ((v_ext is not null and source_system='GERENCIALAB' and external_id=v_ext) or lower(coalesce(nome_canonico,rotulo_original,''))=lower(v_nome)) order by created_at limit 1;
        if v_parametro_id is null then
          insert into public.parametros(nome_canonico,rotulo_original,ativo,source_system,external_id,preco) values(v_nome,v_nome,true,'GERENCIALAB',v_ext,v_valor) returning id into v_parametro_id;
        else
          update public.parametros set nome_canonico=coalesce(nome_canonico,v_nome),rotulo_original=coalesce(rotulo_original,v_nome),source_system=coalesce(source_system,'GERENCIALAB'),external_id=coalesce(v_ext,external_id),preco=coalesce(v_valor,preco),updated_at=now() where id=v_parametro_id;
        end if;
        update public.importacao_linhas set status_validacao='VALIDO',entidade_alvo='parametros',entidade_alvo_id=v_parametro_id,erros='[]'::jsonb,aplicado_em=now() where id=r.id;
        v_aplicadas:=v_aplicadas+1;

      elsif v_tipo = 'GERENCIALAB_HISTORICO_ANALITICO' then
        v_numero:=nullif(btrim(coalesce(p->>'NUMERO_OS','')),'');
        if v_numero is null then raise exception 'NUMERO_OS ausente'; end if;
        select id into v_os_id from public.ordens_servico where deleted_at is null and lower(btrim(numero_os))=lower(v_numero) limit 1;
        if v_os_id is null then raise exception 'OS % não localizada; importe Dashboard/OS antes do Histórico Analítico',v_numero; end if;
        v_ext:=nullif(btrim(coalesce(p->>'AMOSTRA','')),'');
        if v_ext is null then raise exception 'AMOSTRA ausente'; end if;
        select id into v_amostra_id from public.amostras where deleted_at is null and ordem_servico_id=v_os_id and referencia_amostra=v_ext order by created_at limit 1;
        if v_amostra_id is null then
          insert into public.amostras(ordem_servico_id,referencia_amostra,descricao,grupo_snapshot,servico_snapshot,source_system,external_id)
          values(v_os_id,v_ext,v_ext,nullif(p->>'GRUPO',''),nullif(p->>'SERVICO',''),'GERENCIALAB',v_numero||'|'||v_ext) returning id into v_amostra_id;
        else
          update public.amostras set grupo_snapshot=coalesce(nullif(p->>'GRUPO',''),grupo_snapshot),servico_snapshot=coalesce(nullif(p->>'SERVICO',''),servico_snapshot),updated_at=now() where id=v_amostra_id;
        end if;
        v_nome:=nullif(btrim(coalesce(p->>'PARAMETRO','')),'');
        if v_nome is null then raise exception 'PARAMETRO ausente'; end if;
        select id into v_parametro_id from public.parametros where deleted_at is null and lower(coalesce(nome_canonico,rotulo_original,''))=lower(v_nome) order by created_at limit 1;
        if v_parametro_id is null then
          insert into public.parametros(nome_canonico,rotulo_original,ativo,source_system,external_id) values(v_nome,v_nome,true,'GERENCIALAB',lower(v_nome)) returning id into v_parametro_id;
        end if;
        v_lab:=nullif(btrim(coalesce(p->>'LABORATORIO',p->>'LABORATÓRIO','')),'');
        v_laboratorio_id:=null;
        if v_lab is null or upper(v_lab) in ('MINASLAB','MINAS LAB','MINASLAB BRASIL LTDA') then v_tipo_execucao:='INTERNO'; else
          v_tipo_execucao:='EXTERNO';
          select id into v_laboratorio_id from public.laboratorios_parceiros where deleted_at is null and lower(btrim(nome))=lower(v_lab) order by created_at limit 1;
        end if;
        select id into v_proposta_id from public.amostra_parametros where deleted_at is null and amostra_id=v_amostra_id and parametro_id=v_parametro_id and coalesce(metodo,'')=coalesce(p->>'METODO','') and coalesce(unidade,'')=coalesce(p->>'UNIDADE','') order by created_at limit 1;
        if v_proposta_id is null then
          insert into public.amostra_parametros(amostra_id,parametro_id,parametro_rotulo_snapshot,metodo,lq,ld,unidade,contexto_tecnico,source_system,external_id,tipo_execucao,laboratorio_parceiro_id)
          values(v_amostra_id,v_parametro_id,v_nome,nullif(p->>'METODO',''),nullif(p->>'LQ',''),nullif(p->>'LD',''),nullif(p->>'UNIDADE',''),jsonb_build_object('grupo',p->>'GRUPO','servico',p->>'SERVICO','laboratorio',v_lab),'GERENCIALAB',v_numero||'|'||v_ext||'|'||v_nome||'|'||coalesce(p->>'METODO',''),v_tipo_execucao,v_laboratorio_id)
          returning id into v_proposta_id;
        else
          update public.amostra_parametros set lq=coalesce(nullif(p->>'LQ',''),lq),ld=coalesce(nullif(p->>'LD',''),ld),tipo_execucao=v_tipo_execucao,laboratorio_parceiro_id=coalesce(v_laboratorio_id,laboratorio_parceiro_id),contexto_tecnico=contexto_tecnico||jsonb_build_object('laboratorio',v_lab),updated_at=now() where id=v_proposta_id;
        end if;
        update public.importacao_linhas set status_validacao='VALIDO',entidade_alvo='amostra_parametros',entidade_alvo_id=v_proposta_id,payload_normalizado=p||jsonb_build_object('LABORATORIO',v_lab),erros='[]'::jsonb,aplicado_em=now() where id=r.id;
        v_aplicadas:=v_aplicadas+1;

      elsif v_tipo = 'CRM_HISTORICO' then
        v_doc:=regexp_replace(coalesce(p->>'CPF_CNPJ',''),'[^0-9]','','g');
        select id into v_cliente_id from public.clientes where deleted_at is null and cpf_cnpj_normalizado=v_doc order by created_at limit 1;
        if v_cliente_id is null then raise exception 'Cliente não localizado pelo CPF/CNPJ %',coalesce(p->>'CPF_CNPJ',''); end if;
        if exists(select 1 from public.interacoes where source_system='IMPORTACAO_CRM' and external_id=v_external_line) then
          select id into v_proposta_id from public.interacoes where source_system='IMPORTACAO_CRM' and external_id=v_external_line limit 1;
        else
          begin v_ts:=case when coalesce(p->>'DATA_HORA','')~'^\d{2}/\d{2}/\d{4}' then to_timestamp(p->>'DATA_HORA',case when p->>'DATA_HORA' like '%:%' then 'DD/MM/YYYY HH24:MI' else 'DD/MM/YYYY' end) else now() end; exception when others then v_ts:=now(); end;
          insert into public.interacoes(ocorrido_em,tipo,descricao,cliente_id,source_system,external_id,usuario_id)
          values(v_ts,nullif(p->>'TIPO',''),coalesce(nullif(p->>'DESCRICAO',''),nullif(p->>'TITULO',''),'Histórico importado'),v_cliente_id,'IMPORTACAO_CRM',v_external_line,v_user) returning id into v_proposta_id;
        end if;
        update public.importacao_linhas set status_validacao='VALIDO',entidade_alvo='interacoes',entidade_alvo_id=v_proposta_id,erros='[]'::jsonb,aplicado_em=now() where id=r.id;
        v_aplicadas:=v_aplicadas+1;

      elsif v_tipo = 'CRM_ATENDIMENTOS' then
        v_doc:=regexp_replace(coalesce(p->>'CPF_CNPJ',''),'[^0-9]','','g');
        select id into v_cliente_id from public.clientes where deleted_at is null and cpf_cnpj_normalizado=v_doc order by created_at limit 1;
        v_lead_id:=null;
        if v_cliente_id is null then
          select id into v_lead_id from public.leads where deleted_at is null and source_system='IMPORTACAO_CRM' and external_id=v_external_line limit 1;
          if v_lead_id is null then
            begin v_ts:=case when coalesce(p->>'DATA_HORA','')~'^\d{2}/\d{2}/\d{4}' then to_timestamp(p->>'DATA_HORA',case when p->>'DATA_HORA' like '%:%' then 'DD/MM/YYYY HH24:MI' else 'DD/MM/YYYY' end) else now() end; exception when others then v_ts:=now(); end;
            insert into public.leads(nome,telefone_whatsapp,origem,assunto,resumo,status,data_primeiro_atendimento,ativo,source_system,external_id,created_by,updated_by)
            values(nullif(p->>'CLIENTE',''),nullif(p->>'TELEFONE',''),coalesce(nullif(p->>'ORIGEM',''),'Importação'),nullif(p->>'ASSUNTO',''),nullif(p->>'DESCRICAO',''),'NOVO',v_ts,true,'IMPORTACAO_CRM',v_external_line,v_user,v_user) returning id into v_lead_id;
          end if;
        end if;
        if exists(select 1 from public.atendimentos where source_system='IMPORTACAO_CRM' and external_id=v_external_line) then
          select id into v_proposta_id from public.atendimentos where source_system='IMPORTACAO_CRM' and external_id=v_external_line limit 1;
        else
          begin v_ts:=case when coalesce(p->>'DATA_HORA','')~'^\d{2}/\d{2}/\d{4}' then to_timestamp(p->>'DATA_HORA',case when p->>'DATA_HORA' like '%:%' then 'DD/MM/YYYY HH24:MI' else 'DD/MM/YYYY' end) else now() end; exception when others then v_ts:=now(); end;
          insert into public.atendimentos(lead_id,cliente_id,ocorrido_em,canal,assunto,resumo,usuario_id,source_system,external_id,created_by)
          values(v_lead_id,v_cliente_id,v_ts,coalesce(nullif(p->>'ORIGEM',''),'IMPORTACAO'),nullif(p->>'ASSUNTO',''),nullif(p->>'DESCRICAO',''),v_user,'IMPORTACAO_CRM',v_external_line,v_user) returning id into v_proposta_id;
        end if;
        update public.importacao_linhas set status_validacao='VALIDO',entidade_alvo='atendimentos',entidade_alvo_id=v_proposta_id,erros='[]'::jsonb,aplicado_em=now() where id=r.id;
        v_aplicadas:=v_aplicadas+1;

      else
        raise exception 'Tipo de importação ainda não suportado pelo processador automático: %', v_tipo;
      end if;

    exception when others then
      update public.importacao_linhas set status_validacao='ERRO', erros=jsonb_build_array(sqlerrm), classificacao_conflito='ERRO_VALIDACAO_APLICACAO' where id=r.id;
      v_erros:=v_erros+1;
    end;
  end loop;

  update public.importacoes set
    status = case when v_erros=0 then 'APLICADA' when v_aplicadas+v_ignoradas>0 then 'APLICADA_PARCIAL' else 'ERRO' end,
    linhas_validas = v_aplicadas + v_ignoradas,
    linhas_com_erro = v_erros,
    confirmado_em = now(),
    confirmado_por = v_user,
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'processamento_automatico',true,
      'processado_em',now(),
      'aplicadas',v_aplicadas,
      'ignoradas',v_ignoradas,
      'erros',v_erros
    )
  where id=p_importacao_id;

  return jsonb_build_object('status',case when v_erros=0 then 'APLICADA' when v_aplicadas+v_ignoradas>0 then 'APLICADA_PARCIAL' else 'ERRO' end,'total',v_total,'aplicadas',v_aplicadas,'ignoradas',v_ignoradas,'erros',v_erros);
end;
$function$;


revoke all on function public.crm_process_importacao(uuid) from public, anon;
grant execute on function public.crm_process_importacao(uuid) to authenticated;

update public.ordens_servico
set status_os=public.crm_normalize_os_status(status_os),updated_at=now()
where deleted_at is null and (source_system='GERENCIALAB' or source_system like 'IMPORT_OS%')
  and status_os is distinct from public.crm_normalize_os_status(status_os);

with latest as (
  select distinct on (os.contrato_id)
    os.contrato_id,
    coalesce(os.data_recepcao::date,os.data_agendamento::date,os.created_at::date) exec_date
  from public.ordens_servico os
  where os.deleted_at is null and os.contrato_id is not null
    and os.status_os='CONCLUÍDA'
  order by os.contrato_id,coalesce(os.data_recepcao,os.data_agendamento,os.created_at) desc,os.id
)
update public.recorrencias_clientes r
set ultima_execucao=l.exec_date,
    proxima_previsao=public.recorrencia_proxima_data(l.exec_date,r.periodicidade),
    antecedencia_dias=public.recorrencia_antecedencia(r.periodicidade),
    proximo_contato_em=case
      when public.recorrencia_proxima_data(l.exec_date,r.periodicidade) is null then null
      else public.recorrencia_proxima_data(l.exec_date,r.periodicidade)-public.recorrencia_antecedencia(r.periodicidade)
    end,
    status=case when r.status='PAUSADO' then r.status else 'A CONTATAR' end,
    previsao_manual=false,
    updated_at=now()
from latest l
where r.ativo=true and r.contrato_id=l.contrato_id;


-- Permite que os cards usem os mesmos filtros no servidor.
CREATE OR REPLACE FUNCTION public.crm_coletas_list(p_query text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_period text DEFAULT NULL::text, p_month integer DEFAULT NULL::integer, p_collector uuid DEFAULT NULL::uuid, p_city text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with params as (
 select nullif(trim(coalesce(p_query,'')),'') q,nullif(trim(coalesce(p_status,'')),'') st,
 upper(nullif(trim(coalesce(p_period,'')),'')) per,p_month mon,p_collector collector,
 nullif(trim(coalesce(p_city,'')),'') city,greatest(1,coalesce(p_page,1)) pg,
 least(100,greatest(1,coalesce(p_page_size,10))) psz,timezone('America/Sao_Paulo',now()) local_now
), base as (
 select c.id,c.agendamento_id,c.ordem_servico_id,c.numero_os_referencia,c.proposta_id,c.numero_proposta_referencia,
 c.cliente_id,c.contrato_id,c.recorrencia_id,c.coletor_id,c.realizada_pelo_cliente,c.ocorrida_em,c.status,c.observacoes,c.endereco_evento,c.updated_at,
 coalesce(os.numero_os,c.numero_os_referencia) numero_os,coalesce(pr.numero_proposta,c.numero_proposta_referencia) numero_proposta,
 coalesce(c.cliente_id,os.cliente_id,pr.cliente_id,ag.cliente_id) cliente_id_resolvido,
 coalesce(cl.nome_fantasia,cl.razao_social,'Cliente não informado') client,
 case when c.realizada_pelo_cliente then 'Coleta feita pelo cliente' else coalesce(prof.nome,'Sem coletor') end collector,
 prof.avatar_url collector_avatar,
 coalesce(nullif(addr.cidade,''),nullif(trim(substring(c.endereco_evento from '([^-/]+)\\/[A-Za-z]{2}')),''),'Não informada') city,
 (ag.external_calendar_id is not null) synced,
 case when coalesce(os.numero_os,c.numero_os_referencia) is not null then 'OS '||coalesce(os.numero_os,c.numero_os_referencia)
      when coalesce(pr.numero_proposta,c.numero_proposta_referencia) is not null then 'Proposta '||coalesce(pr.numero_proposta,c.numero_proposta_referencia)
      when ct.numero_contrato is not null then 'Contrato '||ct.numero_contrato
      when c.cliente_id is not null then 'Cliente recorrente'
      else 'Sem vínculo' end reference_label
 from public.coletas c
 left join public.ordens_servico os on os.id=c.ordem_servico_id and os.deleted_at is null
 left join public.propostas pr on pr.id=c.proposta_id and pr.deleted_at is null
 left join public.agendamentos ag on ag.id=c.agendamento_id and ag.deleted_at is null
 left join public.contratos ct on ct.id=c.contrato_id and ct.deleted_at is null
 left join public.clientes cl on cl.id=coalesce(c.cliente_id,os.cliente_id,pr.cliente_id,ag.cliente_id) and cl.deleted_at is null
 left join public.profiles prof on prof.id=c.coletor_id
 left join lateral (
   select e.cidade from public.enderecos e
   where e.cliente_id=coalesce(c.cliente_id,os.cliente_id,pr.cliente_id,ag.cliente_id) and e.ativo=true and e.deleted_at is null
   order by e.created_at asc limit 1
 ) addr on true
 where c.deleted_at is null
), filtered as (
 select b.* from base b,params p
 where (p.q is null or concat_ws(' ',b.reference_label,b.client,b.collector,b.endereco_evento,b.city) ilike '%'||p.q||'%')
 and (p.st is null or p.st='TODOS' or b.status=p.st)
 and (p.collector is null or b.coletor_id=p.collector)
 and (p.city is null or p.city='TODAS' or b.city=p.city)
 and (p.mon is null or extract(month from timezone('America/Sao_Paulo',b.ocorrida_em))::int=p.mon)
 and (p.per is null or p.per='TODOS'
  or (p.per='ATRASADAS' and b.ocorrida_em is not null and coalesce(b.status,'') not in ('COLETADA','CANCELADA') and b.ocorrida_em<now())
  or (p.per='HOJE' and timezone('America/Sao_Paulo',b.ocorrida_em)::date=p.local_now::date)
  or (p.per='ESTE MÊS' and date_trunc('month',timezone('America/Sao_Paulo',b.ocorrida_em))=date_trunc('month',p.local_now))
  or (p.per='7 DIAS' and b.ocorrida_em between now() and now()+interval '7 days')
  or (p.per='30 DIAS' and b.ocorrida_em between now() and now()+interval '30 days')
  or (p.per='SEM COLETOR' and b.coletor_id is null and not b.realizada_pelo_cliente and coalesce(b.status,'')<>'CANCELADA'))
), counts as (
 select count(*)::int total,count(*) filter(where status='COLETADA')::int completed,
 count(*) filter(where ocorrida_em is not null and coalesce(status,'') not in ('COLETADA','CANCELADA') and ocorrida_em between now() and now()+interval '7 days')::int week,
 count(*) filter(where city<>'Não informada' and upper(translate(city,'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ','AAAAEEEIIIOOOOUUUC')) not like '%MONTES CLAROS%')::int outside,
 count(*) filter(where endereco_evento is null or trim(endereco_evento)='')::int no_address from filtered
), cards as (
 select count(*) filter(where status='AGENDADA' and timezone('America/Sao_Paulo',ocorrida_em)::date=(select local_now::date from params))::int today_scheduled,
 count(*) filter(where status='EM COLETA')::int in_route,
 count(*) filter(where status='COLETADA' and (((select mon from params) is null and date_trunc('month',timezone('America/Sao_Paulo',ocorrida_em))=date_trunc('month',(select local_now from params))) or ((select mon from params) is not null and extract(month from timezone('America/Sao_Paulo',ocorrida_em))::int=(select mon from params))))::int collected_month,
 count(*) filter(where ocorrida_em is not null and coalesce(status,'') not in ('COLETADA','CANCELADA') and ocorrida_em<now())::int late,
 count(*) filter(where coletor_id is null and not realizada_pelo_cliente and coalesce(status,'')<>'CANCELADA')::int no_collector
 from base where (select mon from params) is null or extract(month from timezone('America/Sao_Paulo',ocorrida_em))::int=(select mon from params)
), page_rows as (
 select * from filtered order by ocorrida_em asc nulls last,id
 limit (select psz from params) offset ((select pg from params)-1)*(select psz from params)
), cities as (
 select coalesce(jsonb_agg(city order by city),'[]'::jsonb) value from (select distinct city from base where city is not null)x
)
select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page_rows) order by ocorrida_em asc nulls last,id) from page_rows),'[]'::jsonb),
'total',(select total from counts),
'summary',jsonb_build_object('completed',(select completed from counts),'rate',case when (select total from counts)>0 then round((select completed from counts)*100.0/(select total from counts))::int else 0 end,'week',(select week from counts),'outside',(select outside from counts),'noAddress',(select no_address from counts)),
'cards',jsonb_build_object('todayScheduled',(select today_scheduled from cards),'inRoute',(select in_route from cards),'collectedMonth',(select collected_month from cards),'late',(select late from cards),'noCollector',(select no_collector from cards)),
'cities',(select value from cities));
$function$;

CREATE OR REPLACE FUNCTION public.crm_clientes_list(p_query text DEFAULT ''::text, p_status text DEFAULT 'TODOS'::text, p_segment text DEFAULT 'TODOS'::text, p_responsible text DEFAULT 'TODOS'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
with settings as (select btrim(coalesce(p_query,'')) q, coalesce(p_status,'TODOS') status_filter, coalesce(p_segment,'TODOS') segment_filter, coalesce(p_responsible,'TODOS') responsible_filter),
opp_stats as (select cliente_id,count(*)::integer opportunity_count from public.oportunidades where deleted_at is null group by cliente_id),
proposal_stats as (select cliente_id,count(*)::integer proposal_count from public.propostas where deleted_at is null group by cliente_id),
last_interaction as (select distinct on (cliente_id) cliente_id,ocorrido_em last_interaction_at,tipo last_interaction_type from public.interacoes where cliente_id is not null order by cliente_id,ocorrido_em desc),
base as (select c.id,c.tipo_pessoa,c.cpf_cnpj_original,c.razao_social,c.nome_fantasia,c.telefone_principal,c.email_principal,c.segmento,c.origem,c.responsavel_comercial_id,c.status_comercial,c.observacoes_comerciais,c.ativo,c.created_at,coalesce(os.opportunity_count,0) opportunity_count,coalesce(ps.proposal_count,0) proposal_count,li.last_interaction_at,li.last_interaction_type from public.clientes c left join opp_stats os on os.cliente_id=c.id left join proposal_stats ps on ps.cliente_id=c.id left join last_interaction li on li.cliente_id=c.id where c.deleted_at is null),
filtered as (select b.* from base b cross join settings s where (s.q='' or position(lower(s.q) in lower(concat_ws(' ',coalesce(nullif(b.nome_fantasia,''),b.razao_social),b.razao_social,b.cpf_cnpj_original,b.telefone_principal,b.email_principal)))>0) and (s.status_filter='TODOS' or (s.status_filter='ATIVOS' and b.ativo and coalesce(b.status_comercial,'')<>'CLIENTE INATIVO') or (s.status_filter='INATIVOS' and (not b.ativo or b.status_comercial='CLIENTE INATIVO')) or b.status_comercial=s.status_filter) and (s.segment_filter='TODOS' or b.segmento=s.segment_filter) and (s.responsible_filter='TODOS' or b.responsavel_comercial_id::text=s.responsible_filter)),
paged as (select f.* from filtered f order by f.created_at desc,f.id offset ((greatest(coalesce(p_page,1),1)-1)*least(greatest(coalesce(p_page_size,10),1),100)) limit least(greatest(coalesce(p_page_size,10),1),100)),
open_opportunities as (select count(*)::integer open_count,coalesce(sum(valor_estimado),0)::numeric negotiation_value from public.oportunidades where deleted_at is null and upper(coalesce(status,'')) not in ('GANHA','PERDIDA','CANCELADA') and upper(coalesce(estagio,'')) not in ('GANHO','PERDIDO')),
all_stats as (select count(*)::integer total_clients,count(*) filter(where ativo and coalesce(status_comercial,'')<>'CLIENTE INATIVO')::integer active_clients,count(*) filter(where status_comercial='PROSPECT' and ativo)::integer prospects,count(*) filter(where not ativo or status_comercial='CLIENTE INATIVO')::integer inactive_clients,count(*) filter(where last_interaction_at is null)::integer clients_without_interaction,coalesce(jsonb_agg(distinct responsavel_comercial_id) filter(where responsavel_comercial_id is not null),'[]'::jsonb) responsible_ids from base),
filtered_stats as (select count(*)::integer total_filtered from filtered)
select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from paged p),'[]'::jsonb),'total',fs.total_filtered,'stats',jsonb_build_object('totalClients',ast.total_clients,'activeClients',ast.active_clients,'prospects',ast.prospects,'inactiveClients',ast.inactive_clients,'openOpportunities',oo.open_count,'negotiationValue',oo.negotiation_value,'clientsWithoutInteraction',ast.clients_without_interaction,'responsibleIds',ast.responsible_ids)) from all_stats ast cross join filtered_stats fs cross join open_opportunities oo;
$function$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_list(p_query text DEFAULT NULL::text, p_stage text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_responsible uuid DEFAULT NULL::uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with settings as (
  select greatest(coalesce(p_page,1),1) as page_no,
         least(greatest(coalesce(p_page_size,25),1),100) as page_size,
         nullif(btrim(p_query),'') as q
), base as (
  select
    o.id,o.cliente_id,o.titulo,o.valor_estimado,o.estagio,o.status,o.responsavel_id,o.previsao_fechamento,o.created_at,
    coalesce(c.nome_fantasia,c.razao_social,'Cliente não informado') as cliente_nome,
    pr.nome as responsavel_nome, pr.avatar_url as responsavel_avatar,
    case
      when upper(coalesce(o.status,''))='CANCELADA' then 'CANCELADA'
      when upper(coalesce(o.estagio,''))='GANHO' or upper(coalesce(o.status,''))='GANHA' then 'GANHA'
      when upper(coalesce(o.estagio,''))='PERDIDO' or upper(coalesce(o.status,''))='PERDIDA' then 'PERDIDA'
      else 'ABERTA'
    end as lifecycle_status
  from public.oportunidades o
  left join public.clientes c on c.id=o.cliente_id and c.deleted_at is null
  left join public.profiles pr on pr.id=o.responsavel_id
  where o.deleted_at is null
), filtered as (
  select b.*
  from base b, settings s
  where (s.q is null or (coalesce(b.titulo,'') || ' ' || coalesce(b.cliente_nome,'')) ilike '%' || s.q || '%')
    and (p_stage is null or p_stage='' or p_stage='TODAS' or b.estagio=p_stage)
    and (p_status is null or p_status='' or p_status='TODOS' or (p_status='ENCERRADAS' and b.lifecycle_status in ('GANHA','PERDIDA')) or b.lifecycle_status=p_status)
    and (p_responsible is null or b.responsavel_id=p_responsible)
), page_rows as (
  select * from filtered
  order by created_at desc, id desc
  offset (greatest(coalesce(p_page,1),1)-1) * least(greatest(coalesce(p_page_size,25),1),100)
  limit least(greatest(coalesce(p_page_size,25),1),100)
), stats as (
  select
    count(*) filter (where lifecycle_status='ABERTA')::int as open_count,
    count(*) filter (where lifecycle_status='GANHA')::int as won_count,
    count(*) filter (where lifecycle_status='PERDIDA')::int as lost_count,
    coalesce(sum(valor_estimado) filter (where lifecycle_status='ABERTA'),0)::numeric as open_value,
    case when count(*) filter (where lifecycle_status in ('GANHA','PERDIDA'))>0
      then round(100.0 * count(*) filter (where lifecycle_status='GANHA') / count(*) filter (where lifecycle_status in ('GANHA','PERDIDA')),1)
      else 0 end as conversion
  from base
)
select jsonb_build_object(
  'rows', coalesce((select jsonb_agg(to_jsonb(r)) from page_rows r),'[]'::jsonb),
  'total', (select count(*) from filtered),
  'stats', (select to_jsonb(s) from stats s)
);
$function$;
