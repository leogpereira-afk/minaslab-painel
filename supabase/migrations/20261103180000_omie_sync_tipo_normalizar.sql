-- Auditoria (03/11): o ml-financeiro-omie-v2 grava o histórico em omie_sync com tipo RECEBER/PAGAR/CLIENTES,
-- mas a tabela só aceitava RECEBIMENTOS/DESPESAS/MOVIMENTOS/NOTAS → ~400 inserts rejeitados por dia (o histórico
-- de sincronização ficava sem registro; os títulos em si eram gravados normalmente).
alter table public.omie_sync drop constraint if exists omie_sync_tipo_check;
alter table public.omie_sync add constraint omie_sync_tipo_check
  check (tipo = any (array['RECEBIMENTOS','DESPESAS','MOVIMENTOS','NOTAS','CLIENTES']));

create or replace function public.omie_sync_tipo_normalizar()
returns trigger language plpgsql set search_path = public as $$
begin
  new.tipo := case upper(new.tipo) when 'RECEBER' then 'RECEBIMENTOS' when 'PAGAR' then 'DESPESAS' else upper(new.tipo) end;
  return new;
end $$;
revoke execute on function public.omie_sync_tipo_normalizar() from public, anon, authenticated;
drop trigger if exists trg_omie_sync_tipo_normalizar on public.omie_sync;
create trigger trg_omie_sync_tipo_normalizar before insert or update of tipo on public.omie_sync
  for each row execute function public.omie_sync_tipo_normalizar();
