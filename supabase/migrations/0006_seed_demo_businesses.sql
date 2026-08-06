-- Demo seed data so the consumer-loop UI has something real to render
-- against instead of client-side mock arrays. Owned by the platform admin
-- account for now — ownership moves to real owner accounts once the owner
-- onboarding flow (§3) creates businesses through the UI instead of SQL.

insert into public.user_roles (user_id, role)
select id, 'business_owner'::app_role from auth.users where email = 'zahihussain92@gmail.com'
on conflict (user_id, role) do nothing;

do $$
declare
  _owner uuid;
  _biz uuid;
begin
  select id into _owner from auth.users where email = 'zahihussain92@gmail.com';

  insert into public.businesses (owner_id, name, slug, category, description, address, postcode, brand_color, loyalty_config)
  values (_owner, 'Joice Cafe', 'joice-cafe', 'Café', 'Local Cafe in Tooting and Balham', '237 Balham High Road', 'SW17 8RT', '#D98B4A', '{"stamps_required": 10}')
  on conflict (slug) do nothing
  returning id into _biz;

  if _biz is not null then
    insert into public.reward_catalog (business_id, title, description, stamp_threshold)
    values (_biz, 'Free coffee', 'Any size', 10);
  end if;

  insert into public.businesses (owner_id, name, slug, category, description, address, postcode, brand_color, loyalty_config)
  values (_owner, 'The Apple Blue', 'the-apple-blue', 'Café', 'Neighbourhood coffee spot on Balham High Road', '12 Balham High Road', 'SW12 9AA', '#1B3A4B', '{"stamps_required": 10}')
  on conflict (slug) do nothing
  returning id into _biz;

  if _biz is not null then
    insert into public.reward_catalog (business_id, title, description, stamp_threshold)
    values (_biz, 'Free pastry', 'Any item', 10);
  end if;

  insert into public.businesses (owner_id, name, slug, category, description, address, postcode, brand_color, loyalty_config)
  values (_owner, 'Milk Balham', 'milk-balham', 'Restaurant', 'Modern brunch and dinner spot in Balham', '4 Chestnut Grove', 'SW12 8JA', '#D6296B', '{"stamps_required": 8}')
  on conflict (slug) do nothing
  returning id into _biz;

  if _biz is not null then
    insert into public.reward_catalog (business_id, title, description, stamp_threshold)
    values (_biz, 'Free dessert', 'Any dessert', 8);
  end if;

  insert into public.businesses (owner_id, name, slug, category, description, address, postcode, brand_color, loyalty_config)
  values (_owner, 'Subhan', 'subhan', 'Barber', 'Bdid', '18 Tooting High Street', 'SW17 0RJ', '#2F6B73', '{"stamps_required": 10}')
  on conflict (slug) do nothing
  returning id into _biz;

  if _biz is not null then
    insert into public.reward_catalog (business_id, title, description, stamp_threshold)
    values (_biz, 'Free shave', 'Any time', 10);
  end if;
end $$;
