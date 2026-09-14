create or replace function public.preencher_servico_gerado_nfse()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_desc text;
  v_os text;
  v_id uuid;
  v_count integer;
begin
  if new.origem <> 'NFSE_NACIONAL' or new.servico_gerado_id is not null then
    return new;
  end if;

  v_desc := coalesce(new.nfse_dados->'servico'->>'descricao','');
  v_os := substring(v_desc from '(?i)OS\s*:\s*([A-Z0-9._/-]+)');
  if coalesce(btrim(v_os),'')='' then
    return new;
  end if;

  select count(*)
    into v_count
  from public.servicos_gerados
  where apagado=false
    and empresa_id=new.empresa_id
    and upper(btrim(os_numero))=upper(btrim(v_os));

  if v_count=1 then
    select id
      into v_id
    from public.servicos_gerados
    where apagado=false
      and empresa_id=new.empresa_id
      and upper(btrim(os_numero))=upper(btrim(v_os))
    limit 1;
    new.servico_gerado_id := v_id;
  end if;

  return new;
end;
$function$;
