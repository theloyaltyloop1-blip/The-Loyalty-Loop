import { supabase } from '@/lib/supabase'

const CONSENT_KEY = 'loyalty-loop-cookie-choice'

export function hasUsageAnalyticsConsent() {
  return localStorage.getItem(CONSENT_KEY) === 'all'
}

export async function trackUsageEvent(eventName: string, context?: string) {
  if (!hasUsageAnalyticsConsent()) return
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  await supabase.from('usage_events').insert({
    user_id: data.user.id,
    surface: 'web',
    event_name: eventName,
    context: context?.slice(0, 80) || null,
  })
}
