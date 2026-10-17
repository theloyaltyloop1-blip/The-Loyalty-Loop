import * as SecureStore from 'expo-secure-store'
import { supabase } from './supabase'
import { createCardCache } from './external-card-cache'
export type { Card } from './external-card-cache'
export const externalCardCache = createCardCache(SecureStore)

// Clear on explicit, expired-session and account-deletion sign-outs, including
// sign-outs initiated outside the wallet. No card payload enters analytics.
let owner: string | null = null
let cleanup: Promise<unknown> = Promise.resolve()
supabase.auth.onAuthStateChange((event, session) => {
  const previous = owner
  owner = session?.user.id ?? null
  if (previous && (event === 'SIGNED_OUT' || previous !== owner)) void externalCardCache.clear(previous).catch(() => undefined)
  if (owner) externalCardCache.activate(owner)
  // Remember the last cache owner across process restarts, including an expired
  // session that starts the app already signed out. Never store card data here.
  const current = owner
  cleanup = cleanup.catch(() => undefined).then(async () => {
    const saved = await SecureStore.getItemAsync('external-cards-owner')
    if (saved && saved !== current) await externalCardCache.clear(saved)
    if (current) await SecureStore.setItemAsync('external-cards-owner', current)
    else await SecureStore.deleteItemAsync('external-cards-owner')
    if (current && current === owner) externalCardCache.activate(current)
  }).catch(() => undefined)
})
