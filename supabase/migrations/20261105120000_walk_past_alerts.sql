-- Walk-past alerts: a shopper who opts in gets one notification when they walk
-- past a shop they have not joined, if that shop has set a walk-past offer.
--
-- The phone watches the nearest offer shops itself (geofences) and only tells
-- the server "I am at shop X" when it enters one. Geofences can fire while the
-- phone is locked, when the signed-in session may be unreadable, so each
-- opted-in phone holds a random device key instead; the server stores only
-- its SHA-256 hash. Turning the setting off deletes the key.
--
-- Limits (enforced here, not on the phone): at most one walk-past alert per
-- person per 20 hours, the same shop at most once per 30 days, only between
-- 08:00 and 20:00 London time, only while the shop is open (when it has
-- opening hours), never for a shop the person already belongs to.

alter table public.businesses
  add column if not exists nearby_offer text
  check (nearby_offer is null or char_length(nearby_offer) between 3 and 80);

create table if not exists public.nearby_alert_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  platform text,
  consented_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index if not exists nearby_alert_devices_user_idx on public.nearby_alert_devices (user_id);
alter table public.nearby_alert_devices enable row level security;
create policy "nearby_alert_devices_select_own" on public.nearby_alert_devices
  for select using (user_id = auth.uid());

create table if not exists public.nearby_alert_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  offer text not null,
  sent_at timestamptz not null default now()
);
create index if not exists nearby_alert_log_user_idx on public.nearby_alert_log (user_id, sent_at desc);
create index if not exists nearby_alert_log_business_idx on public.nearby_alert_log (business_id, sent_at desc);
alter table public.nearby_alert_log enable row level security;
-- No client policies: written by nearby_walk_past, read through nearby_alert_stats.

create or replace function public.nearby_alerts_enable(_token text, _platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if _token is null or char_length(_token) < 32 then raise exception 'invalid_arguments'; end if;
  insert into public.nearby_alert_devices (user_id, token_hash, platform)
  values (auth.uid(), encode(extensions.digest(_token, 'sha256'), 'hex'), left(_platform, 16))
  on conflict (token_hash) do update set user_id = excluded.user_id, consented_at = now();
end;
$$;

-- Off means off everywhere: every phone this person opted in on stops.
create or replace function public.nearby_alerts_disable()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.nearby_alert_devices where user_id = auth.uid();
$$;

create or replace function public.set_nearby_offer(_business_id uuid, _offer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _clean text := nullif(trim(_offer), '');
begin
  if not exists (select 1 from public.businesses b where b.id = _business_id and b.owner_id = auth.uid())
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if _clean is not null and char_length(_clean) not between 3 and 80 then
    raise exception 'offer_length';
  end if;
  update public.businesses set nearby_offer = _clean where id = _business_id;
end;
$$;

-- Called by the phone (possibly locked, so by device key) when it enters a
-- shop's geofence. Returns what to show, or notify = false.
create or replace function public.nearby_walk_past(_token text, _business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _device public.nearby_alert_devices;
  _shop public.businesses;
  _now timestamptz := now();
  _local timestamp := now() at time zone 'Europe/London';
  _minutes integer := extract(hour from _local)::integer * 60 + extract(minute from _local)::integer;
  _day jsonb;
  _open integer;
  _close integer;
begin
  if _token is null or _business_id is null then
    return jsonb_build_object('notify', false, 'reason', 'invalid');
  end if;
  select * into _device from public.nearby_alert_devices
  where token_hash = encode(extensions.digest(_token, 'sha256'), 'hex');
  if not found then
    return jsonb_build_object('notify', false, 'reason', 'not_opted_in');
  end if;
  update public.nearby_alert_devices set last_seen_at = _now where id = _device.id;

  select * into _shop from public.businesses where id = _business_id;
  if not found or not _shop.is_active or _shop.approval_status <> 'approved' or _shop.nearby_offer is null then
    return jsonb_build_object('notify', false, 'reason', 'no_offer');
  end if;

  if exists (select 1 from public.memberships m where m.user_id = _device.user_id and m.business_id = _business_id) then
    return jsonb_build_object('notify', false, 'reason', 'member');
  end if;

  if _minutes < 8 * 60 or _minutes >= 20 * 60 then
    return jsonb_build_object('notify', false, 'reason', 'quiet_hours');
  end if;

  if _shop.opening_hours is not null and _shop.opening_hours <> '{}'::jsonb then
    _day := _shop.opening_hours -> (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from _local)::integer + 1];
    if _day is null or coalesce((_day ->> 'closed')::boolean, false) then
      return jsonb_build_object('notify', false, 'reason', 'closed');
    end if;
    begin
      _open := split_part(_day ->> 'open', ':', 1)::integer * 60 + coalesce(nullif(split_part(_day ->> 'open', ':', 2), '')::integer, 0);
      _close := split_part(_day ->> 'close', ':', 1)::integer * 60 + coalesce(nullif(split_part(_day ->> 'close', ':', 2), '')::integer, 0);
      if _minutes < _open or _minutes >= _close then
        return jsonb_build_object('notify', false, 'reason', 'closed');
      end if;
    exception when others then
      null; -- hours we cannot read do not block the alert
    end;
  end if;

  -- Lock this person's log rows so two shops entered at once cannot both pass the daily cap.
  perform 1 from public.nearby_alert_devices where user_id = _device.user_id for update;
  if exists (select 1 from public.nearby_alert_log l where l.user_id = _device.user_id and l.sent_at > _now - interval '20 hours') then
    return jsonb_build_object('notify', false, 'reason', 'daily_cap');
  end if;
  if exists (select 1 from public.nearby_alert_log l where l.user_id = _device.user_id and l.business_id = _business_id and l.sent_at > _now - interval '30 days') then
    return jsonb_build_object('notify', false, 'reason', 'shop_cap');
  end if;

  insert into public.nearby_alert_log (user_id, business_id, offer) values (_device.user_id, _business_id, _shop.nearby_offer);
  return jsonb_build_object(
    'notify', true,
    'business_id', _business_id,
    'title', 'You''re right by ' || _shop.name,
    'body', _shop.nearby_offer
  );
end;
$$;

-- For the shop: how many people were alerted in the last 30 days and how many
-- of them joined afterwards. Counts only, never who.
create or replace function public.nearby_alert_stats(_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from public.businesses b where b.id = _business_id and b.owner_id = auth.uid())
         and not public.has_role(auth.uid(), 'admin') then null
    else jsonb_build_object(
      'alerted', (select count(*) from public.nearby_alert_log l where l.business_id = _business_id and l.sent_at > now() - interval '30 days'),
      'joined', (select count(*) from public.nearby_alert_log l
                 join public.memberships m on m.user_id = l.user_id and m.business_id = l.business_id
                 where l.business_id = _business_id and l.sent_at > now() - interval '30 days' and m.joined_at >= l.sent_at)
    )
  end
$$;

revoke all on function public.nearby_alerts_enable(text, text) from public, anon;
revoke all on function public.nearby_alerts_disable() from public, anon;
revoke all on function public.set_nearby_offer(uuid, text) from public, anon;
revoke all on function public.nearby_walk_past(text, uuid) from public;
revoke all on function public.nearby_alert_stats(uuid) from public, anon;
grant execute on function public.nearby_alerts_enable(text, text) to authenticated;
grant execute on function public.nearby_alerts_disable() to authenticated;
grant execute on function public.set_nearby_offer(uuid, text) to authenticated;
grant execute on function public.nearby_walk_past(text, uuid) to anon, authenticated;
grant execute on function public.nearby_alert_stats(uuid) to authenticated;
