import type { SupabaseClient } from '@supabase/supabase-js'

let pending: Promise<SupabaseClient> | null = null

/**
 * Loads the Supabase client on first use. Components that run on every page
 * (auth/owner providers, the announcement banner, usage tracking) use this so
 * the ~50 KB client is not on the first-load critical path; lazy routes can
 * keep importing `supabase` directly.
 */
export function loadSupabase(): Promise<SupabaseClient> {
  pending ??= import('./supabase').then((m) => m.supabase)
  return pending
}
