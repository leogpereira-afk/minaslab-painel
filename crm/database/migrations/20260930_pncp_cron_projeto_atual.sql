-- O cron criado em 20260914_pncp_edge_cron_fix.sql apontava para outro projeto Supabase.
-- Recria o job diário chamando a Edge Function pncp-opportunities-sync deste projeto.
select cron.unschedule(jobid) from cron.job where jobname='pncp-opportunities-daily';
select cron.schedule('pncp-opportunities-daily','0 10 * * *',$$select net.http_post(url:='https://reoghclxripktzpdwhiy.supabase.co/functions/v1/pncp-opportunities-sync',headers:='{"Content-Type":"application/json"}'::jsonb,body:='{}'::jsonb,timeout_milliseconds:=120000);$$);
