# The Loyalty Loop — Data Model (for rebuild)

Extracted directly from the live database (`tampnahezmocslvdugaj`) via
`pg_policies`, `pg_proc`, `information_schema.triggers`, and the table
catalog — not reconstructed from memory. This is accurate as of the export
date. Meant to be pasted into a **fresh** Supabase project's SQL editor
(as you confirmed: current project stays running untouched as a live
reference/backup).

Companion docs: `LOYALTY-LOOP-FEATURE-LIST.md` (what to build, in order),
`LOYALTY-LOOP-REBUILD-PROMPT.md` (master prompt for an AI builder).

---

## 0. Setup

```sql
create extension if not exists pgcrypto;   -- gen_random_uuid(), crypt(), gen_salt()
create extension if not exists pg_net;     -- used by cron/webhook triggers if you keep them
```

Enable Supabase Auth. Every table below assumes `auth.users` already exists
(Supabase-managed).

---

## 1. Enums

```sql
create type app_role as enum ('consumer', 'business_owner', 'admin', 'staff');
create type business_approval_status as enum ('pending', 'approved', 'rejected');
create type loyalty_type as enum ('stamp_card', 'points', 'tiered');
create type notification_kind as enum ('system', 'stamp', 'reward', 'promo');
create type promo_type as enum ('broadcast', 'targeted');
create type transaction_type as enum ('stamp', 'redeem', 'points_earn', 'points_spend');
```

---

## 2. Core tables

### `profiles` — one row per user, extends `auth.users`

```sql
create table public.profiles (
  id uuid primary key references auth.users(id),
  first_name text,
  last_name text,
  email text,
  phone text,
  postcode text,
  birthday date,
  avatar_url text,
  stamp_code text not null default gen_short_code(),  -- short unique code, staff look-up
  address text,
  address_postcode text,
  address_lat double precision,
  address_lng double precision,
  referred_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- `stamp_code` needs a `gen_short_code()` helper (short random alphanumeric,
  uniqueness enforced by the trigger below) — this is what staff type in
  manually if a customer can't show their QR.
- **RLS**: self select/update/insert only (`auth.uid() = id`), plus admin can
  read any profile.

### `user_roles` — the single source of truth for permissions

```sql
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  role app_role not null,
  created_at timestamptz not null default now()
);
```
- **No unique constraint on (user_id, role) in the original** — inserts use
  `ON CONFLICT DO NOTHING` against an *assumed* unique constraint in some
  RPCs (e.g. staff role grant). **Add `unique (user_id, role)` in the
  rebuild** — this looks like a latent gap in the current schema, not an
  intentional design choice.
- **RLS**: self select, or admin.
- A user can hold multiple roles (e.g. `consumer` + `business_owner`).
  `PRIORITY = [admin, business_owner, staff, consumer]` — the app always
  resolves to the *highest*-priority role a user holds, checked in exactly
  that order.

### `user_settings`

```sql
create table public.user_settings (
  user_id uuid primary key references auth.users(id),
  theme text not null default 'light',
  language text not null default 'en',
  notify_offers boolean not null default true,
  notify_rewards boolean not null default true,
  notify_stamps boolean not null default true,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- **RLS**: self select/insert/update only.

---

## 3. Business & brand tables

### `brands` — franchise/multi-shop umbrella

```sql
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null,
  created_at timestamptz not null default now()
);
```
- **RLS**: owner select/insert/update (insert requires `has_role(uid,
  'business_owner')` too); admin can select any.

### `businesses` — the shop itself

```sql
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
  brand_id uuid references public.brands(id),
  pending_owner_email text,   -- franchise handoff: claimed by ensure_current_user_bootstrap()
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
```
- `loyalty_config` is a free-form JSON bag — known keys in use:
  `stamps_required` (int, legacy/simple mode) and `signup_reward_title`
  (text, optional welcome-reward on join — see `grant_signup_reward()`).
- **RLS**:
  - `SELECT`: public if `is_active AND approval_status = 'approved'`, **or**
    the owner, **or** admin, **or** an active staff member of it, **or** the
    business belongs to a brand the caller owns.
  - `INSERT`: only self as `owner_id`, and only if caller
    `has_role('business_owner')`.
  - `UPDATE`: owner or admin.
  - `DELETE`: owner or admin.
- **Trigger** `enforce_businesses_update_scope` (BEFORE UPDATE): non-admins
  may **not** change `owner_id`, `approval_status`, `approved_at`,
  `approved_by`, `rejection_reason`, or `is_active` directly — those only
  move through the admin RPCs (`approve_business`, `reject_business`,
  `admin_review_business_verification`, franchise handoff via
  `ensure_current_user_bootstrap`).

### `business_onboarding` — dismissible setup-checklist state

```sql
create table public.business_onboarding (
  business_id uuid primary key references public.businesses(id),
  dismissed_steps text[] not null default '{}',
  manually_done_steps text[] not null default '{}',
  hidden boolean not null default false,
  updated_at timestamptz not null default now()
);
```
- **RLS**: owner full access to their own row only.

### `staff_members`

```sql
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  user_id uuid references auth.users(id),         -- null until they claim the invite
  invited_email text not null,
  name text not null,
  pin_hash text,                                   -- pgcrypto crypt(), never plaintext
  status text not null default 'invited'
    check (status in ('invited','active','revoked')),
  invited_by uuid not null references auth.users(id),
  can_scan_stamps boolean not null default true,
  can_redeem_rewards boolean not null default true,
  can_respond_reviews boolean not null default false,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);
```
- Needs a unique constraint on `(business_id, invited_email)` — the current
  app's `create-staff-account` edge function upserts on that pair.
- **RLS**: owner (of the business) full CRUD; the staff member themselves
  can select their own row; admin full access.

---

## 4. Loyalty core: memberships, transactions, rewards

### `memberships` — a customer's relationship to one shop

```sql
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
  updated_at timestamptz not null default now()
);
```
- Needs a unique constraint on `(user_id, business_id)` — "join" is an
  upsert on this pair in the current app.
- **RLS**:
  - `INSERT`: self only (`user_id = auth.uid()`) — this is literally what
    "join a shop" does client-side.
  - `SELECT`: self, the shop's owner, an active staff member, or admin.
  - `UPDATE`: self, or the shop's owner — **but** see the trigger below;
    "self" updates are locked to `promos_opted_out` only.
- **Trigger** `enforce_membership_update_scope` (BEFORE UPDATE): admins and
  the business owner/active-staff may change anything. Everyone else (i.e.
  the customer themselves) may change **only** `promos_opted_out` — every
  loyalty-balance field is locked from client tampering. This is the
  mechanism that makes stamps trustworthy: a customer literally cannot
  self-award themselves stamps by calling the update endpoint directly.

### `transactions` — the append-only ledger

```sql
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
```
- **This is the actual source of truth for stamps** — `memberships.stamp_count`
  is a derived cache, kept in sync by the `handle_stamp_transaction` trigger
  below, never written directly by a client.
- **RLS**:
  - `INSERT`: the shop owner, **or** an active staff member with the
    matching permission (`scan_stamps` for `stamp`/`points_earn`,
    `redeem_rewards` for `redeem`/`points_spend`) — **and**, for `stamp`
    specifically, the target user must already have a `memberships` row
    (can't stamp someone who hasn't joined).
  - `SELECT`: self, shop owner, active staff, or admin.
  - No `UPDATE`/`DELETE` policy at all — the ledger is genuinely immutable
    once inserted. Keep this in the rebuild; it's the right call.
- **Trigger** `on_stamp_transaction` → `handle_stamp_transaction()` (AFTER
  INSERT, `type = 'stamp'` only) — **this is the real reward engine, not a
  simple counter.** Full logic:
  1. Reject if the customer has no membership row yet.
  2. If the business has a `reward_catalog` (tiered rewards), walk every
     catalog tier the new stamp count crosses, granting a reward + a
     notification for **each** tier crossed (a single big stamp grant can
     cross multiple tiers at once — all get awarded, none skipped). At the
     highest catalog threshold, the counter **resets and cycles** (so
     "collect 10 for a coffee" can repeat indefinitely) — the loop handles
     a stamp value large enough to complete more than one full cycle at
     once.
  3. If there's no reward catalog, fall back to the legacy single-threshold
     mode: `loyalty_config->>'stamps_required'` (default 10), resets to
     the remainder on completion, grants one generic "Free reward" title.
  4. Always sends an in-app notification either way (progress update, or
     the reward-earned message).
- **Trigger** `transactions_stamp_thankyou_email` (AFTER INSERT) → calls the
  `send-stamp-thankyou-email` edge function via `pg_net` (fire-and-forget
  HTTP call from Postgres, shared-secret-authenticated — see §7).

### `rewards` — individually redeemable, one row per earned reward

```sql
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  business_id uuid not null references public.businesses(id),
  title text not null default 'Free reward',
  qr_token text not null default encode(gen_random_bytes(16), 'hex'),
  short_code text not null default gen_reward_short_code(),  -- staff manual-entry fallback
  catalog_id uuid references public.reward_catalog(id),
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
```
- **RLS**:
  - `SELECT`: self, shop owner, active staff, or admin.
  - `UPDATE`: shop owner or active staff only (redeeming is a staff action,
    not something the customer does to their own reward).
  - No `INSERT`/`DELETE` policy — rewards are only ever created by the
    server-side triggers above, never directly by a client. Keep this.
- **Trigger** `enforce_rewards_update_scope` (BEFORE UPDATE): non-admins may
  change **only** `redeemed_at`, and only forward (can't un-redeem, can't
  redeem twice, can't redeem an already-expired reward). Every other column
  is frozen after creation.

### `reward_catalog` — owner-defined tier list per shop

```sql
create table public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  title text not null,
  description text,
  stamp_threshold integer not null default 10,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- **RLS**: owner (or admin) full CRUD; `SELECT` also open to `anon`/public
  when the parent business is active+approved (customers need to see what
  they're working toward before joining).

---

## 5. Consumer engagement

### `favourites`

```sql
create table public.favourites (
  user_id uuid not null references auth.users(id),
  business_id uuid not null references public.businesses(id),
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);
```
- **RLS**: self full access only.

### `reviews`

```sql
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  business_id uuid not null references public.businesses(id),
  rating integer not null check (rating >= 1 and rating <= 5),
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- Add a unique constraint on `(user_id, business_id)` — one review per
  customer per shop (the current app's "update if exists, else insert" UI
  pattern implies this even though it's not in the raw column list — check
  and add if missing).
- **RLS**:
  - `SELECT`: open to any authenticated user (reviews are public within the
    app).
  - `INSERT`: self, **and** must already be a member of that business
    (checked via `EXISTS` against `memberships`) — or admin.
  - `UPDATE`/`DELETE`: self or admin.

### `review_replies`

```sql
create table public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id),
  business_id uuid not null references public.businesses(id),
  owner_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- **RLS**: `SELECT` open to authenticated. `INSERT`/`UPDATE`/`DELETE`
  require `owner_id = auth.uid()` **and** (business ownership OR
  `staff_has_permission(business_id, uid, 'respond_reviews')`).

### `achievements`

```sql
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  code text not null,
  title text not null,
  description text,
  icon text,
  unlocked_at timestamptz not null default now()
);
```
- Needs a unique constraint on `(user_id, code)` — `sync_achievements()`
  relies on `ON CONFLICT (user_id, code) DO NOTHING`.
- **RLS**: self `SELECT` only. No client `INSERT` policy — achievements are
  only ever granted via the `sync_achievements()` RPC (`SECURITY DEFINER`),
  never written directly.
- Six achievement codes exist today, all computed live (not cached) when
  the RPC runs: `first_stamp` (≥1 stamp transaction), `five_shops` (≥5
  memberships), `first_reward` (≥1 reward), `first_review` (≥1 review),
  `ten_rewards` (≥10 redeemed rewards), `three_week_streak` /
  `six_week_streak` (consecutive weekly-visit streak per shop, computed via
  a gaps-and-islands window-function query over weekly-truncated stamp
  transaction dates).

### `referrals`

```sql
create table public.referrals (
  user_id uuid primary key references auth.users(id),
  code text not null unique,
  invited_count integer not null default 0,
  created_at timestamptz not null default now()
);
```
- **RLS**: self full access. Referral consumption happens inside
  `ensure_current_user_bootstrap()` — a new signup's `ref_code` (from JWT
  user_metadata) is looked up via `lookup_referrer_by_code()`, and if valid
  + not self-referral, sets the new user's `profiles.referred_by` once
  (idempotent — only on first bootstrap) and increments the referrer's
  `invited_count`.

---

## 6. Notifications, announcements, promotions

### `notifications`

```sql
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
```
- **RLS**: self select/update/delete. `INSERT` allowed for a business owner
  targeting one of their **actual members** (checked via `EXISTS` against
  `memberships`) — or admin (for platform-wide system notices).
- **Trigger** `notify_push_on_notification_insert` (AFTER INSERT) → calls
  the `send-push` edge function (Expo push API) if the user has a token in
  `user_push_tokens`.

### `user_push_tokens`

```sql
create table public.user_push_tokens (
  user_id uuid primary key references auth.users(id),
  push_token text,
  updated_at timestamptz not null default now()
);
```
- **RLS**: self full access only.

### `announcements`

```sql
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id),  -- null = platform-wide
  title text not null,
  body text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- **RLS**: `SELECT` open if `is_active` (covers both platform-wide and
  per-shop active announcements), plus the owning shop's owner can always
  see their own (even inactive), plus admin. `INSERT`/`UPDATE`/`DELETE`
  restricted to the owning shop's owner (per-shop) — platform-wide ones
  (`business_id IS NULL`) are admin-only via the `admin_*_announcement`
  RPCs, not direct table access.

### `promotions`

```sql
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  title text not null,
  message text,
  promo_type promo_type not null default 'broadcast',
  audience jsonb,             -- e.g. {"segment": "vip", "size": 12}
  scheduled_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- **RLS**: owner full CRUD; `SELECT` also open to any authenticated user if
  `is_active` (customers can see active promos), plus admin.
- Targeted promos are created via `send_targeted_promo()`, not a raw
  `INSERT` — see §7 for the segment logic (this is genuinely useful
  behavior worth keeping: `churn_risk`, `lapsed`, `regulars`, `vip`
  segments, each with a real recency/frequency rule computed server-side,
  never a client-supplied user list).

---

## 7. Server-side business logic (RPCs)

All `SECURITY DEFINER`, all re-check `auth.uid()` ownership/role internally
— being callable by `anon`/`authenticated` roles is only safe *because* of
that internal check. Full signatures:

**Bootstrap / identity**
- `ensure_current_user_bootstrap()` — runs on every login. Creates
  profile/settings/base-role rows if missing; consumes a pending owner
  request (grants `business_owner`); claims a matching staff invite by
  email (grants `staff`); claims a franchise handoff by email on
  `businesses.pending_owner_email` (grants `business_owner`); consumes a
  referral code from signup metadata; grants the hardcoded admin bootstrap
  if the email matches.
- `has_role(_user_id uuid, _role app_role) returns boolean` — the one
  permission-check primitive everything else is built on.
- `is_active_staff_of(_business_id uuid, _user_id uuid) returns boolean`
- `staff_has_permission(_business_id uuid, _user_id uuid, _perm text) returns boolean`
- `gen_short_code()` / `gen_reward_short_code()` — random short-code
  generators used as column defaults (`profiles.stamp_code`,
  `rewards.short_code`).

**Owner/staff tools**
- `lookup_user_by_stamp_code(_code text)` — staff/owner/admin only; resolves
  a customer's short code to `(id, first_name, last_name)` for manual stamp
  entry. **Rate-limited** via `rpc_rate_limits` in the current app (20/min
  per caller) — carry that forward, it's a real abuse control on an
  otherwise-legitimate lookup.
- `log_blocked_stamp_attempt(...)` — audit log when a scan is rejected
  (wrong permission, not a member, etc.) — owner/admin/staff of that
  business only.
- `set_my_staff_pin(_business_id, _pin)` / `verify_staff_pin(_business_id, _pin)`
  — PIN set/verify, `pgcrypto` `crypt()`/`gen_salt('bf')`, scoped to the
  caller's own active staff row only.
- `staff_join_customer(_business_id, _user_id)` — owner or scan-permitted
  staff only; idempotent join (upsert on conflict do nothing). **Exists but
  intentionally unused by any UI in the current app** — the product
  decision on how this should surface was never finalized; don't wire it up
  blind in the rebuild either, decide the UX first.
- `owner_member_directory(_business_id, _user_ids uuid[])` — batch name/email
  lookup for a shop's own members, owner/staff/admin only.
- `submit_business_verification(_business_id, _doc_path, _doc_label)` —
  owner-only, sets status to `pending`.
- `send_targeted_promo(_business_id, _segment, _title, _message)` — see §6.
  Segments and their exact rules:
  - `churn_risk`: last activity 14–60 days ago, at least 1 visit.
  - `lapsed`: no activity, or last activity 60+ days ago.
  - `regulars`: 3–4 visits.
  - `vip`: 5+ visits, **or** top 10% by visit count among members with 2+
    visits (whichever is broader) — deliberately generous so a brand-new
    shop with few visits still has *someone* in the VIP segment.
- `get_brand_overview()` — for a brand owner: every shop under their brand
  (including ones fully handed off to another owner), with live member/
  stamp-today/new-member-today counts per shop.
- `get_or_create_my_brand(_name text default null)` — idempotent; returns
  the caller's existing brand row or creates one (`business_owner` role
  required).

**Admin**
- `admin_pending_owner_requests()`, `admin_approve_owner_request(_user_id)`
  (blocks approval until a verification doc has been uploaded — enforced
  server-side, not just a disabled button), `admin_reject_owner_request(_user_id, _reason)`
- `admin_review_business_verification(_business_id, _approve, _reason)`
- `approve_business(_business_id)` / `reject_business(_business_id, _reason)`
- `admin_grant_role(_user_id, _role)` / `admin_revoke_role(_user_id, _role)`
- `admin_broadcast_announcement`, `admin_update_announcement`,
  `admin_delete_announcement`, `admin_set_announcement_active`
- `admin_set_stamps_required(_business_id, _value)`
- `admin_help_requests()`, `admin_resolve_help_request(_id, _resolved)`
- `public_platform_stats()` — safe aggregate (shops/neighbours/stamps) for
  the public marketing site, no raw table access needed.
- `run_analytics_consistency_check()` — admin-triggerable (also callable
  unattended by a cron/service-role with no `auth.uid()`), recomputes three
  integrity checks per business and logs any drift to
  `analytics_consistency_log`:
  1. distinct member count vs. row count (catches duplicate memberships)
  2. `memberships.stamp_count` (+ implied stamps from earned rewards) vs.
     the actual sum of `stamp` transactions
  3. redeemed-reward count vs. `redeem` transaction count
  This is a genuinely good pattern — keep it, and consider running it on a
  schedule (pg_cron) rather than only on-demand.
- `lookup_referrer_by_code(_code text) returns uuid`

**Utility triggers** (not called directly, but must exist)
- `handle_new_user()` — `AFTER INSERT ON auth.users` (Supabase's own auth
  schema trigger point). Creates the `profiles`/`user_settings`/base-role
  rows and grants the hardcoded admin bootstrap.
- `ensure_profile_stamp_code()` / `ensure_reward_short_code()` — BEFORE
  INSERT, retry-on-collision short-code generation.
- `update_updated_at_column()` — generic `updated_at = now()` on UPDATE,
  attached to nearly every table with an `updated_at` column.
- `trigger_business_welcome_email()` — AFTER INSERT OR UPDATE on
  `businesses`; fires when `pending_owner_email` clears (i.e. a franchise
  handoff completes) or a business first goes live, calling the
  `send-welcome-email` edge function via `pg_net`.

---

## 8. Storage buckets

```sql
-- Public, image-only, size-capped (fixes a real gap found in the current app —
-- the original buckets had NO mime/size restriction at all, letting any
-- authenticated upload serve arbitrary content-type from a public URL).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos', 'logos', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif']),
  ('covers', 'covers', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif']);

-- Private, folder-scoped to the uploader's own auth.uid(), admin can read any folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('owner_verification_docs', 'owner_verification_docs', false, 10485760,
   array['image/png','image/jpeg','image/webp','application/pdf']);
```

Storage RLS policies (not pulled verbatim in this export, but the pattern
throughout the app is consistent — replicate it):
- `logos`/`covers`: any authenticated user can `INSERT` into
  `{business_id}/...` **only if** they own that business; public `SELECT`
  for everyone (bucket is public).
- `owner_verification_docs`: `INSERT`/`SELECT` scoped to the caller's own
  `{auth.uid()}/...` folder, plus admin can `SELECT` any folder.

---

## 9. Supporting/log tables (lower priority — build after the core loop works)

```sql
create table public.analytics_consistency_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  metric text not null,
  computed_value bigint not null,
  expected_value bigint not null,
  delta bigint not null,
  details jsonb,
  checked_at timestamptz not null default now()
);
-- RLS: admin select only.

create table public.stamp_block_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  attempted_user_id uuid references auth.users(id),
  attempted_by uuid references auth.users(id),
  reason text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
-- RLS: business owner or admin select only. Insert only via log_blocked_stamp_attempt().

create table public.cookie_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id),
  necessary boolean not null default true,
  analytics boolean not null default false,
  marketing boolean not null default false,
  policy_version text not null default '2026-06-21',
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: self full access.

create table public.owner_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  business_id uuid references public.businesses(id),
  accepted_terms boolean not null default false,
  accepted_privacy boolean not null default false,
  accepted_cookies boolean not null default false,
  accepted_data_retention boolean not null default false,
  accepted_dpa boolean not null default false,
  accepted_merchant_agreement boolean not null default false,
  policy_version text not null default '2026-06-21',
  user_agent text,
  ip_address text,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- RLS: self select/insert; admin select any. This is an audit trail — never UPDATE, only INSERT new rows.

create table public.winback_email_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  user_id uuid not null references auth.users(id),
  recipient_email text not null,
  days_inactive integer not null,
  coupon_code text not null,
  subject text not null,
  body_preview text,
  status text not null default 'sent',
  error text,
  sent_at timestamptz not null default now()
);
-- RLS: owning business's owner, or admin, select only.

create table public.pending_owner_requests (
  user_id uuid primary key references auth.users(id),
  requested_at timestamptz not null default now(),
  verification_document_path text,
  verification_document_label text
);
-- RLS: self select/insert/update; admin select any.
-- admin_approve_owner_request() refuses to approve until verification_document_path is set.

create table public.rpc_rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, action, window_start)
);
-- No client-facing RLS policy at all (correct — only SECURITY DEFINER
-- functions touch this, e.g. lookup_user_by_stamp_code's 20/min cap).

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  business_id uuid references public.businesses(id),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);
-- RLS: self select/insert; admin select any + update (resolve/reopen).

create table public.help_request_messages (
  id uuid primary key default gen_random_uuid(),
  help_request_id uuid not null references public.help_requests(id),
  sender_id uuid not null references auth.users(id),
  sender_role text not null check (sender_role in ('owner','admin')),
  body text not null,
  created_at timestamptz not null default now()
);
-- RLS: select if you own the parent request or are admin; insert requires
-- sender_id = auth.uid() AND the role claimed matches reality (admin claiming
-- 'admin' must actually have the admin role; owner claiming 'owner' must own
-- the parent help_request).

create table public.stamp_thankyou_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  user_id uuid not null references auth.users(id),
  sent_date date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);
-- No client RLS policy — insert-as-claim pattern from inside the edge
-- function only, unique (business_id, user_id, sent_date) is what throttles
-- to one thank-you email per customer per shop per day.
```

---

## 10. Edge functions (server-side, not RLS-governed)

| Function | Auth | Purpose |
|---|---|---|
| `create-staff-account` | JWT required | Owner-only; uses the Auth Admin API to create a staff login with an owner-chosen password (can't be done from a plain RPC — needs the service role). |
| `create-franchise-shop` | JWT required | Same pattern for the "someone else runs this shop" flow — creates the new owner's auth account + the shop in one call. |
| `delete-account` | JWT required | Self-service account deletion, see feature list §1. |
| `places-proxy` | JWT required | Google Places Autocomplete/Details — **the API key lives only here**, never shipped to a client. |
| `review-insights`, `business-coach-chat`, `deep-business-report`, `analytics-summary` | JWT required | AI features. Each independently re-checks `owner_id = auth.uid() OR has_role(admin)` server-side. |
| `send-welcome-email`, `send-stamp-thankyou-email`, `send-shop-invite-email` | Shared-secret header (`x-loop-internal-secret`), **not** a user JWT | Triggered by Postgres `pg_net` calls from the triggers in §7, not called directly by any client. **In the rebuild, this secret must be a real platform-managed secret from day one** — the current app has this hardcoded in source as a stopgap, which is exactly the anti-pattern to avoid this time. |
| `send-winback-emails` | Shared secret or admin JWT | Scheduled (cron) — scans for inactive members past a threshold and sends the win-back email + coupon, logs to `winback_email_log`. |
| `daily-shop-report` | Shared secret, cron-triggered | Daily digest per shop. |
| `send-push` | None (internal, triggered by the `notify_push_on_notification_insert` trigger) | Expo push API call. |

---

## 11. What NOT to carry forward as-is

- The hardcoded internal-trigger secret pattern (§10) — use real secret
  management from the start.
- The Google Places key ever being anything but server-side-only.
- Unrestricted storage buckets (§8 already shows the fixed version — build
  it with limits from day one, don't add them later as a patch).
- Missing unique constraints called out in §2–5 (`user_roles`, `staff_members`,
  `memberships`, `reviews`, `achievements`) — these are relied on by
  `ON CONFLICT` upserts in the current app's functions/edge functions, so
  they're very likely present in the live database even though this export
  didn't explicitly confirm every one. **Verify each one explicitly before
  writing the equivalent upsert logic in the rebuild** — an upsert against a
  missing unique constraint fails loudly, so this is a quick, safe thing to
  check as you build each feature.
