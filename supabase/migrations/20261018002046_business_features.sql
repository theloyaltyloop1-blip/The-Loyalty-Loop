-- Shop features shoppers can filter by (owner decision 2026-10-18): dietary and
-- access tags the owner ticks in Settings. Self-declared by the shop; halal can
-- optionally name a certifier. Additive: existing shops start with no features.
-- Keep the allowed list in step with shop-features.ts in each app.

alter table public.businesses
  add column features text[] not null default '{}',
  add column halal_certifier text,
  add constraint businesses_features_allowed_check
    check (features <@ array[
      'halal', 'vegetarian', 'vegan', 'gluten_free', 'kids_friendly', 'wheelchair_accessible'
    ]::text[]),
  add constraint businesses_halal_certifier_check
    check (halal_certifier is null or (halal_certifier in ('HMC', 'HFA') and 'halal' = any(features)));

create index businesses_features_gin on public.businesses using gin (features);
