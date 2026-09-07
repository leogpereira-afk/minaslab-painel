create or replace function public.disparar_danfse_nfse_autorizada()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.origem = 'NFSE_NACIONAL'
     and coalesce(new.apagado,false) = false
     and new.status_fiscal = 'AUTORIZADA'
     and new.xml_url is not null
     and new.pdf_url is null then
    perform net.http_post(
      url := 'https://reoghclxripktzpdwhiy.supabase.co/functions/v1/ml-financeiro-nfse-danfse',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-internal-token','nfse-danfse-2026-09-07-a1f4d93e7c2b'
      ),
      body := jsonb_build_object('id',new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_danfse_nfse_autorizada on public.notas_fiscais;
create trigger trg_danfse_nfse_autorizada
after insert or update of status_fiscal, xml_url, pdf_url on public.notas_fiscais
for each row
execute function public.disparar_danfse_nfse_autorizada();

revoke all on function public.disparar_danfse_nfse_autorizada() from public;
