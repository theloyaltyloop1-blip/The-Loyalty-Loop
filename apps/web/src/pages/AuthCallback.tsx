import * as React from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const { session, loading, rolesLoading, primaryRole, refreshRoles } = useAuth()
  const [applyingIntent, setApplyingIntent] = React.useState(false)
  const [linkingWhatsApp, setLinkingWhatsApp] = React.useState(false)
  const [whatsAppLinked, setWhatsAppLinked] = React.useState(false)
  const [whatsAppError, setWhatsAppError] = React.useState<string | null>(null)
  const whatsAppToken = searchParams.get('whatsapp_token')

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

  React.useEffect(() => {
    if (!session?.user || !whatsAppToken) return
    setLinkingWhatsApp(true)
    void (async () => {
      try {
        const { error } = await supabase.rpc('complete_whatsapp_signup', { _token: whatsAppToken })
        if (error) setWhatsAppError(error.message)
        else setWhatsAppLinked(true)
      } finally {
        setLinkingWhatsApp(false)
      }
    })()
  }, [session?.user, whatsAppToken])

  if (loading || rolesLoading || applyingIntent || linkingWhatsApp || (!!session?.user && !!whatsAppToken && !whatsAppLinked && !whatsAppError)) {
    return <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground"><div><p className="font-display text-2xl font-extrabold">Finishing your sign-in…</p><p className="mt-2 text-sm text-foreground/55">Just a moment while we prepare your account.</p></div></main>
  }
  if (!session) return <Navigate to="/login" replace />
  if (whatsAppError) return <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground"><div><p className="font-display text-2xl font-extrabold">We could not link WhatsApp</p><p className="mt-2 text-sm text-red-600">{whatsAppError}</p><a className="mt-5 inline-block font-bold text-primary" href="/dashboard">Open your dashboard</a></div></main>
  if (primaryRole === 'admin') return <Navigate to="/access" replace />
  if (primaryRole === 'brand_head') return <Navigate to="/brand" replace />
  if (primaryRole === 'business_owner') return <Navigate to="/owner" replace />
  if (primaryRole === 'staff') return <Navigate to="/owner/scan" replace />
  return <Navigate to="/dashboard" replace />
}
