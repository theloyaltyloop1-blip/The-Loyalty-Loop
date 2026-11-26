import * as React from 'react'
import { CityScene } from '@/components/city-scene'

// A soft, veiled version of the cream 3D city behind the shopper and Business dashboards.
// Only the page background changes: the tiles, cards and text on top are untouched.
// It is light-theme only (dark mode keeps its plain dark background) and can be switched
// off for pages where the camera or battery matter, such as Scan.
export function AppCityBackground({ host, enabled = true, seed = 3 }: { host: React.RefObject<HTMLElement | null>; enabled?: boolean; seed?: number }) {
  const [dark, setDark] = React.useState(() => document.documentElement.classList.contains('dark'))
  React.useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setDark(el.classList.contains('dark')))
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  if (dark || !enabled) return null
  return <CityScene root={host} seed={seed} skyline="low" mini />
}
