-- Schedule for the SumUp till sync. The call authenticates with a random secret
-- created inside the database (Vault); nobody needs to see or copy it, and the
-- service-role key is never involved. NOT applied yet.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'sumup_sync_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'sumup_sync_secret',
      'Shared secret for the scheduled sumup-sync call'
    );
  end if;
end
$$;

create or replace function public.pos_sync_secret_ok(_secret text)
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
      where s.name = 'sumup_sync_secret' and s.decrypted_secret = _secret
    )
$$;

revoke execute on function public.pos_sync_secret_ok(text) from public, anon, authenticated;
grant execute on function public.pos_sync_secret_ok(text) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sumup-sync') then
    perform cron.unschedule('sumup-sync');
  end if;
end
$$;

select cron.schedule(
  'sumup-sync',
  '*/2 * * * *',
  $job$
  select net.http_post(
    url := 'https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/sumup-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sumup_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $job$
);
