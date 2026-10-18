-- Owner Tools "Deactivate shop" writes businesses.is_active; column was missing.
-- Updates are covered by the existing businesses_update_owner_or_admin policy.
alter table public.businesses add column if not exists is_active boolean not null default true;
