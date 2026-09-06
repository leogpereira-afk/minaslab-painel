alter table public.recebimentos
  add column if not exists c6_codigo_barras text,
  add column if not exists c6_status text,
  add column if not exists c6_data_emissao date,
  add column if not exists c6_data_credito date,
  add column if not exists c6_data_pagamento_boleto date,
  add column if not exists c6_valor_atualizado numeric(14,2),
  add column if not exists c6_valor_liquidacao numeric(14,2),
  add column if not exists c6_dias_atraso integer,
  add column if not exists c6_nosso_numero text,
  add column if not exists c6_carteira text,
  add column if not exists c6_ultima_importacao timestamptz;

create unique index if not exists ux_recebimentos_c6_codigo_barras
  on public.recebimentos (empresa_id, c6_codigo_barras)
  where c6_codigo_barras is not null and c6_codigo_barras <> '' and apagado = false;

create index if not exists ix_recebimentos_c6_nf_documento
  on public.recebimentos (empresa_id, numero_nf, cnpj_cpf)
  where apagado = false;

comment on column public.recebimentos.c6_codigo_barras is 'Código de barras normalizado (somente dígitos) do boleto C6; chave técnica do boleto.';
comment on column public.recebimentos.numero_nf is 'Número da nota fiscal; no relatório C6 corresponde ao campo Número do documento.';
comment on column public.recebimentos.c6_status is 'Situação informada pelo C6 (A VENCER, VENCIDO, PAGO, CANCELADO). Não substitui a baixa bancária via OFX.';
comment on column public.recebimentos.c6_data_credito is 'Data de crédito informada pelo C6. A baixa financeira continua dependente da conciliação bancária/OFX.';
comment on column public.recebimentos.c6_valor_liquidacao is 'Valor liquidado informado pelo C6, podendo incluir juros/multa e diferir do valor da nota.';
