-- 1. Sign-up reward: fires once per real membership insert (never fires on
--    the "join" upsert's ON CONFLICT DO NOTHING no-op, since Postgres
--    triggers don't run for suppressed inserts). Was configurable in
--    Settings but never actually granted anything — this is the missing
--    other half.
create or replace function public.grant_signup_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _title text;
begin
  select loyalty_config->>'signup_reward_title' into _title
  from public.businesses where id = new.business_id;

  if _title is not null and length(trim(_title)) > 0 then
    insert into public.rewards (user_id, business_id, title)
    values (new.user_id, new.business_id, _title);

    insert into public.notifications (user_id, business_id, kind, title, body)
    values (new.user_id, new.business_id, 'reward', 'Welcome reward!', _title || ' is ready to redeem.');
  end if;

  return new;
end;
$$;

create trigger on_membership_signup_reward
  after insert on public.memberships
  for each row execute function public.grant_signup_reward();

-- ---------------------------------------------------------------------
-- 2. Loyalty type support: the reward-engine trigger only ever tracked
--    stamp_count regardless of businesses.loyalty_type, so switching a shop
--    to "points" or "visits" in Settings changed the label but not the
--    actual mechanics. Now branches on loyalty_type: 'points' progresses
--    memberships.points_balance, 'stamp_card'/'tiered' both progress
--    stamp_count (tiered = visits, same cycling mechanic, different label)
--    — visit_count remains the separate monotonic lifetime-visits stat,
--    always incremented regardless of loyalty type.
create or replace function public.handle_stamp_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _membership public.memberships;
  _loyalty_type loyalty_type;
  _config jsonb;
  _stamps_required integer;
  _remaining integer;
  _tier record;
  _new_count integer;
  _crossed_any boolean := false;
  _unit text;
begin
  select * into _membership from public.memberships
    where user_id = new.user_id and business_id = new.business_id
    for update;

  if not found then
    raise exception 'customer has no membership at this business';
  end if;

  select loyalty_type into _loyalty_type from public.businesses where id = new.business_id;

  if _loyalty_type = 'points' then
    _new_count := _membership.points_balance;
    _unit := 'points';
  else
    _new_count := _membership.stamp_count;
    _unit := case when _loyalty_type = 'tiered' then 'visits' else 'stamps' end;
  end if;

  _remaining := new.value;

  if exists (select 1 from public.reward_catalog where business_id = new.business_id) then
    while _remaining > 0 loop
      select * into _tier from public.reward_catalog
        where business_id = new.business_id and stamp_threshold > _new_count
        order by stamp_threshold asc
        limit 1;

      declare
        _top integer := (select max(stamp_threshold) from public.reward_catalog where business_id = new.business_id);
        _needed integer := _tier.stamp_threshold - _new_count;
      begin
        if _remaining < _needed then
          _new_count := _new_count + _remaining;
          _remaining := 0;
        else
          _remaining := _remaining - _needed;
          _crossed_any := true;

          insert into public.rewards (user_id, business_id, title, catalog_id)
          values (new.user_id, new.business_id, _tier.title, _tier.id);

          insert into public.notifications (user_id, business_id, kind, title, body)
          values (new.user_id, new.business_id, 'reward', 'Reward earned!', _tier.title || ' is ready to redeem.');

          _new_count := case when _tier.stamp_threshold >= _top then 0 else _tier.stamp_threshold end;
        end if;
      end;
    end loop;
  else
    _config := (select loyalty_config from public.businesses where id = new.business_id);
    _stamps_required := coalesce((_config->>'stamps_required')::integer, 10);
    _new_count := _new_count + new.value;

    if _new_count >= _stamps_required then
      _crossed_any := true;
      insert into public.rewards (user_id, business_id, title)
      values (new.user_id, new.business_id, 'Free reward');

      insert into public.notifications (user_id, business_id, kind, title, body)
      values (new.user_id, new.business_id, 'reward', 'Reward earned!', 'Free reward is ready to redeem.');

      _new_count := _new_count % _stamps_required;
    end if;
  end if;

  if _loyalty_type = 'points' then
    update public.memberships
      set points_balance = _new_count,
          visit_count = visit_count + 1,
          last_visit_date = (now() at time zone 'utc')::date,
          last_activity_at = now()
      where id = _membership.id;
  else
    update public.memberships
      set stamp_count = _new_count,
          visit_count = visit_count + 1,
          last_visit_date = (now() at time zone 'utc')::date,
          last_activity_at = now()
      where id = _membership.id;
  end if;

  if not _crossed_any then
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (
      new.user_id, new.business_id, 'stamp',
      case
        when _loyalty_type = 'points' then 'Points added'
        when _loyalty_type = 'tiered' then 'Visit recorded'
        else 'Stamp added'
      end,
      'You now have ' || _new_count || ' ' || _unit || '.'
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Owner scan flow: manual code-entry lookup + rate limiting, per
--    docs/LOYALTY-LOOP-DATA-MODEL.md §7/§9/§11. Staff permissions (§4)
--    aren't built yet, so this is owner/admin-only for now — the "owns
--    at least one business" check is what "only their own shop" reduces to
--    at the RPC layer; the actual per-shop scoping happens where the
--    resolved user id is then used (transactions insert / rewards update),
--    both already RLS-restricted to owner_id = auth.uid() on that specific
--    business.
create table public.rpc_rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, action, window_start)
);
-- No client-facing RLS policy — only SECURITY DEFINER functions touch this.
alter table public.rpc_rate_limits enable row level security;

create or replace function public.check_rate_limit(_action text, _limit integer, _window_seconds integer default 60)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _window timestamptz := date_trunc('minute', now());
  _count integer;
begin
  insert into public.rpc_rate_limits (user_id, action, window_start, count)
  values (auth.uid(), _action, _window, 1)
  on conflict (user_id, action, window_start)
  do update set count = rpc_rate_limits.count + 1
  returning count into _count;

  return _count <= _limit;
end;
$$;

create or replace function public.lookup_user_by_stamp_code(_code text)
returns table (id uuid, first_name text, last_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.businesses where owner_id = auth.uid())
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized to look up customers';
  end if;

  if not public.check_rate_limit('lookup_user_by_stamp_code', 20, 60) then
    raise exception 'too many lookups — try again in a minute';
  end if;

  return query
    select p.id, p.first_name, p.last_name
    from public.profiles p
    where p.stamp_code = _code;
end;
$$;

grant execute on function public.lookup_user_by_stamp_code(text) to authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
