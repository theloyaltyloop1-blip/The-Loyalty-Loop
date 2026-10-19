import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TOUR_STOPS, nextStop, remainingOnRoute, tourSeenKey, type TourStop, type TourStopId } from '@/lib/tour-script'

/**
 * Guided tour on the real owner pages: a dimmed overlay with a spotlight cut-out
 * around a real element, one sentence, a Next / Got it button and Skip. Each stop
 * shows the first time the owner reaches that page; seen-state is per shop and
 * per stop in localStorage. Same script as the Business app (lib/tour-script).
 */

const RESTART_EVENT = 'owner-tour-restart'

function readSeen(businessId: string): Set<TourStopId> {
  const seen = new Set<TourStopId>()
  for (const stop of TOUR_STOPS) {
    try { if (localStorage.getItem(tourSeenKey(businessId, stop.id)) === 'true') seen.add(stop.id) } catch { /* private mode */ }
  }
  return seen
}

/** Forget this shop's progress and run the tour again from the start. */
export function restartOwnerTour(businessId: string) {
  for (const stop of TOUR_STOPS) {
    try { localStorage.removeItem(tourSeenKey(businessId, stop.id)) } catch { /* private mode */ }
  }
  window.dispatchEvent(new Event(RESTART_EVENT))
}

function visibleElement(stop: TourStop): Element | null {
  for (const selector of stop.selectors) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  }
  return null
}

const PAD = 8

export function OwnerWalkthrough({ businessId }: { businessId: string }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [seen, setSeen] = React.useState(() => readSeen(businessId))
  const [found, setFound] = React.useState<Set<TourStopId>>(new Set())
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => { setSeen(readSeen(businessId)) }, [businessId])
  React.useEffect(() => {
    const onRestart = () => { setSeen(readSeen(businessId)); navigate('/owner') }
    window.addEventListener(RESTART_EVENT, onRestart)
    return () => window.removeEventListener(RESTART_EVENT, onRestart)
  }, [businessId, navigate])

  const current = nextStop({ pathname, seen, found })
  const currentId = current?.id

  // Find the elements on this page (they may mount a moment after navigation).
  React.useEffect(() => {
    const pending = TOUR_STOPS.filter((s) => s.onRoute(pathname) && !seen.has(s.id))
    if (!pending.length) { setFound((prev) => (prev.size ? new Set() : prev)); return }
    const scan = () => {
      const next = new Set(pending.filter((s) => visibleElement(s)).map((s) => s.id))
      setFound((prev) => (prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next))
    }
    const timer = window.setTimeout(scan, 350)
    const interval = window.setInterval(scan, 700)
    return () => { window.clearTimeout(timer); window.clearInterval(interval) }
  }, [pathname, seen])

  // Keep the spotlight on the element through scroll and resize.
  React.useEffect(() => {
    if (!current) { setRect(null); return }
    const el = visibleElement(current)
    if (!el) { setRect(null); return }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    const measure = () => {
      const live = visibleElement(current)
      if (live) setRect(live.getBoundingClientRect())
    }
    measure()
    const interval = window.setInterval(measure, 250)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { window.clearInterval(interval); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  const markSeen = React.useCallback((ids: TourStopId[]) => {
    setSeen((prev) => new Set([...prev, ...ids]))
    for (const id of ids) {
      try { localStorage.setItem(tourSeenKey(businessId, id), 'true') } catch { /* private mode */ }
    }
  }, [businessId])

  const skip = React.useCallback(() => markSeen(TOUR_STOPS.map((s) => s.id)), [markSeen])

  React.useEffect(() => {
    if (!currentId) return
    buttonRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') skip() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentId, skip])

  if (!current || !rect) return null
  const last = remainingOnRoute(pathname, seen, found) <= 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  const hole = { x: rect.left - PAD, y: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
  const cardWidth = Math.min(340, vw - 32)
  const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardWidth / 2), vw - cardWidth - 16)
  const below = rect.top + rect.height / 2 < vh / 2
  const cardStyle: React.CSSProperties = below
    ? { top: Math.min(hole.y + hole.height + 14, vh - 170), left, width: cardWidth }
    : { bottom: Math.max(vh - hole.y + 14, 16), left, width: cardWidth }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Quick tour">
      <style>{`.tour-hole{transition:x .28s ease,y .28s ease,width .28s ease,height .28s ease}@media (prefers-reduced-motion: reduce){.tour-hole{transition:none}}`}</style>
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="#fff" />
            <rect className="tour-hole" {...hole} rx={18} fill="#000" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(12,12,10,0.74)" mask="url(#tour-mask)" />
        <rect className="tour-hole" {...hole} rx={18} fill="none" stroke="#fff" strokeWidth={2} />
      </svg>
      <div className="absolute rounded-3xl bg-white p-5 text-black shadow-2xl" style={cardStyle}>
        <p className="text-lg font-extrabold leading-snug">{current.copy}</p>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={skip} className="min-h-11 pr-4 text-sm font-bold text-black/60">Skip</button>
          <button
            ref={buttonRef}
            type="button"
            data-press-feedback
            onClick={() => markSeen([current.id])}
            className="h-11 rounded-full bg-primary px-7 font-bold text-primary-foreground hover:bg-primary-hover"
          >
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
