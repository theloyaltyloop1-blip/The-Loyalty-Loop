-- Customer news feed and owner-authored shop announcements.
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text check (char_length(body) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.announcements
  for each row execute function public.update_updated_at_column();

alter table public.announcements enable row level security;

-- Customers may only see active messages from active, approved shops. Owners
-- retain access to their own drafts/inactive announcements.
create policy "announcements_select_public_or_owner_or_admin"
  on public.announcements for select
  using (
    (is_active and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.is_active and b.approval_status = 'approved'
    ))
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
    or public.has_role(auth.uid(), 'admin')
  );

-- `business_id` must belong to the current owner. This is enforced in the
-- database, so an owner cannot publish/edit/delete news for another shop.
create policy "announcements_write_owner_or_admin"
  on public.announcements for all
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    business_id is not null
    and (
      exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
      or public.has_role(auth.uid(), 'admin')
    )
  );
