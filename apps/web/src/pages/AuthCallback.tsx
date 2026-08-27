import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { supabase, OAUTH_INTENT_KEY } from '@/lib/supabase'

/** Handles Supabase email-confirmation AND OAuth (Google) redirects, once the
 * browser has stored the session from the redirect URL. Roles are loaded
 * before routing so a new business owner always reaches the owner onboarding
 * flow. signInWithOAuth has no equivalent of signUp's `options.data`, so a
 * Google sign-up started from the "sign up as a business" page stashes its
 * intent in localStorage beforehand — applied here, then bootstrap is re-run
 * so the business_owner role actually gets granted. */
export function AuthCallback() {
  const { session, loading, rolesLoading, primaryRole, refreshRoles } = useAuth()
  const [applyingIntent, setApplyingIntent] = React.useState(false)

  React.useEffect(() => {
    if (!session?.user) return
    const intent = localStorage.getItem(OAUTH_INTENT_KEY)
    if (!intent) return
    localStorage.removeItem(OAUTH_INTENT_KEY)
    setApplyingIntent(true)
    supabase.auth
      .updateUser({ data: { intent } })
      .then(() => refreshRoles())
      .finally(() => setApplyingIntent(false))
  }, [session?.user, refreshRoles])

  if (loading || rolesLoading || applyingIntent) {
    return <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground"><div><p className="font-display text-2xl font-extrabold">Finishing your sign-in…</p><p className="mt-2 text-sm text-foreground/55">Just a moment while we prepare your account.</p></div></main>
  }
  if (!session) return <Navigate to="/login" replace />
  if (primaryRole === 'admin') return <Navigate to="/access" replace />
  if (primaryRole === 'brand_head') return <Navigate to="/brand" replace />
  if (primaryRole === 'business_owner') return <Navigate to="/owner" replace />
  if (primaryRole === 'staff') return <Navigate to="/owner/scan" replace />
  return <Navigate to="/dashboard" replace />
}
