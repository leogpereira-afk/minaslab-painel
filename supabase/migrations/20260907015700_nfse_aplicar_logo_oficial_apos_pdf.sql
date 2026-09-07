create or replace function public.aplicar_logo_oficial_nfse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pdf_url is not null
     and new.status_fiscal = 'AUTORIZADA'
     and new.origem = 'NFSE_NACIONAL'
     and (old.pdf_url is distinct from new.pdf_url or old.updated_at is distinct from new.updated_at) then
    perform net.http_post(
      url := 'https://reoghclxripktzpdwhiy.supabase.co/functions/v1/ml-financeiro-nfse-logo-fix',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notas_nfse_logo_oficial on public.notas_fiscais;
create trigger trg_notas_nfse_logo_oficial
after update of pdf_url on public.notas_fiscais
for each row
when (new.pdf_url is not null)
execute function public.aplicar_logo_oficial_nfse();
