-- Hardening for AI review replies (Codex review, 2026-09-29).
-- 1. Only the reviews trigger can queue an automatic reply. The Edge
--    Function's unauthenticated path now consumes a queued request for the
--    review's current version, so calling it by hand, re-saving a review
--    unchanged or naming an old review does nothing.
-- 2. At most 3 automatic replies per review in 24 hours, however often the
--    customer edits it.
-- 3. No customer context goes to the model: reviews are shown anonymously,
--    so even "a regular" must never appear in a public reply.

alter table public.review_reply_drafts
  drop constraint review_reply_drafts_status_check,
  add constraint review_reply_drafts_status_check
    check (status in ('queued', 'generating', 'ready', 'failed', 'posted', 'dismissed')),
  add column requested_version timestamptz,
  add column auto_window_start timestamptz,
  add column auto_count integer not null default 0;

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

  -- The queued request is what the Edge Function may act on.
  insert into public.review_reply_drafts
    (review_id, business_id, status, review_version, requested_version)
  values (new.id, new.business_id, 'queued', new.updated_at, new.updated_at)
  on conflict (review_id) do update
    set requested_version = excluded.requested_version,
        status = case when public.review_reply_drafts.status = 'generating'
                      then 'generating' else 'queued' end,
        updated_at = now();

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
    -- Automatic path: only a request queued by the trigger for this exact
    -- version of the review, and not too many in a day.
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
    if _draft.auto_window_start > now() - interval '24 hours' and _draft.auto_count >= 3 then
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

  -- Only the review and public shop details: nothing about the customer.
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

-- Privileges are unchanged by create or replace; restate them for clarity.
revoke execute on function public.claim_review_reply_generation(uuid, boolean),
  public.request_ai_review_reply() from public, anon, authenticated;
grant execute on function public.claim_review_reply_generation(uuid, boolean) to service_role;
