-- Metadata only. The encrypted archive itself is downloaded to the admin's
-- laptop and is never stored in this table or in a public Storage bucket.
create table if not exists public.admin_laptop_backups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  download_confirmed_at timestamptz,
  table_count integer not null check (table_count >= 0),
  record_count bigint not null check (record_count >= 0),
  archive_bytes bigint not null check (archive_bytes >= 0),
  format_version integer not null default 1,
  status text not null default 'prepared' check (status in ('prepared', 'download_confirmed'))
);

create index if not exists admin_laptop_backups_created_at_idx
  on public.admin_laptop_backups (created_at desc);

alter table public.admin_laptop_backups enable row level security;

create policy "admin_laptop_backups_admin_read"
  on public.admin_laptop_backups for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

revoke all on public.admin_laptop_backups from anon, authenticated;
grant select on public.admin_laptop_backups to authenticated;
