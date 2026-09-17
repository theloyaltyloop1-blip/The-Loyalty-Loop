import { useEffect, useState, type ReactNode } from 'react'
import { Dimensions, Modal, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

/** Gesture-driven bottom sheet: drag-to-dismiss with 1:1 finger tracking, spring
 * settle, velocity-based dismissal and rubber-banding past the open position.
 * Replaces the bare `<Modal animationType="slide">` pattern app-wide.
 *
 * The parent keeps `visible` true/false rather than conditionally mounting —
 * that's what lets the exit drag/animation finish before `onClose` unmounts it. */

const SPRING = { duration: 300, dampingRatio: 0.8 }
const CLOSE_TIMING = { duration: 220, easing: Easing.in(Easing.cubic) }
const DISMISS_VELOCITY = 800 // px/s downward flick — enough alone to dismiss
const DISMISS_DISTANCE_RATIO = 0.3 // or dragged past 30% of the sheet's height
const RUBBER_BAND = 0.25 // resistance when dragged upward past the open position

export function Sheet({
  visible,
  onClose,
  children,
  sheetStyle,
  backdrop = true,
  dragArea = 'handle',
  dragAreaHeight = 32,
}: {
  visible: boolean
  onClose: () => void
  children: ReactNode
  sheetStyle?: StyleProp<ViewStyle>
  /** Show a dimmed, drag-progress-linked backdrop behind the sheet. */
  backdrop?: boolean
  /** 'handle': only the top strip (matching the visual grab handle) is draggable,
   *  so a ScrollView inside the sheet keeps its own scroll gesture.
   *  'full': the whole sheet is draggable — use when there's no scrolling content. */
  dragArea?: 'handle' | 'full'
  dragAreaHeight?: number
}) {
  const reducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(visible)
  const screenHeight = Dimensions.get('window').height
  const travel = useSharedValue(screenHeight)
  const translateY = useSharedValue(screenHeight)
  const dragStartY = useSharedValue(0)

  function finishClose() {
    setMounted(false)
    onClose()
  }

  function animateClosed() {
    'worklet'
    translateY.set(
      withTiming(travel.get(), reducedMotion ? { duration: 150 } : CLOSE_TIMING, (finished) => {
        if (finished) scheduleOnRN(finishClose)
      }),
    )
  }

  useEffect(() => {
    if (visible) {
      setMounted(true)
      translateY.set(reducedMotion ? withTiming(0, { duration: 150 }) : withSpring(0, SPRING))
    } else if (mounted) {
      animateClosed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  function handleLayout(height: number) {
    if (height > 0) travel.set(height)
  }

  const pan = Gesture.Pan()
    .onStart(() => {
      dragStartY.set(translateY.get())
    })
    .onUpdate((e) => {
      const next = dragStartY.get() + e.translationY
      translateY.set(next < 0 ? next * RUBBER_BAND : next)
    })
    .onEnd((e) => {
      const current = translateY.get()
      const shouldDismiss = current > 0 && (current > travel.get() * DISMISS_DISTANCE_RATIO || e.velocityY > DISMISS_VELOCITY)
      if (shouldDismiss) {
        translateY.set(
          withTiming(travel.get(), CLOSE_TIMING, (finished) => {
            if (finished) scheduleOnRN(finishClose)
          }),
        )
      } else {
        translateY.set(withSpring(0, { ...SPRING, velocity: e.velocityY }))
      }
    })

  const sheetAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }))
  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.get(), [0, travel.get()], [1, 0], Extrapolation.CLAMP),
  }))

  if (!mounted) return null

  const sheetContent = (
    <Animated.View style={[sheetStyle, sheetAnimStyle]} onLayout={(e) => handleLayout(e.nativeEvent.layout.height)}>
      {children}
      {dragArea === 'handle' && (
        <GestureDetector gesture={pan}>
          <Animated.View pointerEvents="box-only" style={[StyleSheet.absoluteFillObject, { height: dragAreaHeight }]} />
        </GestureDetector>
      )}
    </Animated.View>
  )

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={animateClosed}>
      {backdrop && (
        <Animated.View style={[StyleSheet.absoluteFill, backdropAnimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={animateClosed} />
        </Animated.View>
      )}
      {dragArea === 'full' ? <GestureDetector gesture={pan}>{sheetContent}</GestureDetector> : sheetContent}
    </Modal>
  )
}
