-- Manual spend entry by staff (ARCH_PLAN.md §4.10, decisions M1–M3).
-- Additive only. Nothing changes for a shop until it runs
-- reward_model = 'spend_threshold'.

-- M1: per-entry cap, £200 by default, owner-adjustable between £1 and £1,000.
alter table public.businesses
  add column manual_spend_max_pence integer not null default 20000,
  add constraint businesses_manual_spend_max_pence_check
    check (manual_spend_max_pence between 100 and 100000);

-- Idempotency key for manual entries, and the undo (void) record.
alter table public.transactions
  add column client_ref uuid,
  add column voided_at timestamptz,
  add column voided_by uuid references auth.users(id) on delete set null,
  add column void_reason text,
  add constraint transactions_void_state_check
    check ((voided_at is null and void_reason is null and voided_by is null)
      or (voided_at is not null and void_reason is not null));

create unique index transactions_client_ref_key
  on public.transactions (client_ref)
  where client_ref is not null;

-- M3: the owner, staff who may scan stamps, or an admin.
create or replace function public.can_record_manual_spend(_business_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _user_id is not null and (
    exists (select 1 from public.businesses b where b.id = _business_id and b.owner_id = _user_id)
    or public.staff_has_permission(_business_id, _user_id, 'scan_stamps')
    or public.has_role(_user_id, 'admin')
  )
$$;

-- The only client path for type = 'spend'. The insert fires the existing
-- triggers: the linked-customer rule (method, 3 a day, 30 minutes apart;
-- it also records the inserter) and handle_spend_transaction (progress,
-- rewards, notifications).
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
    or coalesce(_business.reward_threshold_pence, 0) <= 0 then
    raise exception 'shop_not_spend_based';
  end if;

  -- A retry of an entry that already went through returns its result.
  select * into _existing from public.transactions where client_ref = _client_ref;
  if found then
    if _existing.recorded_by is distinct from _caller or _existing.business_id <> _business_id then
      raise exception 'invalid_client_ref';
    end if;
    select reward_progress_pence into _progress from public.memberships
    where user_id = _existing.user_id and business_id = _business_id;
    return jsonb_build_object(
      'status', 'duplicate', 'transactionId', _existing.id, 'amountPence', _existing.value,
      'progressPence', _progress, 'thresholdPence', _business.reward_threshold_pence,
      'rewardsEarned', null);
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
    -- The same entry arrived twice at once; the other copy committed first.
    select * into _existing from public.transactions where client_ref = _client_ref;
    select reward_progress_pence into _progress from public.memberships
    where user_id = _customer_id and business_id = _business_id;
    return jsonb_build_object(
      'status', 'duplicate', 'transactionId', _existing.id, 'amountPence', _existing.value,
      'progressPence', _progress, 'thresholdPence', _business.reward_threshold_pence,
      'rewardsEarned', null);
  end;

  select count(*) into _rewards_after from public.rewards
  where user_id = _customer_id and business_id = _business_id;
  select reward_progress_pence into _progress from public.memberships where id = _membership_id;

  return jsonb_build_object(
    'status', 'recorded', 'transactionId', _transaction_id, 'amountPence', _amount_pence,
    'progressPence', _progress, 'thresholdPence', _business.reward_threshold_pence,
    'rewardsEarned', _rewards_after - _rewards_before);
end;
$$;

-- M2: staff undo their own entry within 10 minutes; the owner or an admin can
-- undo any manual entry within 7 days. Fidel-credited rows (no recorded_by)
-- can never be undone here. The progress adjustment happens in the
-- transactions trigger below, so the membership guard's trusted-trigger rule
-- stays intact.
create or replace function public.undo_manual_spend(_transaction_id uuid, _reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := auth.uid();
  _entry public.transactions;
  _is_owner_or_admin boolean;
begin
  if _caller is null or _transaction_id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into _entry from public.transactions where id = _transaction_id for update;
  if not found or _entry.type::text <> 'spend' or _entry.recorded_by is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if _entry.voided_at is not null then
    raise exception 'already_undone';
  end if;

  _is_owner_or_admin := exists (
      select 1 from public.businesses b where b.id = _entry.business_id and b.owner_id = _caller
    ) or public.has_role(_caller, 'admin');

  if _is_owner_or_admin then
    if now() > _entry.created_at + interval '7 days' then raise exception 'too_late'; end if;
  elsif _entry.recorded_by = _caller and public.can_record_manual_spend(_entry.business_id, _caller) then
    if now() > _entry.created_at + interval '10 minutes' then raise exception 'too_late'; end if;
  else
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  update public.transactions
  set voided_at = now(),
      voided_by = _caller,
      void_reason = coalesce(nullif(trim(left(_reason, 200)), ''), 'Corrected by the shop')
  where id = _transaction_id;

  return jsonb_build_object('status', 'undone', 'transactionId', _transaction_id, 'amountPence', _entry.value);
end;
$$;

-- Runs inside the transactions update, so the membership guard sees a
-- trusted trigger (pg_trigger_depth() > 1), exactly like handle_spend_transaction.
create or replace function public.handle_spend_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _new_progress integer;
  _shop_name text;
begin
  update public.memberships
  set reward_progress_pence = reward_progress_pence - old.value,
      redemption_blocked_reason = case
        when reward_progress_pence - old.value < 0
          then 'A purchase entry was corrected. Spend a little more to redeem again.'
        else redemption_blocked_reason
      end
  where user_id = old.user_id and business_id = old.business_id
  returning reward_progress_pence into _new_progress;

  select name into _shop_name from public.businesses where id = old.business_id;
  insert into public.notifications (user_id, business_id, kind, title, body)
  values (
    old.user_id, old.business_id, 'system', 'Purchase corrected',
    'A purchase of £' || to_char(old.value / 100.0, 'FM999999990.00') ||
      coalesce(' at ' || _shop_name, '') || ' was corrected by the shop.'
  );
  return new;
end;
$$;

create trigger on_spend_void
  after update of voided_at on public.transactions
  for each row
  when (old.voided_at is null and new.voided_at is not null and new.type = 'spend')
  execute function public.handle_spend_void();

-- One call after a scan: progress, the shop's cap and the linked-card state.
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
begin
  if not public.can_record_manual_spend(_business_id, _caller) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into _business from public.businesses where id = _business_id;
  select * into _membership from public.memberships where user_id = _customer_id and business_id = _business_id;
  _link := public.customer_card_link_status(_customer_id, _business_id);
  return jsonb_build_object(
    'rewardModel', _business.reward_model,
    'member', _membership.id is not null,
    'progressPence', _membership.reward_progress_pence,
    'redemptionBlocked', _membership.redemption_blocked_reason is not null,
    'thresholdPence', _business.reward_threshold_pence,
    'manualMaxPence', _business.manual_spend_max_pence,
    'linked', coalesce((_link ->> 'linked')::boolean, false),
    'manualToday', coalesce((_link ->> 'manualToday')::integer, 0),
    'nextAllowedAt', _link -> 'nextAllowedAt'
  );
end;
$$;

revoke execute on function
  public.can_record_manual_spend(uuid, uuid),
  public.record_manual_spend(uuid, uuid, integer, text, uuid),
  public.undo_manual_spend(uuid, text),
  public.handle_spend_void(),
  public.scanned_member_spend_summary(uuid, uuid)
  from public, anon, authenticated;

grant execute on function
  public.record_manual_spend(uuid, uuid, integer, text, uuid),
  public.undo_manual_spend(uuid, text),
  public.scanned_member_spend_summary(uuid, uuid)
  to authenticated;
