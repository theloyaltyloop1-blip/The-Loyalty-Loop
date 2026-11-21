-- Schedule for the reply checker: every 5 minutes, all day, every day,
-- whether or not auto-send is on. Reuses the Vault secret 'outreach_cron_secret'
-- from 20261121182527_outreach_schedule.sql. Apply only AFTER `outreach-replies`
-- is deployed. NOT applied yet.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'outreach-replies') then
    perform cron.unschedule('outreach-replies');
  end if;
end
$$;

select cron.schedule(
  'outreach-replies',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/outreach-replies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-outreach-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'outreach_cron_secret')
    ),
    body := '{"action":"check"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
