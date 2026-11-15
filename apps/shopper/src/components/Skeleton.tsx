// Loading placeholders now come from the shared Whirl kit (packages/whirl): warm tinted shapes that breathe, a tiny Whirl
// peeks in only if the wait is slow. Kept here so existing imports keep working. Keep identical in both apps.
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native'

import { WhirlSkeleton, WhirlSkeletonBlock } from '../../../../packages/whirl/native'

export function SkeletonBlock({ width = '100%', height, radius = 14, style }: { width?: DimensionValue; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  return <WhirlSkeletonBlock width={width} height={height} radius={radius} style={style} />
}

/** A screen-shaped stack of placeholders: a heading, then `cards` card shapes. */
export function SkeletonScreen({ cards = 3, cardHeight = 120, label }: { cards?: number; cardHeight?: number; label?: string }) {
  return <WhirlSkeleton cards={cards} cardHeight={cardHeight} label={label ?? 'Loading'} />
}
