-- 01-preview.sql  (READ ONLY: changes nothing)
-- Run this in the Supabase SQL editor of the project named "The Loyalty Loop"
-- (its address contains tgukdabfvvoywawmzbdo). Check the project name first.
-- It shows what a wipe of test data would remove and which accounts would survive.

-- 1. Admin accounts (these would be KEPT; every other login would go).
select u.id, u.email, 'KEPT (admin)' as outcome
from auth.users u
join public.user_roles r on r.user_id = u.id and r.role = 'admin'
order by u.email;

-- 2. Login accounts that are not admins.
select count(*) as non_admin_logins
from auth.users u
where not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin');

-- 3. Every app table with its row count. Settings-style tables are marked KEEP.
select table_schema as schema, table_name as "table",
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int as rows,
  case when table_name in ('shop_request_settings','whatsapp_dispatch_settings','fidel_retired_metadata_ids','admin_laptop_backups')
       then 'KEEP (settings)' else 'WIPE' end as outcome
from information_schema.tables
where table_type = 'BASE TABLE'
  and table_schema in ('public','whatsapp_archive','business_activation_private')
order by outcome, rows desc, table_name;

-- 4. Uploaded files (shop logos, covers, photos) by bucket. Supabase only lets files
--    be removed through the dashboard or Storage API, not through SQL.
select bucket_id, count(*) as files from storage.objects group by bucket_id order by files desc;
