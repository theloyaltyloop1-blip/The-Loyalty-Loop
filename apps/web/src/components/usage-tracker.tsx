import * as React from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { trackUsageEvent } from '@/lib/usage-analytics'

export function UsageTracker() {
  const { session } = useAuth()
  const location = useLocation()
  const [consentVersion, setConsentVersion] = React.useState(0)

  React.useEffect(() => {
    const refresh = () => setConsentVersion((value) => value + 1)
    window.addEventListener('loyalty-loop-usage-consent', refresh)
    return () => window.removeEventListener('loyalty-loop-usage-consent', refresh)
  }, [])

  React.useEffect(() => {
    if (session?.user) void trackUsageEvent('page_viewed', location.pathname)
  }, [consentVersion, location.pathname, session?.user?.id])

  return null
}
