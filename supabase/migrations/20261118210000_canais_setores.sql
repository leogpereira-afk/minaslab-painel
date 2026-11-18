-- Canais por setor: além do mural geral da empresa (canal_id nulo), cada setor
-- pode ter o seu canal, com responsáveis, membros e regras próprias.
-- Só a Edge Function ml-canais (chave de serviço) lê e grava; o navegador nunca
-- fala com estas tabelas.
--
-- publicacao:   'responsaveis' (mural de avisos) | 'todos' (qualquer membro publica)
-- visibilidade: 'setor' (só membros veem)      | 'empresa' (todos leem, só membros interagem)

create table if not exists public.ml_canais (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 60),
  descricao text not null default '',
  responsaveis text[] not null default '{}',
  membros text[] not null default '{}',
  publicacao text not null default 'responsaveis' check (publicacao in ('responsaveis', 'todos')),
  visibilidade text not null default 'setor' check (visibilidade in ('setor', 'empresa')),
  criado_por text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz,
  apagado boolean not null default false
);

-- canal_id nulo = mural geral (o Canais MinasLab de sempre).
alter table public.ml_canais_posts add column if not exists canal_id uuid references public.ml_canais (id);
alter table public.ml_canais_posts add column if not exists pedir_leitura boolean not null default false;
create index if not exists canais_posts_canal_idx on public.ml_canais_posts (canal_id, apagado, fixado desc, criado_em desc);

-- "Li e entendi" dos avisos que pedem confirmação de leitura.
create table if not exists public.ml_canais_leituras (
  post_id uuid not null references public.ml_canais_posts (id),
  usuario text not null,
  nome text not null default '',
  em timestamptz not null default now(),
  primary key (post_id, usuario)
);

alter table public.ml_canais enable row level security;
alter table public.ml_canais_leituras enable row level security;
revoke all on public.ml_canais, public.ml_canais_leituras from anon, authenticated;

-- O aviso automático no grupo "MinasLab" das Mensagens vale só para o mural
-- geral: publicação de canal de setor não pode vazar para a empresa toda.
create or replace function public.ml_canais_avisar_grupo()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare g uuid; nova record;
begin
  if new.apagado or new.canal_id is not null then return new; end if;
  select id into g from ml_conversas
   where tipo = 'grupo' and not apagada and lower(trim(nome)) = 'minaslab'
   order by criado_em limit 1;
  if g is null then return new; end if;
  insert into ml_conversa_mensagens (conversa_id, autor, tipo, texto)
  values (g, new.autor, 'mensagem',
          '📢 Novidade nos Canais!' || chr(10) ||
          'Acabamos de publicar: ' || new.titulo || chr(10) || chr(10) ||
          '👉 Leia aqui: https://www.minaslab.online/canais?post=' || new.id || chr(10) ||
          'Curta e deixe seu comentário!')
  returning criado_em, texto into nova;
  update ml_conversas set ultima_msg_em = nova.criado_em, ultima_msg_texto = nova.texto, ultima_msg_autor = new.autor
   where id = g;
  return new;
exception when others then
  raise warning 'ml_canais_avisar_grupo: %', sqlerrm;
  return new;
end $function$;
revoke all on function public.ml_canais_avisar_grupo() from public, anon, authenticated;
