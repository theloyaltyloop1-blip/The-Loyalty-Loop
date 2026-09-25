-- User-generated content moderation for shop reviews, to meet App Store
-- Review Guideline 1.2: shoppers can report an objectionable review and
-- block the user who wrote it.

create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'offensive', 'harassment', 'off_topic', 'other')),
  detail text check (char_length(detail) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  unique (review_id, reporter_id)
);

create index review_reports_open_idx on public.review_reports (created_at desc) where status = 'open';

alter table public.review_reports enable row level security;
grant select, insert, update on table public.review_reports to authenticated;

create policy "review_reports_insert_own"
  on public.review_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "review_reports_select_own_or_admin"
  on public.review_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'));

create policy "review_reports_update_admin"
  on public.review_reports for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

create table public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;
grant select, insert, delete on table public.user_blocks to authenticated;

create policy "user_blocks_manage_own"
  on public.user_blocks for all to authenticated
  using (blocker_id = (select auth.uid()))
  with check (blocker_id = (select auth.uid()));

drop policy "reviews_select_authenticated" on public.reviews;

create policy "reviews_select_visible"
  on public.reviews for select to authenticated
  using (
    not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = (select auth.uid()) and b.blocked_id = reviews.user_id
    )
  );;
