-- Logged-out visitors could not read shops: the single read policy called
-- is_active_staff_of/has_role for every role, and anon may not execute them.
-- Public listings and the owner/staff/admin checks are now separate policies.
drop policy businesses_select_public_or_owner_or_admin on public.businesses;
create policy businesses_select_public on public.businesses for select to anon, authenticated
  using (is_active and approval_status = 'approved');
create policy businesses_select_owner_staff_admin on public.businesses for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_active_staff_of(id, (select auth.uid())) or public.has_role((select auth.uid()), 'admin'));
