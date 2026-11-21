-- Automatic win-back emails, part 2 of 2: the daily job. NOT applied yet.
-- Apply only AFTER part 1 (20261121200000_automatic_winback.sql) is applied and
-- the new send-winback-emails function is deployed.
--
-- pg_cron runs in UTC. 10:00 in London is 10:00 UTC in winter and 09:00 UTC in
-- summer, so the job fires every 15 minutes from 09:00 to 10:45 UTC and the
-- function only acts while it is 10 o'clock in London. Each shop is claimed once
-- per London day (winback_auto_runs), so the later calls only pick up shops an
-- earlier call did not reach.
--
-- To switch it off again:  select cron.unschedule('winback-auto');

do $$
begin
  if exists (select 1 from cron.job where jobname = 'winback-auto') then
    perform cron.unschedule('winback-auto');
  end if;
end
$$;

select cron.schedule(
  'winback-auto',
  '0,15,30,45 9,10 * * *',
  $job$
  select net.http_post(
    url := 'https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/send-winback-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-winback-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'winback_cron_secret')
    ),
    body := '{"mode":"scheduled"}'::jsonb,
    timeout_milliseconds := 140000
  );
  $job$
);
