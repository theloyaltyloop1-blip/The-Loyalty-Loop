-- Tiered £ rewards (ARCH_PLAN.md §4.11, decisions T1–T5). Additive: shops keep
-- behaving as today until they have £ tiers or the switchover runs.

-- T1: each catalogue reward gets a £ amount for spend-threshold shops.
alter table public.reward_catalog
  add column spend_threshold_pence integer,
  add constraint reward_catalog_spend_threshold_pence_check
    check (spend_threshold_pence is null or spend_threshold_pence between 1 and 100000000);

create unique index reward_catalog_business_spend_threshold_key
  on public.reward_catalog (business_id, spend_threshold_pence)
  where spend_threshold_pence is not null;

-- businesses.reward_threshold_pence is the cycle length: the highest £ tier.
create or replace function public.sync_business_spend_threshold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _business_id uuid := coalesce(new.business_id, old.business_id);
  _top integer;
begin
  select max(spend_threshold_pence) into _top
  from public.reward_catalog
  where business_id = _business_id and spend_threshold_pence is not null;
  if _top is not null then
    update public.businesses set reward_threshold_pence = _top
    where id = _business_id and reward_threshold_pence is distinct from _top;
  end if;
  return null;
end;
$$;

create trigger sync_business_spend_threshold
  after insert or update of spend_threshold_pence or delete on public.reward_catalog
  for each row execute function public.sync_business_spend_threshold();

-- The next reward above a given progress: the lowest £ tier above it. If an
-- owner has lowered every tier below the customer's progress, the highest tier
-- (it is issued on the next purchase). Shops with no £ tiers fall back to the
-- single threshold.
create or replace function public.spend_next_tier(_business_id uuid, _progress_pence integer)
returns table (amount_pence integer, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.amount_pence, t.title from (
    select r.spend_threshold_pence as amount_pence, r.title
    from public.reward_catalog r
    where r.business_id = _business_id
      and r.spend_threshold_pence is not null
    order by
      (r.spend_threshold_pence > coalesce(_progress_pence, 0)) desc,
      case when r.spend_threshold_pence > coalesce(_progress_pence, 0) then r.spend_threshold_pence end asc,
      r.spend_threshold_pence desc
    limit 1
  ) t
  union all
  select b.reward_threshold_pence, 'Free reward'
  from public.businesses b
  where b.id = _business_id
    and not exists (
      select 1 from public.reward_catalog r
      where r.business_id = _business_id and r.spend_threshold_pence is not null
    )
  limit 1
$$;

-- Spend now walks the £ tiers like the stamp trigger walks stamp tiers:
-- crossing a tier issues that tier's reward; crossing the highest restarts
-- the cycle at £0 and carries the excess. Negative progress must be covered
-- first. Shops with no £ tiers keep the single-threshold behaviour.
create or replace function public.handle_spend_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- Staff results and the scan summary now describe the next reward.
create or replace function public.record_manual_spend(
  _business_id uuid,
  _customer_id uuid,
  _amount_pence integer,
  _payment_method text,
  _client_ref uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  if _business.reward_model is distinct from 'spend_threshold'
    or not (
      coalesce(_business.reward_threshold_pence, 0) > 0
      or exists (select 1 from public.reward_catalog r
                 where r.business_id = _business_id and r.spend_threshold_pence is not null)
    ) then
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
      'nextRewardTitle', _next.title, 'rewardsEarned', null);
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
      'nextRewardTitle', _next.title, 'rewardsEarned', null);
  end;

  select count(*) into _rewards_after from public.rewards
  where user_id = _customer_id and business_id = _business_id;
  select reward_progress_pence into _progress from public.memberships where id = _membership_id;
  select * into _next from public.spend_next_tier(_business_id, _progress);

  return jsonb_build_object(
    'status', 'recorded', 'transactionId', _transaction_id, 'amountPence', _amount_pence,
    'progressPence', _progress, 'thresholdPence', _next.amount_pence,
    'nextRewardTitle', _next.title, 'rewardsEarned', _rewards_after - _rewards_before);
end;
$$;

create or replace function public.scanned_member_spend_summary(_customer_id uuid, _business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
  );
end;
$$;

-- After the switchover, stamps mean nothing at a spend shop. Refuse them with a
-- clear code so an out-of-date app or page can't silently award them.
create or replace function public.refuse_stamps_at_spend_shops()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type::text = 'stamp' and exists (
    select 1 from public.businesses b
    where b.id = new.business_id and b.reward_model = 'spend_threshold'
  ) then
    raise exception 'shop_uses_spend_rewards'
      using hint = 'This shop records purchases in £. Update the app to add a purchase.';
  end if;
  return new;
end;
$$;

create trigger refuse_stamps_at_spend_shops
  before insert on public.transactions
  for each row execute function public.refuse_stamps_at_spend_shops();

revoke execute on function
  public.sync_business_spend_threshold(),
  public.refuse_stamps_at_spend_shops()
  from public, anon, authenticated;
revoke execute on function public.spend_next_tier(uuid, integer) from public, anon;
grant execute on function public.spend_next_tier(uuid, integer) to authenticated;
