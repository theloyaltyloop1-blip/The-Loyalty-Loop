import { useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import './poster-fx.css'

// Quiet interactions for the public pages: blocks that rise in once as they
// scroll into view, the sideways "how it works" panels, and a hidden spin of
// the logo. Each one checks reduced motion.
//
// 2026-11-17 unslop pass: the counting preloader, the page-change curtain,
// the magnetic buttons and the mouse-following cursor were removed. They held
// the page back on first visit and on every page change, moved buttons away
// from the pointer, and kept an animation loop running the whole time the
// page was open.

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Public pages open at the top when you move between them. Signed-in tools
 *  keep their scroll position, as before. */
export function PublicScrollReset() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    if (/^\/(dashboard|owner|access|brand|admin)/.test(pathname)) return
    window.scrollTo(0, 0)
  }, [pathname])
  return null
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

/** 0 → 1 as the element scrolls through the viewport; drives the sideways steps. */
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
