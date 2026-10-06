-- A deactivated shop remains readable and can be reactivated by its owner, but
-- must not accrue new customer value through any transaction or redemption path.
-- approval_status is deliberately not part of this decision.

-- Round-2 compatibility: an already-used local database can retain these old
-- overloads after the UUID-signature migration replaced them.
drop function if exists public.deactivate_my_business();
drop function if exists public.reactivate_my_business();

-- Keep the browser policy aligned with the server-side trigger below. The
-- trigger is still required because SECURITY DEFINER RPCs and service_role
-- bypass RLS (manual spend and Fidel webhook processing).
drop policy if exists "transactions_insert_owner_or_staff_or_admin" on public.transactions;
create policy "transactions_insert_owner_or_staff_or_admin"
  on public.transactions for insert
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = transactions.business_id and b.is_active
    )
    and type <> 'spend'
    and (
      exists (
        select 1 from public.businesses b
        where b.id = business_id and b.owner_id = auth.uid()
      )
      or public.staff_has_permission(business_id, auth.uid(), 'scan_stamps')
      or public.has_role(auth.uid(), 'admin')
    )
    and (
      type != 'stamp'
      or exists (
        select 1 from public.memberships m
        where m.user_id = transactions.user_id
          and m.business_id = transactions.business_id
      )
    )
  );

-- This covers direct inserts, record_manual_spend, and process_fidel_webhook_event.
-- It intentionally applies to every transaction type: a deactivated shop must
-- not record a stamp, spend, redemption, or other customer-value write.
create or replace function public.reject_inactive_business_transaction_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.businesses b
    where b.id = new.business_id and b.is_active
  ) then
    raise exception 'business is inactive' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists a_reject_inactive_business_transaction_write on public.transactions;
create trigger a_reject_inactive_business_transaction_write
  before insert on public.transactions
  for each row execute function public.reject_inactive_business_transaction_write();

revoke execute on function public.reject_inactive_business_transaction_write()
  from public, anon, authenticated;

-- enforce_rewards_update_scope continues to decide who may redeem. This guard
-- adds business activity as a separate invariant without changing that scope.
create or replace function public.reject_inactive_business_reward_redemption()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.redeemed_at is null and new.redeemed_at is not null
    and not exists (
      select 1
      from public.businesses b
      where b.id = new.business_id and b.is_active
    ) then
    raise exception 'business is inactive' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists a_reject_inactive_business_reward_redemption on public.rewards;
create trigger a_reject_inactive_business_reward_redemption
  before update of redeemed_at on public.rewards
  for each row execute function public.reject_inactive_business_reward_redemption();

revoke execute on function public.reject_inactive_business_reward_redemption()
  from public, anon, authenticated;

-- Do not let an auth webhook turn an inactive mapped location into a purchase.
-- The existing function keeps its SECURITY DEFINER, fixed search_path, and
-- service_role-only grant established by the Fidel lifecycle migration.
create or replace function public.fidel_location_accepts_new_awards(_location_row public.business_fidel_locations)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (_location_row).fidel_status = 'active'
    and exists (
      select 1 from public.businesses b
      where b.id = (_location_row).business_id and b.is_active
    ),
    false
  )
$$;
