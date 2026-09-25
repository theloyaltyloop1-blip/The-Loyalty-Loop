-- Security hardening: public RPC access, audit-log visibility and rate limits.
-- Every public SECURITY DEFINER RPC below checks auth.uid() internally, but
-- anonymous execution is unnecessary and should not be exposed through PostgREST.

revoke execute on function public.accept_brand_handoff(uuid) from public, anon;
revoke execute on function public.admin_override_loyalty_threshold(uuid, integer) from public, anon;
revoke execute on function public.admin_pending_business_verifications() from public, anon;
revoke execute on function public.admin_review_business_verification(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_set_business_status(uuid, public.business_approval_status, text) from public, anon;
revoke execute on function public.admin_set_role(text, public.app_role, boolean) from public, anon;
revoke execute on function public.apply_referral_code(text) from public, anon;
revoke execute on function public.brand_create_shop(uuid, text, text, text) from public, anon;
revoke execute on function public.brand_rollup(uuid) from public, anon;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon;
revoke execute on function public.create_brand(text, text) from public, anon;
revoke execute on function public.get_business_members(uuid) from public, anon;
revoke execute on function public.is_active_staff_of(uuid, uuid) from public, anon;
revoke execute on function public.is_brand_member(uuid, uuid) from public, anon;
revoke execute on function public.lookup_user_by_stamp_code(text) from public, anon;
revoke execute on function public.start_brand_handoff(uuid, text) from public, anon;
revoke execute on function public.set_my_staff_pin(uuid, text) from public, anon;
revoke execute on function public.staff_has_permission(uuid, uuid, text) from public, anon;
revoke execute on function public.submit_business_verification(uuid, text, text) from public, anon;
revoke execute on function public.verify_staff_pin(uuid, text) from public, anon;

-- Explicitly grant only the signed-in RPCs used by the product.
grant execute on function public.accept_brand_handoff(uuid) to authenticated;
grant execute on function public.admin_override_loyalty_threshold(uuid, integer) to authenticated;
grant execute on function public.admin_pending_business_verifications() to authenticated;
grant execute on function public.admin_review_business_verification(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_business_status(uuid, public.business_approval_status, text) to authenticated;
grant execute on function public.admin_set_role(text, public.app_role, boolean) to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.brand_create_shop(uuid, text, text, text) to authenticated;
grant execute on function public.brand_rollup(uuid) to authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
grant execute on function public.create_brand(text, text) to authenticated;
grant execute on function public.get_business_members(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_active_staff_of(uuid, uuid) to authenticated;
grant execute on function public.is_brand_member(uuid, uuid) to authenticated;
grant execute on function public.lookup_user_by_stamp_code(text) to authenticated;
grant execute on function public.start_brand_handoff(uuid, text) to authenticated;
grant execute on function public.set_my_staff_pin(uuid, text) to authenticated;
grant execute on function public.staff_has_permission(uuid, uuid, text) to authenticated;
grant execute on function public.submit_business_verification(uuid, text, text) to authenticated;
grant execute on function public.verify_staff_pin(uuid, text) to authenticated;
grant execute on function public.delete_owned_business(uuid, text) to authenticated;
grant execute on function public.ensure_current_user_bootstrap() to authenticated;

-- These are implementation helpers, not client RPCs.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.create_referral_code_for_profile() from public, anon, authenticated;
revoke execute on function public.deliver_platform_announcement() from public, anon, authenticated;
revoke execute on function public.enforce_businesses_update_scope() from public, anon, authenticated;
revoke execute on function public.enforce_membership_update_scope() from public, anon, authenticated;
revoke execute on function public.enforce_rewards_update_scope() from public, anon, authenticated;
revoke execute on function public.grant_signup_reward() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_stamp_transaction() from public, anon, authenticated;

-- Keep internal audit records hidden from all client roles except admins.
create policy "owner_legal_document_emails_admin_read"
  on public.owner_legal_document_emails for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

-- `rpc_rate_limits` deliberately has no client policy: it is only mutated by
-- a SECURITY DEFINER function. Its lack of policy is intentional.
