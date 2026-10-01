-- Auditoria 01/10/2026 (dados, já aplicado no Supabase):
-- 1) Oportunidades recebem o número da proposta do GerenciaLab a partir da proposta ligada (766 de 767).
update public.oportunidades o set numero_proposta_gerencialab=p.numero_proposta, updated_at=now()
from (select distinct on (oportunidade_id) oportunidade_id, btrim(numero_proposta) numero_proposta
        from public.propostas where deleted_at is null and coalesce(btrim(numero_proposta),'')<>''
       order by oportunidade_id, created_at) p
where p.oportunidade_id=o.id and o.deleted_at is null and coalesce(o.numero_proposta_gerencialab,'')='';

-- 2) Importações paradas/com erro, já substituídas por importações aplicadas, ficam ARQUIVADA
--    e não podem mais ser processadas.
update public.importacoes set status='ARQUIVADA',
  metadata=metadata||jsonb_build_object('arquivada_em',now(),'motivo_arquivamento','Auditoria 01/10/2026: importação parada ou com erro, substituída por importação posterior aplicada')
where id in ('168b49b9-0aeb-56d3-bb2f-3d88ea098d4d','61bacc21-be65-54e6-bc24-b7613a93617e','c5261ba8-63f9-51df-b083-eb7a6b9d42c9',
             '4d452ce7-3949-40a3-86da-83bfcfa0d0f9','215db7e0-0209-4e59-b7f9-200ca5f7e0be','8a4147ab-cdaf-4452-95e8-3b20ee0207b1');

do $do$
declare d text;
begin
  d := pg_get_functiondef('public.crm_process_importacao(uuid)'::regprocedure);
  if position('ARQUIVADA' in d)=0 then
    d := replace(d, E'  if v_status = ''APLICADA'' then', E'  if v_status = ''ARQUIVADA'' then\n    raise exception ''Importação arquivada; envie o arquivo novamente se precisar reprocessar'';\n  end if;\n\n  if v_status = ''APLICADA'' then');
    execute d;
  end if;
end $do$;
