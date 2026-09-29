-- AI review replies, second hardening pass (Codex review, 2026-09-29).
-- 1. Consistent lock order: every path locks the review row, then its draft.
--    Completion used to lock the draft first and could deadlock with an
--    owner posting a reply at the same moment.
-- 2. A shop-wide budget of 100 automatic replies per 24 hours, on top of the
--    per-review limit of 3, so many accounts editing many reviews can't run
--    up unbounded model cost.

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
  _attempts integer;
  _shop_auto_today integer;
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
    if _draft.review_id is null or _draft.requested_version is distinct from _review.updated_at then
      return jsonb_build_object('status', 'skipped', 'reason', 'not_requested');
    end if;
    if not coalesce(_settings.enabled, true) then
      update public.review_reply_drafts set requested_version = null,
        status = case when status = 'queued' then 'dismissed' else status end, updated_at = now()
        where review_id = _review_id;
      return jsonb_build_object('status', 'skipped', 'reason', 'disabled');
    end if;
    if exists (select 1 from public.review_replies r where r.review_id = _review_id) then
      update public.review_reply_drafts set requested_version = null,
        status = case when status = 'queued' then 'dismissed' else status end, updated_at = now()
        where review_id = _review_id;
      return jsonb_build_object('status', 'skipped', 'reason', 'already_replied');
    end if;

    -- Serialise the shop budget check so concurrent reviews can't overshoot it.
    perform pg_advisory_xact_lock(hashtextextended('ai-review-budget:' || _review.business_id::text, 0));
    select coalesce(sum(d.auto_count), 0) into _shop_auto_today
      from public.review_reply_drafts d
      where d.business_id = _review.business_id and d.auto_window_start > now() - interval '24 hours';
    if (_draft.auto_window_start > now() - interval '24 hours' and _draft.auto_count >= 3)
      or _shop_auto_today >= 100 then
      update public.review_reply_drafts set requested_version = null,
        status = case when status = 'queued' then 'failed' else status end,
        error = case when status = 'queued' then 'daily_limit' else error end, updated_at = now()
        where review_id = _review_id;
      return jsonb_build_object('status', 'skipped', 'reason', 'daily_limit');
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
        requested_version = case when coalesce(_force, false)
                                 then public.review_reply_drafts.requested_version else null end,
        auto_window_start = case
          when coalesce(_force, false) then public.review_reply_drafts.auto_window_start
          when public.review_reply_drafts.auto_window_start > now() - interval '24 hours'
            then public.review_reply_drafts.auto_window_start
          else now() end,
        auto_count = case
          when coalesce(_force, false) then public.review_reply_drafts.auto_count
          when public.review_reply_drafts.auto_window_start > now() - interval '24 hours'
            then public.review_reply_drafts.auto_count + 1
          else 1 end,
        updated_at = now()
  returning attempts into _attempts;

  return jsonb_build_object(
    'status', 'claimed',
    'attempt', _attempts,
    'review_version', _review.updated_at,
    'review', jsonb_build_object('rating', _review.rating, 'body', _review.body),
    'business', jsonb_build_object(
      'name', _business.name,
      'category', _business.category,
      'description', left(_business.description, 600)),
    'sign_off', _settings.sign_off
  );
end;
$$;

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

  -- Review first, then draft: the same order as claim and owner posting.
  select * into _review from public.reviews where id = _review_id for update;
  if not found then
    return jsonb_build_object('status', 'stale');
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
    set status = 'ready', body = _text, lease_until = null,
        error = left(_error, 300), updated_at = now()
    where review_id = _review_id;
  return jsonb_build_object('status', 'ready');
end;
$$;

-- Dismiss follows the same order.
create or replace function public.dismiss_review_reply_draft(_review_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _review public.reviews;
begin
  select * into _review from public.reviews where id = _review_id for update;
  if not found or not public.can_manage_review_replies(_review.business_id, auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.review_reply_drafts
    set status = 'dismissed', lease_until = null, updated_at = now()
    where review_id = _review_id and status in ('ready', 'failed');
end;
$$;

revoke execute on function
  public.claim_review_reply_generation(uuid, boolean),
  public.complete_review_reply_generation(uuid, integer, text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function
  public.claim_review_reply_generation(uuid, boolean),
  public.complete_review_reply_generation(uuid, integer, text, text, boolean, boolean)
  to service_role;
revoke execute on function public.dismiss_review_reply_draft(uuid) from public, anon;
grant execute on function public.dismiss_review_reply_draft(uuid) to authenticated;
