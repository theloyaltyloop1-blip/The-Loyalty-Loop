import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

import {
  DEFAULT_WHIRL_SETTINGS,
  WHIRL_SETTINGS_KEY,
  createMemoryStorage,
  createDelayedVisibility,
  parseWhirlSettings,
  type WhirlSettings,
  type WhirlStorage,
  type WhirlVariant,
} from '../core'

interface Ctx {
  isDark: boolean
  storage: WhirlStorage
  settings: WhirlSettings
  ready: boolean
  setShowWhirl: (on: boolean) => void
}

const fallbackStorage = createMemoryStorage()
const defaultCtx: Ctx = { isDark: false, storage: fallbackStorage, settings: DEFAULT_WHIRL_SETTINGS, ready: true, setShowWhirl: () => {} }
const WhirlCtx = createContext<Ctx>(defaultCtx)

/**
 * Mount once near the app root. `isDark` is the app theme (shopper: useTheme().isDark); `storage` remembers the
 * "Show Whirl" switch and the once-only tips (apps pass an expo-secure-store adapter). Without a provider Whirl uses the
 * light art, the setting defaults to on and nothing is remembered across launches.
 */
export function WhirlProvider({ isDark = false, storage, children }: { isDark?: boolean; storage?: WhirlStorage; children: React.ReactNode }) {
  const store = storage ?? fallbackStorage
  const [settings, setSettings] = useState<WhirlSettings>(DEFAULT_WHIRL_SETTINGS)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const raw = await store.getItem(WHIRL_SETTINGS_KEY)
        if (alive) setSettings(parseWhirlSettings(raw))
      } catch {
        /* keep defaults */
      } finally {
        if (alive) setReady(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [store])
  const setShowWhirl = useCallback(
    (on: boolean) => {
      const next: WhirlSettings = { showWhirl: on }
      setSettings(next)
      void Promise.resolve(store.setItem(WHIRL_SETTINGS_KEY, JSON.stringify(next))).catch(() => {})
    },
    [store],
  )
  const value = useMemo(() => ({ isDark, storage: store, settings, ready, setShowWhirl }), [isDark, store, settings, ready, setShowWhirl])
  return <WhirlCtx.Provider value={value}>{children}</WhirlCtx.Provider>
}

/** The one place the light/dark choice is made. Reads the theme given to WhirlProvider; light if there is none. */
export function useWhirlVariant(): WhirlVariant {
  return useContext(WhirlCtx).isDark ? 'dark' : 'light'
}

/** Settings > "Show Whirl". `settings.showWhirl === false` turns decorative moments off; loading loops stay. */
export function useWhirlSettings() {
  const c = useContext(WhirlCtx)
  return { settings: c.settings, showWhirl: c.settings.showWhirl, setShowWhirl: c.setShowWhirl, ready: c.ready }
}

export function useWhirlStorage(): WhirlStorage {
  return useContext(WhirlCtx).storage
}

/** True when the OS asks for reduced motion (live: follows the setting while the app is open). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let alive = true
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduce(v)
    })
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduce(v))
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
  return reduce
}

/**
 * `loading` -> `visible`, but only after the wait has lasted about 300 ms, and then for at least 400 ms.
 * Use it where a spinner is conditionally rendered: `const show = useDelayedVisible(loading)`.
 */
export function useDelayedVisible(loading: boolean): boolean {
  const [visible, setVisible] = useState(false)
  const gate = useRef<ReturnType<typeof createDelayedVisibility> | null>(null)
  if (gate.current === null) gate.current = createDelayedVisibility(setVisible)
  useEffect(() => {
    gate.current?.update(loading)
  }, [loading])
  useEffect(() => () => gate.current?.dispose(), [])
  return visible
}
