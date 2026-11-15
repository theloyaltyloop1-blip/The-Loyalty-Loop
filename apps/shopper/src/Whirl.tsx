import React from 'react'
import { SvgXml } from 'react-native-svg'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { WHIRL_XML, type WhirlPose } from './mascot-whirl'

/** Whirl, the Loyalty Loop mascot (small variant, light backgrounds). Decorative: hidden from screen readers. */
export function Whirl({ pose, size = 96, style }: { pose: WhirlPose; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <SvgXml xml={WHIRL_XML[pose]} width={size} height={size} />
    </View>
  )
}
