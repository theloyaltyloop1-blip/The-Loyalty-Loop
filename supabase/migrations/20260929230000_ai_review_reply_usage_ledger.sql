-- AI review replies: durable usage budget (Codex re-review, 2026-09-29).
-- The daily limits used to live on the draft row, which is deleted with its
-- review, so deleting and rewriting a review reset them. Automatic
-- generations are now recorded in a ledger that outlives the review:
--   * at most 3 a day per customer at a shop (whatever reviews they delete),
--   * at most 100 a day per shop.
-- An author's deleted account keeps the shop's usage (author set to null).

create table public.ai_review_reply_usage (
  id bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  review_id uuid,
  created_at timestamptz not null default now()
);

create index ai_review_reply_usage_business_idx on public.ai_review_reply_usage (business_id, created_at);
create index ai_review_reply_usage_author_idx on public.ai_review_reply_usage (author_id, business_id, created_at);

alter table public.ai_review_reply_usage enable row level security;
revoke all on table public.ai_review_reply_usage from public, anon, authenticated;
revoke all on sequence public.ai_review_reply_usage_id_seq from public, anon, authenticated;

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

    -- One budget check at a time per shop, so concurrent reviews can't
    -- both take the last slot.
    perform pg_advisory_xact_lock(hashtextextended('ai-review-budget:' || _review.business_id::text, 0));
    if (select count(*) from public.ai_review_reply_usage u
        where u.business_id = _review.business_id and u.created_at > now() - interval '24 hours') >= 100
      or (select count(*) from public.ai_review_reply_usage u
          where u.business_id = _review.business_id and u.author_id = _review.user_id
            and u.created_at > now() - interval '24 hours') >= 3
    then
      update public.review_reply_drafts set requested_version = null,
        status = case when status = 'queued' then 'failed' else status end,
        error = case when status = 'queued' then 'daily_limit' else error end, updated_at = now()
        where review_id = _review_id;
      return jsonb_build_object('status', 'skipped', 'reason', 'daily_limit');
    end if;
    insert into public.ai_review_reply_usage (business_id, author_id, review_id)
    values (_review.business_id, _review.user_id, _review_id);
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

-- The old per-draft counters are no longer read.
comment on column public.review_reply_drafts.auto_count is 'Unused since 20260929230000; see ai_review_reply_usage.';
comment on column public.review_reply_drafts.auto_window_start is 'Unused since 20260929230000; see ai_review_reply_usage.';

revoke execute on function public.claim_review_reply_generation(uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_review_reply_generation(uuid, boolean) to service_role;
