-- WhatsApp onboarding is optional per shop. Enabled shops can print a QR code
-- that carries the shop slug into the WhatsApp START conversation.
alter table public.businesses
  add column if not exists whatsapp_onboarding_enabled boolean not null default false;

comment on column public.businesses.whatsapp_onboarding_enabled is
  'When enabled, the shop poster opens WhatsApp START with this shop attached.';
