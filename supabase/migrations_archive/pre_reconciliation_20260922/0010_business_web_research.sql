-- §7 Deep AI Business Report — caches Firecrawl-scraped web context (Google
-- reviews, shop website, etc.) per business so the AI coach can reference it
-- across a chat session without re-scraping on every message.
create table public.business_web_research (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  report text not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.business_web_research enable row level security;

create policy "business_web_research_select_owner_or_admin"
  on public.business_web_research for select
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

-- No client-facing insert/update/delete — only the deep-business-report
-- edge function (service role) writes here.
