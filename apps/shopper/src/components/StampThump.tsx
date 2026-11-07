import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

/** Wraps a freshly earned stamp so it lands like a rubber stamp: it drops in
 * slightly big and tilted, presses down with a firm thud, and a ring of ink
 * spreads out and fades. Each new stamp waits `delay` ms so several stamps
 * land one after another. Plays once on mount. */
export function StampThump({ children, delay = 0, ringColor, size = 44, radius = size / 2 }: { children: ReactNode; delay?: number; ringColor: string; size?: number; radius?: number }) {
  const reducedMotion = useReducedMotion()
  const press = useSharedValue(reducedMotion ? 1 : 0)
  const ring = useSharedValue(0)

  useEffect(() => {
    if (reducedMotion) return
    const timer = setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), delay + 170)
    press.set(withDelay(delay, withTiming(1, { duration: 180, easing: Easing.in(Easing.cubic) })))
    ring.set(withDelay(delay + 170, withSequence(withTiming(0.01, { duration: 0 }), withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }))))
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lifted (big, tilted, faint) → pressed flat onto the card.
  const stampStyle = useAnimatedStyle(() => {
    const t = press.get()
    return {
      opacity: Math.min(1, t * 2.5),
      transform: [{ scale: 1.9 - 0.9 * t }, { rotate: `${(1 - t) * -16}deg` }],
    }
  })
  const ringStyle = useAnimatedStyle(() => {
    const r = ring.get()
    return {
      opacity: r === 0 ? 0 : (1 - r) * 0.55,
      transform: [{ scale: 0.9 + r * 0.9 }],
    }
  })

  return (
    <View>
      <Animated.View pointerEvents="none" style={[styles.ring, { top: -4, left: -4, width: size + 8, height: size + 8, borderRadius: radius + 4, borderColor: ringColor }, ringStyle]} />
      <Animated.View style={stampStyle}>{children}</Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 3 },
})
