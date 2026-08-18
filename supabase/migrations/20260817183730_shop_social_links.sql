alter table public.businesses
  add column if not exists tiktok text,
  add column if not exists youtube text;
