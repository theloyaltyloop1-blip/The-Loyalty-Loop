-- §4 Staff accounts. See docs/LOYALTY-LOOP-DATA-MODEL.md §3, §7.
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  invited_email text not null,
  name text not null,
  pin_hash text,
  status text not null default 'invited' check (status in ('invited','active','revoked')),
  invited_by uuid not null references auth.users(id),
  can_scan_stamps boolean not null default true,
  can_redeem_rewards boolean not null default true,
  can_respond_reviews boolean not null default false,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  constraint staff_members_business_email_key unique (business_id, invited_email)
);

alter table public.staff_members enable row level security;

create policy "staff_members_owner_full_access"
  on public.staff_members for all
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

create policy "staff_members_self_select"
  on public.staff_members for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
create or replace function public.is_active_staff_of(_business_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_members
    where business_id = _business_id and user_id = _user_id and status = 'active'
  );
$$;

create or replace function public.staff_has_permission(_business_id uuid, _user_id uuid, _perm text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _row public.staff_members;
begin
  select * into _row from public.staff_members
    where business_id = _business_id and user_id = _user_id and status = 'active';
  if not found then
    return false;
  end if;
  return case _perm
    when 'scan_stamps' then _row.can_scan_stamps
    when 'redeem_rewards' then _row.can_redeem_rewards
    when 'respond_reviews' then _row.can_respond_reviews
    else false
  end;
end;
$$;

grant execute on function public.is_active_staff_of(uuid, uuid) to authenticated;
grant execute on function public.staff_has_permission(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Staff PIN: quick unlock on a shared shop device without the full
-- password. Hashed with pgcrypto, never compared in plaintext.
create or replace function public.set_my_staff_pin(_business_id uuid, _pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4-6 digits';
  end if;

  update public.staff_members
  set pin_hash = crypt(_pin, gen_salt('bf'))
  where business_id = _business_id and user_id = auth.uid() and status = 'active';

  if not found then
    raise exception 'no active staff row found for this shop';
  end if;
end;
$$;

create or replace function public.verify_staff_pin(_business_id uuid, _pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _hash text;
begin
  select pin_hash into _hash from public.staff_members
    where business_id = _business_id and user_id = auth.uid() and status = 'active';

  if _hash is null then
    return false;
  end if;
  return _hash = crypt(_pin, _hash);
end;
$$;

grant execute on function public.set_my_staff_pin(uuid, text) to authenticated;
grant execute on function public.verify_staff_pin(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Widen the businesses/memberships/transactions/rewards/review_replies RLS
-- policies that were deliberately left owner/admin-only in §2 ("staff
-- clause added in §4" comments) now that staff_members actually exists.

drop policy "businesses_select_public_or_owner_or_admin" on public.businesses;
create policy "businesses_select_public_or_owner_or_admin"
  on public.businesses for select
  using (
    (is_active and approval_status = 'approved')
    or owner_id = auth.uid()
    or public.is_active_staff_of(id, auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

drop policy "memberships_select_self_or_owner_or_admin" on public.memberships;
create policy "memberships_select_self_or_owner_or_admin"
  on public.memberships for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.is_active_staff_of(business_id, auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

drop policy "rewards_select_self_or_owner_or_admin" on public.rewards;
create policy "rewards_select_self_or_owner_or_admin"
  on public.rewards for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.is_active_staff_of(business_id, auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

drop policy "rewards_update_owner_or_admin" on public.rewards;
create policy "rewards_update_owner_or_staff_or_admin"
  on public.rewards for update
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.staff_has_permission(business_id, auth.uid(), 'redeem_rewards')
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.staff_has_permission(business_id, auth.uid(), 'redeem_rewards')
    or public.has_role(auth.uid(), 'admin')
  );

drop policy "transactions_select_self_or_owner_or_admin" on public.transactions;
create policy "transactions_select_self_or_owner_or_admin"
  on public.transactions for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.is_active_staff_of(business_id, auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

drop policy "transactions_insert_owner_or_admin" on public.transactions;
create policy "transactions_insert_owner_or_staff_or_admin"
  on public.transactions for insert
  with check (
    (
      exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
      or public.staff_has_permission(business_id, auth.uid(), 'scan_stamps')
      or public.has_role(auth.uid(), 'admin')
    )
    and (
      type != 'stamp'
      or exists (
        select 1 from public.memberships m where m.user_id = transactions.user_id and m.business_id = transactions.business_id
      )
    )
  );

drop policy "review_replies_insert_own_business" on public.review_replies;
create policy "review_replies_insert_own_business"
  on public.review_replies for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.reviews r where r.id = review_id and r.business_id = review_replies.business_id
    )
    and (
      exists (select 1 from public.businesses b where b.id = review_replies.business_id and b.owner_id = (select auth.uid()))
      or public.staff_has_permission(review_replies.business_id, (select auth.uid()), 'respond_reviews')
    )
  );

drop policy "review_replies_update_own_business" on public.review_replies;
create policy "review_replies_update_own_business"
  on public.review_replies for update to authenticated
  using (
    owner_id = (select auth.uid())
    and (
      exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
      or public.staff_has_permission(business_id, (select auth.uid()), 'respond_reviews')
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.reviews r where r.id = review_id and r.business_id = review_replies.business_id
    )
    and (
      exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
      or public.staff_has_permission(business_id, (select auth.uid()), 'respond_reviews')
    )
  );

-- ---------------------------------------------------------------------
-- Widen the stamp-code lookup RPC (owner/admin-only until now) to also
-- allow active staff — it's the manual-entry fallback for scanning.
create or replace function public.lookup_user_by_stamp_code(_code text)
returns table (id uuid, first_name text, last_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.businesses where owner_id = auth.uid())
     and not exists (select 1 from public.staff_members where user_id = auth.uid() and status = 'active')
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
