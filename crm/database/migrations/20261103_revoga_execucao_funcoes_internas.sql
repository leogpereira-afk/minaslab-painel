-- Auditoria do CRM (03/11): funções internas (de gatilho ou de manutenção) estavam liberadas para chamada
-- pela API, inclusive sem login (anon). Os gatilhos continuam funcionando: rodam como dono do banco.
do $r$ declare f text; begin
  foreach f in array array[
    'public.chatpro_evento_sessao_trg()', 'public.chatpro_interacao_sessao_trg()',
    'public.crm_contratos_dedup_numero(text)', 'public.crm_lead_cliente_propagar()',
    'public.crm_msg_cliente_do_lead()', 'public.crm_proposta_laboratorios_sincronizar()',
    'public.financeiro_auditar_conciliacao()', 'public.provedor_envio_tarefa()',
    'public.trg_contratos_dedup_numero()', 'public.trg_crm_tarefa_espelhar()',
    'public.trg_ml_tarefa_para_crm()', 'public.trg_proposta_laboratorios_sincronizar()']
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $r$;
