import React from 'react'
import { SvgXml } from 'react-native-svg'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { WHIRL_XML, WHIRL_XML_DARK, type WhirlPose } from './mascot-whirl'
import { useTheme } from './theme'

/** Whirl, the Loyalty Loop mascot (small variant; dark artwork on dark theme). Decorative: hidden from screen readers. */
export function Whirl({ pose, size = 96, style }: { pose: WhirlPose; size?: number; style?: StyleProp<ViewStyle> }) {
  const { isDark } = useTheme()
  return (
    <View style={style} accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <SvgXml xml={(isDark ? WHIRL_XML_DARK : WHIRL_XML)[pose]} width={size} height={size} />
    </View>
  )
}
