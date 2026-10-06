import * as SecureStore from 'expo-secure-store'
import PostHog from 'posthog-react-native'

const CONSENT_KEY = 'loyalty-loop-usage-analytics-consent'
const ONBOARDING_KEY = 'loyalty-loop-business-onboarding-complete'
const SURFACE = 'business_app'

// The PostHog project key is a public, write-only key designed to ship inside apps.
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || 'phc_AwPnh6a55XDSd9vQTxDxxWw9RZjhkMCvS8dpdjhMhmGo'
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

let client: PostHog | null = null
let identifiedUserId: string | null = null

function getClient() {
  if (client) return client
  try {
    client = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      // Nothing is sent until the user opts in; opt-in is mirrored from the consent switch below.
      defaultOptIn: false,
      // Pure in-memory: no native storage module is needed, so this works in already-installed builds.
      persistence: 'memory',
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      preloadFeatureFlags: false,
      flushAt: 5,
    })
    client.register({ surface: SURFACE })
  } catch {
    client = null
  }
  return client
}

function applyConsent(allowed: boolean) {
  const ph = getClient()
  if (!ph) return
  try {
    if (allowed) {
      void ph.optIn()
    } else {
      void ph.optOut()
      ph.reset()
      identifiedUserId = null
    }
  } catch {
    // Analytics must never break the app.
  }
}

export async function getUsageAnalyticsConsent() {
  return (await SecureStore.getItemAsync(CONSENT_KEY)) === 'yes'
}

export async function getOnboardingComplete() {
  return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === 'yes'
}

export async function setUsageAnalyticsConsent(analyticsAllowed: boolean) {
  await SecureStore.setItemAsync(CONSENT_KEY, analyticsAllowed ? 'yes' : 'no')
  applyConsent(analyticsAllowed)
}

export async function completeOnboarding(analyticsAllowed: boolean) {
  await setUsageAnalyticsConsent(analyticsAllowed)
  await SecureStore.setItemAsync(ONBOARDING_KEY, 'yes')
}

export async function trackUsageEvent(userId: string, eventName: string, context?: string) {
  if (!(await getUsageAnalyticsConsent())) return
  const ph = getClient()
  if (!ph) return
  try {
    // Identify by account id only, never email or name. Opt-in is re-applied because
    // the in-memory client starts opted out on every launch.
    await ph.optIn()
    if (identifiedUserId !== userId) {
      ph.identify(userId)
      identifiedUserId = userId
    }
    ph.capture(eventName, context ? { context: context.slice(0, 80) } : undefined)
  } catch {
    // Analytics must never break the app.
  }
}
