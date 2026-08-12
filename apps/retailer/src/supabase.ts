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
