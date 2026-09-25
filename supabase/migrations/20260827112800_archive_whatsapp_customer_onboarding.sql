-- Pauses the WhatsApp onboarding feature: relocates its (empty) tables and
-- functions into a separate schema rather than dropping anything, so it can
-- be restored later with zero data loss. Source moved to a separate repo
-- (loyalty-loop-whatsapp-wip); see RESTORE.sql there to bring this back.

create schema if not exists whatsapp_archive;

drop trigger if exists zz_queue_whatsapp_transaction_update on public.transactions;

alter table public.whatsapp_contacts set schema whatsapp_archive;
alter table public.whatsapp_conversations set schema whatsapp_archive;
alter table public.whatsapp_handoff_links set schema whatsapp_archive;
alter table public.whatsapp_message_log set schema whatsapp_archive;
alter table public.whatsapp_outbox set schema whatsapp_archive;

alter function public.complete_whatsapp_signup(text) set schema whatsapp_archive;
alter function public.queue_whatsapp_transaction_update() set schema whatsapp_archive;;
