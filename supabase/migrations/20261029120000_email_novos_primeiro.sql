-- E-mail: lê primeiro os mais novos. O histórico agora desce do e-mail mais novo
-- até achar e-mails com mais de 30 dias (piso_uid = menor UID já lido no histórico).
alter table public.email_estado
  add column if not exists piso_uid bigint,
  add column if not exists historico_ok boolean not null default false;
-- Recomeça pelo topo da caixa (os e-mails já gravados são pulados sem baixar de novo).
update public.email_estado set ultimo_uid = 0, piso_uid = null, historico_ok = false;
