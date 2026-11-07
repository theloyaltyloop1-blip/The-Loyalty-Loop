// The last home screen that loaded, saved on the phone so the app never opens
// blank when our servers (or the phone's signal) are down. One copy per account.
import Storage from 'expo-sqlite/kv-store'

const PREFIX = 'loyalty-loop:home-cache:v1:'

export type HomeCache = {
  savedAt: number
  businesses: unknown[]
  memberships: unknown[]
  rewards: unknown[]
  announcements: unknown[]
  homeCatalog: unknown[]
  favouriteIds: string[]
  stampCode: string | null
}

export function readHomeCache(userId: string): HomeCache | null {
  try {
    const raw = Storage.getItemSync(PREFIX + userId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as HomeCache
    return Array.isArray(parsed.businesses) && Array.isArray(parsed.memberships) ? parsed : null
  } catch {
    return null
  }
}

export function writeHomeCache(userId: string, cache: Omit<HomeCache, 'savedAt'>): number | null {
  const savedAt = Date.now()
  try {
    Storage.setItemSync(PREFIX + userId, JSON.stringify({ ...cache, savedAt }))
    return savedAt
  } catch {
    return null
  }
}

export function clearHomeCache(userId: string) {
  try {
    Storage.removeItemSync(PREFIX + userId)
  } catch {
    // nothing saved
  }
}
