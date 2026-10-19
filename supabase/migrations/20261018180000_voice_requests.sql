-- Owner phone line (voice-call edge function). Service role only: RLS on, no policies.
create table if not exists public.voice_requests (
  id uuid primary key default gen_random_uuid(),
  call_sid text not null unique,
  transcript text not null,
  status text not null default 'new' check (status in ('new', 'picked', 'done', 'rejected')),
  result_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voice_requests enable row level security;
revoke all on public.voice_requests from anon, authenticated;

create index if not exists voice_requests_status_created_idx on public.voice_requests (status, created_at);
