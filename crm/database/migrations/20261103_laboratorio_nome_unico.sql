-- Amostras e Parâmetros: o filtro de laboratório listava o mesmo laboratório várias vezes
-- ("Campo Análise", "Campo analises", "Campo Análises", "Minaslab", "MinasLab"...), porque o nome vinha
-- do GerenciaLab do jeito que foi digitado. Agora cada parâmetro aponta para o laboratório cadastrado
-- (laboratorios_parceiros) e o nome gravado é sempre o do cadastro, inclusive nas próximas importações.

create or replace function public.laboratorio_chave(p text)
returns text language sql immutable set search_path = pg_catalog as $$
  select nullif(regexp_replace(regexp_replace(lower(translate(btrim(coalesce(p,'')),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')), '[^a-z0-9]', '', 'g'), 's$', ''), '')
$$;

create or replace function public.laboratorio_parceiro_por_nome(p text)
returns uuid language sql stable set search_path = public as $$
  select lp.id from public.laboratorios_parceiros lp
   where lp.deleted_at is null and public.laboratorio_chave(lp.nome) = public.laboratorio_chave(p)
   order by lp.ativo desc, lp.created_at limit 1
$$;

create or replace function public.amostra_parametro_laboratorio_padrao()
returns trigger language plpgsql set search_path = public as $$
declare v_id uuid; v_nome text;
begin
  v_id := coalesce(new.laboratorio_parceiro_id, public.laboratorio_parceiro_por_nome(new.contexto_tecnico->>'laboratorio'));
  if v_id is not null then
    select nome into v_nome from public.laboratorios_parceiros where id = v_id;
    new.laboratorio_parceiro_id := v_id;
    if new.contexto_tecnico ? 'laboratorio' or new.contexto_tecnico is not null then
      new.contexto_tecnico := coalesce(new.contexto_tecnico, '{}'::jsonb) || jsonb_build_object('laboratorio', v_nome);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_amostra_parametro_laboratorio on public.amostra_parametros;
create trigger trg_amostra_parametro_laboratorio before insert or update of laboratorio_parceiro_id, contexto_tecnico on public.amostra_parametros
  for each row execute function public.amostra_parametro_laboratorio_padrao();

-- Acerta o que já está gravado.
update public.amostra_parametros ap set laboratorio_parceiro_id = ap.laboratorio_parceiro_id
 where ap.deleted_at is null and (ap.laboratorio_parceiro_id is null or ap.contexto_tecnico->>'laboratorio' is distinct from
   (select nome from public.laboratorios_parceiros where id = ap.laboratorio_parceiro_id));

-- Relatórios: parâmetros com tipo_execucao 'EXTERNO' (Freitag, Ceimic, Campo Análise...) eram contados como execução interna.
do $m$ declare d text; n text; begin
  d := pg_get_functiondef('public.crm_relatorios_analitico'::regproc);
  n := replace(d, $a$case when ap.tipo_execucao ~* 'TERCEIR' then 'Terceirizada' else 'Interna' end$a$, $a$case when ap.tipo_execucao ~* '(TERCEIR|EXTERN)' then 'Terceirizada' else 'Interna' end$a$);
  if n <> d then execute n; end if;
end $m$;
