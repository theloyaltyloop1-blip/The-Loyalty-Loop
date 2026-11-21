-- Outreach bot: automatic reply checking. The `outreach-replies` function reads
-- the mailbox (IMAP, read-only) every 5 minutes, and an AI labels each reply
-- from a lead. Applied to production 2026-11-21.
--
-- Labels: Booked a call, Signed up, Interested, Said no, Out of office,
-- Bounced, Needs you. Every label except Out of office stops the sequence
-- (same as the Replied button). Said no also adds to do-not-contact.
-- Out of office keeps the sequence and can hold the next email until a date.

alter table public.outreach_lead_state
  add column reply_label text check (reply_label in ('Booked a call', 'Signed up', 'Interested', 'Said no', 'Out of office', 'Bounced', 'Needs you')),
  add column reply_reason text check (length(reply_reason) <= 300),
  add column reply_snippet text check (length(reply_snippet) <= 600),
  add column reply_at timestamptz,
  add column reply_by text check (reply_by in ('ai', 'owner')),
  add column hold_until timestamptz;

-- One row per message the checker handled, so nothing is processed twice.
-- Only messages from leads (or bounces about them) are ever written here.
create table public.outreach_replies (
  id bigint generated always as identity primary key,
  uidvalidity bigint not null,
  uid bigint not null,
  email text not null check (email = lower(email)),
  label text not null,
  reason text not null default '',
  confidence real,
  snippet text not null default '' check (length(snippet) <= 600),
  received_at timestamptz,
  processed_at timestamptz not null default now(),
  unique (uidvalidity, uid, email)
);
create index outreach_replies_email_idx on public.outreach_replies (email, processed_at desc);

alter table public.outreach_replies enable row level security;
revoke all on public.outreach_replies from anon, authenticated;
create policy outreach_replies_admin_all on public.outreach_replies for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
grant select on public.outreach_replies to authenticated;

-- Checker bookkeeping (written by the function only).
alter table public.outreach_settings
  add column imap_uidvalidity bigint,
  add column imap_last_uid bigint,
  add column checker_last_run timestamptz,
  add column checker_last_ok timestamptz,
  add column checker_last_error text,
  add column checker_lock_until timestamptz;

-- Do-not-contact rows stay undeletable, except through
-- outreach_set_reply_label when the owner confirms the removal.
create or replace function public.outreach_do_not_contact_no_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('outreach.allow_dnc_delete', true), '') = 'on' then return old; end if;
  raise exception 'outreach_do_not_contact rows cannot be deleted';
end
$$;

-- The one place a reply label takes effect. Service role (checker) and the
-- owner's RPC below. Never sends anything.
create or replace function public.outreach_apply_reply(
  _email text, _label text, _reason text, _snippet text, _by text, _hold_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text := lower(trim(_email));
  stops boolean := _label <> 'Out of office';
  dnc boolean := false;
  shop_name text;
begin
  if _label not in ('Booked a call', 'Signed up', 'Interested', 'Said no', 'Out of office', 'Bounced', 'Needs you') then
    raise exception 'bad label %', _label;
  end if;
  select coalesce(nullif(l.shop, ''), '') into shop_name from public.outreach_leads l where l.email = e limit 1;
  insert into public.outreach_lead_state (email, shop) values (e, coalesce(shop_name, '')) on conflict (email) do nothing;
  update public.outreach_lead_state set
    reply_label = _label,
    reply_reason = coalesce(left(_reason, 300), reply_reason),
    reply_snippet = coalesce(left(_snippet, 600), reply_snippet),
    reply_at = now(),
    reply_by = _by,
    stopped_reason = case when stops then _label else stopped_reason end,
    stopped_at = case when stops then now() else stopped_at end,
    hold_until = case when not stops and _hold_until > now() then _hold_until else hold_until end,
    updated_at = now()
  where email = e;
  if _label = 'Said no' and not exists (select 1 from public.outreach_do_not_contact where email = e) then
    insert into public.outreach_do_not_contact (email, shop, reason) values (e, coalesce(shop_name, ''), 'Said no');
    dnc := true;
  end if;
  insert into public.outreach_log (type, text) values (
    case when _label = 'Needs you' then 'needs-you' when stops then 'stopped' else 'reply' end,
    e || ': ' || _label || case when _by = 'ai' then ' (AI: ' || left(coalesce(_reason, ''), 120) || ')' else ' (set by you)' end
      || case when dnc then ', added to do-not-contact' else '' end
      || case when not stops and _hold_until > now() then ', next email held until ' || to_char(_hold_until at time zone 'Europe/London', 'DD Mon') else '' end);
  return jsonb_build_object('dnc', dnc, 'stopped', stops);
end
$$;
revoke execute on function public.outreach_apply_reply(text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.outreach_apply_reply(text, text, text, text, text, timestamptz) to service_role;

-- Owner changes a label with one tap. Changing away from Said no keeps the
-- do-not-contact entry unless _remove_dnc is true (the page asks first).
-- Choosing Out of office means "carry on emailing", so it resumes the sequence.
create or replace function public.outreach_set_reply_label(_email text, _label text, _remove_dnc boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text := lower(trim(_email));
  prev text;
  result jsonb;
  removed boolean := false;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  select reply_label into prev from public.outreach_lead_state where email = e;
  result := public.outreach_apply_reply(e, _label, null, null, 'owner', null);
  if _label = 'Out of office' then
    update public.outreach_lead_state set stopped_reason = null, stopped_at = null, updated_at = now() where email = e;
  end if;
  if _label <> 'Said no' and _remove_dnc then
    perform set_config('outreach.allow_dnc_delete', 'on', true);
    delete from public.outreach_do_not_contact where email = e;
    removed := found;
    perform set_config('outreach.allow_dnc_delete', 'off', true);
    if removed then insert into public.outreach_log (type, text) values ('resumed', e || ': removed from do-not-contact by you'); end if;
  end if;
  return result || jsonb_build_object('previous', prev, 'dnc_removed', removed);
end
$$;
revoke execute on function public.outreach_set_reply_label(text, text, boolean) from public, anon;
grant execute on function public.outreach_set_reply_label(text, text, boolean) to authenticated;

-- Checker lock (one run at a time). Service role only.
create or replace function public.outreach_claim_checker_lock(_seconds integer default 240)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.outreach_settings
      set checker_lock_until = now() + make_interval(secs => greatest(30, least(_seconds, 900)))
      where id and (checker_lock_until is null or checker_lock_until < now())
      returning 1
  )
  select exists (select 1 from claimed)
$$;
create or replace function public.outreach_release_checker_lock()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.outreach_settings set checker_lock_until = null where id
$$;
revoke execute on function public.outreach_claim_checker_lock(integer) from public, anon, authenticated;
revoke execute on function public.outreach_release_checker_lock() from public, anon, authenticated;
grant execute on function public.outreach_claim_checker_lock(integer) to service_role;
grant execute on function public.outreach_release_checker_lock() to service_role;
