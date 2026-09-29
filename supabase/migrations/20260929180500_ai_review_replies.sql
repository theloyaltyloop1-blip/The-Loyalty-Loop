-- AI review replies, phase 1: Loyalty Loop reviews (Google reviews follow).
-- A new or edited review asks the ai-review-reply Edge Function for a reply.
-- 4-5 star replies are posted automatically when the shop allows it; every
-- other reply waits as a draft the owner (or permitted staff) posts or
-- dismisses. The model output is decided on here, never trusted from a client.

-- Per-shop settings. A missing row means the defaults: on, auto-post on.
create table public.business_review_ai_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  enabled boolean not null default true,
  auto_post_positive boolean not null default true,
  sign_off text check (sign_off is null or char_length(sign_off) between 1 and 80),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- One AI draft per review. review_version is the review's updated_at the
-- draft was written for, so an edited review gets a fresh reply.
create table public.review_reply_drafts (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null check (status in ('generating', 'ready', 'failed', 'posted', 'dismissed')),
  body text check (body is null or char_length(body) between 1 and 2000),
  review_version timestamptz not null,
  lease_until timestamptz,
  attempts integer not null default 0,
  error text check (error is null or char_length(error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_reply_drafts_lease_check check ((lease_until is not null) = (status = 'generating'))
);

create index review_reply_drafts_business_idx on public.review_reply_drafts (business_id, status);

alter table public.review_replies
  add column ai_generated boolean not null default false;

-- Owner, staff allowed to answer reviews, or an admin.
create or replace function public.can_manage_review_replies(_business_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _user_id is not null and (
    exists (select 1 from public.businesses b where b.id = _business_id and b.owner_id = _user_id)
    or public.staff_has_permission(_business_id, _user_id, 'respond_reviews')
    or public.has_role(_user_id, 'admin')
  )
$$;

alter table public.business_review_ai_settings enable row level security;
alter table public.review_reply_drafts enable row level security;
revoke all on table public.business_review_ai_settings, public.review_reply_drafts
  from public, anon, authenticated;
grant select on table public.business_review_ai_settings, public.review_reply_drafts to authenticated;

create policy "review_ai_settings_select_managers"
  on public.business_review_ai_settings for select to authenticated
  using (public.can_manage_review_replies(business_id, (select auth.uid())));

create policy "review_reply_drafts_select_managers"
  on public.review_reply_drafts for select to authenticated
  using (public.can_manage_review_replies(business_id, (select auth.uid())));

-- The ai_generated label is set only by the trusted paths below. A person
-- writing or editing a reply directly always produces a human reply.
create or replace function public.enforce_review_reply_ai_label()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
    or coalesce(current_setting('loyalty.ai_reply_write', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.ai_generated := false;
  elsif new.body is distinct from old.body then
    new.ai_generated := false;
  else
    new.ai_generated := old.ai_generated;
  end if;
  return new;
end;
$$;

create trigger enforce_review_reply_ai_label
  before insert or update on public.review_replies
  for each row execute function public.enforce_review_reply_ai_label();

-- Owners (not staff) choose the shop's settings.
create or replace function public.set_review_ai_settings(
  _business_id uuid,
  _enabled boolean,
  _auto_post_positive boolean,
  _sign_off text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := auth.uid();
  _sign text := nullif(trim(coalesce(_sign_off, '')), '');
begin
  if _caller is null or not (
    exists (select 1 from public.businesses b where b.id = _business_id and b.owner_id = _caller)
    or public.has_role(_caller, 'admin')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if _enabled is null or _auto_post_positive is null or char_length(coalesce(_sign, '')) > 80 then
    raise exception 'invalid review AI settings';
  end if;
  insert into public.business_review_ai_settings
    (business_id, enabled, auto_post_positive, sign_off, updated_at, updated_by)
  values (_business_id, _enabled, _auto_post_positive, _sign, now(), _caller)
  on conflict (business_id) do update
    set enabled = excluded.enabled,
        auto_post_positive = excluded.auto_post_positive,
        sign_off = excluded.sign_off,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

-- Service role. Decides whether a reply should be written now and returns
-- the context for it. _force is the owner's "Write with AI" request, which
-- ignores the settings and an earlier draft but never an existing reply lock.
create or replace function public.claim_review_reply_generation(_review_id uuid, _force boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _review public.reviews;
  _business public.businesses;
  _settings public.business_review_ai_settings;
  _draft public.review_reply_drafts;
  _membership public.memberships;
  _attempts integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'claim_review_reply_generation requires service role';
  end if;

  select * into _review from public.reviews where id = _review_id for update;
  if not found then
    return jsonb_build_object('status', 'skipped', 'reason', 'no_review');
  end if;
  select * into _business from public.businesses where id = _review.business_id;
  select * into _settings from public.business_review_ai_settings where business_id = _review.business_id;
  select * into _draft from public.review_reply_drafts where review_id = _review_id for update;

  if _draft.status = 'generating' and _draft.lease_until > now() then
    return jsonb_build_object('status', 'skipped', 'reason', 'in_progress');
  end if;
  if not coalesce(_force, false) then
    if not coalesce(_settings.enabled, true) then
      return jsonb_build_object('status', 'skipped', 'reason', 'disabled');
    end if;
    if exists (select 1 from public.review_replies r where r.review_id = _review_id) then
      return jsonb_build_object('status', 'skipped', 'reason', 'already_replied');
    end if;
    if _draft.review_id is not null and _draft.review_version = _review.updated_at
      and _draft.status in ('ready', 'posted', 'dismissed', 'failed') then
      return jsonb_build_object('status', 'skipped', 'reason', 'already_drafted');
    end if;
  end if;

  insert into public.review_reply_drafts
    (review_id, business_id, status, body, review_version, lease_until, attempts, error)
  values (_review_id, _review.business_id, 'generating', null, _review.updated_at,
          now() + interval '2 minutes', 1, null)
  on conflict (review_id) do update
    set status = 'generating',
        review_version = excluded.review_version,
        lease_until = excluded.lease_until,
        attempts = public.review_reply_drafts.attempts + 1,
        error = null,
        updated_at = now()
  returning attempts into _attempts;

  select * into _membership from public.memberships
    where user_id = _review.user_id and business_id = _review.business_id;

  -- Only non-identifying context: no names, amounts or contact details.
  return jsonb_build_object(
    'status', 'claimed',
    'attempt', _attempts,
    'review_version', _review.updated_at,
    'review', jsonb_build_object('rating', _review.rating, 'body', _review.body),
    'business', jsonb_build_object(
      'name', _business.name,
      'category', _business.category,
      'description', left(_business.description, 600)),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('title', rc.title, 'spend_pounds', rc.spend_threshold_pence / 100)
                       order by rc.spend_threshold_pence)
      from public.reward_catalog rc
      where rc.business_id = _review.business_id and rc.spend_threshold_pence is not null), '[]'::jsonb),
    'customer', jsonb_build_object(
      'is_member', _membership.id is not null,
      'visits', case
        when _membership.id is null then 'unknown'
        when _membership.visit_count >= 10 then 'regular'
        when _membership.visit_count >= 3 then 'returning'
        else 'new' end,
      'has_redeemed_a_reward', exists (
        select 1 from public.rewards r
        where r.user_id = _review.user_id and r.business_id = _review.business_id
          and r.redeemed_at is not null)),
    'sign_off', _settings.sign_off
  );
end;
$$;

-- Service role. Stores the model's reply. _safe_to_post is the Edge
-- Function's verdict on the text; the posting rules themselves are here.
create or replace function public.complete_review_reply_generation(
  _review_id uuid,
  _attempt integer,
  _body text,
  _error text,
  _safe_to_post boolean,
  _allow_auto_post boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _draft public.review_reply_drafts;
  _review public.reviews;
  _business public.businesses;
  _settings public.business_review_ai_settings;
  _text text := nullif(trim(coalesce(_body, '')), '');
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'complete_review_reply_generation requires service role';
  end if;

  select * into _draft from public.review_reply_drafts where review_id = _review_id for update;
  if not found or _draft.status <> 'generating' or _draft.attempts <> _attempt then
    return jsonb_build_object('status', 'stale');
  end if;

  if _text is null or char_length(_text) > 2000 then
    update public.review_reply_drafts
      set status = 'failed', body = null, lease_until = null,
          error = left(coalesce(_error, 'empty_reply'), 300), updated_at = now()
      where review_id = _review_id;
    return jsonb_build_object('status', 'failed');
  end if;

  select * into _review from public.reviews where id = _review_id for update;
  select * into _business from public.businesses where id = _review.business_id;
  select * into _settings from public.business_review_ai_settings where business_id = _review.business_id;

  if coalesce(_allow_auto_post, false)
    and coalesce(_safe_to_post, false)
    and coalesce(_settings.enabled, true)
    and coalesce(_settings.auto_post_positive, true)
    and _review.rating >= 4
    and _review.updated_at = _draft.review_version
    and not exists (select 1 from public.review_replies r where r.review_id = _review_id)
    and not exists (
      select 1 from public.review_reports rr where rr.review_id = _review_id and rr.status = 'open')
  then
    perform set_config('loyalty.ai_reply_write', 'on', true);
    insert into public.review_replies (review_id, business_id, owner_id, body, ai_generated)
    values (_review_id, _review.business_id, _business.owner_id, _text, true);
    perform set_config('loyalty.ai_reply_write', '', true);
    update public.review_reply_drafts
      set status = 'posted', body = _text, lease_until = null, error = null, updated_at = now()
      where review_id = _review_id;
    return jsonb_build_object('status', 'posted');
  end if;

  update public.review_reply_drafts
    set status = 'ready', body = _text, lease_until = null, error = null, updated_at = now()
    where review_id = _review_id;
  return jsonb_build_object('status', 'ready');
end;
$$;

-- An owner or permitted staff member posts a reply from a draft, edited or
-- not. It is labelled AI-written only when the text is the draft unchanged.
create or replace function public.post_review_reply_draft(_review_id uuid, _body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := auth.uid();
  _review public.reviews;
  _draft public.review_reply_drafts;
  _text text := nullif(trim(coalesce(_body, '')), '');
  _reply_id uuid;
  _is_ai boolean;
begin
  select * into _review from public.reviews where id = _review_id for update;
  if not found or not public.can_manage_review_replies(_review.business_id, _caller) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if _text is null or char_length(_text) > 2000 then
    raise exception 'invalid reply';
  end if;

  -- As before, staff may only change a reply they wrote; the owner and
  -- admins may change any reply, including one the AI posted.
  if exists (
    select 1 from public.review_replies r
    where r.review_id = _review_id and r.owner_id <> _caller
  ) and not (
    exists (select 1 from public.businesses b where b.id = _review.business_id and b.owner_id = _caller)
    or public.has_role(_caller, 'admin')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into _draft from public.review_reply_drafts where review_id = _review_id for update;
  _is_ai := _draft.body is not null and _draft.body = _text;

  perform set_config('loyalty.ai_reply_write', 'on', true);
  update public.review_replies
    set body = _text, ai_generated = _is_ai
    where review_id = _review_id
    returning id into _reply_id;
  if not found then
    insert into public.review_replies (review_id, business_id, owner_id, body, ai_generated)
    values (_review_id, _review.business_id, _caller, _text, _is_ai)
    returning id into _reply_id;
  end if;
  perform set_config('loyalty.ai_reply_write', '', true);

  if _draft.review_id is not null then
    update public.review_reply_drafts
      set status = 'posted', lease_until = null, updated_at = now()
      where review_id = _review_id;
  end if;
  return jsonb_build_object('status', 'posted', 'reply_id', _reply_id, 'ai_generated', _is_ai);
end;
$$;

create or replace function public.dismiss_review_reply_draft(_review_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _business_id uuid;
begin
  select business_id into _business_id from public.review_reply_drafts where review_id = _review_id;
  if not found or not public.can_manage_review_replies(_business_id, auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.review_reply_drafts
    set status = 'dismissed', lease_until = null, updated_at = now()
    where review_id = _review_id and status in ('ready', 'failed');
end;
$$;

-- New or edited review: ask the Edge Function for a reply. It re-checks
-- everything through claim_review_reply_generation, so a repeated or
-- spoofed call can do no more than this trigger would.
create or replace function public.request_ai_review_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.rating is not distinct from old.rating
    and new.body is not distinct from old.body then
    return new;
  end if;
  if not coalesce((select s.enabled from public.business_review_ai_settings s
                   where s.business_id = new.business_id), true)
    or exists (select 1 from public.review_replies r where r.review_id = new.id) then
    return new;
  end if;
  begin
    perform net.http_post(
      url := 'https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/ai-review-reply',
      body := jsonb_build_object('review_id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 30000
    );
  exception when others then
    raise warning 'AI review reply request failed: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger request_ai_review_reply
  after insert or update on public.reviews
  for each row execute function public.request_ai_review_reply();

revoke execute on function
  public.can_manage_review_replies(uuid, uuid),
  public.enforce_review_reply_ai_label(),
  public.set_review_ai_settings(uuid, boolean, boolean, text),
  public.claim_review_reply_generation(uuid, boolean),
  public.complete_review_reply_generation(uuid, integer, text, text, boolean, boolean),
  public.post_review_reply_draft(uuid, text),
  public.dismiss_review_reply_draft(uuid),
  public.request_ai_review_reply()
  from public, anon, authenticated;

grant execute on function
  public.can_manage_review_replies(uuid, uuid),
  public.set_review_ai_settings(uuid, boolean, boolean, text),
  public.post_review_reply_draft(uuid, text),
  public.dismiss_review_reply_draft(uuid)
  to authenticated;

grant execute on function
  public.can_manage_review_replies(uuid, uuid),
  public.claim_review_reply_generation(uuid, boolean),
  public.complete_review_reply_generation(uuid, integer, text, text, boolean, boolean)
  to service_role;
