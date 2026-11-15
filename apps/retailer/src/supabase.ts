import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!url || !key) {
  console.warn('Supabase environment variables are missing. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the Expo environment.')
}

const secureStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
}

const browserStorage = {
  getItem: async (name: string) => globalThis.localStorage?.getItem(name) ?? null,
  setItem: async (name: string, value: string) => {
    globalThis.localStorage?.setItem(name, value)
  },
  removeItem: async (name: string) => {
    globalThis.localStorage?.removeItem(name)
  },
}

const storage = Platform.OS === 'web' ? browserStorage : secureStorage

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key', {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
})

export const hasSupabaseConfig = Boolean(url && key)

// Optimistic launch: read the session supabase-js persisted, straight from local
// storage with no network. getSession() can block on a token refresh when the
// access token has expired, which would hold up first paint. The app shows from
// this value and lets getSession() confirm it in the background.
// Default supabase-js storage key: sb-<project-ref>-auth-token.
export async function readStoredSession(): Promise<import('@supabase/supabase-js').Session | null> {
  try {
    if (!hasSupabaseConfig) return null
    const ref = new URL(url).hostname.split('.')[0]
    const raw = await storage.getItem(`sb-${ref}-auth-token`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.access_token || !parsed?.refresh_token || !parsed?.user?.id) return null
    return parsed
  } catch {
    return null
  }
}
