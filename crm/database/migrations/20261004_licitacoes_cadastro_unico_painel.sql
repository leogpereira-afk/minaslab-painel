-- Licitações: cadastro único. A tabela public.licitacoes (CRM) é a fonte; a coleção
-- "licitacoes" do painel (ml_registros) passa a ser um espelho mantido pelo banco,
-- nos dois sentidos e na mesma transação:
--   * gravar/apagar no CRM  -> atualiza o registro do painel e avisa o painel (ml_meta.rev);
--   * gravar/apagar no painel (ml-sync) -> grava no CRM e o registro do painel volta
--     já normalizado a partir do CRM (o ml-sync devolve o registro como ficou).
-- Nada muda no código do painel nem do CRM. Status e modalidade do painel são mais
-- simples que os do CRM: o detalhe do CRM é preservado enquanto o painel não muda a "faixa".

alter table public.licitacoes add column if not exists painel_id text;
create unique index if not exists licitacoes_painel_id_uq on public.licitacoes (painel_id) where painel_id is not null;

-- CRM -> formato do painel. "base" = registro atual do painel (preserva criadoEm, atualizadoPor...).
create or replace function public.ml_licitacao_para_painel(l public.licitacoes, base jsonb default '{}'::jsonb)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select coalesce(base,'{}'::jsonb) || jsonb_build_object(
    'id', coalesce(l.painel_id, l.id::text),
    'crmId', l.id::text,
    'orgao', btrim(l.orgao, E' \t\r\n'),
    'edital', case when l.numero like 'S/N-%' then '' else btrim(l.numero, E' \t\r\n') end,
    'modalidade', case
        when lower(coalesce(l.modalidade,'')) like 'preg%' then 'pregao'
        when lower(coalesce(l.modalidade,'')) like 'concorr%' then 'concorrencia'
        when lower(coalesce(l.modalidade,'')) like 'dispensa%' then 'dispensa'
        when lower(coalesce(l.modalidade,'')) like 'credenciamento%' then 'credenciamento'
        else 'outra' end,
    'objeto', coalesce(l.objeto,''),
    'portal', coalesce(l.portal_url,''),
    'dataSessao', coalesce(to_char(l.data_sessao at time zone 'America/Sao_Paulo','YYYY-MM-DD'),''),
    'horaSessao', case when l.data_sessao is null or to_char(l.data_sessao at time zone 'America/Sao_Paulo','HH24:MI')='00:00' then ''
                       else to_char(l.data_sessao at time zone 'America/Sao_Paulo','HH24:MI') end,
    'valorEstimado', l.valor_estimado,
    'valorProposta', l.valor_proposta,
    'status', case
        when l.status in ('MONITORAMENTO','ANALISE','PREPARACAO') then 'estudando'
        when l.status = 'PROPOSTA_ENVIADA' then 'proposta_enviada'
        when l.status in ('SESSAO','HABILITACAO','ADJUDICADA') then 'em_sessao'
        when l.status = 'GANHA' then 'ganha'
        when l.status = 'PERDIDA' and coalesce(l.motivo_perda,'') ilike 'perdeu a data%' then 'perdeu_data'
        when l.status = 'PERDIDA' then 'perdida'
        else 'nao_participamos' end,
    'resultado', coalesce(l.resultado, ''),
    'obs', coalesce(l.observacoes, ''),
    'municipio', l.municipio,
    'uf', l.uf,
    'criadoEm', coalesce(base->>'criadoEm', to_char(l.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    'atualizadoEm', to_char(l.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
$$;

create or replace function public.ml_licitacoes_bump() returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.ml_meta
     set valor = jsonb_set(jsonb_set(coalesce(valor,'{}'::jsonb), '{rev}', to_jsonb((extract(epoch from clock_timestamp())*1000)::bigint)),
                           '{porColecao,licitacoes}', to_jsonb((extract(epoch from clock_timestamp())*1000)::bigint)),
         atualizado_em = now()
   where chave = 'rev';
$$;

-- Gatilho no CRM: espelha no painel.
create or replace function public.trg_licitacoes_para_painel() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id text;
  v_base jsonb;
begin
  if coalesce(current_setting('ml.lic_sync', true),'') = '1' then return null; end if;
  perform set_config('ml.lic_sync','1',true);
  if tg_op = 'DELETE' then
    v_id := coalesce(old.painel_id, old.id::text);
    update public.ml_registros set apagado = true, atualizado_em = now(),
           registro = jsonb_build_object('id', v_id, '_apagado', true, 'atualizadoEm', to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
     where colecao = 'licitacoes' and id = v_id;
  else
    v_id := coalesce(new.painel_id, new.id::text);
    select registro into v_base from public.ml_registros where colecao = 'licitacoes' and id = v_id and not apagado;
    insert into public.ml_registros(colecao, id, registro, apagado, atualizado_em)
    values ('licitacoes', v_id, public.ml_licitacao_para_painel(new, v_base), new.deleted_at is not null, now())
    on conflict (colecao, id) do update set registro = excluded.registro, apagado = excluded.apagado, atualizado_em = excluded.atualizado_em;
  end if;
  perform public.ml_licitacoes_bump();
  perform set_config('ml.lic_sync','',true);
  return null;
end $$;

drop trigger if exists licitacoes_para_painel on public.licitacoes;
create trigger licitacoes_para_painel after insert or update or delete on public.licitacoes
  for each row execute function public.trg_licitacoes_para_painel();

-- Gatilho no painel (antes de gravar): grava no CRM e devolve o registro normalizado.
create or replace function public.trg_painel_licitacoes_para_crm() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r jsonb := coalesce(new.registro, '{}'::jsonb);
  l public.licitacoes;
  v_status text; v_modal text; v_mod_atual text; v_motivo text;
  v_numero text; v_data timestamptz; v_est numeric; v_prop numeric;
begin
  if new.colecao <> 'licitacoes' or coalesce(current_setting('ml.lic_sync', true),'') = '1' then return new; end if;
  perform set_config('ml.lic_sync','1',true);

  select * into l from public.licitacoes
   where painel_id = new.id or id::text = new.id or (r->>'crmId' is not null and id::text = r->>'crmId')
   order by (deleted_at is null) desc limit 1;

  if new.apagado then
    if l.id is not null then
      update public.licitacoes set deleted_at = coalesce(deleted_at, now()), updated_at = now() where id = l.id;
    end if;
    perform set_config('ml.lic_sync','',true);
    return new;
  end if;

  -- status: o painel tem 7 faixas; o CRM, 10 etapas. Mantém a etapa do CRM se a faixa não mudou.
  v_motivo := l.motivo_perda;
  v_status := case coalesce(r->>'status','estudando')
    when 'estudando' then case when l.status in ('MONITORAMENTO','ANALISE','PREPARACAO') then l.status else 'ANALISE' end
    when 'proposta_enviada' then 'PROPOSTA_ENVIADA'
    when 'em_sessao' then case when l.status in ('SESSAO','HABILITACAO','ADJUDICADA') then l.status else 'SESSAO' end
    when 'ganha' then 'GANHA'
    when 'perdida' then 'PERDIDA'
    when 'perdeu_data' then 'PERDIDA'
    else 'CANCELADA' end;
  if r->>'status' = 'perdeu_data' and coalesce(v_motivo,'') not ilike 'perdeu a data%' then
    v_motivo := 'Perdeu a data' || coalesce(' — ' || nullif(btrim(v_motivo),''), '');
  elsif r->>'status' = 'perdida' and coalesce(v_motivo,'') ilike 'perdeu a data%' then
    v_motivo := nullif(btrim(regexp_replace(v_motivo, '^perdeu a data( — )?', '', 'i')), '');
  end if;

  v_mod_atual := case
    when lower(coalesce(l.modalidade,'')) like 'preg%' then 'pregao'
    when lower(coalesce(l.modalidade,'')) like 'concorr%' then 'concorrencia'
    when lower(coalesce(l.modalidade,'')) like 'dispensa%' then 'dispensa'
    when lower(coalesce(l.modalidade,'')) like 'credenciamento%' then 'credenciamento'
    else 'outra' end;
  v_modal := case when l.id is not null and v_mod_atual = coalesce(r->>'modalidade','outra') then l.modalidade
    else case coalesce(r->>'modalidade','outra')
      when 'pregao' then 'Pregão eletrônico' when 'concorrencia' then 'Concorrência eletrônica'
      when 'dispensa' then 'Dispensa eletrônica' when 'credenciamento' then 'Credenciamento' else 'Outra' end end;

  v_numero := nullif(btrim(coalesce(r->>'edital',''), E' \t\r\n'), '');
  if v_numero is null then
    v_numero := case when l.numero like 'S/N-%' then l.numero else 'S/N-' || right(new.id, 6) end;
  end if;
  if exists (select 1 from public.licitacoes x where x.deleted_at is null and x.empresa = 'MINASLAB'
               and lower(x.numero) = lower(v_numero) and x.id is distinct from l.id) then
    v_numero := v_numero || ' (' || right(new.id, 4) || ')';
  end if;

  begin
    v_data := case when coalesce(r->>'dataSessao','') = '' then null
      else ((r->>'dataSessao') || ' ' || coalesce(nullif(r->>'horaSessao',''), '00:00'))::timestamp at time zone 'America/Sao_Paulo' end;
  exception when others then v_data := l.data_sessao; end;
  begin v_est := nullif(r->>'valorEstimado','')::numeric; exception when others then v_est := l.valor_estimado; end;
  begin v_prop := nullif(r->>'valorProposta','')::numeric; exception when others then v_prop := l.valor_proposta; end;

  if l.id is null then
    insert into public.licitacoes(empresa, numero, orgao, modalidade, objeto, portal_url, status, data_sessao,
      valor_estimado, valor_proposta, resultado, motivo_perda, observacoes, painel_id)
    values ('MINASLAB', v_numero, coalesce(btrim(r->>'orgao', E' \t\r\n'),''), v_modal, coalesce(r->>'objeto',''),
      nullif(btrim(coalesce(r->>'portal',''), E' \t\r\n'),''), v_status, v_data, case when v_est < 0 then 0 else v_est end, case when v_prop < 0 then 0 else v_prop end,
      nullif(r->>'resultado',''), v_motivo, nullif(r->>'obs',''), new.id)
    returning * into l;
  else
    update public.licitacoes set numero = v_numero, orgao = coalesce(btrim(r->>'orgao', E' \t\r\n'), orgao),
      modalidade = v_modal, objeto = coalesce(r->>'objeto', objeto),
      portal_url = nullif(btrim(coalesce(r->>'portal',''), E' \t\r\n'),''), status = v_status, data_sessao = v_data,
      valor_estimado = case when v_est < 0 then 0 else v_est end, valor_proposta = case when v_prop < 0 then 0 else v_prop end,
      resultado = nullif(r->>'resultado',''), motivo_perda = v_motivo, observacoes = nullif(r->>'obs',''),
      painel_id = coalesce(painel_id, case when new.id <> id::text then new.id end),
      deleted_at = null, updated_at = now()
     where id = l.id returning * into l;
  end if;

  new.registro := public.ml_licitacao_para_painel(l, r);
  perform set_config('ml.lic_sync','',true);
  return new;
end $$;

drop trigger if exists painel_licitacoes_para_crm on public.ml_registros;
create trigger painel_licitacoes_para_crm before insert or update on public.ml_registros
  for each row when (new.colecao = 'licitacoes') execute function public.trg_painel_licitacoes_para_crm();

revoke all on function public.trg_licitacoes_para_painel() from public, anon, authenticated;
revoke all on function public.trg_painel_licitacoes_para_crm() from public, anon, authenticated;
revoke all on function public.ml_licitacoes_bump() from public, anon, authenticated;

-- Carga inicial (01/10/2026): as 6 licitações do painel já existiam no CRM (mesmo órgão).
-- Liga cada uma à do CRM (o CRM prevalece; observação do painel entra se o CRM não tiver)
-- e espelha as 14 do CRM no painel.
do $$
begin
  perform set_config('ml.lic_sync','1',true);
  update public.licitacoes l set painel_id = r.id,
         observacoes = coalesce(l.observacoes, nullif(btrim(r.registro->>'obs'),''))
    from public.ml_registros r
   where r.colecao = 'licitacoes' and not r.apagado and l.deleted_at is null and l.painel_id is null
     and lower(btrim(l.orgao, E' \t\r\n')) = lower(btrim(r.registro->>'orgao', E' \t\r\n'))
     and not exists (select 1 from public.licitacoes x where x.painel_id = r.id);
  perform set_config('ml.lic_sync','',true);
  update public.licitacoes set updated_at = updated_at;  -- dispara o espelho de todas
end $$;
