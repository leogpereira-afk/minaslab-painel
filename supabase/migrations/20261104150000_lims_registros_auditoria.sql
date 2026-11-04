-- MinasLab LIMS: tabelas próprias, separadas de ml_registros.
--
-- Por que separado: o ml-sync deixa conta de equipe sem matriz ler e gravar
-- qualquer coleção de ml_registros. Os dados do laboratório (catálogo,
-- propostas, resultados) não podem passar por essa porta. Aqui só a Edge
-- Function ml-lims mexe: RLS ligado e sem política nenhuma para anon e
-- authenticated (só o service_role, que ignora RLS, acessa).

create table if not exists public.ml_lims_registros (
  colecao       text        not null check (colecao ~ '^[a-z][a-z0-9_]{1,40}$'),
  id            text        not null check (char_length(id) between 1 and 80),
  registro      jsonb       not null,
  apagado       boolean     not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (colecao, id)
);
comment on table public.ml_lims_registros is 'MinasLab LIMS: registros por coleção (catálogo, cadastros, propostas...). Só a Edge Function ml-lims acessa.';

-- Leitura incremental por coleção (o que mudou desde X).
create index if not exists ml_lims_registros_colecao_atualizado_idx
  on public.ml_lims_registros (colecao, atualizado_em);

-- Trilha de auditoria (ISO/IEC 17025 7.5 e 7.11): só acrescenta, nunca altera
-- nem apaga. Guarda quem, quando, o quê, antes e depois.
create table if not exists public.ml_lims_auditoria (
  id          bigint generated always as identity primary key,
  em          timestamptz not null default now(),
  usuario     text        not null,
  colecao     text        not null,
  registro_id text        not null,
  acao        text        not null,
  antes       jsonb,
  depois      jsonb
);
comment on table public.ml_lims_auditoria is 'MinasLab LIMS: trilha de auditoria. Só inserção; alterar ou apagar é bloqueado por gatilho.';
create index if not exists ml_lims_auditoria_registro_idx on public.ml_lims_auditoria (colecao, registro_id, em desc);
create index if not exists ml_lims_auditoria_em_idx on public.ml_lims_auditoria (em desc);

create or replace function public.ml_lims_auditoria_somente_insercao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A trilha de auditoria do LIMS não pode ser alterada nem apagada.';
end;
$$;

drop trigger if exists ml_lims_auditoria_bloqueia on public.ml_lims_auditoria;
create trigger ml_lims_auditoria_bloqueia
  before update or delete on public.ml_lims_auditoria
  for each row execute function public.ml_lims_auditoria_somente_insercao();

-- Numeração atômica (proposta, contrato, OS, amostra, laudo...): dois usuários
-- criando ao mesmo tempo nunca recebem o mesmo número.
create table if not exists public.ml_lims_contadores (
  chave text   primary key check (chave ~ '^[a-z][a-z0-9_:]{1,60}$'),
  valor bigint not null default 0
);
comment on table public.ml_lims_contadores is 'MinasLab LIMS: sequências de numeração por chave (ex.: proposta:2026).';

create or replace function public.ml_lims_proximo(p_chave text, p_minimo bigint default 0)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.ml_lims_contadores (chave, valor)
  values (p_chave, greatest(p_minimo, 0) + 1)
  on conflict (chave) do update
    set valor = greatest(public.ml_lims_contadores.valor, p_minimo) + 1
  returning valor;
$$;

alter table public.ml_lims_registros  enable row level security;
alter table public.ml_lims_registros  force  row level security;
alter table public.ml_lims_auditoria  enable row level security;
alter table public.ml_lims_auditoria  force  row level security;
-- Contadores: sem FORCE, porque ml_lims_proximo (security definer) grava como
-- dono da tabela. Continua fechada para anon e authenticated (revoke abaixo).
alter table public.ml_lims_contadores enable row level security;

revoke all on public.ml_lims_registros, public.ml_lims_auditoria, public.ml_lims_contadores from anon, authenticated;
revoke all on function public.ml_lims_proximo(text, bigint) from public, anon, authenticated;
revoke all on function public.ml_lims_auditoria_somente_insercao() from public, anon, authenticated;
grant execute on function public.ml_lims_proximo(text, bigint) to service_role;
