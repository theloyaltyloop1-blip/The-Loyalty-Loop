import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const REMEMBER_FLAG_KEY = 'll-remember-me'
const EXPIRY_SUFFIX = '.expires-at'
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6

/**
 * "Remember me" support. By default the session lives in sessionStorage, so
 * it disappears when the browser/tab closes — that's the unchecked state.
 * When the box is checked (setRememberMe(true), called before sign-in),
 * every write instead goes to localStorage with a rolling 6-month expiry
 * stamped alongside it, checked on every read so a session past its expiry
 * is treated as signed out rather than silently restored.
 */
function isRemembered() {
  return localStorage.getItem(REMEMBER_FLAG_KEY) === '1'
}

export function setRememberMe(remember: boolean) {
  localStorage.setItem(REMEMBER_FLAG_KEY, remember ? '1' : '0')
}

const rememberableStorage = {
  getItem(key: string) {
    const expiresRaw = localStorage.getItem(key + EXPIRY_SUFFIX)
    if (expiresRaw !== null) {
      if (Date.now() > Number(expiresRaw)) {
        localStorage.removeItem(key)
        localStorage.removeItem(key + EXPIRY_SUFFIX)
        return null
      }
      return localStorage.getItem(key)
    }
    return sessionStorage.getItem(key)
  },
  setItem(key: string, value: string) {
    if (isRemembered()) {
      localStorage.setItem(key, value)
      localStorage.setItem(key + EXPIRY_SUFFIX, String(Date.now() + SIX_MONTHS_MS))
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, value)
      localStorage.removeItem(key)
      localStorage.removeItem(key + EXPIRY_SUFFIX)
    }
  },
  removeItem(key: string) {
    localStorage.removeItem(key)
    localStorage.removeItem(key + EXPIRY_SUFFIX)
    sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: rememberableStorage },
})

// Auth emails must always bring people back to the published app, even when
// the account was created from a local development session.
export const AUTH_REDIRECT_URL = 'https://www.the-loyalty-loop.com'

// Read by AuthCallback once the OAuth redirect lands with a session, since
// signInWithOAuth has no equivalent of signUp's `options.data` for passing
// custom signup intent (business_owner vs consumer) through the provider.
export const OAUTH_INTENT_KEY = 'll-oauth-intent'

export async function signInWithGoogle(intent?: 'business_owner') {
  if (intent) localStorage.setItem(OAUTH_INTENT_KEY, intent)
  else localStorage.removeItem(OAUTH_INTENT_KEY)
  setRememberMe(true)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${AUTH_REDIRECT_URL}/auth/callback` },
  })
  if (error) throw error
}
