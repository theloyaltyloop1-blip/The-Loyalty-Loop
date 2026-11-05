import { requireOptionalNativeModule } from 'expo-modules-core'
import * as Crypto from 'expo-crypto'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { milesBetween, type Coords } from './distance'
import { supabase } from './supabase'

// Walk-past alerts (opt-in). The phone watches the nearest shops that have a
// walk-past offer with geofences. Entering one asks the server whether to
// alert; the server applies every limit (once a day, once a month per shop,
// open hours, not already a member). The shop list and the position stay on
// the phone; the server only hears "I'm at shop X" when a geofence fires.
//
// Geofences fire while the phone is locked, when the sign-in in SecureStore
// may not be readable, so the phone keeps its own random device key
// (readable after first unlock) and calls the API with the public key only.
//
// expo-task-manager is only in store builds from 1.0.3 on. JavaScript also
// reaches older builds over the air, and a require() of a missing native
// module crashes the app (see ota-gotchas), so check the native modules first.

export const WALK_PAST_TASK = 'walk-past-geofence'
const TOKEN_KEY = 'walkPastDeviceKey'
const SHOP_RADIUS_M = 120
const MOVE_RADIUS_M = 1500
const MAX_SHOPS = 18 // iOS watches at most 20 regions per app; one is the "you moved" ring
const MOVE_ID = 'move'
const SHOP_PREFIX = 'shop:'
const keyOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

type LocationModule = typeof import('expo-location')
type TaskManagerModule = typeof import('expo-task-manager')
let modules: { location: LocationModule; tasks: TaskManagerModule } | null | undefined

function load() {
  if (modules !== undefined) return modules
  if (Platform.OS === 'web' || !requireOptionalNativeModule('ExpoLocation') || !requireOptionalNativeModule('ExpoTaskManager')) {
    modules = null
    return modules
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modules = { location: require('expo-location') as LocationModule, tasks: require('expo-task-manager') as TaskManagerModule }
  } catch {
    modules = null
  }
  return modules
}

export function walkPastSupported() {
  return load() !== null
}

async function rest(path: string, init?: RequestInit) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`walk-past ${res.status}`)
  return res.json()
}

type OfferShop = { id: string; lat: number | null; lng: number | null }

// Re-points the geofences at the offer shops nearest to `here`.
async function watchAround(here: Coords) {
  const m = load()
  if (!m) return
  const shops = (await rest('businesses?select=id,lat,lng&is_active=eq.true&approval_status=eq.approved&nearby_offer=not.is.null')) as OfferShop[]
  const nearest = shops
    .filter((shop): shop is { id: string; lat: number; lng: number } =>
      typeof shop.lat === 'number' && typeof shop.lng === 'number' && !(shop.lat === 0 && shop.lng === 0))
    .map((shop) => ({ shop, miles: milesBetween(here, shop) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, MAX_SHOPS)
  await m.location.startGeofencingAsync(WALK_PAST_TASK, [
    { identifier: MOVE_ID, latitude: here.lat, longitude: here.lng, radius: MOVE_RADIUS_M, notifyOnEnter: false, notifyOnExit: true },
    ...nearest.map(({ shop }) => ({
      identifier: SHOP_PREFIX + shop.id, latitude: shop.lat, longitude: shop.lng, radius: SHOP_RADIUS_M, notifyOnEnter: true, notifyOnExit: false,
    })),
  ])
}

async function currentCoords(): Promise<Coords | null> {
  const m = load()
  if (!m) return null
  const last = await m.location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })
  const fix = last ?? await m.location.getCurrentPositionAsync({ accuracy: m.location.Accuracy.Balanced })
  return fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude } : null
}

async function walkedPast(businessId: string) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY, keyOptions)
  if (!token) return
  const result = await rest('rpc/nearby_walk_past', {
    method: 'POST',
    body: JSON.stringify({ _token: token, _business_id: businessId }),
  }) as { notify?: boolean; title?: string; body?: string }
  if (!result?.notify || !result.title || !result.body) return
  await Notifications.scheduleNotificationAsync({
    content: { title: result.title, body: result.body, data: { businessId, kind: 'walk_past' } },
    trigger: null,
  })
}

// Must run at app start-up (index.ts), before React, so the OS can wake the
// app in the background and find the task.
export function defineWalkPastTask() {
  const m = load()
  if (!m) return
  m.tasks.defineTask(WALK_PAST_TASK, async ({ data, error }) => {
    if (error) return
    const { eventType, region } = (data ?? {}) as { eventType?: number; region?: { identifier?: string } }
    const id = region?.identifier ?? ''
    try {
      if (eventType === m.location.GeofencingEventType.Enter && id.startsWith(SHOP_PREFIX)) {
        await walkedPast(id.slice(SHOP_PREFIX.length))
      } else if (eventType === m.location.GeofencingEventType.Exit && id === MOVE_ID) {
        const here = await currentCoords()
        if (here) await watchAround(here)
      }
    } catch {
      // Background work must never throw; the next geofence event tries again.
    }
  })
}

export type WalkPastResult = 'on' | 'needs_always' | 'needs_notifications' | 'unsupported' | 'failed'

export async function enableWalkPast(): Promise<WalkPastResult> {
  const m = load()
  if (!m) return 'unsupported'
  const fg = await m.location.requestForegroundPermissionsAsync()
  if (!fg.granted) return 'needs_always'
  const bg = await m.location.requestBackgroundPermissionsAsync()
  if (!bg.granted) return 'needs_always'
  const notes = await Notifications.getPermissionsAsync()
  const allowed = notes.granted ? notes : await Notifications.requestPermissionsAsync()
  if (!allowed.granted) return 'needs_notifications'
  try {
    let token = await SecureStore.getItemAsync(TOKEN_KEY, keyOptions)
    if (!token) {
      token = Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('')
      await SecureStore.setItemAsync(TOKEN_KEY, token, keyOptions)
    }
    const { error } = await supabase.rpc('nearby_alerts_enable', { _token: token, _platform: Platform.OS })
    if (error) throw error
    const here = await currentCoords()
    if (here) await watchAround(here)
    return 'on'
  } catch {
    return 'failed'
  }
}

export async function disableWalkPast() {
  const m = load()
  if (m && await m.location.hasStartedGeofencingAsync(WALK_PAST_TASK).catch(() => false)) {
    await m.location.stopGeofencingAsync(WALK_PAST_TASK).catch(() => {})
  }
  await supabase.rpc('nearby_alerts_disable')
  await SecureStore.deleteItemAsync(TOKEN_KEY, keyOptions).catch(() => {})
}

export async function walkPastEnabled() {
  const m = load()
  if (!m) return false
  const token = await SecureStore.getItemAsync(TOKEN_KEY, keyOptions).catch(() => null)
  return Boolean(token) && await m.location.hasStartedGeofencingAsync(WALK_PAST_TASK).catch(() => false)
}

// On app open: refresh the watched shops around where the person is now, in
// case shops added offers since. Does nothing unless walk-past is on.
export async function refreshWalkPast() {
  try {
    if (!(await walkPastEnabled())) return
    const m = load()
    const bg = await m?.location.getBackgroundPermissionsAsync()
    if (!bg?.granted) return
    const here = await currentCoords()
    if (here) await watchAround(here)
  } catch {
    // best effort
  }
}
