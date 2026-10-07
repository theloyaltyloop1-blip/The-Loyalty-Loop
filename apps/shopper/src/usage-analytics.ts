import * as SecureStore from 'expo-secure-store'
import { supabase } from './supabase'

const CONSENT_KEY = 'loyalty-loop-usage-analytics-consent'
const ONBOARDING_KEY = 'loyalty-loop-shopper-onboarding-complete'

export async function getUsageAnalyticsConsent() {
  return (await SecureStore.getItemAsync(CONSENT_KEY)) === 'yes'
}

export async function getOnboardingComplete() {
  return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === 'yes'
}

export async function setUsageAnalyticsConsent(analyticsAllowed: boolean) {
  await SecureStore.setItemAsync(CONSENT_KEY, analyticsAllowed ? 'yes' : 'no')
}

export async function completeOnboarding(analyticsAllowed: boolean) {
  await setUsageAnalyticsConsent(analyticsAllowed)
  await SecureStore.setItemAsync(ONBOARDING_KEY, 'yes')
}

export async function trackUsageEvent(userId: string, eventName: string, context?: string) {
  if (!(await getUsageAnalyticsConsent())) return
  await supabase.from('usage_events').insert({
    user_id: userId,
    surface: 'shopper_app',
    event_name: eventName,
    context: context?.slice(0, 80) || null,
  })
}
