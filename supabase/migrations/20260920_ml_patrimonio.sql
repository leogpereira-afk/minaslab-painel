-- Inventário próprio da MinasLab. Nenhuma tabela/dado da Impresilk é copiado.
create table if not exists public.ml_patrimonio (
 tipo text not null check (tipo in ('bem','setor','foto')),
 id text not null,
 dados jsonb not null default '{}'::jsonb,
 apagado boolean not null default false,
 atualizado_em timestamptz not null default now(),
 atualizado_por text not null,
 primary key(tipo,id)
);
create unique index if not exists ml_patrimonio_codigo on public.ml_patrimonio ((dados->>'codigo')) where tipo='bem';
create unique index if not exists ml_patrimonio_sigla on public.ml_patrimonio ((dados->>'sigla')) where tipo='setor' and not apagado;
create sequence if not exists public.ml_patrimonio_etiqueta;
alter table public.ml_patrimonio enable row level security;
revoke all on public.ml_patrimonio from anon, authenticated;
revoke all on sequence public.ml_patrimonio_etiqueta from anon, authenticated;
grant all on public.ml_patrimonio to service_role;
grant usage, select on sequence public.ml_patrimonio_etiqueta to service_role;

-- Transação única: etiqueta imutável e setores protegidos, mesmo em duas abas.
create or replace function public.ml_patrimonio_gravar(p_action text,p_tipo text,p_id text,p_dados jsonb,p_usuario text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare antigo jsonb; codigo text; retorno jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('ml_patrimonio',0));
 if p_tipo not in ('bem','setor','foto') or p_action not in ('salvar','remover','iniciar') then raise exception 'Operação inválida'; end if;
 if nullif(p_id,'') is null or nullif(p_usuario,'') is null then raise exception 'Identificação obrigatória'; end if;
 select dados into antigo from public.ml_patrimonio where tipo=p_tipo and id=p_id and not apagado;
 if p_action='iniciar' and antigo is not null then
  select coalesce(jsonb_object_agg(id,dados),'{}'::jsonb) into retorno from public.ml_patrimonio where tipo=p_tipo and not apagado;
  return retorno;
 end if;
 if p_action='remover' then
  if antigo is null then raise exception 'Cadastro não encontrado'; end if;
  if p_tipo='setor' and exists(select 1 from public.ml_patrimonio where tipo='bem' and not apagado and dados->>'setorSigla'=antigo->>'sigla') then raise exception 'Setor possui bens, inclusive baixados. Transfira os bens antes de remover.'; end if;
  update public.ml_patrimonio set apagado=true,atualizado_em=now(),atualizado_por=p_usuario where tipo=p_tipo and id=p_id;
 else
  if exists(select 1 from public.ml_patrimonio where tipo=p_tipo and id=p_id and apagado) then raise exception 'Cadastro removido. Atualize a página.'; end if;
  if p_tipo='setor' then
   if coalesce(p_dados->>'sigla','') !~ '^[A-Z0-9]{2,8}$' or nullif(trim(p_dados->>'nome'),'') is null then raise exception 'Informe sigla (2 a 8 letras/números) e nome do setor'; end if;
   if antigo is not null and antigo->>'sigla' is distinct from p_dados->>'sigla' and exists(select 1 from public.ml_patrimonio where tipo='bem' and not apagado and dados->>'setorSigla'=antigo->>'sigla') then raise exception 'A sigla de um setor com bens não pode mudar'; end if;
  elsif p_tipo='bem' then
   if nullif(trim(p_dados->>'nomeGenerico'),'') is null then raise exception 'Informe o tipo do bem'; end if;
   if not exists(select 1 from public.ml_patrimonio where tipo='setor' and not apagado and dados->>'sigla'=p_dados->>'setorSigla') then raise exception 'Selecione um setor cadastrado'; end if;
   if coalesce(p_dados->>'situacao','') not in ('uso','reserva','manutencao','baixado') then raise exception 'Situação inválida'; end if;
   if (p_dados->>'valor') is null or (p_dados->>'valor')::numeric < 0 or (p_dados->>'valor')::numeric >= 1000000000000000 then raise exception 'Valor inválido'; end if;
   if nullif(p_dados->>'dataAquisicao','')::date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data de aquisição futura'; end if;
   codigo:=coalesce(antigo->>'codigo', 'ML-'||(p_dados->>'setorSigla')||'-'||lpad(nextval('public.ml_patrimonio_etiqueta')::text,6,'0'));
   p_dados:=(p_dados-'codigo')||jsonb_build_object('codigo',codigo);
  else
   if not exists(select 1 from public.ml_patrimonio where tipo='bem' and id=p_dados->>'bemId' and not apagado) then raise exception 'Bem não encontrado'; end if;
  end if;
  insert into public.ml_patrimonio(tipo,id,dados,atualizado_por) values(p_tipo,p_id,p_dados||jsonb_build_object('id',p_id),p_usuario)
  on conflict(tipo,id) do update set dados=excluded.dados,atualizado_por=excluded.atualizado_por,atualizado_em=now();
 end if;
 select coalesce(jsonb_object_agg(id,dados),'{}'::jsonb) into retorno from public.ml_patrimonio where tipo=p_tipo and not apagado;
 return retorno;
end $$;
revoke all on function public.ml_patrimonio_gravar(text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.ml_patrimonio_gravar(text,text,text,jsonb,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ml-patrimonio','ml-patrimonio',false,3145728,array['image/jpeg']) on conflict(id) do nothing;
