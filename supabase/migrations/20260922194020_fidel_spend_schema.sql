-- Fidel cumulative-spend foundation — checkpoint 1 of ARCH_PLAN.md §7.
-- Legacy stamp columns and triggers remain intact.
-- Webhook processing, refund clawbacks and notification dispatch remain
-- separate reviewed checkpoints. The redemption guard is included because
-- ARCH_PLAN.md §4.4a requires it with the membership-state schema.

-- Provider card identity is Fidel's card.id. accountId is audit context only.
create table public.linked_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fidel_card_id text not null,
  fidel_account_id text,
  card_scheme text,
  last_numbers text,
  linked_at timestamptz not null default now(),
  unlinked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint linked_cards_fidel_card_id_key unique (fidel_card_id),
  constraint linked_cards_card_scheme_check
    check (card_scheme is null or card_scheme in ('visa', 'mastercard', 'amex')),
  constraint linked_cards_last_numbers_check
    check (last_numbers is null or last_numbers ~ '^[0-9]{4}$')
);

create index linked_cards_user_id_active_idx
  on public.linked_cards (user_id)
  where unlinked_at is null;

create trigger set_updated_at
  before update on public.linked_cards
  for each row execute function public.update_updated_at_column();

-- A location mapping is controlled by the platform, not network-provided MID data.
create table public.business_fidel_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  fidel_program_id text not null check (length(trim(fidel_program_id)) > 0),
  fidel_location_id text not null check (length(trim(fidel_location_id)) > 0),
  fidel_mid text,
  created_at timestamptz not null default now(),
  constraint business_fidel_locations_fidel_location_id_key unique (fidel_location_id)
);

create index business_fidel_locations_business_id_idx
  on public.business_fidel_locations (business_id);

-- This table is the authoritative state for one qualifying Fidel purchase.
-- Amounts and progress are pence in signed 32-bit Postgres integers.
create table public.fidel_transactions (
  id uuid primary key default gen_random_uuid(),
  fidel_transaction_id text not null,
  business_id uuid not null references public.businesses(id) on delete restrict,
  linked_card_id uuid not null references public.linked_cards(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  original_amount_pence integer not null check (original_amount_pence >= 0),
  total_refunded_pence integer not null default 0 check (total_refunded_pence >= 0),
  progress_credited_pence integer not null default 0,
  status text not null default 'authorized'
    check (status in ('authorized', 'cleared', 'refunded', 'partially_refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fidel_transactions_fidel_transaction_id_key unique (fidel_transaction_id),
  constraint fidel_transactions_refund_not_exceed_original
    check (total_refunded_pence <= original_amount_pence)
);

create index fidel_transactions_linked_card_id_created_at_idx
  on public.fidel_transactions (linked_card_id, created_at desc);
create index fidel_transactions_business_id_created_at_idx
  on public.fidel_transactions (business_id, created_at desc);

create trigger set_updated_at
  before update on public.fidel_transactions
  for each row execute function public.update_updated_at_column();

-- One logical provider event may be delivered repeatedly. The unique key is
-- enforced inside the future atomic RPC, never by application memory alone.
create table public.fidel_webhook_events (
  id uuid primary key default gen_random_uuid(),
  fidel_message_id text not null check (length(trim(fidel_message_id)) > 0),
  fidel_transaction_id text not null check (length(trim(fidel_transaction_id)) > 0),
  event_type text not null
    check (event_type in ('transaction.auth', 'transaction.clearing', 'transaction.refund')),
  received_at timestamptz not null default now(),
  constraint fidel_webhook_events_transaction_event_key
    unique (fidel_transaction_id, event_type)
);

create index fidel_webhook_events_fidel_message_id_idx
  on public.fidel_webhook_events (fidel_message_id);

-- The new progress balance can be negative after refunds. Existing stamp_count
-- and points_balance remain untouched for legacy businesses.
alter table public.businesses
  add column reward_model text not null default 'stamp_legacy'
    check (reward_model in ('spend_threshold', 'stamp_legacy')),
  add column reward_threshold_pence integer
    check (reward_threshold_pence is null or reward_threshold_pence > 0);

alter table public.memberships
  add column reward_progress_pence integer not null default 0,
  add column redemption_blocked_reason text;

-- The existing customer update guard predates these two columns. Without this
-- replacement a shopper could change reward progress through the Data API.
create or replace function public.enforce_membership_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_privileged boolean;
  _is_service_role boolean;
begin
  _is_service_role := coalesce(
    current_setting('request.jwt.claim.role', true) = 'service_role',
    false
  );
  _is_privileged := _is_service_role
    or public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.businesses b
      where b.id = new.business_id and b.owner_id = auth.uid()
    )
    or public.is_active_staff_of(new.business_id, auth.uid());

  -- Only the trusted webhook, an admin, or the spend transaction trigger may
  -- change the new monetary balance. An owner/staff direct table update may not.
  if (
      new.reward_progress_pence != old.reward_progress_pence
      or new.redemption_blocked_reason is distinct from old.redemption_blocked_reason
    )
    and not (
      _is_service_role
      or public.has_role(auth.uid(), 'admin')
      or pg_trigger_depth() > 1
    ) then
    raise exception 'reward progress requires a trusted transaction';
  end if;

  if _is_privileged then
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
$$;

revoke execute on function public.enforce_membership_update_scope()
  from public, anon, authenticated;

-- The 'spend' enum value was committed by the preceding migration. Preserve
-- the old 1..50 range for every legacy transaction type.
alter table public.transactions
  drop constraint transactions_value_check,
  add constraint transactions_value_check
    check (
      (type <> 'spend' and value > 0 and value <= 50)
      or (type = 'spend' and value > 0)
    );

-- Merchant browser clients may insert legacy/manual transactions, but must
-- never be able to fabricate a Fidel spend amount. Only the service-role
-- webhook path can insert type='spend' until a reviewed manual spend RPC exists.
drop policy "transactions_insert_owner_or_staff_or_admin" on public.transactions;
create policy "transactions_insert_owner_or_staff_or_admin"
  on public.transactions for insert
  with check (
    type <> 'spend'
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

-- Browser clients can only read the minimum required mapping data. No browser
-- role can write provider mappings, provider events, or provider transactions.
alter table public.linked_cards enable row level security;
alter table public.business_fidel_locations enable row level security;
alter table public.fidel_transactions enable row level security;
alter table public.fidel_webhook_events enable row level security;

revoke all on table public.linked_cards,
  public.business_fidel_locations,
  public.fidel_transactions,
  public.fidel_webhook_events from public, anon, authenticated;

grant select on table public.linked_cards,
  public.business_fidel_locations to authenticated;

create policy "linked_cards_select_self_or_admin"
  on public.linked_cards for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin')
  );

create policy "business_fidel_locations_select_owner_staff_or_admin"
  on public.business_fidel_locations for select to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = (select auth.uid())
    )
    or public.is_active_staff_of(business_id, (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin')
  );

-- Table privileges and RLS policies intentionally deny all direct client access
-- to the transaction state and delivery ledger. Service role and the reviewed
-- SECURITY DEFINER RPC added in a later checkpoint perform those writes.

-- Extend the existing redemption trigger so a customer with pending reversal
-- state cannot redeem. Business owners and admins retain their existing
-- privileged redemption path; staff are subject to this guard.
create or replace function public.enforce_rewards_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _redemption_blocked_reason text;
  _is_business_owner boolean;
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if new.user_id != old.user_id
    or new.business_id != old.business_id
    or new.title != old.title
    or new.qr_token != old.qr_token
    or new.short_code != old.short_code
    or new.catalog_id is distinct from old.catalog_id
    or new.expires_at is distinct from old.expires_at
    or new.created_at != old.created_at then
    raise exception 'only redeemed_at may be changed';
  end if;

  if old.redeemed_at is not null then
    raise exception 'reward already redeemed';
  end if;

  if new.redeemed_at is not null
    and new.expires_at is not null
    and new.redeemed_at > new.expires_at then
    raise exception 'reward has expired';
  end if;

  if new.redeemed_at is not null and old.redeemed_at is null then
    select exists (
      select 1
      from public.businesses b
      where b.id = new.business_id
        and b.owner_id = auth.uid()
    )
    into _is_business_owner;

    if not _is_business_owner then
      select m.redemption_blocked_reason
      into _redemption_blocked_reason
      from public.memberships m
      where m.user_id = new.user_id
        and m.business_id = new.business_id
      for update;

      if not found then
        raise exception 'reward membership not found';
      end if;

      if _redemption_blocked_reason is not null then
        raise exception 'reward redemption is temporarily blocked';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_rewards_update_scope() from public, anon, authenticated;
