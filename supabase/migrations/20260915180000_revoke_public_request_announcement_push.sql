-- Security review (2026-09-15): request_announcement_push() had no reason to
-- be callable by clients at all. It's only ever invoked from inside
-- deliver_shop_announcement / deliver_platform_announcement, both SECURITY
-- DEFINER triggers that run as the function owner regardless of the original
-- caller's own grants — confirmed no app code calls it via .rpc() either.
--
-- PostgreSQL grants EXECUTE to the PUBLIC pseudo-role by default when a
-- function is created, and every role (anon, authenticated, ...) inherits
-- from PUBLIC unless revoked separately from any direct per-role grant.
-- Revoking anon/authenticated without also revoking PUBLIC leaves the
-- function callable by anyone regardless — this migration removes all three,
-- leaving only postgres/service_role able to call it. Verified after
-- applying: a direct anon RPC call now returns 42501 permission denied,
-- while the legitimate trigger-driven flow (checked by publishing a real
-- announcement) is unaffected.
revoke execute on function public.request_announcement_push(uuid) from anon;
revoke execute on function public.request_announcement_push(uuid) from authenticated;
revoke execute on function public.request_announcement_push(uuid) from public;
