-- Controle de Kits (CRM › Gestão): frascos, sacos, placas e materiais enviados aos clientes.
-- Substitui a planilha "CONTROLE DE ENVIO DE MATERIAIS". Cada envio tem prazo de devolução;
-- passou do prazo, a rotina diária cria uma tarefa de cobrança. Devolução conferida item a item:
-- o que falta ou volta danificado vira valor a cobrar (custo do catálogo).

-- Catálogo: nomes fixos (a planilha tinha "saco micro" escrito de 3 jeitos e "frasco 1 L" de 6).
create table if not exists public.kit_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  retornavel boolean not null default true,
  custo numeric(12,2) check (custo is null or custo >= 0),
  ativo boolean not null default true,
  ordem integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists kit_itens_nome_uk on public.kit_itens (lower(btrim(nome)));

insert into public.kit_itens (nome, retornavel, ordem) values
  ('Frasco plástico 1 L', true, 10), ('Frasco plástico 500 mL', true, 11), ('Frasco plástico 800 mL', true, 12),
  ('Frasco de vidro 1 L', true, 13), ('Frasco âmbar 50 mL', true, 14), ('Frasco âmbar 100 mL', true, 15),
  ('Saco para microbiologia', false, 20), ('Pote estéril (microbiologia)', false, 21), ('Placa de Petri', true, 22),
  ('Branco de campo', true, 23), ('Frasco hemocultura', true, 24), ('Esponja', false, 25), ('Swab', false, 26),
  ('Tubo vial', true, 27), ('Gelo reciclável (gelox)', true, 30), ('Caixa térmica', true, 31)
on conflict do nothing;

create sequence if not exists public.kit_envios_seq;

create table if not exists public.kit_envios (
  id uuid primary key default gen_random_uuid(),
  numero text unique,
  cliente_id uuid references public.clientes(id),
  cliente_nome text,
  contato_id uuid references public.contatos(id),
  contato_nome text,
  contato_whatsapp text,
  ordem_servico_id uuid references public.ordens_servico(id),
  numero_os text,
  data_envio date,
  forma_envio text check (forma_envio is null or forma_envio in ('RETIRADA', 'MOTOBOY', 'COLETOR', 'CORREIO', 'TRANSPORTADORA', 'OUTRA')),
  prazo_dias integer not null default 10 check (prazo_dias between 0 and 365),
  data_limite date,
  prazo_manual boolean not null default false,
  status text not null default 'AGUARDANDO_RETIRADA'
    check (status in ('AGUARDANDO_RETIRADA', 'COM_CLIENTE', 'DEVOLVIDO', 'DEVOLVIDO_COM_FALTA', 'CANCELADO')),
  data_devolucao date,
  valor_a_cobrar numeric(12,2) not null default 0,
  cobranca text check (cobranca is null or cobranca in ('A_COBRAR', 'COBRADO', 'PAGO', 'ABONADO')),
  responsavel_id uuid references public.profiles(id),
  tarefa_atraso_id uuid references public.tarefas(id),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_at timestamptz,
  constraint kit_envios_cliente_chk check (cliente_id is not null or nullif(btrim(cliente_nome), '') is not null)
);
comment on table public.kit_envios is 'Controle de Kits: material enviado ao cliente e devolução. data_limite = data_envio + prazo_dias (ou prorrogada manualmente).';

create table if not exists public.kit_envio_itens (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references public.kit_envios(id) on delete cascade,
  item_id uuid references public.kit_itens(id),
  descricao text not null,
  quantidade integer not null check (quantidade > 0),
  devolvido integer not null default 0 check (devolvido >= 0),
  avariado integer not null default 0 check (avariado >= 0),
  retornavel boolean not null default true,
  custo_unitario numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists public.kit_eventos (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references public.kit_envios(id) on delete cascade,
  tipo text not null check (tipo in ('CRIADO', 'ENVIADO', 'WHATSAPP', 'LIGACAO', 'NOTA', 'PRORROGADO', 'DEVOLUCAO', 'COBRANCA', 'TAREFA', 'CANCELADO', 'EDITADO')),
  texto text,
  automatico boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create index if not exists kit_envios_status_idx on public.kit_envios (status, data_limite) where deleted_at is null;
create index if not exists kit_envios_cliente_idx on public.kit_envios (cliente_id) where deleted_at is null;
create index if not exists kit_envios_os_idx on public.kit_envios (ordem_servico_id) where ordem_servico_id is not null;
create index if not exists kit_envio_itens_envio_idx on public.kit_envio_itens (envio_id);
create index if not exists kit_eventos_envio_idx on public.kit_eventos (envio_id, created_at desc);
alter table public.tarefas add column if not exists kit_envio_id uuid references public.kit_envios(id);

-- Número, vínculos e prazo calculados no banco (mesma regra para a tela e a rotina).
create or replace function public.kit_envios_preparar()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $$
begin
  new.updated_at := now();
  if new.numero is null then
    new.numero := 'KIT ' || to_char(coalesce(new.data_envio, current_date), 'YYYY') || '-' || lpad(nextval('public.kit_envios_seq')::text, 4, '0');
  end if;
  new.numero_os := nullif(btrim(new.numero_os), '');
  if new.ordem_servico_id is null and new.numero_os is not null then
    select o.id into new.ordem_servico_id from public.ordens_servico o
     where o.deleted_at is null and lower(btrim(o.numero_os)) = lower(new.numero_os) limit 1;
  end if;
  if new.cliente_id is null and new.ordem_servico_id is not null then
    select o.cliente_id into new.cliente_id from public.ordens_servico o where o.id = new.ordem_servico_id;
  end if;
  if new.cliente_id is not null then
    select coalesce(nullif(btrim(c.nome_fantasia), ''), c.razao_social) into new.cliente_nome from public.clientes c where c.id = new.cliente_id;
  end if;
  if new.contato_id is not null then
    select ct.nome, coalesce(ct.whatsapp_e164, ct.telefone_e164) into new.contato_nome, new.contato_whatsapp from public.contatos ct where ct.id = new.contato_id;
  end if;
  if not new.prazo_manual then
    new.data_limite := case when new.data_envio is null then null else new.data_envio + new.prazo_dias end;
  end if;
  return new;
end $$;
create trigger trg_kit_envios_preparar before insert or update on public.kit_envios
for each row execute function public.kit_envios_preparar();

-- Rotina diária: envio com o cliente e prazo vencido → tarefa de cobrança (uma por envio).
create or replace function public.kit_envios_cobrar_atrasados()
returns integer language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare r record; v_tarefa uuid; n integer := 0;
begin
  -- Só a rotina (cron, sem JWT) ou o service_role; pela API pública não.
  if coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') in ('anon', 'authenticated') then
    raise exception 'sem permissão';
  end if;
  for r in
    select e.*, (select string_agg(i.quantidade || ' ' || i.descricao, ', ') from public.kit_envio_itens i where i.envio_id = e.id) as itens
      from public.kit_envios e
     where e.deleted_at is null and e.status = 'COM_CLIENTE' and e.data_limite < current_date and e.tarefa_atraso_id is null
  loop
    insert into public.tarefas (responsavel_id, titulo, descricao, prazo, status, prioridade, cliente_id, kit_envio_id, created_by)
    values (coalesce(r.responsavel_id, r.created_by),
            'Cobrar devolução do ' || r.numero || ' — ' || coalesce(r.cliente_nome, 'cliente'),
            'Material com o cliente desde ' || to_char(r.data_envio, 'DD/MM/YYYY') || ', prazo de devolução era ' || to_char(r.data_limite, 'DD/MM/YYYY') ||
              '. Itens: ' || coalesce(r.itens, '—') || coalesce('. Contato: ' || r.contato_nome, '') || '. Controle de Kits no CRM.',
            now(), 'PENDENTE', 'ALTA', r.cliente_id, r.id, coalesce(r.responsavel_id, r.created_by))
    returning id into v_tarefa;
    update public.kit_envios set tarefa_atraso_id = v_tarefa where id = r.id;
    insert into public.kit_eventos (envio_id, tipo, texto, automatico)
    values (r.id, 'TAREFA', 'Prazo vencido em ' || to_char(r.data_limite, 'DD/MM') || ': tarefa de cobrança criada.', true);
    n := n + 1;
  end loop;
  return n;
end $$;

alter table public.kit_itens enable row level security;
alter table public.kit_envios enable row level security;
alter table public.kit_envio_itens enable row level security;
alter table public.kit_eventos enable row level security;

create policy kit_itens_read on public.kit_itens for select to authenticated
  using ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read')));
create policy kit_itens_write on public.kit_itens for all to authenticated
  using ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')))
  with check ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')));
create policy kit_envios_read on public.kit_envios for select to authenticated
  using ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read')));
create policy kit_envios_insert on public.kit_envios for insert to authenticated
  with check ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')));
create policy kit_envios_update on public.kit_envios for update to authenticated
  using ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')))
  with check ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')));
create policy kit_envio_itens_read on public.kit_envio_itens for select to authenticated
  using ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read')));
create policy kit_envio_itens_write on public.kit_envio_itens for all to authenticated
  using ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')))
  with check ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')));
create policy kit_eventos_read on public.kit_eventos for select to authenticated
  using ((select public.has_permission('crm.read')) or (select public.has_permission('operational.read')));
create policy kit_eventos_insert on public.kit_eventos for insert to authenticated
  with check ((select public.has_permission('crm.write')) or (select public.has_permission('operational.import')));

grant select, insert, update, delete on public.kit_itens, public.kit_envios, public.kit_envio_itens, public.kit_eventos to authenticated, service_role;
grant usage on sequence public.kit_envios_seq to authenticated, service_role;

select cron.schedule('kits-cobrar-atrasados', '15 11 * * *', 'select public.kit_envios_cobrar_atrasados();')
where not exists (select 1 from cron.job where jobname = 'kits-cobrar-atrasados');
