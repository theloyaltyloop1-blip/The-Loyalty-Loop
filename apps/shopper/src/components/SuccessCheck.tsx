import { useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { Modal, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import Svg, { Path } from 'react-native-svg'
import { colors } from '@loyalty-loop/design-tokens'

/** Brief (~0.5s) success confirmation: a green checkmark that pops in with a
 * spring, holds briefly, then fades. Shown when a shopper's stamp count (or
 * unlocked rewards) goes up since this screen last observed it — the shopper
 * has no realtime feed, so this is how a stamp scanned at the counter gets
 * an "it worked" beat once the app catches up on refresh. Non-interactive:
 * it sits on top of the screen but never blocks taps. Mirrors the spring/
 * timing feel used by Sheet.tsx (this app's own copy of that convention). */

const POP_SPRING = { duration: 300, dampingRatio: 0.8 } // matches Sheet.tsx
const HOLD_MS = 500
const FADE = { duration: 220, easing: Easing.out(Easing.quad) }

export function SuccessCheck({ visible, onFinished }: { visible: boolean; onFinished: () => void }) {
  const reducedMotion = useReducedMotion()
  const scale = useSharedValue(0)
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (!visible) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    scale.set(0)
    opacity.set(1)
    scale.set(reducedMotion ? withTiming(1, { duration: 150 }) : withSpring(1, POP_SPRING))
    opacity.set(
      withDelay(
        HOLD_MS,
        withTiming(0, FADE, (finished) => {
          if (finished) scheduleOnRN(onFinished)
        }),
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    opacity: opacity.get(),
  }))

  if (!visible) return null

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Animated.View style={[styles.circle, animStyle]}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.funGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
})
