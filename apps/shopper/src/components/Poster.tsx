import { Whirl } from '../Whirl'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { themed, colors, schemeColor } from '@loyalty-loop/design-tokens'
import { useTheme } from '../theme'

// Premium look, palette 1 (2026-11-04): warm paper with Twilight Indigo as the
// brand colour, Blue Slate, Pacific Blue and Dry Sage as quiet fields, deep
// indigo ink, hairlines, slow eased motion. Kept identical in both apps.
export const PAPER = '#F4F1EA'
export const STONE = '#E7E2D8'
export const NIGHT = '#2B3A67'
export const INK = '#1A2138'
export const MUTED = '#6F6B64'
export const HAIRLINE = 'rgba(26,33,56,0.12)'
/** The brand / call-to-action colour (Twilight Indigo; the name is kept from the sapphire days). */
export const SAPPHIRE = '#2B3A67'
export const SLATE = '#496A81'
export const PACIFIC = '#66999B'
export const SAGE = '#B3AF8F'
export const SERIF = 'InstrumentSerif_400Regular_Italic'
export const SANS_MEDIUM = 'Inter_500Medium'
/** Big numbers and headlines: heavy and tight, like the approved mockups. */
export const SANS_HEAVY = 'Inter_800ExtraBold'

const EASE = Easing.bezier(0.22, 1, 0.36, 1)

let introShown = false

/** Paper screen with the name and a hairline that fills, then it lifts away. Once per launch,
 * about 0.75 s in all, so the app is usable almost at once. Skipped with reduced motion. */
export function AppIntro() {
  useTheme() // re-render when the scheme changes
  const { height, width } = useWindowDimensions()
  const [visible, setVisible] = useState(!introShown)
  const progress = useRef(new Animated.Value(0)).current
  const lift = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!visible) return
    introShown = true
    let cancelled = false
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return
      if (reduce) { setVisible(false); return }
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 450, easing: EASE, useNativeDriver: true }),
        Animated.timing(lift, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: true }),
      ]).start(() => setVisible(false))
    }).catch(() => setVisible(false))
    return () => { cancelled = true }
  }, [visible, progress, lift])
  if (!visible) return null
  const line = width - 48
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.intro, { transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) }] }]}>
      <Whirl pose="wave" size={96} style={{ marginBottom: 14 }} />
      <Text style={s.introWord}>The Loyalty <Text style={s.introSerif}>Loop</Text></Text>
      <View style={[s.introTrack, { width: line }]}>
        <Animated.View style={[s.introFill, { width: line, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-line, 0] }) }] }]} />
      </View>
      <Text style={s.introTag}>Local loyalty</Text>
    </Animated.View>
  )
}

// The entrance plays for the first screen that uses it in a session only; coming back to
// a screen shows it straight away.
let fadeUpPlayed = false

/** Fades and lifts its children in after `delay` ms, the first time only. Still with reduced motion. */
export function FadeUp({ delay = 0, children, style }: { delay?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const [still] = useState(() => fadeUpPlayed || reduced)
  const v = useRef(new Animated.Value(still ? 1 : 0)).current
  useEffect(() => {
    if (still) return
    fadeUpPlayed = true
    Animated.timing(v, { toValue: 1, duration: 400, delay, easing: EASE, useNativeDriver: true }).start()
  }, [v, delay, still])
  if (still) return <View style={style}>{children}</View>
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>{children}</Animated.View>
}

/** Small caps label row over a hairline, like gallery wall text. */
export function CornerLabels({ left, right, color = colors.muted }: { left: string; right: string; color?: string }) {
  return <View style={s.corners} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={[s.corner, { color }]}>{left}</Text><Text style={[s.corner, { color }]}>{right}</Text></View>
}

const s = themed(() => StyleSheet.create({
  intro: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  introWord: { color: colors.ink, fontFamily: SANS_MEDIUM, fontSize: 30, letterSpacing: -1.2 },
  introSerif: { fontFamily: SERIF, fontSize: 33, letterSpacing: -0.3 },
  introTrack: { position: 'absolute', left: 24, bottom: 76, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.hairline, overflow: 'hidden' },
  introFill: { height: '100%', backgroundColor: schemeColor('#1A2138', 'bg') },
  introTag: { position: 'absolute', left: 24, bottom: 44, color: colors.muted, fontSize: 13, fontWeight: '500' },
  corners: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  corner: { fontSize: 10, fontWeight: '500', letterSpacing: 1.8 },
}))
