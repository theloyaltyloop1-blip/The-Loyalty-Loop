import * as React from 'react'
import type { Coords } from './distance'

// 'ask' means the browser hasn't been asked yet, so we wait for a tap instead of
// throwing a permission prompt at someone who just opened the page.
export type LocationStatus = 'checking' | 'ask' | 'locating' | 'ready' | 'denied' | 'unavailable' | 'unsupported'

const OPTIONS: PositionOptions = { enableHighAccuracy: false, maximumAge: 10 * 60_000, timeout: 10_000 }

// The position stays in this tab's memory. It is never stored or sent anywhere.
export function useUserLocation() {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const [status, setStatus] = React.useState<LocationStatus>(supported ? 'checking' : 'unsupported')
  const [coords, setCoords] = React.useState<Coords | null>(null)
  const mounted = React.useRef(true)

  React.useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const locate = React.useCallback(() => {
    if (!supported) return
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) return
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude })
        setStatus('ready')
      },
      (error) => {
        if (mounted.current) setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      OPTIONS,
    )
  }, [supported])

  React.useEffect(() => {
    if (!supported) return
    if (!navigator.permissions?.query) {
      setStatus('ask')
      return
    }
    navigator.permissions.query({ name: 'geolocation' })
      .then((result) => {
        if (!mounted.current) return
        if (result.state === 'granted') locate()
        else setStatus(result.state === 'denied' ? 'denied' : 'ask')
      })
      .catch(() => { if (mounted.current) setStatus('ask') })
  }, [supported, locate])

  return { coords, status, locate }
}
