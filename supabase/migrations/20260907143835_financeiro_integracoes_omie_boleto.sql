alter table despesas add column if not exists fornecedor_id uuid references clientes_financeiro(id);
alter table despesas add column if not exists boleto_url text;
alter table despesas add column if not exists boleto_codigo_barras text;
alter table despesas add column if not exists boleto_linha_digitavel text;
alter table despesas add column if not exists boleto_dados jsonb;

alter table contas_bancarias add column if not exists id_omie text;
alter table contas_bancarias add column if not exists dados_omie jsonb;
alter table contas_bancarias add column if not exists saldo_atual numeric;
alter table contas_bancarias add column if not exists saldo_atualizado_em timestamptz;

alter table movimentos_bancarios add column if not exists id_omie text;
alter table movimentos_bancarios add column if not exists dados_omie jsonb;

alter table notas_fiscais add column if not exists dados_omie jsonb;
alter table notas_fiscais add column if not exists status_omie text;

create unique index if not exists uq_contas_bancarias_omie on contas_bancarias(empresa_id,id_omie) where id_omie is not null;
create unique index if not exists uq_movimentos_bancarios_omie on movimentos_bancarios(empresa_id,id_omie) where origem='OMIE' and id_omie is not null;
create unique index if not exists uq_notas_fiscais_omie on notas_fiscais(empresa_id,id_omie) where origem='OMIE' and id_omie is not null;

create or replace function financeiro_vincular_cliente_omie_recebimento()
returns trigger language plpgsql as $$
declare c clientes_financeiro%rowtype;
declare cod text;
begin
  if upper(coalesce(new.origem,'')) <> 'OMIE' then return new; end if;
  cod := new.dados_omie->>'codigo_cliente_fornecedor';
  if coalesce(cod,'') = '' then return new; end if;
  select * into c from clientes_financeiro where id_omie = cod limit 1;
  if found then
    new.cliente_id := c.id;
    new.cliente := c.nome;
    if coalesce(nullif(c.cnpj_cpf,''), '') <> '' then new.cnpj_cpf := c.cnpj_cpf; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_financeiro_vincula_cliente_omie_recebimento on recebimentos;
create trigger trg_financeiro_vincula_cliente_omie_recebimento before insert or update on recebimentos
for each row execute function financeiro_vincular_cliente_omie_recebimento();

create or replace function financeiro_vincular_cliente_omie_despesa()
returns trigger language plpgsql as $$
declare c clientes_financeiro%rowtype;
declare cod text;
begin
  if upper(coalesce(new.origem,'')) <> 'OMIE' then return new; end if;
  cod := new.dados_omie->>'codigo_cliente_fornecedor';
  if coalesce(cod,'') = '' then return new; end if;
  select * into c from clientes_financeiro where id_omie = cod limit 1;
  if found then
    new.fornecedor_id := c.id;
    new.fornecedor := c.nome;
    if coalesce(nullif(c.cnpj_cpf,''), '') <> '' then new.cnpj_cpf := c.cnpj_cpf; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_financeiro_vincula_cliente_omie_despesa on despesas;
create trigger trg_financeiro_vincula_cliente_omie_despesa before insert or update on despesas
for each row execute function financeiro_vincular_cliente_omie_despesa();
