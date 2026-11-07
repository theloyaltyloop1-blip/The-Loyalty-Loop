-- Live programme changes in the shopper app.
-- When a shop edits or switches its programme (including AI-designed custom
-- programmes), the rewards and membership levels change in these tables. The
-- shopper app listens to them, together with businesses (already published),
-- so open cards and shop pages update without a restart. Both tables are
-- publicly readable for active shops; realtime applies the same SELECT
-- policies per subscriber.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reward_catalog') then
      alter publication supabase_realtime add table public.reward_catalog;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'membership_tiers') then
      alter publication supabase_realtime add table public.membership_tiers;
    end if;
  end if;
end $$;
