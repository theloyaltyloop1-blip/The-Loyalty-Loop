import { useEffect, useRef } from 'react'
import type { CityOptions } from '@/lib/city-scene'

// The live 3D city, fixed behind the page. three.js is loaded on demand so the page text
// and links paint first. If WebGL is missing or the import fails, `.lp-no-webgl` is set on
// the page root and a plain glow shows instead. The canvas is decorative (aria-hidden).
export function CityScene({ root, ...options }: CityOptions & { root: React.RefObject<HTMLElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { seed, skyline, landmark, mini } = options

  useEffect(() => {
    const host = root.current
    const el = canvas.current
    if (!host || !el) return
    let stop: (() => void) | null = null
    let cancelled = false
    import('@/lib/city-scene')
      .then((m) => {
        if (cancelled) return
        stop = m.startCityScene(el, host, { seed, skyline, landmark, mini })
        if (!stop) host.classList.add('lp-no-webgl')
      })
      .catch(() => host.classList.add('lp-no-webgl'))
    return () => {
      cancelled = true
      stop?.()
      host.classList.remove('lp-no-webgl')
    }
  }, [root, seed, skyline, landmark, mini])

  return (
    <>
      <canvas ref={canvas} className="lp-scene" aria-hidden="true" />
      <div className="lp-scene-fallback" aria-hidden="true" />
      <div className="lp-vignette" aria-hidden="true" />
    </>
  )
}
