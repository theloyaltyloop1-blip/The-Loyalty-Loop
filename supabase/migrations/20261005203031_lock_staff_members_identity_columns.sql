-- Security fix: close the create-staff-account account-takeover path (RC01 / v-identity-01).
--
-- staff_members.user_id and pin_hash are identity/credential columns. The
-- existing "staff_members_owner_full_access" RLS policy is FOR ALL with no
-- column restriction, so a shop owner could previously INSERT/UPDATE
-- staff_members directly and set user_id to an arbitrary account's uuid.
-- Combined with create-staff-account's "reuse an existing staff row's
-- user_id, reset its password" path, that let an owner seize any account,
-- including the platform admin's.
--
-- This does not change any RLS policy and does not affect the edge
-- function, which writes through the service_role key (service_role is
-- unaffected by grants/revokes scoped to `authenticated`). It only takes
-- away the client's (owner's) ability to write user_id/pin_hash directly;
-- every other column (name, status, permissions, invited_email, etc.)
-- keeps working exactly as before.

revoke insert, update on public.staff_members from authenticated;

grant insert (business_id, invited_email, name, status, invited_by,
              can_scan_stamps, can_redeem_rewards, can_respond_reviews,
              activated_at)
  on public.staff_members to authenticated;

grant update (invited_email, name, status, invited_by,
              can_scan_stamps, can_redeem_rewards, can_respond_reviews,
              activated_at)
  on public.staff_members to authenticated;
