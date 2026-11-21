-- Birthday rewards for ordinary stamp and points shops.
--
--   * businesses.birthday_bonus: extra stamps (stamp shops) or points (points shops)
--     given once a year. Null means off. The owner sets it.
--   * profiles.birthday already exists, and the shopper can already update only their
--     own row (profiles_update_self + the column grant). Shops cannot read profiles, so
--     they never see the date; staff only learn "birthday bonus given" from the visit.
--     When the shopper gives no year, the apps store year 2000 (a leap year, so
--     29 February is a valid date). Only the month is used here.
--   * The bonus is given on the member's first visit in their birthday month (shop
--     local time), once per calendar year per shop. The once-a-year guard is the same
--     programme_bonus_log row custom programmes use (kind 'birthday', period 'YYYY'),
--     so a shop that changes programme type cannot give it twice in one year.
--   * transactions.birthday_bonus records what that visit got, for the scan result
--     and the shopper's activity history.
--   * Custom programmes (reward_model 'custom') are not touched: they keep their own
--     birthday bonus inside apply_custom_spend. Spend-threshold and tiers shops have
--     no stamps or points to add, so they get nothing here.

-- ---------------------------------------------------------------------
-- Columns

alter table public.businesses
  add column birthday_bonus integer
  constraint businesses_birthday_bonus_check check (birthday_bonus is null or birthday_bonus between 1 and 1000);

comment on column public.businesses.birthday_bonus is
  'Extra stamps or points given once a year on the first visit in the member''s birthday month. Null = off. Stamp and points shops only.';

alter table public.transactions
  add column birthday_bonus integer not null default 0
  constraint transactions_birthday_bonus_check check (birthday_bonus >= 0);

comment on column public.transactions.birthday_bonus is
  'Birthday bonus stamps or points this visit added (set by the database, never by clients).';

-- Clients may insert stamp rows directly, so the value they send is ignored; the
-- award triggers set the real value afterwards.
create or replace function public.reset_transaction_birthday_bonus()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.birthday_bonus := 0;
  return new;
end;
$$;

revoke execute on function public.reset_transaction_birthday_bonus() from public, anon, authenticated;

create trigger a_reset_transaction_birthday_bonus
  before insert on public.transactions
  for each row execute function public.reset_transaction_birthday_bonus();

-- ---------------------------------------------------------------------
-- The once-a-year claim. Returns the bonus to add now (0 when none).
-- Called only from the award functions below, inside the visit's transaction,
-- after the membership row is locked.

create or replace function public.claim_birthday_bonus(_user_id uuid, _business_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _b public.businesses;
  _birthday date;
  _local timestamp;
  _got boolean := false;
  _unit text;
begin
  select * into _b from public.businesses where id = _business_id;
  if not found or _b.birthday_bonus is null
     or coalesce(_b.reward_model, 'stamp_legacy') not in ('stamp_legacy', 'points') then
    return 0;
  end if;

  select birthday into _birthday from public.profiles where id = _user_id;
  _local := public.shop_local_now(_b.country_code);
  if _birthday is null or extract(month from _birthday) <> extract(month from _local) then
    return 0;
  end if;

  insert into public.programme_bonus_log (user_id, business_id, kind, period, points)
  values (_user_id, _business_id, 'birthday', to_char(_local, 'YYYY'), _b.birthday_bonus)
  on conflict do nothing
  returning true into _got;
  if not coalesce(_got, false) then
    return 0;
  end if;

  _unit := case
    when coalesce(_b.reward_model, 'stamp_legacy') = 'points' or _b.loyalty_type = 'points'
      then case when _b.birthday_bonus = 1 then 'point' else 'points' end
    when _b.loyalty_type = 'tiered'
      then case when _b.birthday_bonus = 1 then 'visit' else 'visits' end
    else case when _b.birthday_bonus = 1 then 'stamp' else 'stamps' end
  end;

  insert into public.notifications (user_id, business_id, kind, title, body)
  values (
    _user_id, _business_id, 'reward', 'Happy birthday!',
    'Happy birthday from ' || _b.name || '! You got ' || _b.birthday_bonus || ' bonus ' || _unit || '.'
  );

  return _b.birthday_bonus;
end;
$$;

revoke execute on function public.claim_birthday_bonus(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Stamp shops (and the legacy points / visits cards on the stamp path).
-- Same as 20261017225143, plus the birthday bonus (marked "birthday").

create or replace function public.handle_stamp_transaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _membership public.memberships;
  _loyalty_type loyalty_type;
  _config jsonb;
  _stamps_required integer;
  _remaining integer;
  _next integer;
  _top integer;
  _tier record;
  _new_count integer;
  _crossed_any boolean := false;
  _unit text;
  _bonus integer := 0;
begin
  select * into _membership from public.memberships
    where user_id = new.user_id and business_id = new.business_id
    for update;

  if not found then
    raise exception 'customer has no membership at this business';
  end if;

  select loyalty_type into _loyalty_type from public.businesses where id = new.business_id;

  -- birthday: at most 50 extra, the same cap as one stamp entry.
  _bonus := least(coalesce(public.claim_birthday_bonus(new.user_id, new.business_id), 0), 50);

  if _loyalty_type = 'points' then
    _new_count := _membership.points_balance;
    _unit := 'points';
  else
    _new_count := _membership.stamp_count;
    _unit := case when _loyalty_type = 'tiered' then 'visits' else 'stamps' end;
  end if;

  _remaining := new.value + _bonus;
  _top := (select max(stamp_threshold) from public.reward_catalog where business_id = new.business_id);

  if _top is not null then
    while _remaining > 0 loop
      _next := coalesce(
        (select min(stamp_threshold) from public.reward_catalog
          where business_id = new.business_id and stamp_threshold > _new_count),
        _top);

      if _remaining < _next - _new_count then
        _new_count := _new_count + _remaining;
        _remaining := 0;
      else
        _remaining := _remaining - greatest(_next - _new_count, 0);
        _crossed_any := true;

        for _tier in
          select id, title from public.reward_catalog
          where business_id = new.business_id and stamp_threshold = _next
          order by sort_order, created_at
        loop
          insert into public.rewards (user_id, business_id, title, catalog_id)
          values (new.user_id, new.business_id, _tier.title, _tier.id);

          insert into public.notifications (user_id, business_id, kind, title, body)
          values (new.user_id, new.business_id, 'reward', 'Reward earned!', _tier.title || ' is ready to redeem.');
        end loop;

        _new_count := case when _next >= _top then 0 else _next end;
      end if;
    end loop;
  else
    _config := (select loyalty_config from public.businesses where id = new.business_id);
    _stamps_required := coalesce((_config->>'stamps_required')::integer, 10);
    _new_count := _new_count + new.value + _bonus;

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

  -- birthday: record it on the visit for the scan result and activity history.
  if _bonus > 0 then
    update public.transactions set birthday_bonus = _bonus where id = new.id;
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
$function$;

revoke execute on function public.handle_stamp_transaction() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Points shops (£ purchases). Same as 20261020100000, plus the birthday bonus.
-- points_earned stays the purchase's own points; the bonus is kept apart in
-- transactions.birthday_bonus so an undo can hand the birthday back.

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
  _bonus integer;
  _balance integer;
begin
  perform set_config('app.membership_trusted', 'on', true);
  select coalesce((b.loyalty_config ->> 'points_per_pound')::numeric, 1) into _rate
  from public.businesses b where b.id = _business_id;
  -- _value is pence; the rate is points per £. Clamped so a bad setting cannot mint millions.
  _points := floor(_value::numeric * least(greatest(coalesce(_rate, 1), 0), 1000) / 100)::integer;
  _bonus := coalesce(public.claim_birthday_bonus(_user_id, _business_id), 0);

  update public.memberships
  set points_balance = points_balance + _points + _bonus,
      visit_count = visit_count + 1,
      last_visit_date = (now() at time zone 'utc')::date,
      last_activity_at = now()
  where id = _membership_id
  returning points_balance into _balance;
  perform set_config('app.membership_trusted', 'off', true);

  update public.transactions set points_earned = _points, birthday_bonus = _bonus where id = _transaction_id;

  insert into public.notifications (user_id, business_id, kind, title, body)
  values (
    _user_id, _business_id, 'stamp', 'Points added',
    'You earned ' || (_points + _bonus) || ' point' || case when _points + _bonus = 1 then '' else 's' end ||
      case when _bonus > 0 then ' (including a birthday bonus)' else '' end ||
      '. You now have ' || _balance || '.'
  );
end;
$$;

revoke execute on function public.apply_points_spend(uuid, uuid, uuid, uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Undoing a purchase that carried a birthday bonus takes the bonus back too and
-- frees this year's birthday, so the member's next real visit that month gets it.
-- Same as 20261106120000 apart from the two lines marked "birthday".

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
  _country text;
begin
  select b.reward_model, b.name, b.country_code into _model, _shop_name, _country
  from public.businesses b where b.id = old.business_id;

  if _model = 'tiers' then
    perform public.recompute_member_tier(old.user_id, old.business_id);
  elsif _model in ('points', 'custom') then
    perform set_config('app.membership_trusted', 'on', true);
    update public.memberships
    set points_balance = points_balance - coalesce(old.points_earned, 0) - coalesce(old.birthday_bonus, 0) -- birthday
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

  if coalesce(old.birthday_bonus, 0) > 0 then -- birthday
    delete from public.programme_bonus_log
    where user_id = old.user_id and business_id = old.business_id and kind = 'birthday'
      and period = to_char(old.created_at at time zone case coalesce(_country, 'GB') when 'PK' then 'Asia/Karachi' else 'Europe/London' end, 'YYYY');
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

revoke execute on function public.handle_spend_void() from public, anon, authenticated;
