-- Processamento controlado de importações: STAGING -> validação/aplicação -> status final.
-- A função é idempotente por chaves naturais/external_id e exige imports.manage.

create or replace function public.crm_process_importacao(p_importacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
        select id into v_os_id from public.ordens_servico where deleted_at is null and lower(btrim(numero_os))=lower(v_numero) limit 1;
        if v_os_id is null then
          insert into public.ordens_servico(contrato_id,cliente_id,numero_os,status_os,data_recepcao,source_system,external_id,valor,origem_cadastro)
          values(v_contrato_id,v_cliente_id,v_numero,nullif(p->>'STATUS_OS',''),v_ts,'GERENCIALAB',v_numero,coalesce(v_valor,0),'IMPORTACAO') returning id into v_os_id;
        else
          update public.ordens_servico set contrato_id=coalesce(v_contrato_id,contrato_id),cliente_id=v_cliente_id,status_os=coalesce(nullif(p->>'STATUS_OS',''),status_os),data_recepcao=coalesce(v_ts,data_recepcao),valor=coalesce(v_valor,valor),sincronizada_em=now(),updated_at=now() where id=v_os_id;
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
        select id into v_contrato_id from public.contratos where deleted_at is null and numero_contrato=v_numero order by created_at desc limit 1;
        v_ativo:=upper(coalesce(p->>'ATIVO',p->>'STATUS','ATIVO')) not in ('INATIVO','INATIVA','0','FALSE','NÃO','NAO','ENCERRADO','CANCELADO');
        if v_contrato_id is null then
          insert into public.contratos(numero_contrato,cliente_id,proposta_origem_referencia,proposta_origem_id,periodicidade,status,data_inicio,source_system,external_id,ativo)
          values(v_numero,v_cliente_id,nullif(p->>'NUMERO_PROPOSTA',''),v_proposta_id,nullif(p->>'PERIODICIDADE',''),nullif(p->>'STATUS',''),v_data,'GERENCIALAB',coalesce(nullif(p->>'ID_GERENCIALAB',''),v_numero),v_ativo) returning id into v_contrato_id;
        else
          update public.contratos set cliente_id=v_cliente_id,proposta_origem_referencia=coalesce(nullif(p->>'NUMERO_PROPOSTA',''),proposta_origem_referencia),proposta_origem_id=coalesce(v_proposta_id,proposta_origem_id),periodicidade=coalesce(nullif(p->>'PERIODICIDADE',''),periodicidade),status=coalesce(nullif(p->>'STATUS',''),status),data_inicio=coalesce(v_data,data_inicio),external_id=coalesce(nullif(p->>'ID_GERENCIALAB',''),external_id),ativo=v_ativo,updated_at=now() where id=v_contrato_id;
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
$$;

revoke all on function public.crm_process_importacao(uuid) from public, anon;
grant execute on function public.crm_process_importacao(uuid) to authenticated;
