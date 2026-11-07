// Keep this file identical in apps/shopper and apps/retailer.
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  useWindowDimensions,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native'

const MARGIN = 28 // breathing room between the focused field and the keyboard
const TOP_ROOM = 72 // keep a field this far below the top of the screen

type KeyboardFrame = { height: number; top: number | null }
const HIDDEN: KeyboardFrame = { height: 0, top: null }

function frameFrom(e: KeyboardEvent): KeyboardFrame {
  const height = e.endCoordinates?.height ?? 0
  const top = e.endCoordinates?.screenY
  return { height, top: typeof top === 'number' && top > 0 ? top : null }
}

/** Live keyboard size and its top edge on screen (height 0 when hidden). */
export function useKeyboardFrame(): KeyboardFrame {
  const [frame, setFrame] = useState<KeyboardFrame>(HIDDEN)
  useEffect(() => {
    const subs =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillChangeFrame', (e) => setFrame(frameFrom(e))),
            Keyboard.addListener('keyboardWillHide', () => setFrame(HIDDEN)),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', (e) => setFrame(frameFrom(e))),
            Keyboard.addListener('keyboardDidHide', () => setFrame(HIDDEN)),
          ]
    return () => subs.forEach((s) => s.remove())
  }, [])
  return frame
}

/** Live height of the on-screen keyboard (0 when hidden). */
export function useKeyboardHeight() {
  return useKeyboardFrame().height
}

/** ScrollView that keeps the focused text field visible above the keyboard.
 * Pads the content by the keyboard height (so the last field can scroll clear)
 * and scrolls whichever field has focus into view: when the keyboard opens,
 * when focus moves to another field, and when a multi-line field grows as the
 * person types. Pass `pad={false}` inside a `<Sheet>`, which already lifts itself. */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps & { pad?: boolean }>(
  function KeyboardAwareScrollView({ pad = true, contentContainerStyle, onScroll, children, ...rest }, ref) {
    const { height: windowHeight } = useWindowDimensions()
    const keyboard = useKeyboardFrame()
    const keyboardHeight = keyboard.height
    const inner = useRef<ScrollView | null>(null)
    const offset = useRef(0)
    const lastFocused = useRef<unknown>(null)
    const lastHeight = useRef(0)

    const setRefs = useCallback(
      (node: ScrollView | null) => {
        inner.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref],
    )

    const reveal = useCallback(
      (reason: 'open' | 'focus' | 'grow') => {
        const field = TextInput.State.currentlyFocusedInput?.()
        if (!field || !inner.current) return
        field.measureInWindow((_x, y, _w, h) => {
          // The keyboard's own top edge is the most reliable line (it already
          // allows for Android's navigation bar); fall back to the window maths.
          const keyboardTop = keyboard.top != null && keyboard.top < windowHeight + 200 ? Math.min(keyboard.top, windowHeight) : windowHeight - keyboardHeight
          const visibleBottom = keyboardTop - MARGIN
          const overlap = y + h - visibleBottom
          if (overlap > 0) {
            // A field taller than the space left: show its bottom (where the
            // cursor usually is) rather than pushing its top off the screen.
            inner.current?.scrollTo({ y: offset.current + overlap, animated: true })
          } else if (reason !== 'grow' && y < TOP_ROOM && lastFocused.current !== field) {
            inner.current?.scrollTo({ y: Math.max(0, offset.current + y - TOP_ROOM), animated: true })
          }
          lastFocused.current = field
          lastHeight.current = h
        })
      },
      [keyboard.top, keyboardHeight, windowHeight],
    )

    useEffect(() => {
      if (keyboardHeight === 0) {
        lastFocused.current = null
        lastHeight.current = 0
        return
      }
      // Twice: once straight away, once after layout settles (padding applied,
      // Android's keyboard finishing its slide).
      const first = setTimeout(() => reveal('open'), 60)
      const second = setTimeout(() => reveal('open'), 320)
      // Catches focus moving between fields, and a multi-line field growing.
      const poll = setInterval(() => {
        const field = TextInput.State.currentlyFocusedInput?.()
        if (!field) return
        if (field !== lastFocused.current) {
          reveal('focus')
          return
        }
        field.measureInWindow((_x, _y, _w, h) => {
          if (Math.abs(h - lastHeight.current) > 2) reveal('grow')
        })
      }, 250)
      return () => {
        clearTimeout(first)
        clearTimeout(second)
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
