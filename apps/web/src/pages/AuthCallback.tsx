import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

/** Handles Supabase email-confirmation redirects after the browser has stored
 * the session from the confirmation URL. Roles are loaded before routing so a
 * new business owner always reaches the owner onboarding flow. */
export function AuthCallback() {
  const { session, loading, rolesLoading, primaryRole } = useAuth()

  if (loading || rolesLoading) {
    return <main className="grid min-h-screen place-items-center bg-[#F7ECDC] p-6 text-center text-[#1a1a1a]"><div><p className="font-display text-2xl font-extrabold">Finishing your sign-in…</p><p className="mt-2 text-sm text-[#1a1a1a]/55">Just a moment while we prepare your account.</p></div></main>
  }
  if (!session) return <Navigate to="/login" replace />
  if (primaryRole === 'admin') return <Navigate to="/access" replace />
  if (primaryRole === 'brand_head') return <Navigate to="/brand" replace />
  if (primaryRole === 'business_owner') return <Navigate to="/owner" replace />
  if (primaryRole === 'staff') return <Navigate to="/owner/scan" replace />
  return <Navigate to="/dashboard" replace />
}
