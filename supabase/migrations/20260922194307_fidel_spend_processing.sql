-- Checkpoint 2: spend progress and refund clawback. Legacy stamp processing
-- remains available for businesses explicitly set to stamp_legacy.

create or replace function public.handle_spend_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _membership public.memberships;
  _model text;
  _threshold integer;
  _total bigint;
  _new_progress integer;
  _reward_count bigint;
  _remaining bigint;
  _reward_index integer;
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

  if _model is distinct from 'spend_threshold'
    or _threshold is null
    or _threshold <= 0 then
    raise exception 'spend rewards require a configured positive threshold';
  end if;

  _total := _membership.reward_progress_pence::bigint + new.value::bigint;
  if _total >= _threshold then
    _reward_count := _total / _threshold;
    _remaining := _total % _threshold;
  else
    _reward_count := 0;
    _remaining := _total;
  end if;

  -- Prevent a misconfigured 1p threshold from creating millions of rewards
  -- in one database transaction. The purchase rolls back for investigation.
  if _reward_count > 1000 then
    raise exception 'spend transaction crosses too many reward thresholds';
  end if;

  if _remaining < -2147483648 or _remaining > 2147483647 then
    raise exception 'reward progress exceeds integer range';
  end if;
  _new_progress := _remaining::integer;

  update public.memberships
  set reward_progress_pence = _new_progress,
      redemption_blocked_reason =
        case when _new_progress >= 0 then null else redemption_blocked_reason end,
      visit_count = visit_count + 1,
      last_visit_date = (now() at time zone 'utc')::date,
      last_activity_at = now()
  where id = _membership.id;

  if _reward_count > 0 then
    for _reward_index in 1.._reward_count::integer loop
      insert into public.rewards (user_id, business_id, title)
      values (new.user_id, new.business_id, 'Free reward');

      insert into public.notifications (user_id, business_id, kind, title, body)
      values (
        new.user_id, new.business_id, 'reward',
        'Reward earned!', 'Free reward is ready to redeem.'
      );
    end loop;
  else
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (
      new.user_id, new.business_id, 'stamp', 'Progress updated',
      'You are £' ||
        to_char((_threshold::bigint - _new_progress::bigint) / 100.0, 'FM999999990.00') ||
        ' away from your next reward.'
    );
  end if;

  return new;
end;
$$;

create trigger on_spend_transaction
  after insert on public.transactions
  for each row
  when (new.type = 'spend')
  execute function public.handle_spend_transaction();

revoke execute on function public.handle_spend_transaction()
  from public, anon, authenticated;

create or replace function public.apply_spend_clawback(
  _membership_id uuid, _delta integer, _reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _new_balance integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'apply_spend_clawback requires service role';
  end if;

  if _delta >= 0 or _reason is null or length(trim(_reason)) = 0 then
    raise exception 'clawback requires a negative delta and nonempty reason';
  end if;

  update public.memberships
  set reward_progress_pence = reward_progress_pence + _delta,
      redemption_blocked_reason =
        case
          when reward_progress_pence + _delta < 0 then _reason
          else null
        end
  where id = _membership_id
  returning reward_progress_pence into _new_balance;

  if not found then
    raise exception 'membership not found for clawback';
  end if;
end;
$$;

revoke execute on function public.apply_spend_clawback(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.apply_spend_clawback(uuid, integer, text)
  to service_role;
