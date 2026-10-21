-- Entrada única: quem está logado no painel abre o CRM sem digitar senha de novo.
-- Esta tabela diz qual conta do CRM (Supabase Auth) pertence a cada usuário do painel.
-- Só a função crm-sso (service role) lê: RLS ligado e nenhuma política.
create table if not exists public.crm_sso_vinculos (
  usuario_painel text primary key,
  crm_user_id uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.crm_sso_vinculos enable row level security;
revoke all on public.crm_sso_vinculos from anon, authenticated;

-- Vínculos iniciais, pelos nomes das pessoas. Quem não está aqui não entra no CRM pelo painel.
insert into public.crm_sso_vinculos (usuario_painel, crm_user_id)
select v.usuario, u.id
  from (values
    ('ana',         'financeiro@minaslab.net'),
    ('leonardo',    'leogpereira@gmail.com'),
    ('ruthdias',    'contato@minaslab.net'),
    ('lidiany',     'qualidade@minaslab.net'),
    ('joseroberto', 'logisticaminaslab@gmail.com'),
    ('caroline',    'comercialminaslab@gmail.com')
  ) as v(usuario, email)
  join auth.users u on lower(u.email) = v.email
on conflict (usuario_painel) do nothing;
