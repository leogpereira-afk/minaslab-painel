-- E-mail: as pastas da caixa (as criadas no webmail também). A função email-atendimento
-- atualiza a lista a cada leitura; Lixeira, Spam e Rascunhos ficam de fora (lida = false).
create table if not exists public.email_pastas (
  nome text primary key,          -- nome IMAP (ex.: INBOX.Clientes)
  caixa text not null,
  rotulo text not null,           -- nome para mostrar (ex.: Clientes)
  especial text,                  -- inbox | sent | trash | junk | drafts | archive
  lida boolean not null default true,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now()
);
alter table public.email_pastas enable row level security;
drop policy if exists email_pastas_select on public.email_pastas;
create policy email_pastas_select on public.email_pastas for select to authenticated using ((select public.has_permission('crm.read')));
revoke all on public.email_pastas from anon;
grant select on public.email_pastas to authenticated;
create index if not exists email_mensagens_pasta_nome_idx on public.email_mensagens(pasta, recebido_em desc);
