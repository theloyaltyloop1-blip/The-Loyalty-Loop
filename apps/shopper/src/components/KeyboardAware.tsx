import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native'

const MARGIN = 24 // breathing room between the focused field and the keyboard

/** Live height of the on-screen keyboard (0 when hidden). */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height),
    )
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return height
}

/** ScrollView that keeps the focused text field visible above the keyboard.
 * Pads the content by the keyboard height (so the last field can scroll clear)
 * and scrolls whichever field has focus into view, including when the user
 * taps from one field to the next while the keyboard stays open.
 * Pass `pad={false}` inside a `<Sheet>`, which already lifts itself. */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps & { pad?: boolean }>(
  function KeyboardAwareScrollView({ pad = true, contentContainerStyle, onScroll, children, ...rest }, ref) {
    const { height: windowHeight } = useWindowDimensions()
    const keyboardHeight = useKeyboardHeight()
    const inner = useRef<ScrollView | null>(null)
    const offset = useRef(0)
    const lastFocused = useRef<unknown>(null)

    const setRefs = useCallback(
      (node: ScrollView | null) => {
        inner.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref],
    )

    const reveal = useCallback(() => {
      const field = TextInput.State.currentlyFocusedInput?.()
      if (!field || !inner.current) return
      field.measureInWindow((_x, y, _w, h) => {
        const visibleBottom = windowHeight - keyboardHeight - MARGIN
        const overlap = y + h - visibleBottom
        if (overlap > 0) inner.current?.scrollTo({ y: offset.current + overlap, animated: true })
        else if (y < MARGIN * 3 && lastFocused.current !== field) {
          inner.current?.scrollTo({ y: Math.max(0, offset.current + y - MARGIN * 3), animated: true })
        }
        lastFocused.current = field
      })
    }, [keyboardHeight, windowHeight])

    useEffect(() => {
      if (keyboardHeight === 0) {
        lastFocused.current = null
        return
      }
      const first = setTimeout(reveal, 60)
      // Catches focus moving between fields while the keyboard stays up.
      const poll = setInterval(() => {
        const field = TextInput.State.currentlyFocusedInput?.()
        if (field && field !== lastFocused.current) reveal()
      }, 250)
      return () => {
        clearTimeout(first)
        clearInterval(poll)
      }
    }, [keyboardHeight, reveal])

    return (
      <ScrollView
        ref={setRefs}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          offset.current = e.nativeEvent.contentOffset.y
          onScroll?.(e)
        }}
        {...rest}
        contentContainerStyle={[contentContainerStyle, pad && keyboardHeight > 0 ? { paddingBottom: keyboardHeight + MARGIN } : null]}
      >
        {children}
      </ScrollView>
    )
  },
)
