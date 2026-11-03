import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'

// Poster look (2026-11-03): heavy rounded caps (Rubik Black), neon yellow,
// film grain, a branded intro. Kept identical in both apps.
export const POSTER_FONT = 'Rubik_900Black'
export const POSTER_FONT_HEAVY = 'Rubik_800ExtraBold'
export const YELLOW = '#FFFF00'

const grain = require('../../assets/grain.png')

/** Film grain over a colour block. Put it first inside a View with overflow hidden. */
export function Grain({ opacity = 0.22 }: { opacity?: number }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Image source={grain} resizeMode="repeat" style={{ width: '100%', height: '100%', opacity }} />
  </View>
}

let introShown = false

/** Black screen with LOOP and a 000→100 count, then it lifts away. Once per launch. */
export function AppIntro() {
  const { height } = useWindowDimensions()
  const [visible, setVisible] = useState(!introShown)
  const [count, setCount] = useState(0)
  const lift = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!visible) return
    introShown = true
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return
      if (reduce) { setVisible(false); return }
      const start = Date.now()
      timer = setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / 900)
        setCount(Math.round((1 - Math.pow(1 - t, 3)) * 100))
        if (t >= 1) {
          if (timer) clearInterval(timer)
          Animated.timing(lift, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setVisible(false))
        }
      }, 30)
    }).catch(() => setVisible(false))
    return () => { cancelled = true; if (timer) clearInterval(timer) }
  }, [visible, lift])
  if (!visible) return null
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.intro, { transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) }] }]}>
      <Text style={s.introWord}>LOOP</Text>
      <Text style={s.introCount}>{String(count).padStart(3, '0')}</Text>
      <Text style={s.introTag}>THE LOYALTY LOOP · 2026</Text>
    </Animated.View>
  )
}

/** Fades and lifts its children in after `delay` ms, once. */
export function FadeUp({ delay = 0, children, style }: { delay?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 650, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [v, delay])
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }]}>{children}</Animated.View>
}

/** Small caps label row, like the posters' corner text. */
export function CornerLabels({ left, right, color = '#50627C' }: { left: string; right: string; color?: string }) {
  return <View style={s.corners} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={[s.corner, { color }]}>{left}</Text><Text style={[s.corner, { color }]}>{right}</Text></View>
}

const s = StyleSheet.create({
  intro: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  introWord: { color: YELLOW, fontFamily: POSTER_FONT, fontSize: 96, letterSpacing: -4 },
  introCount: { position: 'absolute', left: 24, bottom: 48, color: '#FFFFFF', fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  introTag: { position: 'absolute', right: 24, bottom: 56, color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  corners: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(15,28,51,0.25)' },
  corner: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
})
