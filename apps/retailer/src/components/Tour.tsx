import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import * as SecureStore from 'expo-secure-store'
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Rect } from 'react-native-svg'

import {
  TOUR_STOPS,
  calloutPlacement,
  nextStop,
  rectIsUsable,
  remainingOnScreen,
  tourCopy,
  tourSeenKey,
  type ProgrammeId,
  type Rect as TourRect,
  type TourScreen,
  type TourStop,
  type TourStopId,
} from '../tour-logic'

/**
 * One-time tips on the real screens (tips, not a tour): a ring around a real
 * element and one sentence beside it. Nothing is dimmed or blocked; the tip
 * counts as seen the moment it appears, and goes when tapped, after a few
 * seconds, or when the owner moves to another screen.
 *
 * - `<TourProvider>` wraps the dashboard and owns the seen-state (per shop, per
 *   stop, in SecureStore).
 * - `<TourTarget id>` wraps a real element so the tour can point at it. A stop
 *   whose target is not on screen is skipped silently.
 * - `<TourOverlay />` draws the spotlight; render it last inside the screen.
 * - `useTour().restart()` clears the seen-state and starts again from Home.
 */

type Registry = {
  register: (id: string, ref: RefObject<View | null>) => void
  unregister: (id: string, ref: RefObject<View | null>) => void
}
const RegistryContext = createContext<Registry | null>(null)

type TourState = {
  current: { stop: TourStop; rect: TourRect } | null
  programme: ProgrammeId
  remaining: number
  advance: () => void
  skip: () => void
  restart: () => void
}
const StateContext = createContext<TourState | null>(null)

const noop = () => {}

export function useTour(): { restart: () => void } {
  const state = useContext(StateContext)
  return { restart: state?.restart ?? noop }
}

export function TourProvider({
  businessId,
  enabled,
  screen,
  programme,
  onRestart,
  children,
}: {
  businessId: string | null
  enabled: boolean
  /** Which screen the owner is on now; null while a sub-page is open. */
  screen: TourScreen | null
  programme: ProgrammeId
  /** Called by restart(), so the app can take the owner back to Home. */
  onRestart?: () => void
  children: ReactNode
}) {
  const onRestartRef = useRef(onRestart)
  onRestartRef.current = onRestart
  const refs = useRef(new Map<string, RefObject<View | null>>())
  const [registryVersion, setRegistryVersion] = useState(0)
  const [seen, setSeen] = useState<Set<TourStopId>>(new Set())
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<Set<TourStopId>>(new Set())
  const [current, setCurrent] = useState<{ stop: TourStop; rect: TourRect } | null>(null)

  const register = useCallback((id: string, ref: RefObject<View | null>) => {
    if (refs.current.get(id) === ref) return
    refs.current.set(id, ref)
    setRegistryVersion((v) => v + 1)
  }, [])
  const unregister = useCallback((id: string, ref: RefObject<View | null>) => {
    if (refs.current.get(id) !== ref) return
    refs.current.delete(id)
    setRegistryVersion((v) => v + 1)
  }, [])
  const registry = useMemo(() => ({ register, unregister }), [register, unregister])

  // Load this shop's seen-state.
  useEffect(() => {
    if (!businessId) return
    let cancelled = false
    setCurrent(null)
    Promise.all(
      TOUR_STOPS.map((stop) =>
        SecureStore.getItemAsync(tourSeenKey(businessId, stop.id))
          .then((value) => (value === 'true' ? stop.id : null))
          .catch(() => null),
      ),
    ).then((ids) => {
      if (cancelled) return
      setSeen(new Set(ids.filter((id): id is TourStopId => id !== null)))
      setLoadedFor(businessId)
    })
    return () => {
      cancelled = true
    }
  }, [businessId])

  // A new screen: drop the old spotlight and give skipped stops another chance.
  useEffect(() => {
    setCurrent(null)
    setSkipped(new Set())
  }, [screen])

  const registered = useMemo(
    () => new Set(refs.current.keys()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryVersion],
  )

  const markSeen = useCallback(
    (ids: TourStopId[]) => {
      if (!businessId) return
      setSeen((prev) => new Set([...prev, ...ids]))
      for (const id of ids) SecureStore.setItemAsync(tourSeenKey(businessId, id), 'true').catch(() => {})
    },
    [businessId],
  )

  // Pick and measure the next stop once the screen has settled.
  useEffect(() => {
    if (!enabled || !businessId || loadedFor !== businessId || current) return
    const stop = nextStop({ screen, seen, registered, skipped })
    if (!stop) return
    let cancelled = false
    const timer = setTimeout(() => {
      const node = refs.current.get(stop.target)?.current
      const giveUp = () => {
        if (!cancelled) setSkipped((prev) => new Set(prev).add(stop.id))
      }
      if (!node) return giveUp()
      node.measureInWindow((x, y, width, height) => {
        if (cancelled) return
        const rect = { x, y, width, height }
        if (!rectIsUsable(rect, Dimensions.get('window'))) return giveUp()
        setCurrent({ stop, rect })
        markSeen([stop.id])
      })
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled, businessId, loadedFor, current, screen, seen, registered, skipped, markSeen])

  const advance = useCallback(() => {
    Haptics.selectionAsync().catch(() => {})
    if (current) markSeen([current.stop.id])
    setCurrent(null)
  }, [current, markSeen])

  const skip = useCallback(() => {
    markSeen(TOUR_STOPS.map((stop) => stop.id))
    setCurrent(null)
  }, [markSeen])

  const restart = useCallback(() => {
    if (businessId) {
      for (const stop of TOUR_STOPS) SecureStore.deleteItemAsync(tourSeenKey(businessId, stop.id)).catch(() => {})
    }
    setSeen(new Set())
    setSkipped(new Set())
    setCurrent(null)
    onRestartRef.current?.()
  }, [businessId])

  const state = useMemo<TourState>(
    () => ({
      current,
      programme,
      remaining: screen ? remainingOnScreen(screen, seen).filter((stop) => registered.has(stop.target)).length : 0,
      advance,
      skip,
      restart,
    }),
    [current, programme, screen, seen, registered, advance, skip, restart],
  )

  return (
    <RegistryContext.Provider value={registry}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </RegistryContext.Provider>
  )
}

/** Wrap a real element so the tour can point at it. Outside a provider it is a plain View. */
export function TourTarget({
  id,
  children,
  style,
}: {
  id: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const registry = useContext(RegistryContext)
  const ref = useRef<View>(null)
  useEffect(() => {
    if (!registry) return
    registry.register(id, ref)
    return () => registry.unregister(id, ref)
  }, [registry, id])
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  )
}

const AnimatedRect = Animated.createAnimatedComponent(Rect)
const PAD = 6
const RING = '#2B3A67'
const TIP_SECONDS = 7

export function TourOverlay() {
  const state = useContext(StateContext)
  const reduced = useReducedMotion()
  const rootRef = useRef<View>(null)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ width: 0, height: 0 })

  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const w = useSharedValue(0)
  const h = useSharedValue(0)
  const wasShown = useRef(false)

  const current = state?.current ?? null
  const target = useMemo(
    () =>
      current
        ? {
            x: current.rect.x - origin.x - PAD,
            y: current.rect.y - origin.y - PAD,
            width: current.rect.width + PAD * 2,
            height: current.rect.height + PAD * 2,
          }
        : null,
    [current, origin],
  )

  useEffect(() => {
    if (!target) {
      wasShown.current = false
      return
    }
    if (reduced || !wasShown.current) {
      x.value = target.x
      y.value = target.y
      w.value = target.width
      h.value = target.height
    } else {
      const config = { duration: 280, easing: Easing.out(Easing.cubic) }
      x.value = withTiming(target.x, config)
      y.value = withTiming(target.y, config)
      w.value = withTiming(target.width, config)
      h.value = withTiming(target.height, config)
    }
    wasShown.current = true
  }, [target, reduced, x, y, w, h])

  const holeProps = useAnimatedProps(() => ({ x: x.value, y: y.value, width: w.value, height: h.value }))

  // A tip, not a tour step: it gets out of the way by itself.
  const advance = state?.advance
  useEffect(() => {
    if (!current || !advance) return
    const timer = setTimeout(advance, TIP_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [current, advance])

  if (!state || !current || !target) return null
  const placement = calloutPlacement(
    { x: target.x, y: target.y, width: target.width, height: target.height },
    size.height || 1,
  )
  const copy = tourCopy(current.stop.id, state.programme)

  return (
    <View
      ref={rootRef}
      style={StyleSheet.absoluteFill}
      collapsable={false}
      pointerEvents="box-none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout
        setSize({ width, height })
        rootRef.current?.measureInWindow((ox, oy) => setOrigin({ x: ox, y: oy }))
      }}
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <AnimatedRect animatedProps={holeProps} rx={18} ry={18} fill="none" stroke={RING} strokeWidth={2.5} />
        </Svg>
      )}
      <Animated.View
        key={current.stop.id}
        entering={reduced ? undefined : FadeInDown.duration(220)}
        style={[
          styles.callout,
          placement === 'below'
            ? { top: Math.min(target.y + target.height + 12, Math.max(size.height - 120, 0)) }
            : { bottom: Math.max(size.height - target.y + 12, 0) },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${copy} Tap to hide`}
          onPress={state.advance}
          style={({ pressed }) => [styles.bubble, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.copy}>{copy}</Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  callout: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bubble: {
    backgroundColor: '#1D1C1A',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 16,
    maxWidth: 320,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  copy: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 20, textAlign: 'center' },
})
