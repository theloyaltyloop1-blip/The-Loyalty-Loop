-- PostgreSQL grants EXECUTE to the PUBLIC pseudo-role by default when a
-- function is created, and every role (including anon/authenticated)
-- inherits from PUBLIC unless revoked separately from the per-role grants.
-- Revoking anon/authenticated alone (previous two migrations) left this
-- function callable by anyone regardless — verified via
-- information_schema.role_routine_grants after those migrations, which
-- still showed a PUBLIC row. This closes that.
revoke execute on function public.request_announcement_push(uuid) from public;;
