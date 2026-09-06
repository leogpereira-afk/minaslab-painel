alter table public.empresas add column if not exists cnpj text;
update public.empresas set cnpj='65312061000130',updated_at=now() where sigla='MLAB';
update public.empresas set cnpj='52657257000114',updated_at=now() where sigla='MINASLAB';
create unique index if not exists empresas_cnpj_uq on public.empresas(cnpj) where cnpj is not null;
alter table public.notas_fiscais add column if not exists data_vencimento date;
