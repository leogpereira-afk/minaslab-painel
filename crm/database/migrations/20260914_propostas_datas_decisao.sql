alter table public.propostas add column if not exists data_recusa timestamptz;

update public.propostas
set data_recusa=data_aceite,data_aceite=null
where upper(coalesce(status,''))='RECUSADA' and data_recusa is null and data_aceite is not null;

do $$ begin
 alter table public.propostas add constraint propostas_aprovada_exige_data_aceite
 check (upper(coalesce(status,''))<>'APROVADA' or data_aceite is not null) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
 alter table public.propostas add constraint propostas_recusada_exige_data_recusa
 check (upper(coalesce(status,''))<>'RECUSADA' or data_recusa is not null) not valid;
exception when duplicate_object then null; end $$;

comment on column public.propostas.data_recusa is 'Data real em que a proposta foi recusada pelo cliente.';