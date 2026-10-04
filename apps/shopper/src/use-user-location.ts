import { useCallback, useEffect, useRef, useState } from 'react'
import type { Coords } from './distance'

// 'ask' means the system has not asked yet, so we wait for a tap instead of throwing
// a permission dialog at someone who just opened the app. 'unsupported' is an older
// build that does not contain the location module yet.
export type LocationStatus = 'checking' | 'ask' | 'locating' | 'ready' | 'denied' | 'unavailable' | 'unsupported'

type LocationModule = typeof import('expo-location')

// The native module only exists in builds that include expo-location.
// JavaScript also reaches older builds as an over-the-air update, and importing
// the package there would crash at start-up, so it is loaded lazily inside a guard.
let loaded: LocationModule | null | undefined
function loadLocation(): LocationModule | null {
  if (loaded !== undefined) return loaded
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('expo-location') as LocationModule
  } catch {
    loaded = null
  }
  return loaded
}

const FIX_TIMEOUT_MS = 12_000
const LAST_KNOWN_MAX_AGE_MS = 10 * 60_000

// The position stays in memory on the phone. It is never stored or sent anywhere.
export function useUserLocation() {
  const [status, setStatus] = useState<LocationStatus>('checking')
  const [coords, setCoords] = useState<Coords | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const fix = useCallback(async (location: LocationModule) => {
    setStatus('locating')
    try {
      // A recent position makes the list appear in order straight away; the fresh one refines it.
      const recent = await location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })
      if (recent && mounted.current) {
        setCoords({ lat: recent.coords.latitude, lng: recent.coords.longitude })
        setStatus('ready')
      }
      const current = await Promise.race([
        location.getCurrentPositionAsync({ accuracy: location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
      ])
      if (!mounted.current) return
      if (current) {
        setCoords({ lat: current.coords.latitude, lng: current.coords.longitude })
        setStatus('ready')
      } else if (!recent) {
        setStatus('unavailable')
      }
    } catch {
      if (mounted.current) setStatus((now) => (now === 'ready' ? now : 'unavailable'))
    }
  }, [])

  const locate = useCallback(async () => {
    const location = loadLocation()
    if (!location) { setStatus('unsupported'); return }
    try {
      let permission = await location.getForegroundPermissionsAsync()
      if (!permission.granted && permission.canAskAgain) permission = await location.requestForegroundPermissionsAsync()
      if (!mounted.current) return
      if (permission.granted) await fix(location)
      else setStatus('denied')
    } catch {
      if (mounted.current) setStatus('unavailable')
    }
  }, [fix])

  useEffect(() => {
    const location = loadLocation()
    if (!location) { setStatus('unsupported'); return }
    location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (!mounted.current) return
        if (permission.granted) void fix(location)
        else setStatus(permission.canAskAgain ? 'ask' : 'denied')
      })
      .catch(() => { if (mounted.current) setStatus('unavailable') })
  }, [fix])

  return { coords, status, locate }
}
