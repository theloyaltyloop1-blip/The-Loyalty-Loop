import { useEffect, type RefObject } from 'react'

// Page motion for the public pages (from the living-3d-site kit): smooth scrolling (Lenis),
// the headline lines rising on load (GSAP), the dark veil that grows over the city as you
// scroll, and a nav that tucks away while scrolling down. All of it is skipped when the
// visitor asks for reduced motion; the veil and nav still work because they are plain CSS state.

type LenisLike = { scrollTo: (target: HTMLElement, opts?: { offset?: number }) => void; destroy: () => void; raf: (t: number) => void }
let activeLenis: LenisLike | null = null

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Scrolls to a section. Uses Lenis when it is running so the two do not fight. */
export function scrollToSection(target: HTMLElement) {
  if (activeLenis) activeLenis.scrollTo(target, { offset: 0 })
  else target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
}

export function useLivingMotion(root: RefObject<HTMLElement | null>, mini = false) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const nav = el.querySelector<HTMLElement>('.lp-nav')
    const veilMax = mini ? 0.78 : 0.78
    const veilBase = 0.45 // the city is already softened behind the hero text

    const setVeil = () => el.style.setProperty('--lp-veil', (veilBase + Math.min(1, window.scrollY / (window.innerHeight * 0.8)) * (veilMax - veilBase)).toFixed(3))
    setVeil()
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setVeil()
      nav?.classList.toggle('is-hidden', y > lastY && y > 300)
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    let cancelled = false
    let cleanup: (() => void) | null = null
    if (!reduced()) {
      void Promise.all([import('gsap'), import('lenis')]).then(([gsapMod, lenisMod]) => {
        if (cancelled) return
        const gsap = gsapMod.gsap
        const Lenis = lenisMod.default
        const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 })
        activeLenis = lenis
        const tick = (t: number) => lenis.raf(t * 1000)
        gsap.ticker.add(tick)
        gsap.ticker.lagSmoothing(0)
        const lines = el.querySelectorAll('.lp-line > span')
        if (lines.length) gsap.from(lines, { yPercent: 115, rotate: 2, duration: 1.4, ease: 'expo.out', stagger: 0.09, delay: 0.2 })
        cleanup = () => {
          gsap.ticker.remove(tick)
          gsap.killTweensOf(lines)
          lenis.destroy()
          if (activeLenis === lenis) activeLenis = null
        }
      })
    }

    return () => {
      cancelled = true
      window.removeEventListener('scroll', onScroll)
      cleanup?.()
    }
  }, [root, mini])
}
