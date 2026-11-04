import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'

// Premium look (2026-11-04): warm paper and near-black, Inter at quiet weights
// with an italic serif accent, hairlines, slow eased motion. Sapphire is only
// for the main action. Kept identical in both apps.
export const PAPER = '#F4F1EA'
export const STONE = '#E7E2D8'
export const NIGHT = '#0E0E0F'
export const INK = '#111111'
export const MUTED = '#6F6B64'
export const HAIRLINE = 'rgba(17,17,17,0.12)'
export const SAPPHIRE = '#0042AC'
export const SERIF = 'InstrumentSerif_400Regular_Italic'
export const SANS_MEDIUM = 'Inter_500Medium'
/** Big numbers and headlines: heavy and tight, like the approved mockups. */
export const SANS_HEAVY = 'Inter_800ExtraBold'

const EASE = Easing.bezier(0.22, 1, 0.36, 1)

let introShown = false

/** Paper screen with the name and a hairline that fills, then it lifts away. Once per launch. */
export function AppIntro() {
  const { height, width } = useWindowDimensions()
  const [visible, setVisible] = useState(!introShown)
  const [count, setCount] = useState(0)
  const progress = useRef(new Animated.Value(0)).current
  const lift = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!visible) return
    introShown = true
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return
      if (reduce) { setVisible(false); return }
      Animated.timing(progress, { toValue: 1, duration: 1200, easing: EASE, useNativeDriver: true }).start()
      const start = Date.now()
      timer = setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / 1200)
        setCount(Math.round((1 - Math.pow(1 - t, 3)) * 100))
        if (t >= 1) {
          if (timer) clearInterval(timer)
          Animated.timing(lift, { toValue: 1, duration: 900, easing: EASE, useNativeDriver: true }).start(() => setVisible(false))
        }
      }, 40)
    }).catch(() => setVisible(false))
    return () => { cancelled = true; if (timer) clearInterval(timer) }
  }, [visible, progress, lift])
  if (!visible) return null
  const line = width - 48
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.intro, { transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) }] }]}>
      <Text style={s.introWord}>The Loyalty <Text style={s.introSerif}>Loop</Text></Text>
      <View style={[s.introTrack, { width: line }]}>
        <Animated.View style={[s.introFill, { width: line, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-line, 0] }) }] }]} />
      </View>
      <Text style={s.introTag}>LOCAL LOYALTY</Text>
      <Text style={s.introCount}>{String(count).padStart(3, '0')}</Text>
    </Animated.View>
  )
}

/** Fades and lifts its children in after `delay` ms, once. */
export function FadeUp({ delay = 0, children, style }: { delay?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1000, delay, easing: EASE, useNativeDriver: true }).start()
  }, [v, delay])
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>{children}</Animated.View>
}

/** Small caps label row over a hairline, like gallery wall text. */
export function CornerLabels({ left, right, color = MUTED }: { left: string; right: string; color?: string }) {
  return <View style={s.corners} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={[s.corner, { color }]}>{left}</Text><Text style={[s.corner, { color }]}>{right}</Text></View>
}

const s = StyleSheet.create({
  intro: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000, backgroundColor: PAPER, alignItems: 'center', justifyContent: 'center' },
  introWord: { color: INK, fontFamily: SANS_MEDIUM, fontSize: 30, letterSpacing: -1.2 },
  introSerif: { fontFamily: SERIF, fontSize: 33, letterSpacing: -0.3 },
  introTrack: { position: 'absolute', left: 24, bottom: 76, height: StyleSheet.hairlineWidth * 2, backgroundColor: HAIRLINE, overflow: 'hidden' },
  introFill: { height: '100%', backgroundColor: INK },
  introTag: { position: 'absolute', left: 24, bottom: 44, color: MUTED, fontSize: 10, fontWeight: '500', letterSpacing: 1.8 },
  introCount: { position: 'absolute', right: 24, bottom: 44, color: INK, fontSize: 12, fontWeight: '500', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  corners: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: HAIRLINE },
  corner: { fontSize: 10, fontWeight: '500', letterSpacing: 1.8 },
})
