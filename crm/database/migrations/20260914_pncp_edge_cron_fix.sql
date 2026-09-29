create extension if not exists pg_net with schema extensions;
create table public.pncp_sync_controle(id integer primary key check(id=1),ultima_tentativa timestamptz,ultima_execucao timestamptz,ultimo_resultado jsonb);
alter table public.pncp_sync_controle enable row level security;
revoke all on public.pncp_sync_controle from anon,authenticated;
grant all on public.pncp_sync_controle to service_role;
select cron.unschedule(jobid) from cron.job where jobname='pncp-opportunities-daily';
select cron.schedule('pncp-opportunities-daily','0 10 * * *',$$select net.http_post(url:='https://mhsgihqtohogerquuyyv.supabase.co/functions/v1/pncp-opportunities-sync',headers:='{"Content-Type":"application/json"}'::jsonb,body:='{}'::jsonb);$$);
drop function if exists public.crm_sync_pncp_opportunities();
drop function if exists private.sync_pncp_opportunities();
