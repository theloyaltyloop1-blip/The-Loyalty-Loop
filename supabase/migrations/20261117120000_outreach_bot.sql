-- Cold-email outreach bot, moved online from the owner's laptop
-- (marketing/outreach-bot). Same data the local bot kept in CSV files and
-- state.json, held here so the `outreach-send` edge function can send on
-- schedule while the laptop is off. NOT applied yet: owner's yes first.
--
-- Admin only. Every table has RLS with one policy: has_role(auth.uid(), 'admin').
-- anon gets nothing. The edge function uses the service role.
-- The mailbox password is NOT stored here: it is a Supabase secret
-- (OUTREACH_SMTP_PASS) read only by the edge function.

-- ---------------------------------------------------------------------
-- Leads. One row per CSV row per list, exactly like the local bot's lead
-- files (list 'email-ok' = marketing/london-leads/email-ok.csv, list
-- 'leads' = leads.csv). `position` keeps file order, which decides who is
-- emailed first. Fields are already derived the way lib.mjs toLead() does.

create table public.outreach_leads (
  id uuid primary key default gen_random_uuid(),
  list text not null check (list ~ '^[a-z0-9-]{1,60}$'),
  position integer not null check (position >= 0),
  email text not null default '' check (email = lower(email) and length(email) <= 320),
  all_emails text[] not null default '{}',
  shop text not null default '',
  first_name text not null default '',
  shop_type text not null default 'shop',
  area text not null default 'London',
  linkedin_url text not null default '',
  instagram_handle text not null default '',
  legal_entity text not null default '',
  company_number text not null default '',
  -- lib.mjs: email_ok column "yes" -> true; other value -> false; no column -> true.
  email_ok boolean not null,
  imported_at timestamptz not null default now(),
  unique (list, position)
);
-- The local bot keeps only the first row for each email in a file.
create unique index outreach_leads_list_email_key on public.outreach_leads (list, email) where email <> '';

-- Never email these (do-not-contact.csv). Rows cannot be deleted: an
-- objection stays recorded.
create table public.outreach_do_not_contact (
  email text primary key check (email = lower(email) and email like '%@%'),
  shop text not null default '',
  reason text not null default '',
  created_at timestamptz not null default now()
);

-- Shops already emailed in the earlier Thunderbird batches (EXCLUDE_FILES):
-- never start a new sequence with them.
create table public.outreach_excluded (
  email text primary key check (email = lower(email) and email like '%@%'),
  source text not null default ''
);

-- Per-email state (state.json "leads"): replied/stopped.
create table public.outreach_lead_state (
  email text primary key check (email = lower(email)),
  shop text not null default '',
  stopped_reason text,
  stopped_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Every email the bot sent. One row per lead per step, so a step can
-- never be sent twice to the same address even if two runs race.
create table public.outreach_sends (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  step smallint not null check (step between 0 and 2),
  step_key text not null check (step_key in ('pain', 'features', 'story')),
  shop text not null default '',
  subject text not null default '',
  message_id text,
  sent_at timestamptz not null default now(),
  unique (email, step)
);
create index outreach_sends_sent_at_idx on public.outreach_sends (sent_at desc);

-- LinkedIn progress (ticked by hand; never automated).
create table public.outreach_linkedin (
  email text primary key check (email = lower(email)),
  requested timestamptz,
  accepted timestamptz,
  messaged timestamptz
);

-- Instagram progress, by handle (ticked by hand; never automated).
create table public.outreach_instagram (
  handle text primary key check (handle ~ '^[a-z0-9._]{1,30}$'),
  sent timestamptz,
  followed_up timestamptz,
  replied timestamptz,
  no timestamptz
);

-- Food reviewers to DM (reviewers.csv).
create table public.outreach_reviewers (
  handle text primary key check (handle ~ '^[a-z0-9._]{1,30}$'),
  name text not null default '' check (length(name) <= 200),
  area text not null default '' check (length(area) <= 200),
  liked text not null default '' check (length(liked) <= 200),
  added date not null default current_date
);

-- Message templates (templates/ folder). Email keys hold the same text as
-- the .txt files: line 1 "Subject: ...", then the body.
create table public.outreach_templates (
  key text primary key check (key in ('email-1-pain.txt', 'email-2-features.txt', 'email-3-story.txt', 'linkedin.json', 'instagram.json')),
  content text not null check (length(content) between 1 and 20000),
  updated_at timestamptz not null default now(),
  check (key like '%.json' or content ~* '^Subject:')
);

-- Activity log (state.json "log").
create table public.outreach_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  type text not null,
  text text not null
);
create index outreach_log_at_idx on public.outreach_log (at desc);

-- Settings (settings.json + the non-secret parts of .env). Exactly one row.
create table public.outreach_settings (
  id boolean primary key default true check (id),
  auto_send boolean not null default false,
  leads_list text not null default 'email-ok',
  start_hour smallint not null default 9 check (start_hour between 0 and 24),
  end_hour smallint not null default 16 check (end_hour between 0 and 24),
  weekdays_only boolean not null default true,
  daily_limit smallint not null default 25 check (daily_limit between 1 and 60),
  min_delay_seconds integer not null default 90 check (min_delay_seconds >= 30),
  max_delay_seconds integer not null default 240,
  followup_gap_days integer[] not null default '{3,4}' check (array_length(followup_gap_days, 1) = 2),
  linkedin_angle text not null default 'pain' check (linkedin_angle in ('pain', 'features', 'story')),
  linkedin_daily_limit smallint not null default 20 check (linkedin_daily_limit between 0 and 100),
  instagram_list text not null default 'leads',
  instagram_daily_limit smallint not null default 20 check (instagram_daily_limit between 0 and 100),
  sender_name text not null default 'Zahi Hussain',
  from_email text not null default '',
  booking_link text not null default 'https://calendly.com/the-loyalty-loop1/15min',
  signup_link text not null default 'https://www.the-loyalty-loop.com/signup/owner',
  website text not null default 'https://www.the-loyalty-loop.com',
  -- Sender bookkeeping, written by the edge function only.
  next_send_at timestamptz,
  consecutive_failures integer not null default 0,
  last_error text,
  send_lock_until timestamptz,
  updated_at timestamptz not null default now(),
  check (max_delay_seconds >= min_delay_seconds)
);
insert into public.outreach_settings (id) values (true);

-- ---------------------------------------------------------------------
-- Security: admin only.

do $$
declare t text;
begin
  foreach t in array array['outreach_leads', 'outreach_do_not_contact', 'outreach_excluded', 'outreach_lead_state',
    'outreach_sends', 'outreach_linkedin', 'outreach_instagram', 'outreach_reviewers', 'outreach_templates',
    'outreach_log', 'outreach_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))', t || '_admin_all', t);
  end loop;
end
$$;

-- What admins may do from the website. Sends are written only by the edge
-- function (service role); the admin page reads them.
grant select on public.outreach_leads, public.outreach_excluded, public.outreach_sends, public.outreach_log to authenticated;
grant select, insert on public.outreach_do_not_contact to authenticated;
grant select, insert, update on public.outreach_lead_state, public.outreach_linkedin, public.outreach_instagram,
  public.outreach_templates to authenticated;
grant select, insert, update, delete on public.outreach_reviewers to authenticated;
grant select on public.outreach_settings to authenticated;
-- Only the owner-facing settings, never the sender bookkeeping or auto_send
-- (auto_send goes through outreach_set_auto_send so it is logged).
grant update (leads_list, start_hour, end_hour, weekdays_only, daily_limit, min_delay_seconds, max_delay_seconds,
  linkedin_angle, linkedin_daily_limit, instagram_list, instagram_daily_limit, sender_name, from_email,
  booking_link, signup_link, website, updated_at) on public.outreach_settings to authenticated;
grant insert on public.outreach_log to authenticated;

create or replace function public.outreach_do_not_contact_no_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'outreach_do_not_contact rows cannot be deleted';
end
$$;
create trigger outreach_do_not_contact_no_delete before delete on public.outreach_do_not_contact
  for each row execute function public.outreach_do_not_contact_no_delete();

-- ---------------------------------------------------------------------
-- Admin actions. security invoker: RLS still decides (admins only).

-- lib.mjs stopLead(): mark replied; "no / unsubscribe / declined / not
-- interested" also adds the address to do-not-contact.
create or replace function public.outreach_stop_lead(_email text, _reason text default 'Replied')
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  e text := lower(trim(_email));
  r text := coalesce(nullif(trim(_reason), ''), 'Replied');
  shop_name text;
  dnc boolean := false;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  insert into public.outreach_lead_state (email, stopped_reason, stopped_at)
  values (e, r, now())
  on conflict (email) do update set stopped_reason = excluded.stopped_reason, stopped_at = excluded.stopped_at, updated_at = now();
  select shop into shop_name from public.outreach_lead_state where email = e;
  if r ~* '(\mno\M|unsub|declin|not interested)'
     and not exists (select 1 from public.outreach_do_not_contact where email = e) then
    insert into public.outreach_do_not_contact (email, shop, reason) values (e, coalesce(shop_name, ''), r);
    dnc := true;
  end if;
  insert into public.outreach_log (type, text)
  values ('stopped', e || ': ' || r || case when dnc then ' (added to do-not-contact)' else '' end);
  return jsonb_build_object('dnc', dnc);
end
$$;

create or replace function public.outreach_resume_lead(_email text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare e text := lower(trim(_email));
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.outreach_lead_state set stopped_reason = null, stopped_at = null, updated_at = now() where email = e;
  insert into public.outreach_log (type, text) values ('resumed', e);
end
$$;

-- Auto-send switch. Logged, and resets the failure counter like the local bot.
create or replace function public.outreach_set_auto_send(_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  update public.outreach_settings
    set auto_send = _on, consecutive_failures = 0, updated_at = now()
    where id;
  insert into public.outreach_log (type, text)
  values (case when _on then 'auto-on' else 'auto-off' end,
          case when _on then 'Auto-send switched on' else 'Auto-send switched off' end);
end
$$;

revoke execute on function public.outreach_stop_lead(text, text) from public, anon;
revoke execute on function public.outreach_resume_lead(text) from public, anon;
revoke execute on function public.outreach_set_auto_send(boolean) from public, anon;
grant execute on function public.outreach_stop_lead(text, text) to authenticated;
grant execute on function public.outreach_resume_lead(text) to authenticated;
grant execute on function public.outreach_set_auto_send(boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Sender lock, so the scheduled run and a "Send next email now" press can
-- never send at the same moment. Service role only.

create or replace function public.outreach_claim_send_lock(_seconds integer default 120)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.outreach_settings
      set send_lock_until = now() + make_interval(secs => greatest(10, least(_seconds, 600)))
      where id and (send_lock_until is null or send_lock_until < now())
      returning 1
  )
  select exists (select 1 from claimed)
$$;

create or replace function public.outreach_release_send_lock()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.outreach_settings set send_lock_until = null where id
$$;

revoke execute on function public.outreach_claim_send_lock(integer) from public, anon, authenticated;
revoke execute on function public.outreach_release_send_lock() from public, anon, authenticated;
grant execute on function public.outreach_claim_send_lock(integer) to service_role;
grant execute on function public.outreach_release_send_lock() to service_role;
