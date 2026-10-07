create table if not exists public.user_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text,
  suspended_by uuid references auth.users(id),
  suspended_at timestamptz not null default now()
);
alter table public.user_suspensions enable row level security;
create policy "user_suspensions_admin_read" on public.user_suspensions for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));
grant select on public.user_suspensions to authenticated;

