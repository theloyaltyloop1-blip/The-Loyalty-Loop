create table public.owner_legal_document_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  sent_at timestamptz not null default now()
);

alter table public.owner_legal_document_emails enable row level security;
