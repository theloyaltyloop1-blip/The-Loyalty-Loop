import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'

import { Switch } from '@/components/ui/switch'
import { WHIRL_ART, type WhirlPose } from '../../../../../packages/whirl/art.generated'
import {
  WHIRL_SETTINGS_KEY,
  WHIRL_TIMING,
  artKindForSize,
  decideMoment,
  markSeen,
  parseWhirlSettings,
  shouldShowOnce,
  whirlBudget,
  type WhirlSettings,
  type WhirlStorage,
  type WhirlVariant,
} from '../../../../../packages/whirl/core'
import './whirl.css'

export type { WhirlPose }
export type WhirlEffect = 'none' | 'wave' | 'pop' | 'oops' | 'celebrate' | 'stamp' | 'peek'

// ---------- storage + settings (localStorage, shared across tabs and components) ----------

export const localStorageAdapter: WhirlStorage = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v)
    } catch {
      /* private mode: keep going, nothing is remembered */
    }
  },
}

const listeners = new Set<() => void>()
let cached: WhirlSettings | null = null
function readSettings(): WhirlSettings {
  if (cached) return cached
  cached = parseWhirlSettings(localStorageAdapter.getItem(WHIRL_SETTINGS_KEY) as string | null)
  return cached
}
function subscribeSettings(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === WHIRL_SETTINGS_KEY) {
      cached = null
      cb()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

/** "Show Whirl" switch for the website. Off = no decorative Whirl; the loading loop and bar stay. */
export function useWhirlSettings() {
  const settings = useSyncExternalStore(subscribeSettings, readSettings, () => ({ showWhirl: true }))
  const setShowWhirl = useCallback((on: boolean) => {
    cached = { showWhirl: on }
    localStorageAdapter.setItem(WHIRL_SETTINGS_KEY, JSON.stringify(cached))
    listeners.forEach((l) => l())
  }, [])
  return { settings, showWhirl: settings.showWhirl, setShowWhirl }
}

// ---------- variant (light / dark) ----------

function currentVariant(): WhirlVariant {
  if (typeof document === 'undefined') return 'light'
  const el = document.documentElement
  return el.classList.contains('dark') || el.dataset.theme === 'dark' ? 'dark' : 'light'
}

/** The one place the light/dark choice is made on the web: follows the site's `html.dark` switch, light otherwise. */
export function useWhirlVariant(): WhirlVariant {
  const [v, setV] = useState<WhirlVariant>(currentVariant)
  useEffect(() => {
    const obs = new MutationObserver(() => setV(currentVariant()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    setV(currentVariant())
    return () => obs.disconnect()
  }, [])
  return v
}

// ---------- Whirl ----------

export interface WhirlProps {
  pose: WhirlPose
  /** Width in px. Below 48 the plain mini face is used. */
  size?: number
  /** One-shot animation on appearance (CSS, skipped automatically with prefers-reduced-motion). Change `playKey` to replay. */
  effect?: WhirlEffect
  playKey?: string | number
  /** Alt text. Leave out when Whirl is decoration: he is then aria-hidden. */
  label?: string
  /** Hidden when "Show Whirl" is off. Pass false only for things that carry meaning. */
  decorative?: boolean
  /** Force the light or dark art. Default: follows the site's html.dark switch. */
  variant?: WhirlVariant
  className?: string
  style?: CSSProperties
}

export function Whirl({ pose, size = 96, effect = 'none', playKey, label, decorative = true, variant: forced, className, style }: WhirlProps) {
  const themeVariant = useWhirlVariant()
  const variant = forced ?? themeVariant
  const { showWhirl } = useWhirlSettings()
  const art = WHIRL_ART[variant][artKindForSize(size)][pose]
  const [x, y, vw, vh] = art.vb
  const h = Math.round((size * vh) / vw)
  const inner = useMemo(
    () =>
      art.layers
        .map((l) => {
          const origin = l.pivot ? ` style="transform-origin:${l.pivot[0]}px ${l.pivot[1]}px"` : ''
          return `<g class="whirl-layer whirl-${l.id}"${origin}>${l.svg}</g>`
        })
        .join(''),
    [art],
  )
  if (decorative && !showWhirl) return null
  return (
    <svg
      key={playKey}
      className={['whirl-svg', className].filter(Boolean).join(' ')}
      style={style}
      width={size}
      height={h}
      viewBox={`${x} ${y} ${vw} ${vh}`}
      data-whirl-effect={effect}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <g className="whirl-group" dangerouslySetInnerHTML={{ __html: inner }} />
    </svg>
  )
}

// ---------- loading ----------

/** Loading spinner: the loop mark turning in four eased quarter turns (1.1 s per turn), hidden for the first 300 ms. */
export function WhirlSpinner({ size = 32, delayMs = WHIRL_TIMING.SPINNER_DELAY_MS, label = 'Loading', color, className }: { size?: number; delayMs?: number; label?: string; color?: string; className?: string }) {
  const variant = useWhirlVariant()
  const blades = WHIRL_ART[variant].blades
  return (
    <span className={['whirl-spinner', className].filter(Boolean).join(' ')} style={{ ['--whirl-delay' as string]: `${delayMs}ms`, width: size, height: size }} role="progressbar" aria-label={label} aria-busy="true">
      <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false">
        {blades.map((b, i) => (
          <path key={i} d={b.d} fill={color ?? b.fill} fillOpacity={color ? [1, 0.72, 0.5, 0.72][i] : 1} />
        ))}
      </svg>
    </span>
  )
}

/** Loading bar for uploads and slow reports. Give `progress` (0..1) for a percentage, or leave it out for a sweep. */
export function WhirlProgress({ progress, height = 10, label = 'Loading', withWhirl = true, className }: { progress?: number; height?: number; label?: string; withWhirl?: boolean; className?: string }) {
  const variant = useWhirlVariant()
  const { showWhirl } = useWhirlSettings()
  const cols = WHIRL_ART[variant].blades.map((b) => b.fill)
  const determinate = typeof progress === 'number'
  const pct = determinate ? Math.min(1, Math.max(0, progress)) : 0
  const band = (
    <div className="whirl-bar">
      {cols.map((c, i) => (
        <i key={i} style={{ background: c }} />
      ))}
    </div>
  )
  const face = showWhirl && withWhirl && determinate && pct > 0.04
  return (
    <div className={className} style={{ position: 'relative', paddingTop: face ? 0 : 0 }} role="progressbar" aria-label={label} aria-busy="true" aria-valuemin={determinate ? 0 : undefined} aria-valuemax={determinate ? 100 : undefined} aria-valuenow={determinate ? Math.round(pct * 100) : undefined}>
      <div className="whirl-track" style={{ height }}>
        {determinate ? (
          <div className="whirl-bar-fill" style={{ width: `${pct * 100}%` }}>
            {band}
          </div>
        ) : (
          <div className="whirl-bar-sweep">{band}</div>
        )}
      </div>
      {face ? <Whirl pose="wave" size={28} style={{ position: 'absolute', top: -9, left: `calc(${pct * 100}% - 22px)` }} /> : null}
    </div>
  )
}

export function WhirlSkeletonBlock({ width = '100%', height, radius = 14, className }: { width?: number | string; height: number; radius?: number; className?: string }) {
  return <div className={['whirl-skel', className].filter(Boolean).join(' ')} style={{ width, height, borderRadius: radius }} />
}

/** Warm placeholder cards that breathe while a page loads; a tiny Whirl peeks in after 2.5 s (once per page, only if allowed). */
export function WhirlSkeleton({ cards = 3, cardHeight = 120, label = 'Loading', screenId = 'skeleton' }: { cards?: number; cardHeight?: number; label?: string; screenId?: string }) {
  const { showWhirl } = useWhirlSettings()
  const [granted, setGranted] = useState(false)
  useEffect(() => {
    if (!showWhirl) return
    const id = window.setTimeout(() => setGranted(whirlBudget.claim(screenId, 'skeleton-whirl')), 2500)
    return () => {
      window.clearTimeout(id)
      whirlBudget.release(screenId, 'skeleton-whirl')
    }
  }, [showWhirl, screenId])
  return (
    <div role="status" aria-label={label} aria-busy="true" style={{ display: 'grid', gap: 14, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'grid', gap: 10, flex: 1 }}>
          <WhirlSkeletonBlock width="55%" height={28} radius={10} />
          <WhirlSkeletonBlock width="35%" height={14} radius={7} />
        </div>
        {granted ? <Whirl pose="sleepy" size={40} effect="pop" /> : null}
      </div>
      {Array.from({ length: cards }, (_, i) => (
        <WhirlSkeletonBlock key={i} height={cardHeight} radius={22} />
      ))}
    </div>
  )
}

// ---------- moments ----------

export interface WhirlMomentProps {
  screenId: string
  momentId: string
  pose: WhirlPose
  line: string
  subline?: string
  /** First-time tip: shown once ever, remembered the moment it appears. */
  once?: boolean
  dismissible?: boolean
  size?: number
  effect?: WhirlEffect
  layout?: 'row' | 'stack'
  onDismiss?: () => void
  className?: string
  children?: ReactNode
}

/** Pose plus a line. Hidden if "Show Whirl" is off, one per screen, `once` tips never repeat, never modal, dismissible on request. */
export function WhirlMoment({ screenId, momentId, pose, line, subline, once = false, dismissible, size = 72, effect = 'pop', layout = 'row', onDismiss, className, children }: WhirlMomentProps) {
  const { settings } = useWhirlSettings()
  const [visible, setVisible] = useState(false)
  const canDismiss = dismissible ?? once
  useEffect(() => {
    let alive = true
    void (async () => {
      const onceOk = once ? await shouldShowOnce(localStorageAdapter, momentId) : true
      if (!alive) return
      if (!decideMoment({ settings, screenId, momentId, onceOk })) {
        setVisible(false)
        return
      }
      setVisible(true)
      if (once) void markSeen(localStorageAdapter, momentId)
    })()
    return () => {
      alive = false
      whirlBudget.release(screenId, momentId)
    }
  }, [settings.showWhirl, screenId, momentId, once])
  if (!visible) return null
  const stack = layout === 'stack'
  return (
    <div className={['whirl-moment', className].filter(Boolean).join(' ')} style={{ position: 'relative', display: 'flex', flexDirection: stack ? 'column' : 'row', alignItems: 'center', gap: stack ? 10 : 12, textAlign: stack ? 'center' : 'left' }}>
      <Whirl pose={pose} size={size} effect={effect} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{line}</p>
        {subline ? <p style={{ margin: '2px 0 0', opacity: 0.72 }}>{subline}</p> : null}
        {children}
      </div>
      {canDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setVisible(false)
            whirlBudget.release(screenId, momentId)
            onDismiss?.()
          }}
          style={{ position: 'absolute', top: 0, right: 0, padding: 6, background: 'none', border: 0, cursor: 'pointer', color: 'inherit', opacity: 0.7 }}
        >
          ✕
        </button>
      ) : null}
    </div>
  )
}

/** Shows Whirl, or `fallback` (the old icon) when "Show Whirl" is off. */
export function WhirlOrIcon({ fallback, ...props }: WhirlProps & { fallback: ReactNode }) {
  const { showWhirl } = useWhirlSettings()
  return showWhirl ? <Whirl {...props} /> : <>{fallback}</>
}

/** A tiny Whirl that peeks in only if a page is still loading after 2.5 s (once per page, only if allowed). */
export function SlowLoadWhirl({ screenId = 'page-loading' }: { screenId?: string }) {
  const { showWhirl } = useWhirlSettings()
  const [granted, setGranted] = useState(false)
  useEffect(() => {
    if (!showWhirl) return
    const id = window.setTimeout(() => setGranted(whirlBudget.claim(screenId, 'slow-load')), 2500)
    return () => {
      window.clearTimeout(id)
      whirlBudget.release(screenId, 'slow-load')
    }
  }, [showWhirl, screenId])
  return granted ? <Whirl pose="sleepy" size={44} effect="pop" className="mx-auto mt-2" /> : null
}

/** The "Show Whirl" switch for Settings pages. */
export function WhirlSwitch({ className }: { className?: string }) {
  const { showWhirl, setShowWhirl } = useWhirlSettings()
  return (
    <label className={['flex min-h-11 cursor-pointer items-center justify-between gap-4', className].filter(Boolean).join(' ')}>
      <span>
        <span className="block font-semibold">Show Whirl</span>
        <span className="block text-sm text-muted-foreground">Our mascot on welcome screens, empty pages and tips. Loading spinners stay.</span>
      </span>
      <Switch checked={showWhirl} onCheckedChange={setShowWhirl} aria-label="Show Whirl" />
    </label>
  )
}
