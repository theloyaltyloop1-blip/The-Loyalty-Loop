-- Owner growth tools: member directory, saved promotions and safe cancellation.
create table public.business_promotions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null, body text not null, audience text not null default 'all' check (audience in ('all','inactive_30','new_members','regulars')),
  status text not null default 'draft' check (status in ('draft','sent')), sent_at timestamptz, created_at timestamptz not null default now()
);
alter table public.business_promotions enable row level security;
create policy "business_promotions_owner_access" on public.business_promotions for all to authenticated using (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid()))) with check (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
grant select,insert,update,delete on public.business_promotions to authenticated;

create or replace function public.get_business_members(_business_id uuid)
returns table(user_id uuid, first_name text, last_name text, stamp_count integer, points_balance integer, visit_count integer, last_activity_at timestamptz, joined_at timestamptz)
language sql stable security definer set search_path=public as $$
 select m.user_id,p.first_name,p.last_name,m.stamp_count,m.points_balance,m.visit_count,m.last_activity_at,m.joined_at
 from public.memberships m join public.profiles p on p.id=m.user_id
 where m.business_id=_business_id and exists(select 1 from public.businesses b where b.id=_business_id and b.owner_id=auth.uid())
 order by m.last_activity_at desc nulls last;
$$;
revoke all on function public.get_business_members(uuid) from public;
grant execute on function public.get_business_members(uuid) to authenticated;
