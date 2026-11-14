-- Release announcement emails ("what's new" after a big release).
--
-- Flow: Claude inserts a draft row (service role). An admin reviews it on the
-- website admin panel (/access?view=release-emails), can edit the words, sends
-- a test to themselves, then presses Send. Only the send-release-announcement
-- edge function (service role) sends mail and writes recipient rows.

-- Platform-wide opt-out for product news. Separate from memberships.promos_opted_out,
-- which is per shop and about that shop's promotions.
alter table public.profiles
  add column if not exists product_updates_opted_out boolean not null default false;

create table public.release_announcements (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('owners', 'shoppers')),
  subject text not null check (char_length(subject) between 1 and 150),
  -- Plain text. Blank line = new paragraph, lines starting "- " = bullet list.
  body text not null check (char_length(body) between 1 and 10000),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'cancelled')),
  release_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete set null,
  sending_started_at timestamptz,
  sent_at timestamptz,
  recipient_count integer,
  sent_count integer not null default 0,
  failed_count integer not null default 0
);

create table public.release_announcement_recipients (
  announcement_id uuid not null references public.release_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  -- 'pending' = claimed by a send run. A row left pending by a crashed run is
  -- deliberately NOT retried automatically (it may already have gone out).
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  -- The send run that owns this row. A run only sends rows it claimed itself
  -- (update ... where claimed_by is null), so two runs can't both send one row.
  claimed_by uuid,
  error text,
  updated_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.release_announcements enable row level security;
alter table public.release_announcement_recipients enable row level security;

create policy "Admins read release announcements" on public.release_announcements
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Admins may only edit the words of a draft (and cancel it). Status changes to
-- sending/sent happen only in the edge function with the service role.
create policy "Admins edit draft release announcements" on public.release_announcements
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin') and status = 'draft')
  with check (public.has_role(auth.uid(), 'admin') and status in ('draft', 'cancelled'));

revoke update on public.release_announcements from authenticated;
grant select on public.release_announcements to authenticated;
grant update (subject, body, status, updated_at) on public.release_announcements to authenticated;

create policy "Admins read release announcement recipients" on public.release_announcement_recipients
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
revoke insert, update, delete on public.release_announcement_recipients from authenticated, anon;
grant select on public.release_announcement_recipients to authenticated;

-- Who an announcement goes to. Service role only.
create or replace function public.release_announcement_audience(_audience text)
returns table (user_id uuid, email text, first_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (p.id) p.id, p.email, p.first_name
  from public.profiles p
  join public.user_roles r on r.user_id = p.id
  where r.role = case _audience when 'owners' then 'business_owner'::app_role
                                when 'shoppers' then 'consumer'::app_role end
    and p.email is not null
    and position('@' in p.email) > 1
    and not p.product_updates_opted_out
  order by p.id;
$$;

revoke execute on function public.release_announcement_audience(text) from public, anon, authenticated;
grant execute on function public.release_announcement_audience(text) to service_role;

-- How many people a send would reach, for the admin "Send to N people" button.
create or replace function public.release_announcement_audience_count(_audience text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (select count(*)::integer from public.release_announcement_audience(_audience));
end;
$$;

revoke execute on function public.release_announcement_audience_count(text) from public, anon;
grant execute on function public.release_announcement_audience_count(text) to authenticated;
