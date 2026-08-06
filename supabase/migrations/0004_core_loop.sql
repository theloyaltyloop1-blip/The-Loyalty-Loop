-- §2 Core Consumer Loop — businesses, memberships, transactions, rewards,
-- reward_catalog, notifications. See docs/LOYALTY-LOOP-DATA-MODEL.md §3-4, §6.
--
-- Staff-related RLS clauses (is_active_staff_of / staff_has_permission) are
-- deferred to §4 — policies below only cover owner/admin/self for now and
-- will be widened with ALTER POLICY once staff_members exists.

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null,
  slug text not null unique,
  category text,
  description text,
  address text,
  postcode text,
  lat double precision,
  lng double precision,
  brand_color text not null default '#8b7355',
  logo_url text,
  cover_url text,
  loyalty_type loyalty_type not null default 'stamp_card',
  loyalty_config jsonb not null default '{"stamps_required": 10}'::jsonb,
  opening_hours jsonb,
  website text,
  phone text,
  instagram text,
  is_active boolean not null default true,
  approval_status business_approval_status not null default 'approved',
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  trending boolean not null default false,
  brand_id uuid,
  pending_owner_email text,
  pending_owner_name text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  verification_document_path text,
  verification_document_label text,
  verification_submitted_at timestamptz,
  verification_reviewed_at timestamptz,
  verification_reviewed_by uuid references auth.users(id),
  verification_rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.businesses
  for each row execute function public.update_updated_at_column();

alter table public.businesses enable row level security;

create policy "businesses_select_public_or_owner_or_admin"
  on public.businesses for select
  using (
    (is_active and approval_status = 'approved')
    or owner_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  );

create policy "businesses_insert_self_owner"
  on public.businesses for insert
  with check (owner_id = auth.uid() and public.has_role(auth.uid(), 'business_owner'));

create policy "businesses_update_owner_or_admin"
  on public.businesses for update
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "businesses_delete_owner_or_admin"
  on public.businesses for delete
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------

create table public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  stamp_threshold integer not null default 10,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.reward_catalog
  for each row execute function public.update_updated_at_column();

alter table public.reward_catalog enable row level security;

create policy "reward_catalog_select_public_or_owner_or_admin"
  on public.reward_catalog for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.is_active and b.approval_status = 'approved'
    )
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

create policy "reward_catalog_write_owner_or_admin"
  on public.reward_catalog for all
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

-- ---------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  business_id uuid not null references public.businesses(id),
  stamp_count integer not null default 0,
  points_balance integer not null default 0,
  current_tier text,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  visit_count integer not null default 0,
  last_visit_date date,
  last_activity_at timestamptz,
  promos_opted_out boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_user_business_key unique (user_id, business_id)
);

create trigger set_updated_at
  before update on public.memberships
  for each row execute function public.update_updated_at_column();

alter table public.memberships enable row level security;

create policy "memberships_select_self_or_owner_or_admin"
  on public.memberships for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

create policy "memberships_insert_self"
  on public.memberships for insert
  with check (user_id = auth.uid());

create policy "memberships_update_self_or_owner_or_admin"
  on public.memberships for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

-- Customers may only ever change promos_opted_out on their own membership —
-- every loyalty-balance field is locked from client tampering. Owner/admin
-- can change anything (staff clause added in §4).
create or replace function public.enforce_membership_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_privileged boolean;
begin
  _is_privileged := public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = auth.uid());

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
    or new.joined_at != old.joined_at
  then
    raise exception 'customers may only change promos_opted_out';
  end if;

  return new;
end;
$$;

create trigger enforce_membership_update_scope
  before update on public.memberships
  for each row execute function public.enforce_membership_update_scope();

-- ---------------------------------------------------------------------

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  business_id uuid not null references public.businesses(id),
  membership_id uuid references public.memberships(id),
  type transaction_type not null,
  value integer not null default 1 check (value > 0 and value <= 50),
  note text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "transactions_select_self_or_owner_or_admin"
  on public.transactions for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

-- Staff-permission clause (scan_stamps/redeem_rewards) lands in §4 — owner
-- and admin only for now. "stamp" additionally requires an existing
-- membership row (can't stamp someone who hasn't joined).
create policy "transactions_insert_owner_or_admin"
  on public.transactions for insert
  with check (
    (
      exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
      or public.has_role(auth.uid(), 'admin')
    )
    and (
      type != 'stamp'
      or exists (
        select 1 from public.memberships m where m.user_id = transactions.user_id and m.business_id = transactions.business_id
      )
    )
  );

-- ---------------------------------------------------------------------

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  business_id uuid not null references public.businesses(id),
  title text not null default 'Free reward',
  qr_token text not null default encode(gen_random_bytes(16), 'hex'),
  short_code text not null default public.gen_short_code(),
  catalog_id uuid references public.reward_catalog(id),
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rewards_short_code_key unique (short_code)
);

alter table public.rewards enable row level security;

create policy "rewards_select_self_or_owner_or_admin"
  on public.rewards for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

create policy "rewards_update_owner_or_admin"
  on public.rewards for update
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

create or replace function public.enforce_rewards_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
    or new.created_at != old.created_at
  then
    raise exception 'only redeemed_at may be changed';
  end if;

  if old.redeemed_at is not null then
    raise exception 'reward already redeemed';
  end if;

  if new.redeemed_at is not null and new.expires_at is not null and new.redeemed_at > new.expires_at then
    raise exception 'reward has expired';
  end if;

  return new;
end;
$$;

create trigger enforce_rewards_update_scope
  before update on public.rewards
  for each row execute function public.enforce_rewards_update_scope();

-- ---------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  business_id uuid references public.businesses(id),
  kind notification_kind not null default 'system',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_select_self"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_self"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_delete_self"
  on public.notifications for delete
  using (user_id = auth.uid());

create policy "notifications_insert_owner_targeting_member_or_admin"
  on public.notifications for insert
  with check (
    public.has_role(auth.uid(), 'admin')
    or (
      exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
      and exists (select 1 from public.memberships m where m.user_id = notifications.user_id and m.business_id = notifications.business_id)
    )
  );

-- ---------------------------------------------------------------------
-- The real reward engine. AFTER INSERT on transactions, type = 'stamp' only.
create or replace function public.handle_stamp_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _membership public.memberships;
  _config jsonb;
  _stamps_required integer;
  _remaining integer;
  _tier record;
  _new_count integer;
  _crossed_any boolean := false;
begin
  select * into _membership from public.memberships
    where user_id = new.user_id and business_id = new.business_id
    for update;

  if not found then
    raise exception 'customer has no membership at this business';
  end if;

  _new_count := _membership.stamp_count;
  _remaining := new.value;

  if exists (select 1 from public.reward_catalog where business_id = new.business_id) then
    -- Tiered catalog mode: walk every tier crossed by this stamp grant,
    -- awarding a reward each time. _new_count is always in [0, top) between
    -- iterations — crossing the top tier resets it to 0, so there is always
    -- a next tier to look for (a value big enough to complete several full
    -- cycles at once just loops around multiple times).
    while _remaining > 0 loop
      select * into _tier from public.reward_catalog
        where business_id = new.business_id and stamp_threshold > _new_count
        order by stamp_threshold asc
        limit 1;

      declare
        _top integer := (select max(stamp_threshold) from public.reward_catalog where business_id = new.business_id);
        _needed integer := _tier.stamp_threshold - _new_count;
      begin
        if _remaining < _needed then
          _new_count := _new_count + _remaining;
          _remaining := 0;
        else
          _remaining := _remaining - _needed;
          _crossed_any := true;

          insert into public.rewards (user_id, business_id, title, catalog_id)
          values (new.user_id, new.business_id, _tier.title, _tier.id);

          insert into public.notifications (user_id, business_id, kind, title, body)
          values (new.user_id, new.business_id, 'reward', 'Reward earned!', _tier.title || ' is ready to redeem.');

          _new_count := case when _tier.stamp_threshold >= _top then 0 else _tier.stamp_threshold end;
        end if;
      end;
    end loop;
  else
    -- Legacy single-threshold mode.
    _config := (select loyalty_config from public.businesses where id = new.business_id);
    _stamps_required := coalesce((_config->>'stamps_required')::integer, 10);
    _new_count := _membership.stamp_count + new.value;

    if _new_count >= _stamps_required then
      _crossed_any := true;
      insert into public.rewards (user_id, business_id, title)
      values (new.user_id, new.business_id, 'Free reward');

      insert into public.notifications (user_id, business_id, kind, title, body)
      values (new.user_id, new.business_id, 'reward', 'Reward earned!', 'Free reward is ready to redeem.');

      _new_count := _new_count % _stamps_required;
    end if;
  end if;

  update public.memberships
    set stamp_count = _new_count,
        visit_count = visit_count + 1,
        last_visit_date = (now() at time zone 'utc')::date,
        last_activity_at = now()
    where id = _membership.id;

  if not _crossed_any then
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (new.user_id, new.business_id, 'stamp', 'Stamp added', 'You now have ' || _new_count || ' stamps.');
  end if;

  return new;
end;
$$;

create trigger on_stamp_transaction
  after insert on public.transactions
  for each row
  when (new.type = 'stamp')
  execute function public.handle_stamp_transaction();
