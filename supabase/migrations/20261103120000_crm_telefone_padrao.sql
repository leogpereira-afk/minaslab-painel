-- CRM: telefone no padrão +55(DD)NNNNN-NNNN (fixo: +55(DD)NNNN-NNNN), para não haver erro de identificação.
-- Celular gravado com 8 dígitos (começa com 6, 7, 8 ou 9) ganha o 9 na frente. "ramal N" é preservado no texto.
-- O texto mostrado fica no padrão; a coluna *_e164 (+55DDNNNNNNNNN) continua sendo a usada nas buscas.

create or replace function public.telefone_br_e164(p text)
returns text language plpgsql immutable set search_path = pg_catalog as $$
declare d text;
begin
  if p is null then return null; end if;
  d := regexp_replace(regexp_replace(p, '[Rr][Aa][Mm][Aa][Ll].*$', ''), '\D', '', 'g');
  d := ltrim(d, '0');
  if length(d) in (12, 13) and left(d, 2) = '55' then d := substr(d, 3); end if;
  if length(d) = 10 and substr(d, 3, 1) in ('6','7','8','9') then d := left(d, 2) || '9' || substr(d, 3); end if;
  if length(d) = 11 and substr(d, 3, 1) <> '9' then return null; end if;
  if length(d) not in (10, 11) then return null; end if;
  return '+55' || d;
end $$;

create or replace function public.telefone_br_formatar(p text)
returns text language plpgsql immutable set search_path = pg_catalog, public as $$
declare e text := public.telefone_br_e164(p); n text; r text;
begin
  if e is null then return null; end if;
  n := substr(e, 6);
  r := substring(p from '[Rr][Aa][Mm][Aa][Ll]\D*(\d+)');
  return '+55(' || substr(e, 4, 2) || ')' || left(n, length(n) - 4) || '-' || right(n, 4) || coalesce(' ramal ' || r, '');
end $$;

create or replace function public.sync_cliente_phone_e164()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $$
declare v_e text := public.telefone_br_e164(new.telefone_principal);
begin
  if v_e is not null then
    new.telefone_principal := public.telefone_br_formatar(new.telefone_principal);
    new.telefone_principal_e164 := v_e;
  else
    new.telefone_principal_e164 := public.normalize_phone_e164(new.telefone_principal);
  end if;
  return new;
end $$;

create or replace function public.sync_contato_phone_e164()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $$
declare v_t text := public.telefone_br_e164(new.telefone); v_w text := public.telefone_br_e164(new.whatsapp);
begin
  if v_t is not null then new.telefone := public.telefone_br_formatar(new.telefone); new.telefone_e164 := v_t;
  else new.telefone_e164 := public.normalize_phone_e164(new.telefone); end if;
  if v_w is not null then new.whatsapp := public.telefone_br_formatar(new.whatsapp); new.whatsapp_e164 := v_w;
  else new.whatsapp_e164 := public.normalize_phone_e164(new.whatsapp); end if;
  return new;
end $$;

-- Coloca no padrão o que já está gravado.
update public.clientes set telefone_principal = telefone_principal
 where telefone_principal is not null and public.telefone_br_formatar(telefone_principal) is distinct from telefone_principal
   and public.telefone_br_formatar(telefone_principal) is not null;
update public.contatos set telefone = telefone, whatsapp = whatsapp
 where (telefone is not null and public.telefone_br_formatar(telefone) is not null and public.telefone_br_formatar(telefone) <> telefone)
    or (whatsapp is not null and public.telefone_br_formatar(whatsapp) is not null and public.telefone_br_formatar(whatsapp) <> whatsapp);
