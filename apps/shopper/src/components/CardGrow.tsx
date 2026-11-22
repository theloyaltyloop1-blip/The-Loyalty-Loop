import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { Image, Keyboard, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// "Don't cut. Carry." A tapped card grows into the shop page, and Back shrinks the
// page into the card's spot again (measured again on the way back, in case the list
// moved). The page itself is drawn from the first frame, seen through a window that
// grows from the card's rectangle to the whole screen. A layer in the card's colour
// sits over it and turns into the shop's colour, then fades to show the page.
//
// Taps that don't come from a card (notifications, sheets, links) open with the old
// hard cut. So does any tap whose card can't be measured.

/** What the card looked like, so the growing window starts as the same object. */
export type CardLook = { color: string; radius: number; /** The tile is the designed card: the overlay draws `face` scaled to the window. */ face?: boolean }

type Measurable = { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void }
type Rect = { x: number; y: number; width: number; height: number }
type Origin = { id: string; target: Measurable; look: CardLook; at: number }

// Perceived ~320ms, no overshoot. A spring, so Back mid-growth turns around smoothly.
const SPRING = { duration: 320, dampingRatio: 1, overshootClamping: true }
const FADE_MS = 160
// A card tap is only used for the page it opened, and only straight away.
const ORIGIN_FRESH_MS = 1500

let pending: Origin | null = null

function isMeasurable(target: unknown): target is Measurable {
  return typeof target === 'object' && target !== null && 'measureInWindow' in target && typeof target.measureInWindow === 'function'
}

/** Call in a card's onPress, just before it opens the shop. `target` is the press event's
 * `currentTarget` (or a ref's current view). Never blocks the tap: if the card can't be
 * measured later, the page simply opens as before. */
export function markCardOrigin(id: string, target: unknown, look: CardLook) {
  pending = isMeasurable(target) ? { id, target, look, at: Date.now() } : null
}

function originFor(id: string): Origin | null {
  return pending && pending.id === id && Date.now() - pending.at < ORIGIN_FRESH_MS ? pending : null
}

function measure(target: Measurable): Promise<Rect | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), 150)
    try {
      target.measureInWindow((x, y, width, height) => {
        clearTimeout(timer)
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null)
      })
    } catch {
      // The card is gone (unmounted): fall back without the shape.
      clearTimeout(timer)
      resolve(null)
    }
  })
}

export type CardGrowHandle = { close: () => void }

export function CardGrowOverlay({ ref, shopId, pageColor, logoUrl, face, faceWidth = 300, onClosed, children }: {
  ref?: Ref<CardGrowHandle>
  shopId: string
  /** The shop page's own background, which the card's colour turns into. */
  pageColor: string
  logoUrl?: string | null
  /** The designed card, drawn at `faceWidth` wide; scaled to fill the window while it moves. */
  face?: ReactNode
  faceWidth?: number
  /** The page has finished leaving (or left at once): unmount it. */
  onClosed: () => void
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  const screen = useWindowDimensions()
  const [size, setSize] = useState({ width: screen.width, height: screen.height })
  const [origin] = useState(() => originFor(shopId))
  const [closing, setClosing] = useState(false)
  const rootRef = useRef<View>(null)
  const rootOffset = useRef({ x: 0, y: 0 })
  const grew = useRef(false)
  const closingRef = useRef(false)
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed

  // 0 = the card's rectangle, 1 = the whole screen.
  const progress = useSharedValue(origin && !reduced ? 0 : 1)
  // Hidden until the card is measured; reduced motion fades it in.
  const shown = useSharedValue(origin || reduced ? 0 : 1)
  const cardX = useSharedValue(0)
  const cardY = useSharedValue(0)
  const cardW = useSharedValue(0)
  const cardH = useSharedValue(0)
  const fullW = useSharedValue(size.width)
  const fullH = useSharedValue(size.height)

  const finish = useCallback(() => onClosedRef.current(), [])

  useEffect(() => {
    // A search box left focused underneath would otherwise keep the keyboard over the page.
    Keyboard.dismiss()
    if (reduced) {
      shown.set(withTiming(1, { duration: FADE_MS }))
      return
    }
    if (!origin) return
    let active = true
    void (async () => {
      const [root, card] = await Promise.all([
        rootRef.current ? measure(rootRef.current) : Promise.resolve(null),
        measure(origin.target),
      ])
      if (!active) return
      if (!root || !card) {
        // Can't see the card: open the way it always did.
        progress.set(1)
        shown.set(1)
        return
      }
      rootOffset.current = { x: root.x, y: root.y }
      fullW.set(root.width)
      fullH.set(root.height)
      cardX.set(card.x - root.x)
      cardY.set(card.y - root.y)
      cardW.set(card.width)
      cardH.set(card.height)
      grew.current = true
      shown.set(1)
      if (!closingRef.current) progress.set(withSpring(1, SPRING))
    })()
    return () => { active = false }
    // Runs once per opened page; the overlay is keyed by each open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fadeOut = useCallback(() => {
    shown.set(withTiming(0, { duration: FADE_MS }, done => { if (done) scheduleOnRN(finish) }))
  }, [finish, shown])

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    if (reduced) { fadeOut(); return }
    if (!origin || !grew.current) { finish(); return }
    void measure(origin.target).then(card => {
      const H = fullH.get()
      // The card scrolled away or left the list: fade rather than fly off screen.
      if (!card || card.y + card.height - rootOffset.current.y < 0 || card.y - rootOffset.current.y > H) { fadeOut(); return }
      cardX.set(card.x - rootOffset.current.x)
      cardY.set(card.y - rootOffset.current.y)
      cardW.set(card.width)
      cardH.set(card.height)
      progress.set(withSpring(0, SPRING, done => { if (done) scheduleOnRN(finish) }))
    })
  }, [cardH, cardW, cardX, cardY, fadeOut, finish, fullH, origin, progress, reduced])

  useImperativeHandle(ref, () => ({ close }), [close])

  const radius = origin?.look.radius ?? 0
  const frameStyle = useAnimatedStyle(() => {
    const p = progress.get()
    return {
      opacity: shown.get(),
      left: interpolate(p, [0, 1], [cardX.get(), 0]),
      top: interpolate(p, [0, 1], [cardY.get(), 0]),
      width: interpolate(p, [0, 1], [cardW.get(), fullW.get()]),
      height: interpolate(p, [0, 1], [cardH.get(), fullH.get()]),
      borderRadius: interpolate(p, [0, 1], [radius, 0]),
    }
  })
  // The page stays pinned to the screen while the window around it moves.
  const pageStyle = useAnimatedStyle(() => {
    const p = progress.get()
    return {
      transform: [
        { translateX: -interpolate(p, [0, 1], [cardX.get(), 0]) },
        { translateY: -interpolate(p, [0, 1], [cardY.get(), 0]) },
      ],
    }
  })
  const faceStyle = useAnimatedStyle(() => {
    const w = interpolate(progress.get(), [0, 1], [cardW.get(), fullW.get()])
    return { transform: [{ scale: w / faceWidth }] }
  })
  const showFace = !!(face && origin?.look.face)
  const cardColor = origin?.look.color ?? pageColor
  const skinStyle = useAnimatedStyle(() => {
    const p = progress.get()
    return {
      // The card's own contents dissolve into its colour, the colour becomes the
      // shop's, then the page shows through once the window is mostly open.
      // Fully opaque from the first frame so no clipped page chrome shows at the small end.
      opacity: interpolate(p, [0, 0.55, 0.9], [1, 1, 0], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(p, [0.15, 0.6], [cardColor, pageColor]),
    }
  })

  return (
    <View
      ref={rootRef}
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout
        setSize({ width, height })
        fullW.set(width)
        fullH.set(height)
      }}
    >
      <Animated.View accessibilityViewIsModal pointerEvents={closing ? 'none' : 'auto'} style={[s.frame, frameStyle]}>
        <Animated.View style={[s.page, { width: size.width, height: size.height }, pageStyle]}>{children}</Animated.View>
        {origin && !reduced ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.skin, skinStyle]}>
            {showFace ? <Animated.View style={[s.face, { width: faceWidth }, faceStyle]}>{face}</Animated.View> : null}
            {!showFace && logoUrl ? <View style={s.logo}><Image accessibilityIgnoresInvertColors source={{ uri: logoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /></View> : null}
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  frame: { position: 'absolute', overflow: 'hidden' },
  page: { position: 'absolute', left: 0, top: 0 },
  skin: { alignItems: 'center', justifyContent: 'center' },
  face: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
  logo: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: '#FFFFFF' },
})
