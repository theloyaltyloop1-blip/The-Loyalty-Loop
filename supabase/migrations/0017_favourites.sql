-- §2 Favourites — save shops for quick access.
create table public.favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);

alter table public.favourites enable row level security;

create policy "favourites_self_full_access"
  on public.favourites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
