create or replace function public.financeiro_vincular_categoria_omie()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Enquanto um título Omie estiver sob ajuste manual controlado,
  -- a sincronização não pode refazer automaticamente o vínculo de categoria.
  -- Ao restaurar o Omie (override=false), o vínculo automático volta a funcionar.
  if upper(coalesce(new.origem,'')) = 'OMIE'
     and coalesce(new.omie_override_manual,false) = true then
    return new;
  end if;

  if new.categoria_id is null and coalesce(new.categoria_texto,'')<>'' then
    select m.categoria_id into new.categoria_id
    from public.categorias_omie_codigos m
    where m.empresa_id=new.empresa_id
      and m.codigo_omie=new.categoria_texto
      and m.ativa=true
    limit 1;
  end if;
  return new;
end;
$function$;
