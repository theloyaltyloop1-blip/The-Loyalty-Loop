-- Real gap found while building the onboarding wizard: Signup.tsx already
-- sends intent: 'business_owner' in the signup metadata, and the docs are
-- explicit that self-service owner signup has "no manual admin approval
-- gate ... business_owner role is granted the moment they submit". But
-- ensure_current_user_bootstrap() never actually read that metadata — it
-- only ever granted 'consumer' (plus the hardcoded admin allowlist). Every
-- new owner signup was silently stuck with no way to ever create a shop,
-- since businesses_insert_self_owner requires has_role(..., 'business_owner').
create or replace function public.ensure_current_user_bootstrap()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _email text;
  _intent text;
begin
  if _uid is null then raise exception 'not authenticated'; end if;

  select email, raw_user_meta_data->>'intent' into _email, _intent from auth.users where id = _uid;

  insert into public.profiles (id, email) values (_uid, _email) on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (_uid) on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role) values (_uid, 'consumer') on conflict (user_id, role) do nothing;

  if _intent = 'business_owner' then
    insert into public.user_roles (user_id, role) values (_uid, 'business_owner') on conflict (user_id, role) do nothing;
  end if;

  if lower(_email) in ('zahihussain92@gmail.com', 'flyhigher722@gmail.com', 'developer@the-loyalty-loop.com') then
    insert into public.user_roles (user_id, role) values (_uid, 'admin') on conflict (user_id, role) do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- §3 Shop gallery — multiple photos beyond the single logo/cover.
create table public.business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index business_photos_business_idx on public.business_photos (business_id, sort_order);

alter table public.business_photos enable row level security;

create policy "business_photos_select_public_or_owner_or_admin"
  on public.business_photos for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.is_active and b.approval_status = 'approved'
    )
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

create policy "business_photos_write_owner_or_admin"
  on public.business_photos for all
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "gallery_public_read"
  on storage.objects for select
  using (bucket_id = 'gallery');

create policy "gallery_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'gallery'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "gallery_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'gallery'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  );
