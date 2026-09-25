-- Expose the table to Supabase's signed-in Data API role. Row-level security
-- remains the authorization boundary; these grants only permit the API to
-- evaluate the RLS policies in 0012.
grant select, insert, update, delete on table public.announcements to authenticated;
