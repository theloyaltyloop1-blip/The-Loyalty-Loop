-- DRAFT. NOT APPLIED. Not in supabase/migrations on purpose.
-- Written 2026-11-15 as part of the outreach design (marketing/outreach/04-lead-tracking.md).
-- Before use: re-check the latest migration timestamp, review the RLS, and
-- move to supabase/migrations/<timestamp>_outreach_tables.sql only on the owner's go-ahead.
-- Admin-only: no grants to anon or authenticated; edge functions use the service role.

create table public.outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email', 'domain', 'place_id', 'social_handle')),
  value text not null check (value = lower(value) and length(value) between 1 and 320),
  reason text not null check (reason in ('opt_out', 'bounce', 'complaint', 'declined', 'wrong_person', 'joined', 'manual')),
  created_at timestamptz not null default now(),
  unique (kind, value)
);

create table public.outreach_leads (
  id uuid primary key default gen_random_uuid(),
  place_id text unique,
  requested_place_id text references public.requested_shops(place_id) on delete set null,
  business_name text not null,
  town text,
  category text not null check (category in ('cafe', 'salon', 'shop', 'other')),
  country_code text not null default 'GB' references public.countries(code),
  entity_type text not null default 'unknown'
    check (entity_type in ('company', 'sole_trader_or_partnership', 'unknown')),
  channel_allowed text not null default 'none'
    check (channel_allowed in ('email', 'manual_dm', 'in_person_or_post', 'none')),
  contact_email text,
  email_source_url text,
  lawful_basis text not null default 'legitimate_interests'
    check (lawful_basis in ('legitimate_interests', 'consent')),
  lia_version text,
  status text not null default 'new'
    check (status in ('new', 'drafted', 'approved', 'sent', 'replied', 'joined', 'declined', 'suppressed', 'bounced')),
  template text,
  draft_subject text,
  draft_body text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  sent_at timestamptz,
  follow_up_due date,
  joined_business_id uuid references public.businesses(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- an email address may only be held with the page it came from
  check (contact_email is null or email_source_url is not null),
  -- email only for corporate subscribers, never for unknown or sole traders
  check (contact_email is null or channel_allowed = 'email'),
  check (channel_allowed <> 'email' or entity_type = 'company'),
  check (status not in ('approved', 'sent') or (approved_by is not null and approved_at is not null))
);

create index outreach_leads_status_idx on public.outreach_leads (status);
create index outreach_leads_follow_up_idx on public.outreach_leads (follow_up_due) where status = 'sent';

alter table public.outreach_suppressions enable row level security;
alter table public.outreach_leads enable row level security;

create policy "outreach_suppressions_admin_all" on public.outreach_suppressions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "outreach_leads_admin_all" on public.outreach_leads
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke all on public.outreach_suppressions, public.outreach_leads from anon, authenticated;
grant select, insert, update, delete on public.outreach_suppressions, public.outreach_leads to authenticated; -- RLS limits to admins

-- Suppression rows are append-only: nobody deletes an objection.
create or replace function public.outreach_suppressions_no_delete() returns trigger
language plpgsql as $$ begin raise exception 'outreach_suppressions rows cannot be deleted'; end $$;
create trigger outreach_suppressions_no_delete before delete on public.outreach_suppressions
  for each row execute function public.outreach_suppressions_no_delete();
