import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import * as QueryParams from 'expo-auth-session/build/QueryParams'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Required once at module load so the in-app browser session resolves back
// to the app correctly when the OAuth redirect lands.
WebBrowser.maybeCompleteAuthSession()

/**
 * Opens Google's OAuth consent screen in an in-app browser, then exchanges
 * the returned tokens for a Supabase session. Mirrors Supabase's documented
 * Expo pattern: signInWithOAuth with skipBrowserRedirect gives us the
 * provider URL to open ourselves, and the redirect back to our custom
 * scheme carries the session tokens in the URL for setSession to pick up.
 */
export async function signInWithGoogle(): Promise<Session | null> {
  const redirectTo = makeRedirectUri({ scheme: 'loyaltyloop', path: 'auth/callback' })

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error) throw error
  if (!data.url) throw new Error('Could not start Google sign-in.')

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  if (result.type !== 'success' || !result.url) return null

  const { params, errorCode } = QueryParams.getQueryParams(result.url)
  if (errorCode) throw new Error(errorCode)

  const { access_token, refresh_token } = params
  if (!access_token || !refresh_token) return null

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  })
  if (sessionError) throw sessionError
  return sessionData.session
}
