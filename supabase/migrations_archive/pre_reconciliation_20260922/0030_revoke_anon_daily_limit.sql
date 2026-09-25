-- The migration that created this function has already run in production.
-- Remove Postgres's default PUBLIC execute grant there as well.
revoke execute on function public.check_daily_limit(text, integer) from public, anon;
grant execute on function public.check_daily_limit(text, integer) to authenticated;
