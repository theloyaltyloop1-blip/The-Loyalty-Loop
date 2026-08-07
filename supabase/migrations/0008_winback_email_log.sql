-- §3 Win-back emails. See docs/LOYALTY-LOOP-DATA-MODEL.md §9.
create table public.winback_email_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  recipient_email text not null,
  days_inactive integer not null,
  coupon_code text not null,
  subject text not null,
  body_preview text,
  status text not null default 'sent',
  error text,
  sent_at timestamptz not null default now()
);

alter table public.winback_email_log enable row level security;

create policy "winback_email_log_select_owner_or_admin"
  on public.winback_email_log for select
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

-- No client-facing insert/update/delete policy — only the send-winback-emails
-- edge function (service role) writes here.
