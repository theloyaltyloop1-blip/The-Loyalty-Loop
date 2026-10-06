import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'

const CONSENT_KEY = 'loyalty-loop-cookie-choice'
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com'

let started = false

export function hasUsageAnalyticsConsent() {
  return localStorage.getItem(CONSENT_KEY) === 'all'
}

function start() {
  if (started || !POSTHOG_KEY) return
  started = true
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Nothing is captured until the user accepts optional storage.
    opt_out_capturing_by_default: true,
    // Page views are captured per route by UsageTracker.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true,
    person_profiles: 'identified_only',
  })
}

/** Syncs PostHog with the cookie choice. Safe to call repeatedly. */
export function syncUsageAnalyticsConsent() {
  start()
  if (!started) return
  if (hasUsageAnalyticsConsent()) {
    posthog.opt_in_capturing({ captureEventName: false })
  } else {
    posthog.opt_out_capturing()
    posthog.reset()
  }
}

/** Ties events to the Supabase user id only. Never pass an email or name. */
export function identifyUsageUser(userId: string | null) {
  if (!started || !hasUsageAnalyticsConsent()) return
  if (userId) posthog.identify(userId)
  else posthog.reset()
}

export async function trackUsageEvent(eventName: string, context?: string) {
  if (!hasUsageAnalyticsConsent()) return
  start()
  if (!started) return
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  posthog.capture(eventName, context ? { context: context.slice(0, 80) } : undefined)
}
