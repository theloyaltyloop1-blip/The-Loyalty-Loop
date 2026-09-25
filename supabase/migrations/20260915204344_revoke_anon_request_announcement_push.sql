-- request_announcement_push() only re-processes notification rows that a
-- properly-authorized trigger already created; it can't leak data or forge
-- an announcement. But it has no reason to be callable by an unauthenticated
-- client, so drop the unused anon grant (found during a 2026-09-15 security
-- review). authenticated keeps it, since deliver_shop_announcement /
-- deliver_platform_announcement call it via `perform` under the calling
-- user's own session in some paths.
revoke execute on function public.request_announcement_push(uuid) from anon;;
