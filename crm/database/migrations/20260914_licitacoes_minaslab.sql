-- Módulo de Licitações exclusivo da MinasLab.
create table public.licitacoes (
 id uuid primary key default gen_random_uuid(), empresa text not null default 'MINASLAB' check (empresa='MINASLAB'),
 numero text not null, orgao text not null, modalidade text, objeto text not null, portal_url text, municipio text, uf text check(uf is null or length(uf)=2),
 status text not null default 'MONITORAMENTO' check(status in ('MONITORAMENTO','ANALISE','PREPARACAO','PROPOSTA_ENVIADA','SESSAO','HABILITACAO','ADJUDICADA','GANHA','PERDIDA','CANCELADA')),
 data_publicacao date, data_sessao timestamptz,
 valor_estimado numeric(14,2) check(valor_estimado is null or valor_estimado>=0), valor_proposta numeric(14,2) check(valor_proposta is null or valor_proposta>=0), valor_homologado numeric(14,2) check(valor_homologado is null or valor_homologado>=0),
 cliente_id uuid references public.clientes(id) on delete set null, proposta_id uuid references public.propostas(id) on delete set null, contrato_id uuid references public.contratos(id) on delete set null, responsavel_id uuid references public.profiles(id) on delete set null,
 resultado text, motivo_perda text, observacoes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null, deleted_at timestamptz
);
create unique index licitacoes_numero_uq on public.licitacoes(empresa,lower(numero)) where deleted_at is null;
create index licitacoes_status_idx on public.licitacoes(status) where deleted_at is null;
create index licitacoes_sessao_idx on public.licitacoes(data_sessao) where deleted_at is null;

create table public.licitacao_responsaveis (
 licitacao_id uuid not null references public.licitacoes(id) on delete cascade, usuario_id uuid not null references public.profiles(id) on delete cascade,
 papel text, created_at timestamptz not null default now(), primary key(licitacao_id,usuario_id)
);
create table public.licitacao_prazos (
 id uuid primary key default gen_random_uuid(), licitacao_id uuid not null references public.licitacoes(id) on delete cascade,
 tipo text not null default 'PRAZO' check(tipo in ('PUBLICACAO','ESCLARECIMENTO','IMPUGNACAO','DOCUMENTO','PROPOSTA','SESSAO','RECURSO','CONTRATO','PRAZO')),
 titulo text not null, prazo timestamptz not null, lembrete_em timestamptz, status text not null default 'PENDENTE' check(status in ('PENDENTE','CONCLUIDO','CANCELADO')),
 responsavel_id uuid references public.profiles(id) on delete set null, tarefa_id uuid references public.tarefas(id) on delete set null, observacoes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null
);
create index licitacao_prazos_alerta_idx on public.licitacao_prazos(prazo) where status='PENDENTE';
create table public.licitacao_concorrentes (
 id uuid primary key default gen_random_uuid(), licitacao_id uuid not null references public.licitacoes(id) on delete cascade,
 nome text not null, cnpj text, valor_proposta numeric(14,2) check(valor_proposta is null or valor_proposta>=0), classificacao integer check(classificacao is null or classificacao>0),
 vencedora boolean not null default false, observacoes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.licitacao_documentos (
 id uuid primary key default gen_random_uuid(), licitacao_id uuid not null references public.licitacoes(id) on delete cascade,
 nome text not null, categoria text not null default 'OUTRO' check(categoria in ('EDITAL','HABILITACAO','CERTIDAO','PROPOSTA','ATA','CONTRATO','OUTRO')),
 storage_path text not null unique, mime_type text, tamanho_bytes bigint check(tamanho_bytes is null or tamanho_bytes>=0), validade date,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null
);
alter table public.tarefas add column licitacao_id uuid references public.licitacoes(id) on delete set null;
create index tarefas_licitacao_idx on public.tarefas(licitacao_id) where deleted_at is null;
insert into storage.buckets(id,name,public,file_size_limit) values('licitacoes-documentos','licitacoes-documentos',false,20971520);

alter table public.licitacoes enable row level security;
alter table public.licitacao_responsaveis enable row level security;
alter table public.licitacao_prazos enable row level security;
alter table public.licitacao_concorrentes enable row level security;
alter table public.licitacao_documentos enable row level security;
do $$ declare t text; begin foreach t in array array['licitacoes','licitacao_responsaveis','licitacao_prazos','licitacao_concorrentes','licitacao_documentos'] loop
 execute format('create policy %I on public.%I for select to authenticated using (public.has_permission(''crm.read''))',t||'_read',t);
 execute format('create policy %I on public.%I for all to authenticated using (public.has_permission(''crm.write'')) with check (public.has_permission(''crm.write''))',t||'_write',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated,service_role',t);
end loop; end $$;
create policy licitacoes_storage_read on storage.objects for select to authenticated using(bucket_id='licitacoes-documentos' and public.has_permission('crm.read'));
create policy licitacoes_storage_write on storage.objects for all to authenticated using(bucket_id='licitacoes-documentos' and public.has_permission('crm.write')) with check(bucket_id='licitacoes-documentos' and public.has_permission('crm.write'));

