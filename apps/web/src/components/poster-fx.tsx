import { useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import './poster-fx.css'

// Premium interactions for the public pages (2026-11-04, quiet version): a
// paper preloader with a hairline progress, a dark curtain between pages, lines
// that rise in, gently magnetic buttons, a cursor that names what a thing does,
// and a hidden spin of the logo. Each one checks reduced motion and, where it
// needs a mouse, a fine pointer.

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

function safeSession(get: true): string | null
function safeSession(get: false, value: string): void
function safeSession(get: boolean, value?: string) {
  try {
    if (get) return window.sessionStorage.getItem('ll-preloaded')
    window.sessionStorage.setItem('ll-preloaded', value ?? '1')
  } catch {
    return get ? '1' : undefined
  }
  return undefined
}

/** Black screen counting 000 → 100, then lifts away. Once per browser session. */
export function Preloader() {
  const [state, setState] = useState<'off' | 'count' | 'lift'>(() => (typeof window === 'undefined' || reducedMotion() || safeSession(true) ? 'off' : 'count'))
  const [n, setN] = useState(0)
  useEffect(() => {
    if (state !== 'count') return
    safeSession(false, '1')
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1300)
      setN(Math.round((1 - Math.pow(1 - t, 3)) * 100))
      if (t < 1) frame = requestAnimationFrame(tick)
      else setState('lift')
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state])
  useEffect(() => {
    if (state !== 'lift') return
    const t = window.setTimeout(() => setState('off'), 1100)
    return () => window.clearTimeout(t)
  }, [state])
  if (state === 'off') return null
  return (
    <div className={`fx-preloader${state === 'lift' ? ' is-lifting' : ''}`} aria-hidden="true">
      <span className="fx-preloader-word">The Loyalty <em>Loop</em></span>
      <span className="fx-preloader-line"><i style={{ transform: `scaleX(${n / 100})` }} /></span>
      <span className="fx-preloader-count">{String(n).padStart(3, '0')}</span>
      <span className="fx-preloader-tag">Local loyalty, London</span>
    </div>
  )
}

/** A yellow panel sweeps off the screen each time the page changes. */
export function PageWipe() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)
  const [key, setKey] = useState(0)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    // Public pages only: signed-in tools change screens too often for a wipe.
    if (reducedMotion() || /^\/(dashboard|owner|access|brand|admin)/.test(pathname)) return
    setKey((k) => k + 1)
    window.scrollTo(0, 0)
  }, [pathname])
  if (!key) return null
  return <div key={key} className="fx-wipe" aria-hidden="true"><span>The Loyalty <em>Loop</em></span></div>
}

/** Adds `is-in` to every `[data-reveal]` inside the ref once it scrolls into view. */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (reducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-in')
        io.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 })
    // Anything already on screen (the hero) staggers in straight away.
    items.forEach((item) => {
      if (item.getBoundingClientRect().top < window.innerHeight) item.classList.add('is-in')
      else io.observe(item)
    })
    return () => io.disconnect()
  }, [root])
}

/** Buttons marked `data-magnetic` lean towards the mouse when it is near. */
export function useMagnetic(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el || reducedMotion() || !finePointer()) return
    const buttons = Array.from(el.querySelectorAll<HTMLElement>('[data-magnetic]'))
    const cleanups = buttons.map((button) => {
      const move = (event: PointerEvent) => {
        const r = button.getBoundingClientRect()
        const x = event.clientX - (r.left + r.width / 2)
        const y = event.clientY - (r.top + r.height / 2)
        button.style.transform = `translate(${x * 0.16}px, ${y * 0.22}px)`
      }
      const leave = () => { button.style.transform = '' }
      button.addEventListener('pointermove', move)
      button.addEventListener('pointerleave', leave)
      return () => { button.removeEventListener('pointermove', move); button.removeEventListener('pointerleave', leave) }
    })
    return () => cleanups.forEach((fn) => fn())
  }, [root])
}

/** A dot that follows the mouse and grows into a label over `[data-cursor="Label"]`. */
export function ContextCursor() {
  const dot = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [enabled] = useState(() => typeof window !== 'undefined' && finePointer() && !reducedMotion())
  useEffect(() => {
    if (!enabled) return
    let x = -100, y = -100, cx = -100, cy = -100, frame = 0
    const move = (event: PointerEvent) => {
      x = event.clientX; y = event.clientY
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-cursor]')
      setLabel(target?.dataset.cursor ?? null)
    }
    const loop = () => {
      cx += (x - cx) * 0.16; cy += (y - cy) * 0.16
      if (dot.current) dot.current.style.transform = `translate(${cx}px, ${cy}px)`
      frame = requestAnimationFrame(loop)
    }
    window.addEventListener('pointermove', move)
    frame = requestAnimationFrame(loop)
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame) }
  }, [enabled])
  if (!enabled) return null
  return (
    <div ref={dot} className={`fx-cursor${label ? ' has-label' : ''}`} aria-hidden="true">
      <span>{label}</span>
    </div>
  )
}

/** Click the target five times quickly: the logo turns once and a small note
 *  appears. Returns a click handler, whether it is turning, and the note. */
export function useEasterEgg() {
  const clicks = useRef<number[]>([])
  const [found, setFound] = useState(0)
  const onClick = () => {
    const now = Date.now()
    clicks.current = [...clicks.current.filter((t) => now - t < 1600), now]
    if (clicks.current.length >= 5) {
      clicks.current = []
      setFound((f) => f + 1)
    }
  }
  useEffect(() => {
    if (!found) return
    const t = window.setTimeout(() => setFound(0), 2800)
    return () => window.clearTimeout(t)
  }, [found])
  const node = found ? <div key={found} className="fx-note" role="status">You found the <em>loop.</em></div> : null
  return { onClick, spinning: found > 0, node }
}

/** 0 → 1 as the element scrolls through the viewport; for parallax and the sideways steps. */
export function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  const [p, setP] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion()) return
    let frame = 0
    const update = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      setP(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame) }
  }, [ref])
  return p
}
