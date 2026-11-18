-- Schedule for the outreach sender. Apply only AFTER the `outreach-send`
-- function is deployed and its secrets are set. NOT applied yet.
--
-- Runs every minute, but only calls the function while auto-send is on.
-- The function itself decides whether to send (sending hours, weekdays,
-- daily limit, the random 1.5-4 minute gap), so a minute is just the
-- resolution of that gap, not a sending rate.
--
-- The call authenticates with a random secret created inside the database
-- (Vault); nobody needs to see or copy it.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'outreach_cron_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'outreach_cron_secret',
      'Shared secret for the scheduled outreach-send call'
    );
  end if;
end
$$;

create or replace function public.outreach_cron_secret_ok(_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _secret is not null
    and length(_secret) >= 32
    and exists (
      select 1 from vault.decrypted_secrets s
      where s.name = 'outreach_cron_secret' and s.decrypted_secret = _secret
    )
$$;

revoke execute on function public.outreach_cron_secret_ok(text) from public, anon, authenticated;
grant execute on function public.outreach_cron_secret_ok(text) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'outreach-send') then
    perform cron.unschedule('outreach-send');
  end if;
end
$$;

select cron.schedule(
  'outreach-send',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/outreach-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-outreach-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'outreach_cron_secret')
    ),
    body := '{"action":"tick"}'::jsonb,
    timeout_milliseconds := 55000
  )
  from public.outreach_settings
  where id and auto_send;
  $job$
);
