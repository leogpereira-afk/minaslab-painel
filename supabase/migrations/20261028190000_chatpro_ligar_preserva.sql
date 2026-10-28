-- Não desfaz a ligação usuário ChatPro → CRM quando o usuário do CRM é
-- desativado (ex.: colaboradora que saiu): o histórico continua atribuído a ela.
create or replace function public.chatpro_ligar_usuarios() returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  update public.chatpro_usuarios u set perfil_id = x.perfil
  from (
    select cu.id,
      coalesce(
        (select min(p.id::text)::uuid from public.profiles p
          where coalesce(p.ativo, true)
            and lower(extensions.unaccent(split_part(btrim(p.nome), ' ', 1))) =
                lower(extensions.unaccent(split_part(btrim(case when cu.nome like '% - %' then substr(cu.nome, strpos(cu.nome, ' - ') + 3) else cu.nome end), ' ', 1)))
          having count(*) = 1),
        (select p.id from public.profiles p join auth.users au on au.id = p.id
          where coalesce(p.ativo, true) and lower(au.email) = lower(cu.email) limit 1)
      ) perfil
    from public.chatpro_usuarios cu where not cu.perfil_manual
  ) x
  where u.id = x.id and x.perfil is not null and u.perfil_id is distinct from x.perfil;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.chatpro_ligar_usuarios() from public, anon, authenticated;
