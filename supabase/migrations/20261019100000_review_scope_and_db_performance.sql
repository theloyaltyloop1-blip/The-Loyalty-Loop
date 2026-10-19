-- Audit follow-up (2026-10-19): review update scope, RLS initplan, permissive-policy overlap,
-- foreign-key indexes, unused indexes.

-- 1. Review authors may only change rating and body. Moving a review was already blocked;
--    id and created_at could still be rewritten. Admins keep full edit rights.
create or replace function public.enforce_review_update_scope()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.user_id is distinct from old.user_id or new.business_id is distinct from old.business_id then
    raise exception 'a review cannot be moved to another customer or business';
  end if;
  if not public.has_role(auth.uid(), 'admin'::public.app_role)
     and (new.id is distinct from old.id or new.created_at is distinct from old.created_at) then
    raise exception 'only the rating and text of a review can be changed';
  end if;
  return new;
end;
$function$;

-- 2. auth_rls_initplan: evaluate auth.uid() once per query instead of once per row.
do $$
declare
  p record;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual ~ 'auth\.uid\(\)' or with_check ~ 'auth\.uid\(\)')
  loop
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then
      stmt := stmt || ' using (' ||
        replace(replace(p.qual, '( SELECT auth.uid() AS uid)', '__UID__'), 'auth.uid()', '(select auth.uid())')
        || ')';
      stmt := replace(stmt, '__UID__', '(select auth.uid())');
    end if;
    if p.with_check is not null then
      stmt := stmt || ' with check (' ||
        replace(replace(replace(p.with_check, '( SELECT auth.uid() AS uid)', '__UID__'), 'auth.uid()', '(select auth.uid())'), '__UID__', '(select auth.uid())')
        || ')';
    end if;
    execute stmt;
  end loop;
end $$;

-- 3. multiple_permissive_policies: split each FOR ALL write policy into INSERT/UPDATE/DELETE and
--    fold its USING clause into the table's SELECT policy, so read access is unchanged.
do $$
declare
  pair record;
  w record;
  s record;
  r text;
begin
  for pair in
    select * from (values
      ('announcements', 'announcements_write_owner_or_admin', 'announcements_select_public_or_owner_or_admin'),
      ('business_photos', 'business_photos_write_owner_or_admin', 'business_photos_select_public_or_owner_or_admin'),
      ('reward_catalog', 'reward_catalog_write_owner_or_admin', 'reward_catalog_select_public_or_owner_or_admin'),
      ('staff_members', 'staff_members_owner_full_access', 'staff_members_self_select'),
      ('business_feature_settings', 'feature_settings_admin_write', 'feature_settings_owner_admin_read'),
      ('platform_announcements', 'platform_announcements_admin_write', 'platform_announcements_select_active')
    ) as t(tbl, write_pol, select_pol)
  loop
    select * into w from pg_policies where schemaname = 'public' and tablename = pair.tbl and policyname = pair.write_pol;
    select * into s from pg_policies where schemaname = 'public' and tablename = pair.tbl and policyname = pair.select_pol;
    if w is null or s is null or w.cmd <> 'ALL' then
      continue;
    end if;
    select string_agg(quote_ident(x), ', ') into r from unnest(w.roles) x;
    r := replace(r, '"public"', 'public');

    execute format('alter policy %I on public.%I using ((%s) or (%s))', s.policyname, pair.tbl, s.qual, w.qual);
    execute format('create policy %I on public.%I for insert to %s with check (%s)', pair.write_pol || '_ins', pair.tbl, r, coalesce(w.with_check, w.qual));
    execute format('create policy %I on public.%I for update to %s using (%s) with check (%s)', pair.write_pol || '_upd', pair.tbl, r, w.qual, coalesce(w.with_check, w.qual));
    execute format('create policy %I on public.%I for delete to %s using (%s)', pair.write_pol || '_del', pair.tbl, r, w.qual);
    execute format('drop policy %I on public.%I', pair.write_pol, pair.tbl);
  end loop;
end $$;

-- 4. Cover every foreign key with an index.
create index if not exists review_replies_owner_id_fk_idx on public.review_replies (owner_id);
create index if not exists profiles_country_code_fk_idx on public.profiles (country_code);
create index if not exists profiles_referred_by_fk_idx on public.profiles (referred_by);
create index if not exists rewards_business_id_fk_idx on public.rewards (business_id);
create index if not exists rewards_catalog_id_fk_idx on public.rewards (catalog_id);
create index if not exists rewards_user_id_fk_idx on public.rewards (user_id);
create index if not exists businesses_approved_by_fk_idx on public.businesses (approved_by);
create index if not exists businesses_owner_id_fk_idx on public.businesses (owner_id);
create index if not exists businesses_verification_reviewed_by_fk_idx on public.businesses (verification_reviewed_by);
create index if not exists memberships_business_id_fk_idx on public.memberships (business_id);
create index if not exists announcements_business_id_fk_idx on public.announcements (business_id);
create index if not exists business_web_research_business_id_fk_idx on public.business_web_research (business_id);
create index if not exists favourites_business_id_fk_idx on public.favourites (business_id);
create index if not exists business_promotions_business_id_fk_idx on public.business_promotions (business_id);
create index if not exists brands_created_by_fk_idx on public.brands (created_by);
create index if not exists brand_handoffs_brand_id_fk_idx on public.brand_handoffs (brand_id);
create index if not exists brand_handoffs_business_id_fk_idx on public.brand_handoffs (business_id);
create index if not exists brand_handoffs_from_owner_id_fk_idx on public.brand_handoffs (from_owner_id);
create index if not exists brand_handoffs_to_owner_id_fk_idx on public.brand_handoffs (to_owner_id);
create index if not exists brand_members_user_id_fk_idx on public.brand_members (user_id);
create index if not exists notifications_business_id_fk_idx on public.notifications (business_id);
create index if not exists notifications_user_id_fk_idx on public.notifications (user_id);
create index if not exists platform_announcements_created_by_fk_idx on public.platform_announcements (created_by);
create index if not exists platform_audit_log_actor_id_fk_idx on public.platform_audit_log (actor_id);
create index if not exists referrals_referrer_id_fk_idx on public.referrals (referrer_id);
create index if not exists requested_shops_joined_business_id_fk_idx on public.requested_shops (joined_business_id);
create index if not exists admin_laptop_backups_created_by_fk_idx on public.admin_laptop_backups (created_by);
create index if not exists fidel_transactions_user_id_fk_idx on public.fidel_transactions (user_id);
create index if not exists business_review_ai_settings_updated_by_fk_idx on public.business_review_ai_settings (updated_by);
create index if not exists review_reports_reporter_id_fk_idx on public.review_reports (reporter_id);
create index if not exists review_reports_resolved_by_fk_idx on public.review_reports (resolved_by);
create index if not exists shop_requests_joined_notification_id_fk_idx on public.shop_requests (joined_notification_id);
create index if not exists staff_members_invited_by_fk_idx on public.staff_members (invited_by);
create index if not exists staff_members_user_id_fk_idx on public.staff_members (user_id);
create index if not exists support_requests_resolved_by_fk_idx on public.support_requests (resolved_by);
create index if not exists support_requests_user_id_fk_idx on public.support_requests (user_id);
create index if not exists transactions_business_id_fk_idx on public.transactions (business_id);
create index if not exists transactions_membership_id_fk_idx on public.transactions (membership_id);
create index if not exists transactions_recorded_by_fk_idx on public.transactions (recorded_by);
create index if not exists transactions_voided_by_fk_idx on public.transactions (voided_by);
create index if not exists user_blocks_blocked_id_fk_idx on public.user_blocks (blocked_id);
create index if not exists user_suspensions_suspended_by_fk_idx on public.user_suspensions (suspended_by);
create index if not exists visit_thank_you_log_user_id_fk_idx on public.visit_thank_you_log (user_id);
create index if not exists whatsapp_conversations_business_id_fk_idx on public.whatsapp_conversations (business_id);
create index if not exists whatsapp_handoff_links_business_id_fk_idx on public.whatsapp_handoff_links (business_id);
create index if not exists whatsapp_handoff_links_phone_e164_fk_idx on public.whatsapp_handoff_links (phone_e164);
create index if not exists whatsapp_handoff_links_user_id_fk_idx on public.whatsapp_handoff_links (user_id);
create index if not exists whatsapp_message_log_business_id_fk_idx on public.whatsapp_message_log (business_id);
create index if not exists whatsapp_message_log_user_id_fk_idx on public.whatsapp_message_log (user_id);
create index if not exists whatsapp_outbox_business_id_fk_idx on public.whatsapp_outbox (business_id);
create index if not exists whatsapp_outbox_phone_e164_fk_idx on public.whatsapp_outbox (phone_e164);
create index if not exists whatsapp_outbox_user_id_fk_idx on public.whatsapp_outbox (user_id);
create index if not exists winback_email_log_business_id_fk_idx on public.winback_email_log (business_id);
create index if not exists winback_email_log_user_id_fk_idx on public.winback_email_log (user_id);
create index if not exists whatsapp_conversations_business_id_fk_idx on whatsapp_archive.whatsapp_conversations (business_id);
create index if not exists whatsapp_handoff_links_business_id_fk_idx on whatsapp_archive.whatsapp_handoff_links (business_id);
create index if not exists whatsapp_handoff_links_phone_e164_fk_idx on whatsapp_archive.whatsapp_handoff_links (phone_e164);
create index if not exists whatsapp_handoff_links_user_id_fk_idx on whatsapp_archive.whatsapp_handoff_links (user_id);
create index if not exists whatsapp_message_log_business_id_fk_idx on whatsapp_archive.whatsapp_message_log (business_id);
create index if not exists whatsapp_message_log_user_id_fk_idx on whatsapp_archive.whatsapp_message_log (user_id);

-- 5. Unused indexes that cover no foreign key. FK-covering ones and the new voice_requests index stay.
drop index if exists whatsapp_archive.whatsapp_handoff_links_lookup_idx;
drop index if exists public.usage_events_surface_event_idx;
drop index if exists public.fidel_webhook_events_fidel_message_id_idx;
drop index if exists public.businesses_features_gin;
