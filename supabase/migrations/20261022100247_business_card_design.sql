-- Additive presentation only. Existing cards and reward accounting are unchanged.
alter table public.businesses add column card_design jsonb;

create function public.valid_card_design(d jsonb, business_id uuid)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text;
begin
 if d is null then return true; end if;
 if jsonb_typeof(d) <> 'object' or octet_length(d::text) > 4096 then return false; end if;
 if not (d ?& array['version','background','color','secondary','icon','font','layout','entrance','logoPosition','photo']) then return false; end if;
 for k in select jsonb_object_keys(d) loop
  if k <> all(array['version','background','color','secondary','icon','font','layout','entrance','logoPosition','photo']) then return false; end if;
 end loop;
 if d->'version' <> '1'::jsonb then return false; end if;
 foreach k in array array['background','color','secondary','icon','font','layout','entrance','logoPosition'] loop
  if jsonb_typeof(d->k) <> 'string' then return false; end if;
 end loop;
 if (d->>'color') !~ '^#[0-9A-Fa-f]{6}$' or (d->>'secondary') !~ '^#[0-9A-Fa-f]{6}$' then return false; end if;
 if (d->>'background') <> all(array['solid','gradient','kraft','chalkboard','marble','wood','roast','pinstripe','paper','photo'])
 or (d->>'icon') <> all(array['coffee','scissors','paw','donut','star','logo'])
 or (d->>'font') <> all(array['modern','classic','handwritten','retro'])
 or (d->>'layout') <> all(array['grid','ring','row','jar','bar'])
 or (d->>'entrance') <> all(array['none','stamp','flip'])
 or (d->>'logoPosition') <> all(array['left','center','right']) then return false; end if;
 if d->'photo' <> 'null'::jsonb then
  if jsonb_typeof(d->'photo') <> 'string' or length(d->>'photo') > 2048 then return false; end if;
  -- Only public shop-owned card images; reject arbitrary URLs/data/SVG payloads.
  if (d->>'photo') !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/covers/' || business_id::text || '/card-[a-zA-Z0-9-]+\.(jpg|png|webp)$') then return false; end if;
 end if;
 if d->>'background' = 'photo' and d->'photo' = 'null'::jsonb then return false; end if;
 return true;
end $$;
alter table public.businesses add constraint businesses_card_design_valid check (public.valid_card_design(card_design, id));
-- Existing businesses RLS restricts writes to owners/admins. This additional guard
-- prevents future broad staff policies from granting presentation control.
create function public.enforce_card_design_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.card_design is distinct from old.card_design
 and (select auth.uid()) is distinct from old.owner_id
 and not public.has_role((select auth.uid()), 'admin') then
  raise exception 'Only the shop owner can change the card design' using errcode = '42501';
 end if;
 return new;
end $$;
create trigger enforce_card_design_owner before update on public.businesses
for each row execute function public.enforce_card_design_owner();
revoke all on function public.enforce_card_design_owner() from public, anon, authenticated;
-- The immutable validator runs in client CHECK constraints, so it needs EXECUTE.
grant execute on function public.valid_card_design(jsonb, uuid) to authenticated;

-- Realtime updates are RLS-filtered. The resume refresh also covers offline clients.
do $$ begin
 if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
 and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'businesses')
 then alter publication supabase_realtime add table public.businesses; end if;
end $$;
