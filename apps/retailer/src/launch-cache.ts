import Storage from 'expo-sqlite/kv-store'
import { createLaunchCache } from './launch-cache-core'

// Synchronous key-value store (expo-sqlite), already used by both apps for the
// outage cache, so this ships by OTA and reads cost nothing at first paint.
const cache = createLaunchCache({
  get: (key) => Storage.getItemSync(key),
  set: (key, value) => Storage.setItemSync(key, value),
  remove: (key) => Storage.removeItemSync(key),
})

export const readLaunchCache = cache.read
export const writeLaunchCache = cache.write
export const launchCacheTicket = cache.ticket
export const clearLaunchCache = cache.clear
