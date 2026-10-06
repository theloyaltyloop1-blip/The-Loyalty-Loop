-- Product analytics moved to PostHog (website, shopper app and business app).
-- Apply only after PostHog is confirmed to be receiving events from all three surfaces.
-- Dropping the table permanently deletes the old usage_events history.

drop function if exists public.admin_usage_analytics(integer);
drop table if exists public.usage_events;
