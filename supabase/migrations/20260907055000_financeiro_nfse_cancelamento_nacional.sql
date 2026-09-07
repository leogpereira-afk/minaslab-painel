alter table public.notas_fiscais
  add column if not exists nfse_cancelada_em timestamptz,
  add column if not exists nfse_cancelamento_motivo_codigo text,
  add column if not exists nfse_cancelamento_motivo text,
  add column if not exists nfse_cancelamento_evento_path text,
  add column if not exists nfse_cancelamento_dados jsonb not null default '{}'::jsonb;

create or replace function public.finalizar_nfse_cancelamento(p_nota_id uuid,p_motivo_codigo text,p_motivo text,p_evento_path text default null,p_evento_dados jsonb default '{}'::jsonb,p_cancelada_em timestamptz default now()) returns jsonb language plpgsql security definer set search_path=public as $$
declare n public.notas_fiscais%rowtype; r public.recebimentos%rowtype; tem_baixa boolean:=false; tem_conciliacao boolean:=false; financeiro_cancelado boolean:=false;
begin
 select * into n from public.notas_fiscais where id=p_nota_id and coalesce(apagado,false)=false for update; if not found then raise exception 'NFS-e não encontrada.'; end if;
 if n.origem<>'NFSE_NACIONAL' then raise exception 'A nota não é NFS-e Nacional.'; end if;
 if n.status_fiscal='CANCELADA' then return jsonb_build_object('ok',true,'jaCancelada',true,'recebimentoId',n.recebimento_id); end if;
 if n.status_fiscal<>'AUTORIZADA' or coalesce(n.chave_acesso,'')='' then raise exception 'Somente NFS-e AUTORIZADA com chave pode ser cancelada.'; end if;
 if n.recebimento_id is not null then select * into r from public.recebimentos where id=n.recebimento_id and coalesce(apagado,false)=false for update; if found then select exists(select 1 from public.baixas_recebimentos b where b.recebimento_id=r.id and coalesce(b.estornada,false)=false) into tem_baixa; select exists(select 1 from public.conciliacoes c where c.recebimento_id=r.id) into tem_conciliacao; if not tem_baixa and not tem_conciliacao and coalesce(r.valor_recebido,0)=0 then update public.recebimentos set status='CANCELADO',valor_pendente=0,updated_at=now(),updated_by='NFSE_CANCELAMENTO' where id=r.id; financeiro_cancelado:=true; end if; end if; end if;
 update public.notas_fiscais set status_fiscal='CANCELADA',nfse_cancelada_em=p_cancelada_em,nfse_cancelamento_motivo_codigo=p_motivo_codigo,nfse_cancelamento_motivo=p_motivo,nfse_cancelamento_evento_path=p_evento_path,nfse_cancelamento_dados=coalesce(nfse_cancelamento_dados,'{}'::jsonb)||coalesce(p_evento_dados,'{}'::jsonb),updated_at=now() where id=p_nota_id;
 return jsonb_build_object('ok',true,'jaCancelada',false,'recebimentoId',n.recebimento_id,'financeiroCancelado',financeiro_cancelado,'temBaixa',tem_baixa,'temConciliacao',tem_conciliacao);
end;$$;
revoke all on function public.finalizar_nfse_cancelamento(uuid,text,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.finalizar_nfse_cancelamento(uuid,text,text,text,jsonb,timestamptz) to service_role;