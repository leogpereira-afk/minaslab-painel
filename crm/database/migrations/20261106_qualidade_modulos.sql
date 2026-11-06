-- Laboratório › Qualidade (painel): Documentos e POPs, Equipamentos, Não conformidades, Auditorias e proficiência, Indicadores.
-- Acesso só pela Edge Function ml-qualidade (crachá do painel): RLS ligado e sem políticas = nada pela API pública.

create table if not exists public.qualidade_documentos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  tipo text not null default 'POP' check (tipo in ('PG','POP','IT','FOR','MQ','OUTRO')),
  setor text,
  revisao text not null default '00',
  vigencia_inicio date,
  proxima_revisao date,
  elaborado_por text,
  aprovado_por text,
  status text not null default 'VIGENTE' check (status in ('ELABORACAO','EM_APROVACAO','VIGENTE','OBSOLETO')),
  leitores text[] not null default '{}',        -- usuários do painel que precisam confirmar leitura
  observacao text,
  criado_em timestamptz not null default now(), criado_por text,
  atualizado_em timestamptz not null default now(), atualizado_por text
);
create table if not exists public.qualidade_documento_revisoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.qualidade_documentos(id) on delete cascade,
  revisao text not null, data date not null default current_date, descricao text, autor text,
  criado_em timestamptz not null default now()
);
create table if not exists public.qualidade_documento_leituras (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.qualidade_documentos(id) on delete cascade,
  revisao text not null, usuario text not null, confirmado_em timestamptz not null default now(),
  unique (documento_id, revisao, usuario)
);

create table if not exists public.qualidade_equipamentos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  setor text,
  local text, fabricante text, modelo text, serie text,
  controle text not null default 'CALIBRACAO' check (controle in ('CALIBRACAO','VERIFICACAO','VALIDACAO','DIARIA','NENHUM')),
  periodicidade_meses int,
  proxima date,
  criterio text,
  ensaios_afetados text,
  situacao text not null default 'ATIVO' check (situacao in ('ATIVO','MANUTENCAO','INATIVO')),
  observacao text,
  criado_em timestamptz not null default now(), criado_por text,
  atualizado_em timestamptz not null default now(), atualizado_por text
);
create table if not exists public.qualidade_calibracoes (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references public.qualidade_equipamentos(id) on delete cascade,
  tipo text not null default 'CALIBRACAO' check (tipo in ('CALIBRACAO','VERIFICACAO','VALIDACAO','DIARIA')),
  data date not null default current_date,
  resultado text not null default 'APROVADO' check (resultado in ('APROVADO','REPROVADO')),
  leitura text, certificado text, laboratorio text, observacao text,
  nc_id uuid,
  registrado_por text, criado_em timestamptz not null default now()
);

create table if not exists public.qualidade_nc (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  descricao text,
  origem text not null default 'ROTINA' check (origem in ('ROTINA','RECLAMACAO','AUDITORIA','PROFICIENCIA','EQUIPAMENTO','FORNECEDOR','OUTRA')),
  etapa text not null default 'ABERTA' check (etapa in ('ABERTA','CAUSA','ACAO','EFICACIA','ENCERRADA')),
  responsavel text,
  prazo date,
  trabalho_afetado boolean not null default false,
  impacto text,
  porques text[] not null default '{}',
  causa_raiz text,
  acao text,
  eficacia_em date,
  eficacia_resultado text,
  eficaz boolean,
  ref_tipo text, ref_id uuid,                     -- de onde veio (proficiência, calibração, pesquisa...)
  registrada_por text, criado_em timestamptz not null default now(),
  encerrada_em timestamptz, encerrada_por text,
  atualizado_em timestamptz not null default now(), atualizado_por text
);

create table if not exists public.qualidade_auditorias (
  id uuid primary key default gen_random_uuid(),
  ano int not null,
  requisito text not null,
  mes int not null check (mes between 1 and 12),
  data date,
  status text not null default 'PROGRAMADA' check (status in ('PROGRAMADA','EM_CURSO','FEITA','CANCELADA')),
  auditor text,
  constatacoes text,
  n_constatacoes int not null default 0,
  criado_em timestamptz not null default now(), criado_por text,
  atualizado_em timestamptz not null default now(), atualizado_por text
);
create table if not exists public.qualidade_proficiencia (
  id uuid primary key default gen_random_uuid(),
  provedor text,
  rodada text not null,
  matriz text,
  parametro text not null,
  data date,
  z numeric,
  resultado text not null default 'AGUARDANDO' check (resultado in ('AGUARDANDO','SATISFATORIO','QUESTIONAVEL','INSATISFATORIO','CORRETO','INCORRETO')),
  observacao text,
  nc_id uuid references public.qualidade_nc(id) on delete set null,
  criado_em timestamptz not null default now(), criado_por text,
  atualizado_em timestamptz not null default now(), atualizado_por text
);

create table if not exists public.qualidade_metas (
  chave text primary key,
  rotulo text not null,
  meta numeric not null,
  sentido text not null check (sentido in ('MAX','MIN')),   -- MAX: resultado ≤ meta; MIN: resultado ≥ meta
  unidade text,
  atualizado_em timestamptz not null default now(), atualizado_por text
);
insert into public.qualidade_metas (chave, rotulo, meta, sentido, unidade) values
  ('prazo_liberacao', 'Prazo médio de liberação', 5, 'MAX', 'dias'),
  ('no_prazo', 'Amostras liberadas no prazo', 90, 'MIN', '%'),
  ('reclamacoes', 'Reclamações de clientes (por mês)', 2, 'MAX', ''),
  ('nps', 'NPS da pesquisa de satisfação', 70, 'MIN', ''),
  ('satisfacao', 'Satisfação geral (1–5)', 4.5, 'MIN', ''),
  ('nc_abertas', 'Não conformidades abertas', 5, 'MAX', ''),
  ('equip_em_dia', 'Equipamentos com controle em dia', 100, 'MIN', '%'),
  ('proficiencia', 'Proficiência satisfatória', 90, 'MIN', '%')
on conflict (chave) do nothing;

create table if not exists public.qualidade_arquivos (
  id uuid primary key default gen_random_uuid(),
  ref_tipo text not null check (ref_tipo in ('documento','equipamento','calibracao','nc','auditoria','proficiencia')),
  ref_id uuid not null,
  nome text not null, tipo text, tamanho int, caminho text not null,
  autor text, criado_em timestamptz not null default now(), apagado boolean not null default false
);
create index if not exists qualidade_arquivos_ref_idx on public.qualidade_arquivos (ref_tipo, ref_id) where not apagado;

alter table public.qualidade_documentos enable row level security;
alter table public.qualidade_documento_revisoes enable row level security;
alter table public.qualidade_documento_leituras enable row level security;
alter table public.qualidade_equipamentos enable row level security;
alter table public.qualidade_calibracoes enable row level security;
alter table public.qualidade_nc enable row level security;
alter table public.qualidade_auditorias enable row level security;
alter table public.qualidade_proficiencia enable row level security;
alter table public.qualidade_metas enable row level security;
alter table public.qualidade_arquivos enable row level security;
