-- Live stamp/points balances in the shopper app.
-- The shopper app subscribes to its own memberships and rewards rows so a
-- stamp awarded at the counter appears on the customer's phone straight
-- away. Realtime applies each table's existing SELECT policy per subscriber,
-- so a shopper only ever receives their own rows (the app also filters by
-- user_id). No change to the Business app or the till path.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memberships') then
      alter publication supabase_realtime add table public.memberships;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rewards') then
      alter publication supabase_realtime add table public.rewards;
    end if;
  end if;
end $$;
