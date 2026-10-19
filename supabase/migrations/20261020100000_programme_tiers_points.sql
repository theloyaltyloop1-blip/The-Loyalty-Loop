-- Two new programme types next to stamps and £ spend: Membership tiers (a level
-- earned by £ spent in the last 12 months) and Points (earn per £, spend points
-- on rewards). Both ride the existing spend path: manual entry
-- (record_manual_spend) and the SumUp till link (pos_credit_sale) insert
-- type = 'spend' transactions, and handle_spend_transaction now dispatches by
-- the shop's reward_model. Existing stamp and £ spend shops behave exactly as
-- before. NOT applied to any database yet.

-- ---------------------------------------------------------------------
-- Models and helper

alter table public.businesses drop constraint businesses_reward_model_check;
alter table public.businesses
  add constraint businesses_reward_model_check
  check (reward_model in ('stamp_legacy', 'spend_threshold', 'tiers', 'points'));

-- One place that says "staff record a purchase amount at this shop".
create or replace function public.reward_model_records_spend(_model text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(_model, '') in ('spend_threshold', 'tiers', 'points')
$$;

-- ---------------------------------------------------------------------
-- Columns

-- current_tier (text) stays as the display name; the id is the source of truth.
-- No foreign key on purpose: deleting a tier recomputes levels instead of
-- cascading an update through the membership guard.
alter table public.memberships add column current_tier_id uuid;

-- Points earned by one purchase, so a refund can take back exactly that many.
alter table public.transactions add column points_earned integer;

-- What a points reward costs.
alter table public.reward_catalog
  add column points_cost integer
  check (points_cost is null or (points_cost >= 1 and points_cost <= 100000000));

-- Rolling 12-month spend per customer.
create index transactions_spend_window_idx
  on public.transactions (business_id, user_id, created_at)
  where type = 'spend' and voided_at is null;

-- ---------------------------------------------------------------------
-- Membership tiers

create table public.membership_tiers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  spend_threshold_pence integer not null check (spend_threshold_pence between 0 and 100000000),
  perks text[] not null default '{}' check (cardinality(perks) <= 6),
  colour text check (colour is null or colour ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_tiers_business_threshold_key unique (business_id, spend_threshold_pence)
);

create index membership_tiers_business_id_idx on public.membership_tiers (business_id);

alter table public.membership_tiers enable row level security;
revoke all on public.membership_tiers from public, anon, authenticated;
grant select on public.membership_tiers to anon, authenticated;
grant insert, update, delete on public.membership_tiers to authenticated;

-- The ladder is public (it is on the shop page); only the owner or an admin edits it.
create policy "membership_tiers_select_public_or_owner_or_admin"
  on public.membership_tiers for select
  using (
    exists (select 1 from public.businesses b
            where b.id = membership_tiers.business_id and b.is_active
              and b.approval_status = 'approved'::public.business_approval_status)
    or exists (select 1 from public.businesses b
               where b.id = membership_tiers.business_id and b.owner_id = (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );
create policy "membership_tiers_write_owner_or_admin_ins"
  on public.membership_tiers for insert
  with check (
    exists (select 1 from public.businesses b
            where b.id = membership_tiers.business_id and b.owner_id = (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );
create policy "membership_tiers_write_owner_or_admin_upd"
  on public.membership_tiers for update
  using (
    exists (select 1 from public.businesses b
            where b.id = membership_tiers.business_id and b.owner_id = (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  )
  with check (
    exists (select 1 from public.businesses b
            where b.id = membership_tiers.business_id and b.owner_id = (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );
create policy "membership_tiers_write_owner_or_admin_del"
  on public.membership_tiers for delete
  using (
    exists (select 1 from public.businesses b
            where b.id = membership_tiers.business_id and b.owner_id = (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

create trigger set_updated_at
  before update on public.membership_tiers
  for each row execute function public.update_updated_at_column();

create or replace function public.validate_membership_tier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (
    select count(*) from public.membership_tiers t where t.business_id = new.business_id
  ) >= 8 then
    raise exception 'too_many_tiers';
  end if;
  if exists (select 1 from unnest(new.perks) p where length(p) > 80) then
    raise exception 'perk_too_long';
  end if;
  return new;
end;
$$;

create trigger validate_membership_tier
  before insert or update on public.membership_tiers
  for each row execute function public.validate_membership_tier();

-- ---------------------------------------------------------------------
-- Points redemptions (a ledger, and the idempotency key for the redeem call)

create table public.points_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  catalog_id uuid references public.reward_catalog(id) on delete set null,
  points integer not null check (points > 0),
  reward_id uuid references public.rewards(id) on delete set null,
  client_ref uuid not null,
  created_at timestamptz not null default now(),
  constraint points_redemptions_client_ref_key unique (client_ref)
);

create index points_redemptions_user_business_idx on public.points_redemptions (user_id, business_id);

alter table public.points_redemptions enable row level security;
revoke all on public.points_redemptions from public, anon, authenticated;
grant select on public.points_redemptions to authenticated;

create policy "points_redemptions_select_self_or_owner_or_admin"
  on public.points_redemptions for select
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.businesses b
               where b.id = points_redemptions.business_id and b.owner_id = (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

-- ---------------------------------------------------------------------
-- The membership guard: tier and points columns are trusted-only, like £ progress.
-- "Trusted" now also means a server function that set app.membership_trusted for
-- the rest of its own transaction (cron job, redeem RPC), not only a trigger.

create or replace function public.enforce_membership_update_scope()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _is_privileged boolean;
  _is_service_role boolean;
  _trusted boolean;
begin
  _is_service_role := coalesce(auth.role(), '') = 'service_role';
  _is_privileged := _is_service_role
    or public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.businesses b
      where b.id = new.business_id and b.owner_id = auth.uid()
    )
    or public.is_active_staff_of(new.business_id, auth.uid());
  _trusted := _is_service_role
    or public.has_role(auth.uid(), 'admin')
    or pg_trigger_depth() > 1
    or coalesce(current_setting('app.membership_trusted', true), '') = 'on';

  -- Only the trusted webhook, an admin, a spend/void trigger or a server function
  -- may change money-like balances. An owner/staff direct table update may not.
  if (
      new.reward_progress_pence != old.reward_progress_pence
      or new.redemption_blocked_reason is distinct from old.redemption_blocked_reason
      or new.current_tier_id is distinct from old.current_tier_id
      or (new.points_balance != old.points_balance and exists (
        select 1 from public.businesses b where b.id = new.business_id and b.reward_model = 'points'))
      or (new.current_tier is distinct from old.current_tier and exists (
        select 1 from public.businesses b where b.id = new.business_id and b.reward_model = 'tiers'))
    )
    and not _trusted then
    raise exception 'reward progress requires a trusted transaction';
  end if;

  -- A server function that marked this transaction trusted (redeem, cron) may
  -- change what it needs even when the signed-in caller is a customer.
  if _is_privileged or coalesce(current_setting('app.membership_trusted', true), '') = 'on' then
    return new;
  end if;

  if new.user_id != old.user_id
    or new.business_id != old.business_id
    or new.stamp_count != old.stamp_count
    or new.points_balance != old.points_balance
    or new.current_tier is distinct from old.current_tier
    or new.current_streak != old.current_streak
    or new.longest_streak != old.longest_streak
    or new.visit_count != old.visit_count
    or new.last_visit_date is distinct from old.last_visit_date
    or new.last_activity_at is distinct from old.last_activity_at
    or new.joined_at != old.joined_at then
    raise exception 'customers may only change promos_opted_out';
  end if;

  return new;
end;
$function$;

revoke execute on function public.enforce_membership_update_scope() from public, anon, authenticated;

-- The programme type cannot change once customers have progress. (Admins and
-- server code are exempt; an owner who needs a change contacts support.)
create or replace function public.lock_programme_after_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reward_model is distinct from old.reward_model
    and auth.uid() is not null
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.has_role(auth.uid(), 'admin')
    and exists (
      select 1 from public.memberships m
      where m.business_id = old.id
        and (m.stamp_count <> 0 or m.points_balance <> 0 or m.reward_progress_pence <> 0
             or m.visit_count <> 0 or m.current_tier_id is not null)
    ) then
    raise exception 'programme_locked'
      using hint = 'Customers already have progress, so the programme type can no longer change. Contact support.';
  end if;
  return new;
end;
$$;

create trigger lock_programme_after_activity
  before update of reward_model on public.businesses
  for each row execute function public.lock_programme_after_activity();

revoke execute on function public.lock_programme_after_activity() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Tier maths

create or replace function public.member_rolling_spend(_user_id uuid, _business_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(t.value), 0)::bigint
  from public.transactions t
  where t.user_id = _user_id and t.business_id = _business_id
    and t.type = 'spend' and t.voided_at is null
    and t.created_at > now() - interval '12 months'
$$;

-- One customer's tier after a refund or void.
create or replace function public.recompute_member_tier(_user_id uuid, _business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _tier public.membership_tiers;
begin
  perform set_config('app.membership_trusted', 'on', true);
  select * into _tier from public.membership_tiers t
  where t.business_id = _business_id
    and t.spend_threshold_pence <= public.member_rolling_spend(_user_id, _business_id)
  order by t.spend_threshold_pence desc limit 1;
  update public.memberships m
  set current_tier_id = _tier.id, current_tier = _tier.name
  where m.user_id = _user_id and m.business_id = _business_id
    and (m.current_tier_id is distinct from _tier.id or m.current_tier is distinct from _tier.name);
  perform set_config('app.membership_trusted', 'off', true);
end;
$$;

-- Everyone at one shop (nightly, and when the owner edits the ladder).
create or replace function public.recompute_business_tiers(_business_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _changed integer;
begin
  perform set_config('app.membership_trusted', 'on', true);
  with spend as (
    select t.user_id, sum(t.value)::bigint as total
    from public.transactions t
    where t.business_id = _business_id and t.type = 'spend' and t.voided_at is null
      and t.created_at > now() - interval '12 months'
    group by t.user_id
  ),
  target as (
    select m.id as membership_id,
      (select x.id from public.membership_tiers x
       where x.business_id = _business_id
         and x.spend_threshold_pence <= coalesce(s.total, 0)
       order by x.spend_threshold_pence desc limit 1) as tier_id
    from public.memberships m
    left join spend s on s.user_id = m.user_id
    where m.business_id = _business_id
  )
  update public.memberships m
  set current_tier_id = target.tier_id,
      current_tier = (select y.name from public.membership_tiers y where y.id = target.tier_id)
  from target
  where m.id = target.membership_id and m.current_tier_id is distinct from target.tier_id;
  get diagnostics _changed = row_count;
  perform set_config('app.membership_trusted', 'off', true);
  return _changed;
end;
$$;

create or replace function public.recompute_tiers_after_ladder_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_business_tiers(coalesce(new.business_id, old.business_id));
  return null;
end;
$$;

create trigger recompute_tiers_after_ladder_change
  after insert or update or delete on public.membership_tiers
  for each row execute function public.recompute_tiers_after_ladder_change();

-- ---------------------------------------------------------------------
-- Engines: called from handle_spend_transaction

create or replace function public.apply_tiers_spend(_user_id uuid, _business_id uuid, _membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _spend bigint;
  _old_id uuid;
  _old_threshold integer;
  _new public.membership_tiers;
  _next public.membership_tiers;
begin
  perform set_config('app.membership_trusted', 'on', true);
  _spend := public.member_rolling_spend(_user_id, _business_id);
  select m.current_tier_id into _old_id from public.memberships m where m.id = _membership_id;
  select t.spend_threshold_pence into _old_threshold from public.membership_tiers t where t.id = _old_id;
  select * into _new from public.membership_tiers t
  where t.business_id = _business_id and t.spend_threshold_pence <= _spend
  order by t.spend_threshold_pence desc limit 1;
  select * into _next from public.membership_tiers t
  where t.business_id = _business_id and t.spend_threshold_pence > _spend
  order by t.spend_threshold_pence limit 1;

  update public.memberships
  set current_tier_id = _new.id,
      current_tier = _new.name,
      visit_count = visit_count + 1,
      last_visit_date = (now() at time zone 'utc')::date,
      last_activity_at = now()
  where id = _membership_id;
  perform set_config('app.membership_trusted', 'off', true);

  if _new.id is not null and _new.id is distinct from _old_id
    and (_old_threshold is null or _new.spend_threshold_pence > _old_threshold) then
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (
      _user_id, _business_id, 'reward', 'You''ve reached ' || _new.name,
      case when cardinality(_new.perks) > 0
        then 'Your perks: ' || array_to_string(_new.perks, ', ') || '.'
        else 'Thanks for being a regular.' end
    );
  elsif _next.id is not null then
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (
      _user_id, _business_id, 'stamp', 'Progress updated',
      'You are £' || to_char((_next.spend_threshold_pence - _spend) / 100.0, 'FM999999990.00') ||
        ' away from ' || _next.name || '.'
    );
  end if;
end;
$$;

create or replace function public.apply_points_spend(
  _user_id uuid, _business_id uuid, _membership_id uuid, _transaction_id uuid, _value integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _rate numeric;
  _points integer;
  _balance integer;
begin
  perform set_config('app.membership_trusted', 'on', true);
  select coalesce((b.loyalty_config ->> 'points_per_pound')::numeric, 1) into _rate
  from public.businesses b where b.id = _business_id;
  -- _value is pence; the rate is points per £. Clamped so a bad setting cannot mint millions.
  _points := floor(_value::numeric * least(greatest(coalesce(_rate, 1), 0), 1000) / 100)::integer;

  update public.memberships
  set points_balance = points_balance + _points,
      visit_count = visit_count + 1,
      last_visit_date = (now() at time zone 'utc')::date,
      last_activity_at = now()
  where id = _membership_id
  returning points_balance into _balance;
  perform set_config('app.membership_trusted', 'off', true);

  update public.transactions set points_earned = _points where id = _transaction_id;

  insert into public.notifications (user_id, business_id, kind, title, body)
  values (
    _user_id, _business_id, 'stamp', 'Points added',
    'You earned ' || _points || ' point' || case when _points = 1 then '' else 's' end ||
      '. You now have ' || _balance || '.'
  );
end;
$$;

-- A customer turns points into a reward. The reward is an ordinary rewards row
-- (QR + short code), so staff redeem it at the till exactly as before.
create or replace function public.redeem_points_reward(_business_id uuid, _catalog_id uuid, _client_ref uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _business public.businesses;
  _membership public.memberships;
  _catalog public.reward_catalog;
  _existing public.points_redemptions;
  _reward_id uuid;
  _balance integer;
begin
  if _uid is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if _business_id is null or _catalog_id is null or _client_ref is null then
    raise exception 'invalid_arguments';
  end if;

  select * into _existing from public.points_redemptions where client_ref = _client_ref;
  if found then
    if _existing.user_id <> _uid then
      raise exception 'invalid_client_ref';
    end if;
    select points_balance into _balance from public.memberships
    where user_id = _uid and business_id = _business_id;
    return jsonb_build_object('status', 'duplicate', 'rewardId', _existing.reward_id, 'pointsBalance', _balance);
  end if;

  select * into _business from public.businesses where id = _business_id;
  if not found or _business.reward_model <> 'points' or not _business.is_active then
    raise exception 'shop_not_points';
  end if;

  select * into _catalog from public.reward_catalog
  where id = _catalog_id and business_id = _business_id and points_cost is not null;
  if not found then
    raise exception 'reward_not_found';
  end if;

  select * into _membership from public.memberships
  where user_id = _uid and business_id = _business_id for update;
  if not found then
    raise exception 'not_a_member';
  end if;
  if _membership.points_balance < _catalog.points_cost then
    raise exception 'not_enough_points';
  end if;

  perform set_config('app.membership_trusted', 'on', true);
  update public.memberships
  set points_balance = points_balance - _catalog.points_cost
  where id = _membership.id
  returning points_balance into _balance;
  perform set_config('app.membership_trusted', 'off', true);

  insert into public.rewards (user_id, business_id, title, catalog_id)
  values (_uid, _business_id, _catalog.title, _catalog.id)
  returning id into _reward_id;

  begin
    insert into public.points_redemptions (user_id, business_id, catalog_id, points, reward_id, client_ref)
    values (_uid, _business_id, _catalog.id, _catalog.points_cost, _reward_id, _client_ref);
  exception when unique_violation then
    -- The same request arrived twice at once; the other copy committed first.
    raise exception 'duplicate_in_flight';
  end;

  insert into public.notifications (user_id, business_id, kind, title, body)
  values (_uid, _business_id, 'reward', 'Reward ready', _catalog.title || ' is ready to redeem.');

  return jsonb_build_object('status', 'redeemed', 'rewardId', _reward_id, 'pointsBalance', _balance);
end;
$$;

-- What a scan or an entry result shows about the customer's standing.
create or replace function public.programme_snapshot(_user_id uuid, _business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _b public.businesses;
  _m public.memberships;
  _spend bigint;
  _tier public.membership_tiers;
  _next public.membership_tiers;
begin
  select * into _b from public.businesses where id = _business_id;
  select * into _m from public.memberships where user_id = _user_id and business_id = _business_id;
  if _b.reward_model = 'tiers' then
    _spend := public.member_rolling_spend(_user_id, _business_id);
    select * into _tier from public.membership_tiers t
    where t.business_id = _business_id and t.spend_threshold_pence <= _spend
    order by t.spend_threshold_pence desc limit 1;
    select * into _next from public.membership_tiers t
    where t.business_id = _business_id and t.spend_threshold_pence > _spend
    order by t.spend_threshold_pence limit 1;
    return jsonb_build_object(
      'programme', 'tiers',
      'tierName', _tier.name,
      'tierPerks', coalesce(to_jsonb(_tier.perks), '[]'::jsonb),
      'rollingSpendPence', _spend,
      'nextTierName', _next.name,
      'toNextTierPence', case when _next.id is null then null else _next.spend_threshold_pence - _spend end
    );
  elsif _b.reward_model = 'points' then
    return jsonb_build_object(
      'programme', 'points',
      'pointsBalance', coalesce(_m.points_balance, 0),
      'pointsPerPound', coalesce((_b.loyalty_config ->> 'points_per_pound')::numeric, 1)
    );
  elsif _b.reward_model = 'spend_threshold' then
    return jsonb_build_object('programme', 'spend');
  end if;
  return jsonb_build_object('programme', 'stamps');
end;
$$;

-- ---------------------------------------------------------------------
-- Dispatch: existing functions, extended. The stamp and £ spend paths are unchanged.

create or replace function public.handle_spend_transaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _membership public.memberships;
  _model text;
  _threshold integer;
  _has_tiers boolean;
  _top integer;
  _pos bigint;
  _remaining bigint;
  _tier record;
  _needed bigint;
  _reward_count integer := 0;
  _next record;
begin
  select * into _membership
  from public.memberships
  where user_id = new.user_id and business_id = new.business_id
  for update;

  if not found then
    raise exception 'customer has no membership at this business';
  end if;

  if new.membership_id is not null and new.membership_id != _membership.id then
    raise exception 'transaction membership does not match customer and business';
  end if;

  select b.reward_model, b.reward_threshold_pence
  into _model, _threshold
  from public.businesses b
  where b.id = new.business_id;

  if _model = 'tiers' then
    perform public.apply_tiers_spend(new.user_id, new.business_id, _membership.id);
    return new;
  elsif _model = 'points' then
    perform public.apply_points_spend(new.user_id, new.business_id, _membership.id, new.id, new.value);
    return new;
  end if;

  select max(spend_threshold_pence) into _top
  from public.reward_catalog
  where business_id = new.business_id and spend_threshold_pence is not null;
  _has_tiers := _top is not null;

  if _model is distinct from 'spend_threshold'
    or (not _has_tiers and (_threshold is null or _threshold <= 0)) then
    raise exception 'spend rewards require a configured positive threshold';
  end if;

  _pos := _membership.reward_progress_pence::bigint;
  _remaining := new.value::bigint;

  while _remaining > 0 loop
    if _has_tiers then
      select id, title, spend_threshold_pence as amount into _tier
      from public.reward_catalog
      where business_id = new.business_id
        and spend_threshold_pence is not null
        and spend_threshold_pence > _pos
      order by spend_threshold_pence
      limit 1;
      if not found then
        -- Every tier was lowered below this customer's progress: the top
        -- reward is due now, then a new cycle starts.
        select id, title, spend_threshold_pence as amount into _tier
        from public.reward_catalog
        where business_id = new.business_id and spend_threshold_pence = _top
        limit 1;
      end if;
    else
      select null::uuid as id, 'Free reward'::text as title, _threshold as amount into _tier;
    end if;

    _needed := greatest(_tier.amount::bigint - _pos, 0);
    if _remaining < _needed then
      _pos := _pos + _remaining;
      _remaining := 0;
    else
      _remaining := _remaining - _needed;
      _reward_count := _reward_count + 1;
      -- Prevent a misconfigured tiny tier from creating millions of rewards
      -- in one database transaction. The purchase rolls back for investigation.
      if _reward_count > 1000 then
        raise exception 'spend transaction crosses too many reward thresholds';
      end if;

      insert into public.rewards (user_id, business_id, title, catalog_id)
      values (new.user_id, new.business_id, _tier.title, _tier.id);

      insert into public.notifications (user_id, business_id, kind, title, body)
      values (new.user_id, new.business_id, 'reward', 'Reward earned!', _tier.title || ' is ready to redeem.');

      _pos := case
        when not _has_tiers or _tier.amount >= _top then 0
        else _tier.amount
      end;
    end if;
  end loop;

  if _pos < -2147483648 or _pos > 2147483647 then
    raise exception 'reward progress exceeds integer range';
  end if;

  update public.memberships
  set reward_progress_pence = _pos::integer,
      redemption_blocked_reason =
        case when _pos >= 0 then null else redemption_blocked_reason end,
      visit_count = visit_count + 1,
      last_visit_date = (now() at time zone 'utc')::date,
      last_activity_at = now()
  where id = _membership.id;

  if _reward_count = 0 then
    select * into _next from public.spend_next_tier(new.business_id, _pos::integer);
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (
      new.user_id, new.business_id, 'stamp', 'Progress updated',
      'You are £' ||
        to_char(greatest(0, _next.amount_pence::bigint - _pos) / 100.0, 'FM999999990.00') ||
        ' away from ' || coalesce(_next.title, 'your next reward') || '.'
    );
  end if;

  return new;
end;
$function$;

create or replace function public.handle_spend_void()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  _model text;
  _new_progress integer;
  _shop_name text;
begin
  select b.reward_model, b.name into _model, _shop_name
  from public.businesses b where b.id = old.business_id;

  if _model = 'tiers' then
    perform public.recompute_member_tier(old.user_id, old.business_id);
  elsif _model = 'points' then
    perform set_config('app.membership_trusted', 'on', true);
    -- Take back exactly the points this purchase earned. The balance may go
    -- negative if they were already spent; redeeming needs a positive balance.
    update public.memberships
    set points_balance = points_balance - coalesce(old.points_earned, 0)
    where user_id = old.user_id and business_id = old.business_id;
    perform set_config('app.membership_trusted', 'off', true);
  else
    update public.memberships
    set reward_progress_pence = reward_progress_pence - old.value,
        redemption_blocked_reason = case
          when reward_progress_pence - old.value < 0
            then 'A purchase entry was corrected. Spend a little more to redeem again.'
          else redemption_blocked_reason
        end
    where user_id = old.user_id and business_id = old.business_id
    returning reward_progress_pence into _new_progress;
  end if;

  insert into public.notifications (user_id, business_id, kind, title, body)
  values (
    old.user_id, old.business_id, 'system', 'Purchase corrected',
    'A purchase of £' || to_char(old.value / 100.0, 'FM999999990.00') ||
      coalesce(' at ' || _shop_name, '') || ' was corrected by the shop.'
  );
  return new;
end;
$function$;

create or replace function public.refuse_stamps_at_spend_shops()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.type::text = 'stamp' and exists (
    select 1 from public.businesses b
    where b.id = new.business_id and public.reward_model_records_spend(b.reward_model)
  ) then
    raise exception 'shop_uses_spend_rewards'
      using hint = 'This shop records purchases in £. Update the app to add a purchase.';
  end if;
  return new;
end;
$function$;

create or replace function public.record_manual_spend(
  _business_id uuid, _customer_id uuid, _amount_pence integer, _payment_method text, _client_ref uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  _caller uuid := auth.uid();
  _business public.businesses;
  _membership_id uuid;
  _existing public.transactions;
  _transaction_id uuid;
  _rewards_before integer;
  _rewards_after integer;
  _progress integer;
  _next record;
begin
  if _business_id is null or _customer_id is null or _client_ref is null
    or (_payment_method is not null and _payment_method not in ('cash', 'unlinked_card')) then
    raise exception 'invalid_arguments';
  end if;
  if not public.can_record_manual_spend(_business_id, _caller) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into _business from public.businesses where id = _business_id;
  if not public.reward_model_records_spend(_business.reward_model)
    or (_business.reward_model = 'spend_threshold' and not (
      coalesce(_business.reward_threshold_pence, 0) > 0
      or exists (select 1 from public.reward_catalog r
                 where r.business_id = _business_id and r.spend_threshold_pence is not null)
    ))
    or (_business.reward_model = 'tiers' and not exists (
      select 1 from public.membership_tiers t where t.business_id = _business_id
    )) then
    raise exception 'shop_not_spend_based';
  end if;

  select * into _existing from public.transactions where client_ref = _client_ref;
  if found then
    if _existing.recorded_by is distinct from _caller or _existing.business_id <> _business_id then
      raise exception 'invalid_client_ref';
    end if;
    select reward_progress_pence into _progress from public.memberships
    where user_id = _existing.user_id and business_id = _business_id;
    select * into _next from public.spend_next_tier(_business_id, _progress);
    return jsonb_build_object(
      'status', 'duplicate', 'transactionId', _existing.id, 'amountPence', _existing.value,
      'progressPence', _progress, 'thresholdPence', _next.amount_pence,
      'nextRewardTitle', _next.title, 'rewardsEarned', null)
      || public.programme_snapshot(_existing.user_id, _business_id);
  end if;

  if _amount_pence is null or _amount_pence < 1 or _amount_pence > _business.manual_spend_max_pence then
    raise exception 'amount_out_of_range' using detail = _business.manual_spend_max_pence::text;
  end if;

  select id into _membership_id from public.memberships
  where user_id = _customer_id and business_id = _business_id;
  if not found then
    raise exception 'not_a_member';
  end if;

  select count(*) into _rewards_before from public.rewards
  where user_id = _customer_id and business_id = _business_id;

  begin
    insert into public.transactions (
      user_id, business_id, membership_id, type, value, manual_payment_method, client_ref
    ) values (
      _customer_id, _business_id, _membership_id, 'spend', _amount_pence, _payment_method, _client_ref
    )
    returning id into _transaction_id;
  exception when unique_violation then
    select * into _existing from public.transactions where client_ref = _client_ref;
    select reward_progress_pence into _progress from public.memberships
    where user_id = _customer_id and business_id = _business_id;
    select * into _next from public.spend_next_tier(_business_id, _progress);
    return jsonb_build_object(
      'status', 'duplicate', 'transactionId', _existing.id, 'amountPence', _existing.value,
      'progressPence', _progress, 'thresholdPence', _next.amount_pence,
      'nextRewardTitle', _next.title, 'rewardsEarned', null)
      || public.programme_snapshot(_customer_id, _business_id);
  end;

  select count(*) into _rewards_after from public.rewards
  where user_id = _customer_id and business_id = _business_id;
  select reward_progress_pence into _progress from public.memberships where id = _membership_id;
  select * into _next from public.spend_next_tier(_business_id, _progress);

  return jsonb_build_object(
    'status', 'recorded', 'transactionId', _transaction_id, 'amountPence', _amount_pence,
    'progressPence', _progress, 'thresholdPence', _next.amount_pence,
    'nextRewardTitle', _next.title, 'rewardsEarned', _rewards_after - _rewards_before)
    || public.programme_snapshot(_customer_id, _business_id);
end;
$function$;

create or replace function public.scanned_member_spend_summary(_customer_id uuid, _business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  _caller uuid := auth.uid();
  _business public.businesses;
  _membership public.memberships;
  _link jsonb;
  _next record;
begin
  if not public.can_record_manual_spend(_business_id, _caller) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into _business from public.businesses where id = _business_id;
  select * into _membership from public.memberships where user_id = _customer_id and business_id = _business_id;
  select * into _next from public.spend_next_tier(_business_id, _membership.reward_progress_pence);
  _link := public.customer_card_link_status(_customer_id, _business_id);
  return jsonb_build_object(
    'rewardModel', _business.reward_model,
    'member', _membership.id is not null,
    'progressPence', _membership.reward_progress_pence,
    'redemptionBlocked', _membership.redemption_blocked_reason is not null,
    'thresholdPence', _next.amount_pence,
    'nextRewardTitle', _next.title,
    'manualMaxPence', _business.manual_spend_max_pence,
    'linked', coalesce((_link ->> 'linked')::boolean, false),
    'manualToday', coalesce((_link ->> 'manualToday')::integer, 0),
    'nextAllowedAt', _link -> 'nextAllowedAt'
  ) || public.programme_snapshot(_customer_id, _business_id);
end;
$function$;

-- ---------------------------------------------------------------------
-- Nightly: levels drop when spend ages out of the 12-month window.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'recompute-membership-tiers') then
      perform cron.unschedule('recompute-membership-tiers');
    end if;
    perform cron.schedule(
      'recompute-membership-tiers',
      '17 3 * * *',
      $job$select public.recompute_business_tiers(b.id) from public.businesses b where b.reward_model = 'tiers'$job$
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Privileges. Internal functions are not callable by clients; only the
-- customer's own redeem call and the existing client RPCs are.

revoke execute on function
  public.reward_model_records_spend(text),
  public.member_rolling_spend(uuid, uuid),
  public.recompute_member_tier(uuid, uuid),
  public.recompute_business_tiers(uuid),
  public.recompute_tiers_after_ladder_change(),
  public.apply_tiers_spend(uuid, uuid, uuid),
  public.apply_points_spend(uuid, uuid, uuid, uuid, integer),
  public.redeem_points_reward(uuid, uuid, uuid),
  public.programme_snapshot(uuid, uuid),
  public.handle_spend_transaction(),
  public.handle_spend_void(),
  public.refuse_stamps_at_spend_shops(),
  public.validate_membership_tier(),
  public.record_manual_spend(uuid, uuid, integer, text, uuid),
  public.scanned_member_spend_summary(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.reward_model_records_spend(text) to anon, authenticated;
grant execute on function public.redeem_points_reward(uuid, uuid, uuid) to authenticated;
grant execute on function public.record_manual_spend(uuid, uuid, integer, text, uuid) to authenticated;
grant execute on function public.scanned_member_spend_summary(uuid, uuid) to authenticated;
