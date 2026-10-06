-- Card payments received while a shop is inactive are held, then credited when
-- the shop is reactivated (owner decision, 2026-10-06). A held payment that is
-- refunded or cleared before reactivation is adjusted, so only the net amount
-- is credited. Payments for a card that has since been unlinked, a customer
-- who left, or a location that is no longer active are dropped, not credited.
-- Replay never blocks reactivation: a failing payment is marked 'failed'.

create table if not exists public.fidel_deferred_awards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  fidel_transaction_id text not null,
  fidel_card_id text not null,
  fidel_location_id text not null,
  program_id text not null,
  amount_pence integer not null check (amount_pence > 0),
  refunded_pence integer not null default 0 check (refunded_pence >= 0 and refunded_pence <= amount_pence),
  cleared boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'replayed', 'dropped', 'failed')),
  status_reason text,
  received_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint fidel_deferred_awards_transaction_key unique (fidel_transaction_id)
);
create index if not exists fidel_deferred_awards_pending_idx
  on public.fidel_deferred_awards (business_id, received_at) where status = 'pending';
alter table public.fidel_deferred_awards enable row level security;
revoke all on public.fidel_deferred_awards from public, anon, authenticated;

-- Webhook processing, unchanged from 20260929071345_fidel_card_lifecycle_repair.sql
-- except for three marked branches that hold, adjust or record a deferred payment.
create or replace function public.process_fidel_webhook_event(
  _fidel_message_id text,
  _event_type text,
  _fidel_transaction_id text,
  _program_id text,
  _fidel_card_id text,
  _fidel_location_id text,
  _original_transaction_id text,
  _amount_pence integer,
  _auth boolean,
  _cleared boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _event_id uuid;
  _business_location public.business_fidel_locations;
  _linked_card public.linked_cards;
  _membership public.memberships;
  _purchase public.fidel_transactions;
  _refund_amount bigint;
  _new_total_refunded bigint;
  _new_progress_credited bigint;
  _delta bigint;
  _reason text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'process_fidel_webhook_event requires service role';
  end if;

  if _event_type not in ('transaction.auth', 'transaction.clearing', 'transaction.refund')
    or _fidel_message_id is null or length(trim(_fidel_message_id)) = 0
    or _fidel_transaction_id is null or length(trim(_fidel_transaction_id)) = 0
    or _program_id is null or length(trim(_program_id)) = 0
    or _fidel_card_id is null or length(trim(_fidel_card_id)) = 0
    or _fidel_location_id is null or length(trim(_fidel_location_id)) = 0 then
    raise exception 'invalid validated Fidel transaction arguments';
  end if;

  -- The ledger insert and all later actions are in this single transaction.
  begin
    insert into public.fidel_webhook_events (
      fidel_message_id, fidel_transaction_id, event_type
    ) values (
      _fidel_message_id, _fidel_transaction_id, _event_type
    ) returning id into _event_id;
  exception when unique_violation then
    return jsonb_build_object('status', 'duplicate');
  end;

  -- Exact-zero verification authorizations and clearings are valid provider
  -- events. Keep their idempotency record, then acknowledge them as no-ops.
  if _amount_pence = 0
    and _event_type in ('transaction.auth', 'transaction.clearing') then
    update public.fidel_webhook_events set outcome = 'ignored_zero_amount' where id = _event_id;
    return jsonb_build_object('status', 'ignored_zero_amount');
  end if;

  select * into _business_location
  from public.business_fidel_locations
  where fidel_location_id = _fidel_location_id
    and fidel_program_id = _program_id;
  if not found then
    raise warning 'Fidel webhook unknown merchant location: %', _fidel_location_id;
    update public.fidel_webhook_events set outcome = 'unknown_merchant' where id = _event_id;
    return jsonb_build_object('status', 'unknown_merchant');
  end if;

  if _event_type = 'transaction.auth' then
    if not public.fidel_location_accepts_new_awards(_business_location) then
      -- A shop that is only inactive holds the payment; it is credited when the
      -- shop is reactivated (see replay_deferred_fidel_awards).
      if _business_location.fidel_status = 'active'
        and _amount_pence > 0 and _auth is true
        and exists (select 1 from public.businesses b
          where b.id = _business_location.business_id and not b.is_active) then
        insert into public.fidel_deferred_awards (
          business_id, fidel_transaction_id, fidel_card_id, fidel_location_id, program_id, amount_pence
        ) values (
          _business_location.business_id, _fidel_transaction_id, _fidel_card_id,
          _fidel_location_id, _program_id, _amount_pence
        ) on conflict (fidel_transaction_id) do nothing;
        update public.fidel_webhook_events set outcome = 'deferred_inactive' where id = _event_id;
        return jsonb_build_object('status', 'deferred_inactive');
      end if;
      update public.fidel_webhook_events set outcome = 'ineligible_location' where id = _event_id;
    return jsonb_build_object('status','ineligible_location');
    end if;
    select * into _linked_card from public.linked_cards
      where fidel_card_id = _fidel_card_id and unlinked_at is null for share;
    if not found then update public.fidel_webhook_events set outcome = 'unknown_card' where id = _event_id;
    return jsonb_build_object('status','unknown_card'); end if;
    select * into _membership from public.memberships
      where user_id = _linked_card.user_id and business_id = _business_location.business_id for update;
    if not found then update public.fidel_webhook_events set outcome = 'unknown_membership' where id = _event_id;
    return jsonb_build_object('status','unknown_membership'); end if;

    if _amount_pence < 0 or _auth is not true then
      raise exception 'invalid authorization event';
    end if;

    insert into public.fidel_transactions (
      fidel_transaction_id, business_id, linked_card_id, user_id,
      original_amount_pence, progress_credited_pence, status
    ) values (
      _fidel_transaction_id, _business_location.business_id, _linked_card.id,
      _linked_card.user_id, _amount_pence, _amount_pence, 'authorized'
    );

    insert into public.transactions (
      user_id, business_id, membership_id, type, value, note
    ) values (
      _linked_card.user_id, _business_location.business_id, _membership.id,
      'spend', _amount_pence, 'fidel:auth:' || _fidel_transaction_id
    );

    update public.fidel_webhook_events set outcome = 'processed' where id = _event_id;
    return jsonb_build_object('status', 'processed');
  end if;

  if _event_type = 'transaction.clearing' then
    -- Fidel emits a negative auth=false clearing as part of a refund. It is
    -- ledgered for idempotency but never changes purchase state or progress.
    if _amount_pence < 0 or _auth is false then
      update public.fidel_webhook_events set outcome = 'ignored_negative_clearing' where id = _event_id;
    return jsonb_build_object('status', 'ignored_negative_clearing');
    end if;
    if _amount_pence < 0 or _cleared is not true then
      raise exception 'invalid positive clearing event';
    end if;

    update public.fidel_transactions
    set status = 'cleared'
    where fidel_transaction_id = _fidel_transaction_id
      and business_id = _business_location.business_id
      and exists (select 1 from public.linked_cards c
        where c.id = fidel_transactions.linked_card_id and c.fidel_card_id = _fidel_card_id
          and c.user_id = fidel_transactions.user_id);
    if not found then
      update public.fidel_deferred_awards set cleared = true
      where fidel_transaction_id = _fidel_transaction_id
        and business_id = _business_location.business_id and status = 'pending';
      if found then
        update public.fidel_webhook_events set outcome = 'deferred_clearing_recorded' where id = _event_id;
        return jsonb_build_object('status', 'deferred_clearing_recorded');
      end if;
      raise warning 'Fidel clearing did not resolve to an authorization: %', _fidel_transaction_id;
      update public.fidel_webhook_events set outcome = 'unresolved_clearing' where id = _event_id;
    return jsonb_build_object('status', 'unresolved_clearing');
    end if;
    update public.fidel_webhook_events set outcome = 'processed' where id = _event_id;
    return jsonb_build_object('status', 'processed');
  end if;

  -- transaction.refund: do not infer a purchase when the provider correlation
  -- is absent or has a shape contradicted by a future signed sandbox delivery.
  if _amount_pence >= 0 or _auth is not false then
    raise exception 'invalid refund event';
  end if;
  if _original_transaction_id is null or length(trim(_original_transaction_id)) = 0 then
    raise warning 'Fidel refund had no original transaction id';
    update public.fidel_webhook_events set outcome = 'unresolved_refund' where id = _event_id;
    return jsonb_build_object('status', 'unresolved_refund');
  end if;

  select * into _purchase
  from public.fidel_transactions
  where fidel_transaction_id = _original_transaction_id
    and business_id = _business_location.business_id
    and exists (select 1 from public.linked_cards c
      where c.id = fidel_transactions.linked_card_id and c.fidel_card_id = _fidel_card_id
        and c.user_id = fidel_transactions.user_id)
  for update;
  if not found then
    update public.fidel_deferred_awards
    set refunded_pence = refunded_pence + (-_amount_pence)
    where fidel_transaction_id = _original_transaction_id
      and business_id = _business_location.business_id and status = 'pending'
      and refunded_pence + (-_amount_pence) <= amount_pence;
    if found then
      update public.fidel_webhook_events set outcome = 'deferred_refund_recorded' where id = _event_id;
      return jsonb_build_object('status', 'deferred_refund_recorded');
    end if;
    raise warning 'Fidel refund did not resolve to a known purchase';
    update public.fidel_webhook_events set outcome = 'unresolved_refund' where id = _event_id;
    return jsonb_build_object('status', 'unresolved_refund');
  end if;

  select * into _membership from public.memberships
    where user_id = _purchase.user_id and business_id = _purchase.business_id for update;
  if not found then update public.fidel_webhook_events set outcome = 'refund_membership_missing' where id = _event_id;
    return jsonb_build_object('status','refund_membership_missing'); end if;

  _refund_amount := -_amount_pence::bigint;
  _new_total_refunded := _purchase.total_refunded_pence::bigint + _refund_amount;
  if _new_total_refunded > _purchase.original_amount_pence then
    raise warning 'Fidel refund exceeds original authorization amount';
    update public.fidel_webhook_events set outcome = 'invalid_refund' where id = _event_id;
    return jsonb_build_object('status', 'invalid_refund');
  end if;
  _new_progress_credited := _purchase.original_amount_pence::bigint - _new_total_refunded;
  _delta := _new_progress_credited - _purchase.progress_credited_pence::bigint;
  if _delta > 0 then
    raise warning 'Fidel refund would increase reward progress';
    update public.fidel_webhook_events set outcome = 'invalid_refund' where id = _event_id;
    return jsonb_build_object('status', 'invalid_refund');
  end if;

  if _delta < 0 then
    _reason := 'A refund reduced your reward progress. Spend more to redeem again.';
    perform public.apply_spend_clawback(_membership.id, _delta::integer, _reason);
  end if;

  update public.fidel_transactions
  set total_refunded_pence = _new_total_refunded::integer,
      progress_credited_pence = _new_progress_credited::integer,
      status = case
        when _new_total_refunded = _purchase.original_amount_pence then 'refunded'
        else 'partially_refunded'
      end
  where id = _purchase.id;

  update public.fidel_webhook_events set outcome = 'processed' where id = _event_id;
    return jsonb_build_object('status', 'processed');
end;
$$;


create or replace function public.replay_deferred_fidel_awards(_business_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.fidel_deferred_awards;
  _location public.business_fidel_locations;
  _card public.linked_cards;
  _membership public.memberships;
  _net integer;
  _count integer := 0;
begin
  for r in
    select * from public.fidel_deferred_awards
    where business_id = _business_id and status = 'pending'
    order by received_at, id
    for update
  loop
    begin
      select * into _location from public.business_fidel_locations
      where fidel_location_id = r.fidel_location_id and fidel_program_id = r.program_id
        and business_id = _business_id;
      if not found or not public.fidel_location_accepts_new_awards(_location) then
        update public.fidel_deferred_awards
        set status = 'dropped', status_reason = 'location_not_active', resolved_at = now() where id = r.id;
        continue;
      end if;
      select * into _card from public.linked_cards
      where fidel_card_id = r.fidel_card_id and unlinked_at is null for share;
      if not found then
        update public.fidel_deferred_awards
        set status = 'dropped', status_reason = 'card_unlinked', resolved_at = now() where id = r.id;
        continue;
      end if;
      select * into _membership from public.memberships
      where user_id = _card.user_id and business_id = _business_id for update;
      if not found then
        update public.fidel_deferred_awards
        set status = 'dropped', status_reason = 'no_membership', resolved_at = now() where id = r.id;
        continue;
      end if;

      _net := r.amount_pence - r.refunded_pence;
      insert into public.fidel_transactions (
        fidel_transaction_id, business_id, linked_card_id, user_id,
        original_amount_pence, total_refunded_pence, progress_credited_pence, status
      ) values (
        r.fidel_transaction_id, _business_id, _card.id, _card.user_id,
        r.amount_pence, r.refunded_pence, _net,
        case when r.refunded_pence = 0 then (case when r.cleared then 'cleared' else 'authorized' end)
             when _net = 0 then 'refunded' else 'partially_refunded' end
      );
      if _net > 0 then
        insert into public.transactions (user_id, business_id, membership_id, type, value, note)
        values (_card.user_id, _business_id, _membership.id, 'spend', _net, 'fidel:auth:' || r.fidel_transaction_id);
      end if;
      update public.fidel_deferred_awards set status = 'replayed', resolved_at = now() where id = r.id;
      _count := _count + 1;
    exception when others then
      update public.fidel_deferred_awards
      set status = 'failed', status_reason = left(sqlerrm, 200), resolved_at = now() where id = r.id;
    end;
  end loop;
  return _count;
end;
$$;

revoke execute on function public.replay_deferred_fidel_awards(uuid) from public, anon, authenticated;
grant execute on function public.replay_deferred_fidel_awards(uuid) to service_role;

create or replace function public.replay_deferred_awards_on_reactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active is distinct from true and new.is_active is true then
    perform public.replay_deferred_fidel_awards(new.id);
  end if;
  return new;
end;
$$;
revoke execute on function public.replay_deferred_awards_on_reactivation() from public, anon, authenticated;

drop trigger if exists replay_deferred_awards_on_reactivation on public.businesses;
create trigger replay_deferred_awards_on_reactivation
  after update of is_active on public.businesses
  for each row execute function public.replay_deferred_awards_on_reactivation();
