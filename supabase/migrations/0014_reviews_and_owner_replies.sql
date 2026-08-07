-- Customer reviews: one review per genuine member of a shop. Owner replies
-- are strictly tied to the review's own business, preventing cross-shop
-- replies even if a client submits a different business_id.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, business_id)
);

create trigger set_updated_at
  before update on public.reviews
  for each row execute function public.update_updated_at_column();

create or replace function public.enforce_review_update_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id or new.business_id is distinct from old.business_id then
    raise exception 'a review cannot be moved to another customer or business';
  end if;
  return new;
end;
$$;

create trigger enforce_review_update_scope
  before update on public.reviews
  for each row execute function public.enforce_review_update_scope();

create index reviews_business_created_idx on public.reviews (business_id, created_at desc);

alter table public.reviews enable row level security;
grant select, insert, update, delete on table public.reviews to authenticated;

create policy "reviews_select_authenticated"
  on public.reviews for select to authenticated using (true);

create policy "reviews_insert_members_only"
  on public.reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.memberships m
      where m.user_id = (select auth.uid()) and m.business_id = reviews.business_id
    )
  );

create policy "reviews_update_author_or_admin"
  on public.reviews for update to authenticated
  using (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
  with check (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'));

create policy "reviews_delete_author_or_admin"
  on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'));

create table public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id)
);

create trigger set_updated_at
  before update on public.review_replies
  for each row execute function public.update_updated_at_column();

create or replace function public.enforce_review_reply_update_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.review_id is distinct from old.review_id
    or new.business_id is distinct from old.business_id
    or new.owner_id is distinct from old.owner_id
  then
    raise exception 'a review reply cannot be reassigned';
  end if;
  return new;
end;
$$;

create trigger enforce_review_reply_update_scope
  before update on public.review_replies
  for each row execute function public.enforce_review_reply_update_scope();

create index review_replies_business_idx on public.review_replies (business_id, created_at desc);

alter table public.review_replies enable row level security;
grant select, insert, update, delete on table public.review_replies to authenticated;

create policy "review_replies_select_authenticated"
  on public.review_replies for select to authenticated using (true);

create policy "review_replies_insert_own_business"
  on public.review_replies for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.reviews r
      where r.id = review_id and r.business_id = review_replies.business_id
    )
    and exists (
      select 1 from public.businesses b
      where b.id = review_replies.business_id and b.owner_id = (select auth.uid())
    )
  );

create policy "review_replies_update_own_business"
  on public.review_replies for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.reviews r
      where r.id = review_id and r.business_id = review_replies.business_id
    )
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
  );

create policy "review_replies_delete_own_business"
  on public.review_replies for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
  );
