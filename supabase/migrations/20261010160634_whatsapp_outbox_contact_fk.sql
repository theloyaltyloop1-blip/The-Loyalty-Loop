-- The outbox was moved out of whatsapp_archive but its foreign key still pointed at the
-- archived contacts table, so queueing a message for any live contact failed (and the
-- trigger's safety handler swallowed the error). Point it at the live contacts table.
alter table public.whatsapp_outbox drop constraint if exists whatsapp_outbox_phone_e164_fkey;
alter table public.whatsapp_outbox
  add constraint whatsapp_outbox_phone_e164_fkey
  foreign key (phone_e164) references public.whatsapp_contacts(phone_e164) on delete cascade;
