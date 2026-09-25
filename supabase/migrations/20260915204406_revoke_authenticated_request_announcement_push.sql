-- No client code calls request_announcement_push() directly (grep confirmed
-- 2026-09-15) — it's only ever invoked from inside deliver_shop_announcement
-- and deliver_platform_announcement, both SECURITY DEFINER triggers that run
-- with the function owner's rights regardless of the original caller's own
-- grants. The authenticated grant was therefore as unnecessary as the anon
-- one removed just before this. Nothing in the app calls this via .rpc().
revoke execute on function public.request_announcement_push(uuid) from authenticated;;
