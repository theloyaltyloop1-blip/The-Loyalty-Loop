import React, { useEffect, useState } from 'react'
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { WHIRL_ART } from '../art.generated'
import { WHIRL_TIMING, assertDurations, motionAllowed, whirlBudget } from '../core'
import { Whirl } from './Whirl'
import { useReduceMotion, useWhirlSettings, useWhirlVariant } from './context'

const QUARTER = Math.round(WHIRL_TIMING.SPIN_TURN_MS / 4)
assertDurations(QUARTER * 4, null)
const CLICK = Easing.inOut(Easing.cubic)

/**
 * The loading spinner: the loop mark itself, turning in four eased quarter turns, its four coloured parts in the brand
 * colours (reversed set on dark). One turn takes 1.1 s. It stays hidden for the first `delayMs` (default 300 ms) so quick
 * loads never flash it; the space is reserved so nothing jumps. With reduced motion it sits still.
 * Replaces ActivityIndicator. It does not depend on the "Show Whirl" setting (it is a loading indicator, not a moment).
 */
export function WhirlSpinner({ size = 32, delayMs = WHIRL_TIMING.SPINNER_DELAY_MS, label = 'Loading', style }: { size?: number; delayMs?: number; label?: string; style?: StyleProp<ViewStyle> }) {
  const variant = useWhirlVariant()
  const reduce = useReduceMotion()
  const [shown, setShown] = useState(delayMs <= 0)
  const angle = useSharedValue(0)
  const fade = useSharedValue(0)

  useEffect(() => {
    if (delayMs <= 0) return
    const id = setTimeout(() => setShown(true), delayMs)
    return () => clearTimeout(id)
  }, [delayMs])

  useEffect(() => {
    if (!shown) return
    fade.set(withTiming(1, { duration: 140 }))
    if (!motionAllowed({ reduceMotion: reduce })) {
      cancelAnimation(angle)
      angle.set(0)
      return
    }
    angle.set(
      withRepeat(
        withSequence(
          withTiming(90, { duration: QUARTER, easing: CLICK }),
          withTiming(180, { duration: QUARTER, easing: CLICK }),
          withTiming(270, { duration: QUARTER, easing: CLICK }),
          withTiming(360, { duration: QUARTER, easing: CLICK }),
        ),
        -1,
        false,
      ),
    )
    return () => cancelAnimation(angle)
  }, [shown, reduce])

  const turn = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ rotate: `${angle.get()}deg` }] }))
  const blades = WHIRL_ART[variant].blades
  return (
    <View style={[{ width: size, height: size }, style]} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      {shown ? (
        <Animated.View style={[{ width: size, height: size }, turn]}>
          <Svg width={size} height={size} viewBox="0 0 256 256">
            {blades.map((b, i) => (
              <Path key={i} d={b.d} fill={b.fill} />
            ))}
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  )
}

const TRACK = { light: 'rgba(94, 104, 57, 0.16)', dark: 'rgba(180, 195, 134, 0.18)' } as const

/**
 * Loading bar for uploads and slow AI reports. Pass `progress` (0..1) for a real percentage, or leave it out for an
 * indeterminate sweep (1.1 s). The fill is the four brand colours. When "Show Whirl" is on a tiny Whirl rides the head of the
 * bar; when it is off (or motion is reduced) the bar is plain. Never blocks anything: it is just a View.
 */
export function WhirlProgress({ progress, height = 10, label = 'Loading', withWhirl = true, style }: { progress?: number; height?: number; label?: string; withWhirl?: boolean; style?: StyleProp<ViewStyle> }) {
  const variant = useWhirlVariant()
  const reduce = useReduceMotion()
  const { showWhirl } = useWhirlSettings()
  const [width, setWidth] = useState(0)
  const sweep = useSharedValue(0)
  const determinate = typeof progress === 'number'
  const pct = determinate ? Math.min(1, Math.max(0, progress)) : 0
  const animated = !determinate && motionAllowed({ reduceMotion: reduce })

  useEffect(() => {
    if (!animated) {
      cancelAnimation(sweep)
      sweep.set(0.35)
      return
    }
    sweep.set(0)
    sweep.set(withRepeat(withTiming(1, { duration: WHIRL_TIMING.SPIN_TURN_MS, easing: CLICK }), -1, false))
    return () => cancelAnimation(sweep)
  }, [animated])

  const part = Math.max(40, width * 0.35)
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: -part + sweep.get() * (width + part) }] }))
  const cols = WHIRL_ART[variant].blades.map((b) => b.fill)
  const fillWidth: DimensionValue = determinate ? `${pct * 100}%` : part
  const band = (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {cols.map((c, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </View>
  )
  const face = showWhirl && withWhirl && determinate && width > 120 && pct > 0.04
  return (
    <View
      style={[{ height: Math.max(height, face ? 28 : height), justifyContent: 'center' }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={determinate ? { min: 0, max: 100, now: Math.round(pct * 100) } : undefined}
      accessibilityState={{ busy: true }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: TRACK[variant] }}>
        {determinate ? (
          <View style={{ width: fillWidth, height, borderRadius: height / 2, overflow: 'hidden' }}>{band}</View>
        ) : (
          <Animated.View style={[{ width: part, height, borderRadius: height / 2, overflow: 'hidden' }, moving]}>{band}</Animated.View>
        )}
      </View>
      {face ? <Whirl pose="wave" size={28} style={{ position: 'absolute', top: 0, left: Math.max(0, Math.min(width - 28, pct * width - 20)) }} /> : null}
    </View>
  )
}

const SKELETON_TINT = { light: 'rgba(170, 82, 30, 0.14)', dark: 'rgba(244, 226, 196, 0.12)' } as const
const SLOW_LOAD_MS = 2500

export function WhirlSkeletonBlock({ width = '100%', height, radius = 14, style }: { width?: DimensionValue; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const variant = useWhirlVariant()
  const reduce = useReduceMotion()
  const pulse = useSharedValue(1)
  useEffect(() => {
    if (!motionAllowed({ reduceMotion: reduce })) {
      cancelAnimation(pulse)
      pulse.set(1)
      return
    }
    // 550 ms each way = one 1.1 s breath
    pulse.set(withRepeat(withTiming(0.5, { duration: WHIRL_TIMING.SPIN_TURN_MS / 2, easing: Easing.inOut(Easing.quad) }), -1, true))
    return () => cancelAnimation(pulse)
  }, [reduce])
  const animated = useAnimatedStyle(() => ({ opacity: pulse.get() }))
  return <Animated.View style={[{ width, height, borderRadius: radius, borderCurve: 'continuous', backgroundColor: SKELETON_TINT[variant] }, animated, style]} />
}

/**
 * A screen-shaped stack of warm placeholders that breathe while a screen loads (replaces SkeletonScreen). If the wait runs
 * past about 2.5 s a tiny Whirl peeks in at the corner ("one moment"), once per screen, and only if "Show Whirl" is on.
 */
export function WhirlSkeleton({ cards = 3, cardHeight = 120, label = 'Loading', screenId = 'skeleton' }: { cards?: number; cardHeight?: number; label?: string; screenId?: string }) {
  const { showWhirl } = useWhirlSettings()
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_LOAD_MS)
    return () => clearTimeout(id)
  }, [])
  const [granted, setGranted] = useState(false)
  useEffect(() => {
    if (!slow || !showWhirl) return
    const ok = whirlBudget.claim(screenId, 'skeleton-whirl')
    setGranted(ok)
    return () => whirlBudget.release(screenId, 'skeleton-whirl')
  }, [slow, showWhirl, screenId])
  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} style={{ gap: 14, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 10 }}>
          <WhirlSkeletonBlock width="55%" height={28} radius={10} />
          <WhirlSkeletonBlock width="35%" height={14} radius={7} />
        </View>
        {granted ? <Whirl pose="sleepy" size={40} effect="pop" /> : null}
      </View>
      <View style={{ height: 6 }} />
      {Array.from({ length: cards }, (_, i) => (
        <WhirlSkeletonBlock key={i} height={cardHeight} radius={22} />
      ))}
    </View>
  )
}

/**
 * Pull-to-refresh: native RefreshControl cannot be re-drawn, so keep it (tint it with the brand olive/orange) and, while
 * `refreshing`, show this small turning loop pinned at the top, after the 300 ms delay. Put it inside the scroll view's parent.
 */
export function WhirlRefreshIndicator({ refreshing, top = 8 }: { refreshing: boolean; top?: number }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!refreshing) {
      setShow(false)
      return
    }
    const id = setTimeout(() => setShow(true), WHIRL_TIMING.SPINNER_DELAY_MS)
    return () => clearTimeout(id)
  }, [refreshing])
  if (!show) return null
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, left: 0, right: 0, alignItems: 'center' }}>
      <WhirlSpinner size={26} delayMs={0} label="Refreshing" />
    </View>
  )
}
