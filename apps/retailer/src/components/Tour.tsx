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
import Svg, { Defs, Mask, Rect } from 'react-native-svg'

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
 * Guided tour on the real screens: a dimmed overlay with a spotlight cut-out
 * around a real element, one sentence, a Next / Got it pill and Skip.
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
      })
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled, businessId, loadedFor, current, screen, seen, registered, skipped])

  const markSeen = useCallback(
    (ids: TourStopId[]) => {
      if (!businessId) return
      setSeen((prev) => new Set([...prev, ...ids]))
      for (const id of ids) SecureStore.setItemAsync(tourSeenKey(businessId, id), 'true').catch(() => {})
    },
    [businessId],
  )

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
const DIM = 'rgba(12,12,10,0.74)'

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

  if (!state || !current || !target) return null
  const placement = calloutPlacement(
    { x: target.x, y: target.y, width: target.width, height: target.height },
    size.height || 1,
  )
  const copy = tourCopy(current.stop.id, state.programme)
  const last = state.remaining <= 1

  return (
    <View
      ref={rootRef}
      style={StyleSheet.absoluteFill}
      collapsable={false}
      accessibilityViewIsModal
      onStartShouldSetResponder={() => true}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout
        setSize({ width, height })
        rootRef.current?.measureInWindow((ox, oy) => setOrigin({ x: ox, y: oy }))
      }}
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <Mask id="tour-hole">
              <Rect x={0} y={0} width={size.width} height={size.height} fill="#fff" />
              <AnimatedRect animatedProps={holeProps} rx={18} ry={18} fill="#000" />
            </Mask>
          </Defs>
          <Rect x={0} y={0} width={size.width} height={size.height} fill={DIM} mask="url(#tour-hole)" />
          <AnimatedRect animatedProps={holeProps} rx={18} ry={18} fill="none" stroke="#fff" strokeWidth={2} />
        </Svg>
      )}
      <Animated.View
        key={current.stop.id}
        entering={reduced ? undefined : FadeInDown.duration(220)}
        style={[
          styles.callout,
          placement === 'below'
            ? { top: Math.min(target.y + target.height + 16, Math.max(size.height - 190, 0)) }
            : { bottom: Math.max(size.height - target.y + 16, 0) },
        ]}
      >
        <Text style={styles.copy} accessibilityRole="header">
          {copy}
        </Text>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip the tour" onPress={state.skip} hitSlop={8} style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={last ? 'Got it' : 'Next'}
            onPress={state.advance}
            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.pillText}>{last ? 'Got it' : 'Next'}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  callout: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  copy: { color: '#000', fontSize: 18, fontWeight: '800', lineHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  skip: { minHeight: 44, justifyContent: 'center', paddingRight: 16 },
  skipText: { color: '#000', fontSize: 15, fontWeight: '700', opacity: 0.6 },
  pill: {
    minHeight: 46,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: '#C0501F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
