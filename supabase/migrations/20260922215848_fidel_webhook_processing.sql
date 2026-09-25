-- Checkpoint 5: one atomic, service-role-only webhook operation.
-- The Edge Function verifies the raw Fidel request before calling this RPC.

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
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
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
    );
  exception when unique_violation then
    return jsonb_build_object('status', 'duplicate');
  end;

  -- Exact-zero verification authorizations and clearings are valid provider
  -- events. Keep their idempotency record, then acknowledge them as no-ops.
  if _amount_pence = 0
    and _event_type in ('transaction.auth', 'transaction.clearing') then
    return jsonb_build_object('status', 'ignored_zero_amount');
  end if;

  select * into _business_location
  from public.business_fidel_locations
  where fidel_location_id = _fidel_location_id
    and fidel_program_id = _program_id;
  if not found then
    raise warning 'Fidel webhook unknown merchant location: %', _fidel_location_id;
    return jsonb_build_object('status', 'unknown_merchant');
  end if;

  select * into _linked_card
  from public.linked_cards
  where fidel_card_id = _fidel_card_id
    and unlinked_at is null;
  if not found then
    raise warning 'Fidel webhook unknown linked card';
    return jsonb_build_object('status', 'unknown_card');
  end if;

  select * into _membership
  from public.memberships
  where user_id = _linked_card.user_id
    and business_id = _business_location.business_id
  for update;
  if not found then
    raise warning 'Fidel webhook linked card has no membership for mapped business';
    return jsonb_build_object('status', 'unknown_membership');
  end if;

  if _event_type = 'transaction.auth' then
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

    return jsonb_build_object('status', 'processed');
  end if;

  if _event_type = 'transaction.clearing' then
    -- Fidel emits a negative auth=false clearing as part of a refund. It is
    -- ledgered for idempotency but never changes purchase state or progress.
    if _amount_pence < 0 or _auth is false then
      return jsonb_build_object('status', 'ignored_negative_clearing');
    end if;
    if _amount_pence < 0 or _cleared is not true then
      raise exception 'invalid positive clearing event';
    end if;

    update public.fidel_transactions
    set status = 'cleared'
    where fidel_transaction_id = _fidel_transaction_id
      and business_id = _business_location.business_id
      and linked_card_id = _linked_card.id;
    if not found then
      raise warning 'Fidel clearing did not resolve to an authorization: %', _fidel_transaction_id;
      return jsonb_build_object('status', 'unresolved_clearing');
    end if;
    return jsonb_build_object('status', 'processed');
  end if;

  -- transaction.refund: do not infer a purchase when the provider correlation
  -- is absent or has a shape contradicted by a future signed sandbox delivery.
  if _amount_pence >= 0 or _auth is not false then
    raise exception 'invalid refund event';
  end if;
  if _original_transaction_id is null or length(trim(_original_transaction_id)) = 0 then
    raise warning 'Fidel refund had no original transaction id';
    return jsonb_build_object('status', 'unresolved_refund');
  end if;

  select * into _purchase
  from public.fidel_transactions
  where fidel_transaction_id = _original_transaction_id
    and business_id = _business_location.business_id
    and linked_card_id = _linked_card.id
    and user_id = _linked_card.user_id
  for update;
  if not found then
    raise warning 'Fidel refund did not resolve to a known purchase';
    return jsonb_build_object('status', 'unresolved_refund');
  end if;

  _refund_amount := -_amount_pence::bigint;
  _new_total_refunded := _purchase.total_refunded_pence::bigint + _refund_amount;
  if _new_total_refunded > _purchase.original_amount_pence then
    raise warning 'Fidel refund exceeds original authorization amount';
    return jsonb_build_object('status', 'invalid_refund');
  end if;
  _new_progress_credited := _purchase.original_amount_pence::bigint - _new_total_refunded;
  _delta := _new_progress_credited - _purchase.progress_credited_pence::bigint;
  if _delta > 0 then
    raise warning 'Fidel refund would increase reward progress';
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

  return jsonb_build_object('status', 'processed');
end;
$$;

revoke execute on function public.process_fidel_webhook_event(
  text, text, text, text, text, text, text, integer, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.process_fidel_webhook_event(
  text, text, text, text, text, text, text, integer, boolean, boolean
) to service_role;
