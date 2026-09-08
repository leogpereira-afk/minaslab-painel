alter table public.recebimentos add column if not exists omie_override_manual boolean not null default false, add column if not exists omie_override_dados jsonb, add column if not exists omie_override_em timestamptz, add column if not exists omie_override_por text;
alter table public.despesas add column if not exists omie_override_manual boolean not null default false, add column if not exists omie_override_dados jsonb, add column if not exists omie_override_em timestamptz, add column if not exists omie_override_por text;

create or replace function public.financeiro_preservar_override_omie() returns trigger language plpgsql set search_path=public as $$
begin
  if old.origem='OMIE' and old.omie_override_manual=true and new.updated_by='omie' then
    if tg_table_name='recebimentos' then
      new.cliente:=old.cliente; new.cnpj_cpf:=old.cnpj_cpf; new.descricao:=old.descricao; new.valor_previsto:=old.valor_previsto; new.valor_recebido:=old.valor_recebido; new.valor_pendente:=old.valor_pendente; new.data_vencimento:=old.data_vencimento; new.data_pagamento:=old.data_pagamento; new.status:=old.status; new.categoria_id:=old.categoria_id; new.conta_bancaria_id:=old.conta_bancaria_id; new.categoria_texto:=old.categoria_texto; new.conta_bancaria_texto:=old.conta_bancaria_texto; new.forma_pagamento:=old.forma_pagamento; new.numero_nf:=old.numero_nf; new.observacao:=old.observacao;
    else
      new.fornecedor:=old.fornecedor; new.cnpj_cpf:=old.cnpj_cpf; new.descricao:=old.descricao; new.valor_original:=old.valor_original; new.valor_pago:=old.valor_pago; new.valor_pendente:=old.valor_pendente; new.data_lancamento:=old.data_lancamento; new.data_vencimento:=old.data_vencimento; new.data_pagamento:=old.data_pagamento; new.status:=old.status; new.categoria_id:=old.categoria_id; new.conta_bancaria_id:=old.conta_bancaria_id; new.centro_custo_id:=old.centro_custo_id; new.centro_custo:=old.centro_custo; new.categoria_texto:=old.categoria_texto; new.conta_bancaria_texto:=old.conta_bancaria_texto; new.forma_pagamento:=old.forma_pagamento; new.observacao:=old.observacao;
    end if;
    new.omie_override_manual:=old.omie_override_manual; new.omie_override_dados:=old.omie_override_dados; new.omie_override_em:=old.omie_override_em; new.omie_override_por:=old.omie_override_por;
  end if;
  return new;
end $$;

drop trigger if exists trg_recebimentos_preserva_override_omie on public.recebimentos;
create trigger trg_recebimentos_preserva_override_omie before update on public.recebimentos for each row execute function public.financeiro_preservar_override_omie();
drop trigger if exists trg_despesas_preserva_override_omie on public.despesas;
create trigger trg_despesas_preserva_override_omie before update on public.despesas for each row execute function public.financeiro_preservar_override_omie();