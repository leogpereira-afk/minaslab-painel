create or replace function public.resolve_cliente_by_phone_e164(p_phone text)
returns table(status text, cliente_id uuid, contato_id uuid, matched_phone text, match_source text, candidate_clients integer)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with input as (
    select public.normalize_phone_e164(p_phone) as e164
  ),
  exact_raw as (
    select c.cliente_id, c.id as contato_id, c.whatsapp_e164 as matched_phone,
           'contatos.whatsapp'::text as match_source, 1 as priority
    from public.contatos c cross join input i
    where i.e164 is not null and c.deleted_at is null and c.ativo = true
      and c.whatsapp_e164 = i.e164
    union all
    select c.cliente_id, c.id, c.telefone_e164,
           'contatos.telefone'::text, 2
    from public.contatos c cross join input i
    where i.e164 is not null and c.deleted_at is null and c.ativo = true
      and c.telefone_e164 = i.e164
    union all
    select cl.id, null::uuid, cl.telefone_principal_e164,
           'clientes.telefone_principal'::text, 3
    from public.clientes cl cross join input i
    where i.e164 is not null and cl.deleted_at is null
      and cl.telefone_principal_e164 = i.e164
  ),
  exact_clients as (
    select distinct cliente_id from exact_raw where cliente_id is not null
  ),
  exact_count as (
    select count(*)::integer n from exact_clients
  ),
  compat_raw as (
    select c.cliente_id, c.id as contato_id, c.whatsapp_e164 as matched_phone,
           'contatos.whatsapp_br_compat'::text as match_source, 11 as priority
    from public.contatos c cross join input i cross join exact_count ec
    where ec.n = 0 and i.e164 ~ '^[+]55[0-9]{10,11}$'
      and c.deleted_at is null and c.ativo = true
      and c.whatsapp_e164 ~ '^[+]55[0-9]{10,11}$'
      and left(c.whatsapp_e164,5) = left(i.e164,5)
      and right(c.whatsapp_e164,8) = right(i.e164,8)
      and abs(length(c.whatsapp_e164)-length(i.e164)) <= 1
    union all
    select c.cliente_id, c.id, c.telefone_e164,
           'contatos.telefone_br_compat'::text, 12
    from public.contatos c cross join input i cross join exact_count ec
    where ec.n = 0 and i.e164 ~ '^[+]55[0-9]{10,11}$'
      and c.deleted_at is null and c.ativo = true
      and c.telefone_e164 ~ '^[+]55[0-9]{10,11}$'
      and left(c.telefone_e164,5) = left(i.e164,5)
      and right(c.telefone_e164,8) = right(i.e164,8)
      and abs(length(c.telefone_e164)-length(i.e164)) <= 1
    union all
    select cl.id, null::uuid, cl.telefone_principal_e164,
           'clientes.telefone_principal_br_compat'::text, 13
    from public.clientes cl cross join input i cross join exact_count ec
    where ec.n = 0 and i.e164 ~ '^[+]55[0-9]{10,11}$'
      and cl.deleted_at is null
      and cl.telefone_principal_e164 ~ '^[+]55[0-9]{10,11}$'
      and left(cl.telefone_principal_e164,5) = left(i.e164,5)
      and right(cl.telefone_principal_e164,8) = right(i.e164,8)
      and abs(length(cl.telefone_principal_e164)-length(i.e164)) <= 1
  ),
  candidates_raw as (
    select * from exact_raw
    union all
    select * from compat_raw
  ),
  dedup_clients as (
    select distinct cliente_id from candidates_raw where cliente_id is not null
  ),
  counts as (
    select count(*)::integer as n from dedup_clients
  ),
  best_match as (
    select cr.cliente_id, cr.contato_id, cr.matched_phone, cr.match_source
    from candidates_raw cr
    order by cr.priority, cr.contato_id nulls last
    limit 1
  )
  select
    case when c.n = 0 then 'NAO_LOCALIZADO' when c.n = 1 then 'LOCALIZADO' else 'AMBIGUO' end,
    case when c.n = 1 then b.cliente_id else null::uuid end,
    case when c.n = 1 then b.contato_id else null::uuid end,
    case when c.n = 1 then b.matched_phone else null::text end,
    case when c.n = 1 then b.match_source else null::text end,
    c.n
  from counts c
  left join best_match b on true;
$$;

revoke all on function public.resolve_cliente_by_phone_e164(text) from public, anon, authenticated;
grant execute on function public.resolve_cliente_by_phone_e164(text) to service_role;
