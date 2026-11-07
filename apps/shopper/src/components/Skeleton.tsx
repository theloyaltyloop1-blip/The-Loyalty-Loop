// Grey placeholder shapes that gently pulse while a screen loads, so the layout
// appears straight away instead of a lone spinner. Keep identical in both apps.
import { useEffect } from 'react'
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

const BASE = 'rgba(20, 20, 30, 0.08)'

export function SkeletonBlock({ width = '100%', height, radius = 14, style }: { width?: DimensionValue; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion()
  const pulse = useSharedValue(1)
  useEffect(() => {
    if (reducedMotion) return
    pulse.set(withRepeat(withTiming(0.45, { duration: 750, easing: Easing.inOut(Easing.quad) }), -1, true))
  }, [reducedMotion])
  const animated = useAnimatedStyle(() => ({ opacity: pulse.get() }))
  return <Animated.View style={[{ width, height, borderRadius: radius, borderCurve: 'continuous', backgroundColor: BASE }, animated, style]} />
}

/** A screen-shaped stack of placeholders: a heading, then `cards` card shapes. */
export function SkeletonScreen({ cards = 3, cardHeight = 120, label }: { cards?: number; cardHeight?: number; label?: string }) {
  return (
    <View accessible accessibilityLabel={label ?? 'Loading'} accessibilityState={{ busy: true }} style={{ gap: 14, paddingVertical: 8 }}>
      <SkeletonBlock width="55%" height={28} radius={10} />
      <SkeletonBlock width="35%" height={14} radius={7} />
      <View style={{ height: 6 }} />
      {Array.from({ length: cards }, (_, i) => (
        <SkeletonBlock key={i} height={cardHeight} radius={22} />
      ))}
    </View>
  )
}
