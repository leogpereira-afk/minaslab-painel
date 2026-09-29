-- Radar automático PNCP: fila de revisão antes da conversão em Licitação.
create extension if not exists http with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create schema if not exists private;

create table public.licitacao_oportunidades (
 id uuid primary key default gen_random_uuid(),
 numero_controle_pncp text not null unique,
 numero_compra text, processo text, orgao text not null, cnpj_orgao text,
 unidade text, municipio text, uf text, modalidade text, objeto text not null,
 data_publicacao timestamptz, data_abertura_proposta timestamptz, data_encerramento_proposta timestamptz,
 valor_estimado numeric(14,2), portal_url text, pncp_url text not null,
 palavras_encontradas text[] not null default '{}', prioridade text not null default 'MEDIA' check(prioridade in ('ALTA','MEDIA')),
 status text not null default 'NOVA' check(status in ('NOVA','APROVADA','DESCARTADA')),
 licitacao_id uuid references public.licitacoes(id) on delete set null,
 payload jsonb not null default '{}', encontrada_em timestamptz not null default now(), atualizada_em timestamptz not null default now(),
 revisada_em timestamptz, revisada_por uuid references auth.users(id) on delete set null
);
create index licitacao_oportunidades_status_idx on public.licitacao_oportunidades(status,encontrada_em desc);
create index licitacao_oportunidades_prazo_idx on public.licitacao_oportunidades(data_encerramento_proposta) where status='NOVA';
alter table public.licitacao_oportunidades enable row level security;
create policy licitacao_oportunidades_read on public.licitacao_oportunidades for select to authenticated using(public.has_permission('crm.read'));
create policy licitacao_oportunidades_write on public.licitacao_oportunidades for all to authenticated using(public.has_permission('crm.write')) with check(public.has_permission('crm.write'));
grant select,insert,update,delete on public.licitacao_oportunidades to authenticated,service_role;

create or replace function private.sync_pncp_opportunities()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions,private as $$
declare
 modalidade_id integer; pagina integer; total_paginas integer; payload jsonb; item jsonb; normalized text; city text;
 matched text[]; inserted_count integer:=0; updated_count integer:=0; processed_count integer:=0; existed boolean;
 start_date text:=to_char(current_date,'YYYYMMDD'); end_date text:=to_char(current_date+60,'YYYYMMDD');
 modalities integer[]:=array[1,2,3,4,5,6,7,8,9,12,13];
 cities text[]:=array['montes claros','janauba','januaria','pirapora','bocaiuva','salinas','brasilia de minas','sao francisco','grao mogol','taiobeiras','porteirinha','espinosa','manga','jaiba','coracao de jesus','francisco sa','capitao eneas','pedras de maria da cruz','varzelandia','coracao de jesus','buritizeiro','juramento','mirabela','eng. navarro','engenheiro navarro'];
begin
 perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','20000');
 foreach modalidade_id in array modalities loop
  pagina:=1; total_paginas:=1;
  while pagina<=least(total_paginas,10) loop
   begin
    select (extensions.http_get(format('https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal=%s&codigoModalidadeContratacao=%s&uf=MG&pagina=%s&tamanhoPagina=50',end_date,modalidade_id,pagina))).content::jsonb into payload;
   exception when others then
    raise warning 'Falha PNCP modalidade %, página %: %',modalidade_id,pagina,sqlerrm; exit;
   end;
   total_paginas:=greatest(coalesce((payload->>'totalPaginas')::integer,1),1);
   for item in select value from jsonb_array_elements(coalesce(payload->'data','[]'::jsonb)) loop
    processed_count:=processed_count+1;
    city:=extensions.unaccent(lower(coalesce(item#>>'{unidadeOrgao,municipioNome}','')));
    normalized:=extensions.unaccent(lower(coalesce(item->>'objetoCompra','')||' '||coalesce(item->>'informacaoComplementar','')));
    if city=any(cities) and normalized ~ '(analis|laborator|potabil|microbiolog|fisico.quim|agua|efluen|eta|ete|poco|recurso.?hidric|monitoramento ambiental|sedimento|balneabil|portaria.{0,12}888|coleta.{0,20}amostra|qualidade.{0,12}agua|alimento)' then
     select array_agg(k) into matched from unnest(array['análise','laboratório','potabilidade','microbiologia','físico-química','água','efluentes','ETA/ETE','poço','recursos hídricos','monitoramento ambiental','sedimentos','balneabilidade','Portaria 888','coleta de amostras','alimentos']) k
      where normalized like '%'||extensions.unaccent(lower(k))||'%';
     select exists(select 1 from public.licitacao_oportunidades where numero_controle_pncp=item->>'numeroControlePNCP') into existed;
     insert into public.licitacao_oportunidades(numero_controle_pncp,numero_compra,processo,orgao,cnpj_orgao,unidade,municipio,uf,modalidade,objeto,data_publicacao,data_abertura_proposta,data_encerramento_proposta,valor_estimado,portal_url,pncp_url,palavras_encontradas,prioridade,payload,atualizada_em)
     values(item->>'numeroControlePNCP',item->>'numeroCompra',item->>'processo',item#>>'{orgaoEntidade,razaoSocial}',item#>>'{orgaoEntidade,cnpj}',item#>>'{unidadeOrgao,nomeUnidade}',item#>>'{unidadeOrgao,municipioNome}',item#>>'{unidadeOrgao,ufSigla}',item->>'modalidadeNome',item->>'objetoCompra',nullif(item->>'dataPublicacaoPncp','')::timestamptz,nullif(item->>'dataAberturaProposta','')::timestamptz,nullif(item->>'dataEncerramentoProposta','')::timestamptz,nullif(item->>'valorTotalEstimado','')::numeric,coalesce(nullif(item->>'linkSistemaOrigem',''),nullif(item->>'linkProcessoEletronico','')),format('https://pncp.gov.br/app/editais/%s/%s/%s',item#>>'{orgaoEntidade,cnpj}',item->>'anoCompra',item->>'sequencialCompra'),coalesce(matched,'{}'),case when city='montes claros' then 'ALTA' else 'MEDIA' end,item,now())
     on conflict(numero_controle_pncp) do update set objeto=excluded.objeto,data_encerramento_proposta=excluded.data_encerramento_proposta,valor_estimado=excluded.valor_estimado,portal_url=excluded.portal_url,payload=excluded.payload,atualizada_em=now();
     if existed then updated_count:=updated_count+1; else inserted_count:=inserted_count+1; end if;
    end if;
   end loop;
   pagina:=pagina+1;
  end loop;
 end loop;
 return jsonb_build_object('ok',true,'processadas',processed_count,'novas',inserted_count,'atualizadas',updated_count,'executado_em',now());
end $$;
revoke all on function private.sync_pncp_opportunities() from public,anon,authenticated;

create or replace function public.crm_sync_pncp_opportunities()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.uid() is null or not public.has_permission('crm.write') then raise exception 'Acesso negado'; end if;
 return private.sync_pncp_opportunities();
end $$;
revoke all on function public.crm_sync_pncp_opportunities() from public,anon;
grant execute on function public.crm_sync_pncp_opportunities() to authenticated,service_role;

do $$ declare existing_job bigint; begin
 select jobid into existing_job from cron.job where jobname='pncp-opportunities-daily';
 if existing_job is not null then perform cron.unschedule(existing_job); end if;
 perform cron.schedule('pncp-opportunities-daily','0 10 * * *','select private.sync_pncp_opportunities();');
end $$;
