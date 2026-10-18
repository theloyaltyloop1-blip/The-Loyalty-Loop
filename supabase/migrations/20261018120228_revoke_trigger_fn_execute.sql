-- Trigger functions are SECURITY DEFINER and were exposed via /rest/v1/rpc to anon/authenticated.
-- Triggers still fire (they run as the table owner); this only removes direct API execution.
revoke execute on function public.deliver_shop_announcement() from public, anon, authenticated;
revoke execute on function public.notify_reward_redeemed() from public, anon, authenticated;
