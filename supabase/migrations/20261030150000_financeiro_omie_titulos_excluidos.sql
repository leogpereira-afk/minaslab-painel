-- Financeiro: título excluído na Omie some do sistema também.
-- A sincronização só atualiza o que a Omie devolve; um título excluído lá ficava "em aberto" aqui
-- para sempre (ex.: 5 contas a pagar de set/out/2026 que somavam R$ 4.809,36 nos vencidos do painel).
-- Ao terminar uma passada completa de RECEBER/PAGAR, o ml-financeiro-omie-auto chama esta função:
-- títulos da Omie em aberto, dentro da janela (vencimento original E previsão), que não vieram na
-- passada, são marcados como apagados (apagado=true, reversível). Trava: mais de 15 de uma vez → não mexe.

create or replace function public.financeiro_omie_marcar_excluidos(p_tipo text, p_inicio timestamptz, p_de date, p_ate date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int; v_ids uuid[];
begin
  if p_tipo = 'RECEBER' then
    select array_agg(id) into v_ids from recebimentos r
     where upper(coalesce(r.origem,''))='OMIE' and coalesce(r.apagado,false)=false
       and r.status in ('VENCIDO','A RECEBER','PARCIAL')
       and r.data_sincronizacao_omie < p_inicio
       and to_date(nullif(r.dados_omie->>'data_vencimento',''),'DD/MM/YYYY') between p_de and p_ate
       and coalesce(to_date(nullif(r.dados_omie->>'data_previsao',''),'DD/MM/YYYY'), r.data_vencimento) between p_de and p_ate;
  elsif p_tipo = 'PAGAR' then
    select array_agg(id) into v_ids from despesas d
     where upper(coalesce(d.origem,''))='OMIE' and coalesce(d.apagado,false)=false
       and d.status in ('VENCIDO','A PAGAR','PARCIAL')
       and d.data_sincronizacao_omie < p_inicio
       and to_date(nullif(d.dados_omie->>'data_vencimento',''),'DD/MM/YYYY') between p_de and p_ate
       and coalesce(to_date(nullif(d.dados_omie->>'data_previsao',''),'DD/MM/YYYY'), d.data_vencimento) between p_de and p_ate;
  else
    raise exception 'tipo inválido: %', p_tipo;
  end if;
  n := coalesce(array_length(v_ids,1),0);
  if n = 0 then return jsonb_build_object('excluidos',0); end if;
  if n > 15 then return jsonb_build_object('excluidos',0,'ignorado',true,'candidatos',n,'motivo','Mais de 15 títulos sumiram de uma vez; nada foi apagado.'); end if;
  if p_tipo = 'RECEBER' then
    update recebimentos set apagado=true, apagado_em=now(), apagado_por='omie-sync', updated_by='omie', updated_at=now(),
      observacao = concat_ws(' | ', nullif(observacao,''), 'Excluído na Omie (não veio na sincronização de '||to_char(p_inicio at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||').')
     where id = any(v_ids);
  else
    update despesas set apagado=true, apagado_em=now(), apagado_por='omie-sync', updated_by='omie', updated_at=now(),
      observacao = concat_ws(' | ', nullif(observacao,''), 'Excluído na Omie (não veio na sincronização de '||to_char(p_inicio at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||').')
     where id = any(v_ids);
  end if;
  return jsonb_build_object('excluidos',n);
end $$;
revoke all on function public.financeiro_omie_marcar_excluidos(text,timestamptz,date,date) from public, anon, authenticated;
grant execute on function public.financeiro_omie_marcar_excluidos(text,timestamptz,date,date) to service_role;

-- As 5 contas a pagar que já não existem na Omie (passada completa de 30/10/2026 12:02 não as trouxe).
update public.despesas set apagado=true, apagado_em=now(), apagado_por='omie-sync', updated_by='omie', updated_at=now(),
  observacao = concat_ws(' | ', nullif(observacao,''), 'Excluído na Omie (não veio na sincronização completa de 30/10/2026).')
where origem='OMIE' and coalesce(apagado,false)=false and id_omie in ('5463923920','5470217218','5473330193','5468761183','5479183090')
  and status in ('VENCIDO','A PAGAR','PARCIAL');
