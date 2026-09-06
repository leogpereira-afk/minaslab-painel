alter table public.notas_fiscais drop constraint if exists notas_fiscais_origem_check;
alter table public.notas_fiscais add constraint notas_fiscais_origem_check check (origem = any (array['MANUAL'::text,'XML'::text,'OMIE'::text,'NFSE_NACIONAL'::text]));
create unique index if not exists ux_notas_fiscais_nfse_dps on public.notas_fiscais (empresa_id,nfse_dps_id) where nfse_dps_id is not null and apagado=false;
create index if not exists notas_fiscais_status_fiscal_idx on public.notas_fiscais(status_fiscal) where apagado=false;
