// Platform-free rules for Whirl. No React, no React Native, no DOM: everything here is plain TypeScript so both apps
// and the website share it and it can be unit-tested with `node --test`. The "not annoying" rules live in this file and
// are written up in docs/whirl-usage-rules.md.

/** Timing budget. Anything that animates must stay inside these numbers. */
export const WHIRL_TIMING = {
  /** One full turn of any looping animation (spinner, wave, sway) must take less than this. */
  LOOP_MAX_MS: 1200,
  /** One-shot effects (celebrate, stamp, oops) must finish inside this. */
  ONESHOT_MAX_MS: 1500,
  /** A spinner or bar only appears if the wait lasts longer than this, so quick loads never flicker. */
  SPINNER_DELAY_MS: 300,
  /** Once a spinner has appeared it stays at least this long, so it never blinks on and straight off. */
  SPINNER_MIN_VISIBLE_MS: 400,
  /** The spinner turns once per this many ms (four quarter turns). */
  SPIN_TURN_MS: 1100,
  /** Decorative loops stop after this much continuous screen time and rest. */
  LOOP_REST_AFTER_MS: 20000,
} as const

/** Below this size the plain `mini` face is used instead of the full character. */
export const WHIRL_MINI_BELOW = 48

export type WhirlVariant = 'light' | 'dark'
export type WhirlArtKind = 'full' | 'mini'

export function artKindForSize(size: number): WhirlArtKind {
  return size < WHIRL_MINI_BELOW ? 'mini' : 'full'
}

// ---------- settings ----------

export interface WhirlSettings {
  /** "Show Whirl" switch. Off = no decorative Whirl moments; loading indicators (plain loop) stay. */
  showWhirl: boolean
}
export const DEFAULT_WHIRL_SETTINGS: WhirlSettings = { showWhirl: true }
export const WHIRL_SETTINGS_KEY = 'whirl.settings.v1'

export function parseWhirlSettings(raw: string | null | undefined): WhirlSettings {
  if (!raw) return { ...DEFAULT_WHIRL_SETTINGS }
  try {
    const v = JSON.parse(raw) as Partial<WhirlSettings> | null
    return { showWhirl: typeof v?.showWhirl === 'boolean' ? v.showWhirl : DEFAULT_WHIRL_SETTINGS.showWhirl }
  } catch {
    return { ...DEFAULT_WHIRL_SETTINGS }
  }
}

// ---------- motion ----------

export interface MotionInput {
  reduceMotion: boolean
}

/** Loops, blinking, waving and bursts are allowed only when the OS has not asked for reduced motion. */
export function motionAllowed(m: MotionInput): boolean {
  return !m.reduceMotion
}

/** Throws in development if an animation breaks the duration rules. Used by the components' own constants and by tests. */
export function assertDurations(loopMs: number | null, oneShotMs: number | null): void {
  if (loopMs !== null && loopMs >= WHIRL_TIMING.LOOP_MAX_MS) throw new Error(`Whirl loop of ${loopMs} ms is not under ${WHIRL_TIMING.LOOP_MAX_MS} ms`)
  if (oneShotMs !== null && oneShotMs >= WHIRL_TIMING.ONESHOT_MAX_MS) throw new Error(`Whirl one-shot of ${oneShotMs} ms is not under ${WHIRL_TIMING.ONESHOT_MAX_MS} ms`)
}

/** Ease in-out cubic, 0..1. */
export function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/**
 * Spinner angle in degrees for a progress value p (any number, one unit = one full turn).
 * The loop turns in four eased quarter turns, so it reads as the four-part loop "clicking round" and not a grey wheel.
 */
export function spinnerAngle(p: number): number {
  const q = (((p % 1) + 1) % 1) * 4
  const whole = Math.floor(q)
  return 90 * (whole + easeInOut(q - whole))
}

/** Indeterminate bar: position 0..1 of the moving part's left edge for progress p, partWidth is the fraction of the bar it covers. */
export function barSweep(p: number, partWidth = 0.35): number {
  const x = ((p % 1) + 1) % 1
  return -partWidth + easeInOut(x) * (1 + partWidth)
}

// ---------- frequency budget ----------

export type WhirlMomentKind = 'greeting' | 'empty' | 'celebration' | 'tip' | 'error' | 'permission' | 'intro' | 'misc'

/**
 * One decorative (non-loading) Whirl moment per screen. Screens claim a slot with `claim(screenId, momentId)`;
 * the first claim wins and later ones are refused until the screen is released (unmount / navigate away).
 * Loading indicators are never counted: they are not "moments".
 */
export function createFrequencyBudget(maxPerScreen = 1) {
  const used = new Map<string, Set<string>>()
  return {
    claim(screenId: string, momentId: string): boolean {
      const set = used.get(screenId) ?? new Set<string>()
      if (set.has(momentId)) return true // the same moment re-rendering keeps its slot
      if (set.size >= maxPerScreen) return false
      set.add(momentId)
      used.set(screenId, set)
      return true
    },
    release(screenId: string, momentId?: string): void {
      if (!momentId) {
        used.delete(screenId)
        return
      }
      const set = used.get(screenId)
      set?.delete(momentId)
      if (set && set.size === 0) used.delete(screenId)
    },
    count(screenId: string): number {
      return used.get(screenId)?.size ?? 0
    },
  }
}
export type FrequencyBudget = ReturnType<typeof createFrequencyBudget>

/** Shared budget for the whole app/page. */
export const whirlBudget: FrequencyBudget = createFrequencyBudget(1)

// ---------- once-only memory ----------

/** Minimal async-or-sync key/value store: SecureStore in the apps, localStorage on the web, a Map in tests. */
export interface WhirlStorage {
  getItem(key: string): Promise<string | null> | string | null
  setItem(key: string, value: string): Promise<void> | void
}

export function createMemoryStorage(): WhirlStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  }
}

const ONCE_PREFIX = 'whirl.seen.'
const celebrated = new Set<string>()

/** "First-time tips only once ever": true if this tip has never been marked seen. Fails closed (false) if storage throws. */
export async function shouldShowOnce(storage: WhirlStorage, id: string): Promise<boolean> {
  try {
    return (await storage.getItem(ONCE_PREFIX + id)) === null
  } catch {
    return false // can't remember = don't risk nagging
  }
}

export async function markSeen(storage: WhirlStorage, id: string): Promise<void> {
  try {
    await storage.setItem(ONCE_PREFIX + id, new Date().toISOString())
  } catch {
    /* ignore: the in-session guard below still stops repeats this session */
  }
  celebrated.add(id)
}

/** Celebrations: once per event id (reward id, stamp id...), kept for this session only. */
export function shouldCelebrate(eventId: string): boolean {
  if (celebrated.has('celebrate.' + eventId)) return false
  celebrated.add('celebrate.' + eventId)
  return true
}
export function resetWhirlSessionForTests(): void {
  celebrated.clear()
}

// ---------- delayed spinner (no flicker) ----------

export interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
  now(): number
}
export const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
}

/**
 * Tracks `loading` and reports `visible` only if loading lasted longer than `delayMs`, then keeps it visible for at
 * least `minVisibleMs`. `onChange` fires with the new visible value. Call `update(loading)` whenever loading changes
 * and `dispose()` on unmount.
 */
export function createDelayedVisibility(
  onChange: (visible: boolean) => void,
  { delayMs = WHIRL_TIMING.SPINNER_DELAY_MS, minVisibleMs = WHIRL_TIMING.SPINNER_MIN_VISIBLE_MS, timers = realTimers } = {},
) {
  let showTimer: unknown = null
  let hideTimer: unknown = null
  let visible = false
  let shownAt = 0
  const setVisible = (v: boolean) => {
    if (v === visible) return
    visible = v
    if (v) shownAt = timers.now()
    onChange(v)
  }
  return {
    update(loading: boolean) {
      if (loading) {
        if (hideTimer !== null) {
          timers.clear(hideTimer)
          hideTimer = null
        }
        if (!visible && showTimer === null) {
          showTimer = timers.set(() => {
            showTimer = null
            setVisible(true)
          }, delayMs)
        }
        return
      }
      if (showTimer !== null) {
        timers.clear(showTimer)
        showTimer = null
      }
      if (visible && hideTimer === null) {
        const left = Math.max(0, minVisibleMs - (timers.now() - shownAt))
        if (left === 0) setVisible(false)
        else
          hideTimer = timers.set(() => {
            hideTimer = null
            setVisible(false)
          }, left)
      }
    },
    dispose() {
      if (showTimer !== null) timers.clear(showTimer)
      if (hideTimer !== null) timers.clear(hideTimer)
      showTimer = hideTimer = null
    },
    isVisible: () => visible,
  }
}

// ---------- the one decision function ----------

export interface ShowDecisionInput {
  settings: WhirlSettings
  budget?: FrequencyBudget
  screenId: string
  momentId: string
  /** True for the first-time tips that must only ever appear once. Pass the result of shouldShowOnce(). */
  onceOk?: boolean
}

/** Should a decorative Whirl moment appear? Loading indicators do not call this. */
export function decideMoment(i: ShowDecisionInput): boolean {
  if (!i.settings.showWhirl) return false
  if (i.onceOk === false) return false
  return (i.budget ?? whirlBudget).claim(i.screenId, i.momentId)
}
