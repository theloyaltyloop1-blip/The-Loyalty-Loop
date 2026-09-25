revoke execute on function public.check_daily_limit(text, integer) from public, anon;
grant execute on function public.check_daily_limit(text, integer) to authenticated;;
