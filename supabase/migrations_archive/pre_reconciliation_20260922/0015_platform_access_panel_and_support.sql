-- Platform access accounts. These are roles, not client-side email checks.
-- Existing accounts receive the role now; ensure_current_user_bootstrap also
-- grants it at each future login for the allowlisted accounts.
insert into public.user_roles (user_id, role)
select id, 'admin'::app_role
from auth.users
where lower(email) in ('zahihussain92@gmail.com', 'flyhigher722@gmail.com', 'developer@the-loyalty-loop.com')
on conflict (user_id, role) do nothing;

create or replace function public.ensure_current_user_bootstrap()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _email text;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select email into _email from auth.users where id = _uid;
  insert into public.profiles (id, email) values (_uid, _email) on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (_uid) on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role) values (_uid, 'consumer') on conflict (user_id, role) do nothing;
  if lower(_email) in ('zahihussain92@gmail.com', 'flyhigher722@gmail.com', 'developer@the-loyalty-loop.com') then
    insert into public.user_roles (user_id, role) values (_uid, 'admin') on conflict (user_id, role) do nothing;
  end if;
end;
$$;

-- Owner help requests, triaged from the platform Access Panel.
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  admin_response text check (char_length(admin_response) <= 4000),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.support_requests for each row execute function public.update_updated_at_column();
create index support_requests_status_created_idx on public.support_requests (status, created_at desc);
create index support_requests_business_created_idx on public.support_requests (business_id, created_at desc);
alter table public.support_requests enable row level security;
grant select, insert, update on public.support_requests to authenticated;

create policy "support_requests_select_owner_or_admin" on public.support_requests for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin')
  );
create policy "support_requests_insert_owner" on public.support_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.businesses b where b.id = support_requests.business_id and b.owner_id = (select auth.uid()))
  );
create policy "support_requests_update_admin" on public.support_requests for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
