alter table public.notas_fiscais
  add column if not exists nfse_dps_numero bigint,
  add column if not exists nfse_dps_serie integer,
  add column if not exists nfse_autorizada_em timestamptz;

create sequence if not exists public.mlab_nfse_dps_serie_900_seq
  as bigint start with 1 increment by 1 minvalue 1 no cycle;

create unique index if not exists ux_notas_nfse_dps_numero
  on public.notas_fiscais (empresa_id, nfse_ambiente, nfse_dps_serie, nfse_dps_numero)
  where nfse_dps_numero is not null and nfse_dps_serie is not null and apagado = false;

create unique index if not exists ux_notas_nfse_recebimento
  on public.notas_fiscais (recebimento_id)
  where recebimento_id is not null and origem = 'NFSE_NACIONAL' and apagado = false;

create or replace function public.reservar_nfse_dps_numero(
  p_nota_id uuid,
  p_serie integer default 900
)
returns table(nota_id uuid, serie integer, numero bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nota public.notas_fiscais%rowtype;
  v_numero bigint;
begin
  if p_serie <> 900 then
    raise exception 'Série de produção não autorizada: %', p_serie;
  end if;

  select * into v_nota
  from public.notas_fiscais
  where id = p_nota_id
    and origem = 'NFSE_NACIONAL'
    and apagado = false
  for update;

  if not found then
    raise exception 'Rascunho NFS-e não encontrado.';
  end if;

  if coalesce(v_nota.status_fiscal,'') not in ('RASCUNHO','REJEITADA','PROCESSANDO') then
    raise exception 'A nota está em % e não pode reservar número de DPS.', v_nota.status_fiscal;
  end if;

  if v_nota.nfse_dps_numero is not null then
    return query select v_nota.id, v_nota.nfse_dps_serie, v_nota.nfse_dps_numero;
    return;
  end if;

  v_numero := nextval('public.mlab_nfse_dps_serie_900_seq');

  update public.notas_fiscais
  set nfse_dps_serie = p_serie,
      nfse_dps_numero = v_numero,
      nfse_ambiente = 'PRODUCAO',
      updated_at = now()
  where id = v_nota.id;

  return query select v_nota.id, p_serie, v_numero;
end;
$$;

revoke all on function public.reservar_nfse_dps_numero(uuid, integer) from public, anon, authenticated;
grant execute on function public.reservar_nfse_dps_numero(uuid, integer) to service_role;

create or replace function public.finalizar_nfse_producao(
  p_nota_id uuid,
  p_chave_acesso text,
  p_numero_nf text,
  p_codigo_verificacao text default null,
  p_nfse_dados jsonb default '{}'::jsonb,
  p_autorizada_em timestamptz default now()
)
returns table(nota_id uuid, recebimento_id uuid, criou_recebimento boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nota public.notas_fiscais%rowtype;
  v_recebimento uuid;
  v_criou boolean := false;
begin
  if nullif(trim(p_chave_acesso),'') is null then
    raise exception 'Chave de acesso obrigatória para finalizar NFS-e.';
  end if;
  if nullif(trim(p_numero_nf),'') is null then
    raise exception 'Número da NFS-e obrigatório para finalizar NFS-e.';
  end if;

  select * into v_nota
  from public.notas_fiscais
  where id = p_nota_id
    and origem = 'NFSE_NACIONAL'
    and apagado = false
  for update;

  if not found then
    raise exception 'NFS-e não encontrada.';
  end if;

  if v_nota.status_fiscal = 'AUTORIZADA' and v_nota.chave_acesso = p_chave_acesso and v_nota.recebimento_id is not null then
    return query select v_nota.id, v_nota.recebimento_id, false;
    return;
  end if;

  if coalesce(v_nota.status_fiscal,'') not in ('RASCUNHO','REJEITADA','PROCESSANDO','AUTORIZADA') then
    raise exception 'A nota está em % e não pode ser finalizada como AUTORIZADA.', v_nota.status_fiscal;
  end if;

  update public.notas_fiscais
  set status_fiscal = 'AUTORIZADA',
      chave_acesso = p_chave_acesso,
      numero_nf = p_numero_nf,
      nfse_codigo_verificacao = p_codigo_verificacao,
      nfse_autorizada_em = coalesce(p_autorizada_em, now()),
      nfse_ambiente = 'PRODUCAO',
      nfse_dados = coalesce(nfse_dados,'{}'::jsonb) || coalesce(p_nfse_dados,'{}'::jsonb),
      updated_at = now()
  where id = v_nota.id;

  if v_nota.recebimento_id is not null then
    return query select v_nota.id, v_nota.recebimento_id, false;
    return;
  end if;

  insert into public.recebimentos (
    empresa_id, cliente_id, cliente, cnpj_cpf, descricao,
    valor_previsto, valor_recebido, valor_pendente,
    data_vencimento, status, numero_nf, observacao,
    origem, forma_pagamento, created_by, updated_by
  ) values (
    v_nota.empresa_id,
    v_nota.cliente_id,
    coalesce(v_nota.nome_destinatario,'CLIENTE'),
    v_nota.cnpj_destinatario,
    'NFS-e ' || p_numero_nf,
    v_nota.valor_total,
    0,
    v_nota.valor_total,
    v_nota.data_vencimento,
    'A RECEBER',
    p_numero_nf,
    'Gerado automaticamente após autorização da NFS-e Nacional. Chave: ' || p_chave_acesso,
    'MANUAL',
    coalesce(v_nota.nfse_dados #>> '{financeiro,formaPagamento}', null),
    'NFSE_NACIONAL',
    'NFSE_NACIONAL'
  ) returning id into v_recebimento;

  update public.notas_fiscais
  set recebimento_id = v_recebimento,
      updated_at = now()
  where id = v_nota.id;

  v_criou := true;
  return query select v_nota.id, v_recebimento, v_criou;
end;
$$;

revoke all on function public.finalizar_nfse_producao(uuid, text, text, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.finalizar_nfse_producao(uuid, text, text, text, jsonb, timestamptz) to service_role;
