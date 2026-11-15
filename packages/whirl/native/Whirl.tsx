import React, { useEffect, useMemo } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { SvgXml } from 'react-native-svg'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { WHIRL_ART, type WhirlPose, type WhirlPoseArt } from '../art.generated'
import { artKindForSize, assertDurations, motionAllowed } from '../core'
import { useReduceMotion, useWhirlSettings, useWhirlVariant } from './context'

/** One-shot effects. Each finishes inside 1.5 s; nothing here loops. */
export type WhirlEffect = 'none' | 'wave' | 'pop' | 'oops' | 'celebrate' | 'stamp' | 'peek'

const DURATIONS: Record<WhirlEffect, number> = { none: 0, wave: 960, pop: 420, oops: 360, celebrate: 1300, stamp: 420, peek: 520 }
for (const ms of Object.values(DURATIONS)) assertDurations(null, ms)

const EASE = Easing.inOut(Easing.quad)
const OUT = Easing.out(Easing.cubic)

function xmlFor(art: WhirlPoseArt, ids?: string[]): string {
  const [x, y, w, h] = art.vb
  const inner = art.layers.filter((l) => !ids || ids.includes(l.id)).map((l) => l.svg).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">${inner}</svg>`
}

export interface WhirlProps {
  pose: WhirlPose
  /** Width in px. Below 48 the plain mini face is used automatically. */
  size?: number
  /** One-shot animation that plays when it appears (or when `playKey` changes). Skipped with reduced motion. */
  effect?: WhirlEffect
  playKey?: string | number
  /** Spoken label. Leave out when Whirl is just decoration (the default): he is then hidden from screen readers. */
  label?: string
  /** Hides Whirl when the user has switched "Show Whirl" off. Set false only for things that carry meaning, never for loading. */
  decorative?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Whirl, the Loyalty Loop mascot. Light or dark art comes from `useWhirlVariant()`. Animations are one-shots (never loops)
 * and are skipped when the OS asks for reduced motion. Limb layers are real (the wave moves the arm, not the body).
 */
export function Whirl({ pose, size = 96, effect = 'none', playKey, label, decorative = true, style }: WhirlProps) {
  const variant = useWhirlVariant()
  const { showWhirl } = useWhirlSettings()
  const reduce = useReduceMotion()
  const art = WHIRL_ART[variant][artKindForSize(size)][pose]
  const [, , vw, vh] = art.vb
  const w = size
  const h = Math.round((size * vh) / vw)
  const k = w / vw

  const arm = useSharedValue(0)
  const bodyY = useSharedValue(0)
  const bodyX = useSharedValue(0)
  const scale = useSharedValue(1)
  const props = useSharedValue(1)
  const fade = useSharedValue(1)

  const animate = effect !== 'none' && motionAllowed({ reduceMotion: reduce })

  useEffect(() => {
    cancelAnimation(arm)
    cancelAnimation(bodyY)
    cancelAnimation(bodyX)
    cancelAnimation(scale)
    cancelAnimation(props)
    cancelAnimation(fade)
    arm.set(0)
    bodyY.set(0)
    bodyX.set(0)
    scale.set(1)
    props.set(1)
    fade.set(1)
    if (!animate) return
    if (effect === 'wave') {
      arm.set(withSequence(withTiming(-14, { duration: 180, easing: EASE }), withTiming(14, { duration: 280, easing: EASE }), withTiming(-14, { duration: 280, easing: EASE }), withTiming(0, { duration: 220, easing: EASE })))
    } else if (effect === 'pop') {
      scale.set(withSequence(withTiming(0.9, { duration: 0 }), withSpring(1, { damping: 10, stiffness: 220 })))
    } else if (effect === 'oops') {
      bodyX.set(withSequence(withTiming(-3, { duration: 60 }), withTiming(3, { duration: 90 }), withTiming(-3, { duration: 90 }), withTiming(0, { duration: 120 })))
    } else if (effect === 'celebrate') {
      bodyY.set(withSequence(withTiming(-size * 0.09, { duration: 200, easing: OUT }), withSpring(0, { damping: 9, stiffness: 180 })))
      arm.set(withSequence(withTiming(-8, { duration: 200 }), withTiming(8, { duration: 200 }), withTiming(0, { duration: 200 })))
      props.set(withSequence(withTiming(0, { duration: 0 }), withDelay(120, withTiming(1, { duration: 900, easing: OUT }))))
    } else if (effect === 'stamp') {
      arm.set(withSequence(withTiming(10, { duration: 160, easing: OUT }), withTiming(0, { duration: 260, easing: EASE })))
      bodyY.set(withSequence(withTiming(size * 0.03, { duration: 160, easing: OUT }), withTiming(0, { duration: 260, easing: EASE })))
    } else if (effect === 'peek') {
      bodyY.set(withSequence(withTiming(size * 0.07, { duration: 0 }), withDelay(150, withSpring(0, { damping: 14, stiffness: 160 }))))
      fade.set(withSequence(withTiming(0, { duration: 0 }), withDelay(150, withTiming(1, { duration: 200 }))))
    }
  }, [animate, effect, playKey, size])

  const groupStyle = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ translateX: bodyX.get() }, { translateY: bodyY.get() }, { scale: scale.get() }],
  }))
  const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${arm.get()}deg` }] }))
  const propsStyle = useAnimatedStyle(() => ({ opacity: props.get(), transform: [{ scale: 0.85 + 0.15 * props.get() }] }))

  const single = useMemo(() => xmlFor(art), [art])
  const layers = useMemo(() => art.layers.map((l) => ({ id: l.id, pivot: l.pivot, xml: xmlFor(art, [l.id]) })), [art])

  if (decorative && !showWhirl) return null
  const a11y = label
    ? ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: label } as const)
    : ({ accessible: false, importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true } as const)

  if (!animate) {
    return (
      <View style={[{ width: w, height: h }, style]} pointerEvents="none" {...a11y}>
        <SvgXml xml={single} width={w} height={h} />
      </View>
    )
  }
  return (
    <View style={[{ width: w, height: h }, style]} pointerEvents="none" {...a11y}>
      <Animated.View style={[{ width: w, height: h }, groupStyle]}>
        {layers.map((l) => {
          const xmlEl = <SvgXml xml={l.xml} width={w} height={h} />
          const abs = { position: 'absolute', left: 0, top: 0, width: w, height: h } as const
          if (l.id === 'armR' && l.pivot) {
            return (
              <Animated.View key={l.id} style={[abs, { transformOrigin: `${l.pivot[0] * k}px ${(l.pivot[1] - art.vb[1]) * k}px` }, armStyle]}>
                {xmlEl}
              </Animated.View>
            )
          }
          if (l.id === 'props') {
            return (
              <Animated.View key={l.id} style={[abs, effect === 'celebrate' ? propsStyle : null]}>
                {xmlEl}
              </Animated.View>
            )
          }
          return (
            <View key={l.id} style={abs}>
              {xmlEl}
            </View>
          )
        })}
      </Animated.View>
    </View>
  )
}
