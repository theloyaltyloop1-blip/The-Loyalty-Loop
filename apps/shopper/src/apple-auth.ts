import * as AppleAuthentication from 'expo-apple-authentication'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import * as QueryParams from 'expo-auth-session/build/QueryParams'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * Native Sign in with Apple, iOS only. Apple's system sheet returns a signed
 * identity token directly — no browser redirect involved, unlike the Google
 * flow. Supabase's native (non-OAuth) Apple provider only needs this app's
 * bundle ID added to its "Client IDs" allow-list; no Services ID or nonce
 * handling is required for this on-device flow.
 */
export async function signInWithApple(): Promise<Session | null> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  })

  if (!credential.identityToken) throw new Error('Apple did not return an identity token.')

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  })
  if (error) throw error

  // Apple only ever sends the full name on the very first sign-in for a
  // given user — capture it now, since there's no second chance to ask.
  if (credential.fullName?.givenName) {
    const fullName = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
    await supabase.auth.updateUser({ data: { first_name: credential.fullName.givenName, full_name: fullName } })
  }

  return data.session
}

/**
 * Sign in with Apple on Android, via the web OAuth flow — Apple's native
 * on-device sign-in doesn't exist outside iOS, so this is the only way to
 * offer it there. Mirrors the Google sign-in pattern exactly (in-app
 * browser session, redirect carries the tokens). This uses the Services ID
 * ("com.theloyaltyloop.shopper.signin") registered in Apple Developer
 * Portal for web authentication — a separate identifier from the app's
 * bundle ID used by the native flow above, both listed in Supabase's Apple
 * provider "Client IDs".
 */
export async function signInWithAppleWeb(): Promise<Session | null> {
  const redirectTo = makeRedirectUri({ scheme: 'loyaltyloop', path: 'auth/callback' })

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error) throw error
  if (!data.url) throw new Error('Could not start Apple sign-in.')

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
