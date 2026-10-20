import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, G, Polyline, Rect, Text as SvgText } from 'react-native-svg'

/**
 * Short looping explainers (about 5 s, one caption line) instead of paragraphs.
 * Pure react-native-svg + Reanimated, so they ship JS-only by OTA (no Lottie).
 * With reduced motion on, each shows its finished frame and does not move.
 *
 * Every scene is a function of one clock `t` (0 to 1) and is complete by
 * t = 0.85, so `t = 1` is also the static frame.
 */

export type ExplainerKind = 'join' | 'scan' | 'stamps' | 'tiers' | 'points' | 'spend'

export const EXPLAINER_CAPTIONS: Record<ExplainerKind, string> = {
  join: 'Customers scan your poster to join.',
  scan: 'You scan their QR and their progress fills.',
  stamps: 'Every visit fills a stamp. Full card, free reward.',
  tiers: 'The more they spend, the higher their level.',
  points: 'Every £ spent earns points towards rewards.',
  spend: 'Every £ spent fills the bar towards a reward.',
}

const LOOP_MS = 5600
const INK = '#F4F3EF'
const ORANGE = '#F2672A'
const GREEN = '#4CC07A'
const GOLD = '#E0A82E'
const PAPER = '#151716'
const TRACK = '#332A19'
const BG: Record<ExplainerKind, string> = {
  join: '#2A1D14',
  scan: '#15241A',
  stamps: '#2A1D14',
  tiers: '#1F1A2B',
  points: '#29230F',
  spend: '#15241A',
}

/** 0 before a, 1 after b, linear between. */
function ramp(t: number, a: number, b: number) {
  'worklet'
  return Math.min(1, Math.max(0, (t - a) / (b - a)))
}

const AnimatedRect = Animated.createAnimatedComponent(Rect)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedG = Animated.createAnimatedComponent(G)

type Clock = SharedValue<number>

function ARect({ t, map, ...rest }: ComponentProps<typeof Rect> & { t: Clock; map: (t: number) => Record<string, number> }) {
  const animatedProps = useAnimatedProps(() => map(t.value))
  return <AnimatedRect animatedProps={animatedProps} {...rest} />
}
function ACircle({ t, map, ...rest }: ComponentProps<typeof Circle> & { t: Clock; map: (t: number) => Record<string, number> }) {
  const animatedProps = useAnimatedProps(() => map(t.value))
  return <AnimatedCircle animatedProps={animatedProps} {...rest} />
}
/** A group whose opacity follows the clock. */
function Fade({ t, from, to, out, children }: { t: Clock; from: number; to: number; out?: [number, number]; children: ReactNode }) {
  const animatedProps = useAnimatedProps(() => ({
    opacity: ramp(t.value, from, to) * (out ? 1 - ramp(t.value, out[0], out[1]) : 1),
  }))
  return <AnimatedG animatedProps={animatedProps}>{children}</AnimatedG>
}

/** A small fixed pseudo-QR so the scenes read as "a code". */
const QR_ROWS = ['1110111', '1010101', '1110011', '0001101', '1101110', '0111001', '1010111']
function QrCode({ x, y, size, color = INK }: { x: number; y: number; size: number; color?: string }) {
  const cell = size / QR_ROWS.length
  return (
    <G>
      {QR_ROWS.flatMap((row, r) =>
        row.split('').map((bit, c) =>
          bit === '1' ? <Rect key={`${r}-${c}`} x={x + c * cell} y={y + r * cell} width={cell} height={cell} fill={color} /> : null,
        ),
      )}
    </G>
  )
}

function Phone({ x, y, w = 90, h = 140, children }: { x: number; y: number; w?: number; h?: number; children?: ReactNode }) {
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} rx={16} fill={INK} />
      <Rect x={x + 6} y={y + 10} width={w - 12} height={h - 20} rx={8} fill={PAPER} />
      {children}
    </G>
  )
}

function Check({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <Polyline
      points={`${cx - 7 * s},${cy} ${cx - 2 * s},${cy + 6 * s} ${cx + 8 * s},${cy - 7 * s}`}
      fill="none"
      stroke="#fff"
      strokeWidth={3.5 * s}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function Join({ t }: { t: Clock }) {
  return (
    <>
      {/* The shop's poster */}
      <Rect x={34} y={26} width={86} height={128} rx={10} fill={PAPER} stroke={INK} strokeWidth={2} />
      <QrCode x={48} y={44} size={58} />
      <Rect x={50} y={116} width={54} height={5} rx={2.5} fill={ORANGE} />
      <Rect x={58} y={128} width={38} height={4} rx={2} fill={TRACK} />
      {/* scan beam over the poster */}
      <ARect t={t} x={40} width={74} height={4} rx={2} fill={ORANGE} map={(v) => { 'worklet'; return { y: 40 + ramp(v, 0.06, 0.4) * 76, opacity: ramp(v, 0.04, 0.08) * (1 - ramp(v, 0.4, 0.44)) } }} />
      {/* the phone */}
      <Phone x={196} y={20} />
      {/* a spark travels poster -> phone */}
      <ACircle t={t} cy={90} r={5} fill={ORANGE} map={(v) => { 'worklet'; return { cx: 124 + ramp(v, 0.4, 0.56) * 76, opacity: ramp(v, 0.4, 0.42) * (1 - ramp(v, 0.56, 0.6)) } }} />
      {/* the loyalty card appears */}
      <ARect t={t} x={206} y={52} width={70} rx={9} fill={ORANGE} map={(v) => { 'worklet'; return { height: ramp(v, 0.58, 0.72) * 46 } }} />
      <Fade t={t} from={0.66} to={0.74}>
        <Rect x={214} y={62} width={34} height={5} rx={2.5} fill="#fff" />
        <Rect x={214} y={73} width={50} height={4} rx={2} fill="#fff" opacity={0.6} />
      </Fade>
      <ACircle t={t} cx={241} cy={124} fill={GREEN} map={(v) => { 'worklet'; return { r: ramp(v, 0.74, 0.84) * 14 } }} />
      <Fade t={t} from={0.8} to={0.86}>
        <Check cx={241} cy={124} s={0.8} />
      </Fade>
    </>
  )
}

function Scan({ t }: { t: Clock }) {
  return (
    <>
      {/* staff phone with a viewfinder */}
      <Phone x={26} y={20} />
      <Fade t={t} from={0} to={0.02} out={[0.46, 0.52]}>
        <Polyline points="42,56 42,46 52,46" fill="none" stroke={ORANGE} strokeWidth={3} strokeLinecap="round" />
        <Polyline points="98,46 108,46 108,56" fill="none" stroke={ORANGE} strokeWidth={3} strokeLinecap="round" />
        <Polyline points="42,98 42,108 52,108" fill="none" stroke={ORANGE} strokeWidth={3} strokeLinecap="round" />
        <Polyline points="98,108 108,108 108,98" fill="none" stroke={ORANGE} strokeWidth={3} strokeLinecap="round" />
      </Fade>
      <ARect t={t} x={44} width={62} height={3} rx={1.5} fill={ORANGE} map={(v) => { 'worklet'; return { y: 50 + ramp(v, 0.05, 0.45) * 54, opacity: ramp(v, 0.04, 0.08) * (1 - ramp(v, 0.44, 0.48)) } }} />
      {/* progress appears on the staff phone once the scan lands */}
      <ACircle t={t} cx={75} cy={64} fill={GREEN} map={(v) => { 'worklet'; return { r: ramp(v, 0.5, 0.58) * 15 } }} />
      <Fade t={t} from={0.56} to={0.6}>
        <Check cx={75} cy={64} s={0.8} />
      </Fade>
      <Rect x={42} y={96} width={66} height={10} rx={5} fill={TRACK} />
      <ARect t={t} x={42} y={96} height={10} rx={5} fill={ORANGE} map={(v) => { 'worklet'; return { width: 66 * (0.35 + 0.5 * ramp(v, 0.58, 0.82)) } }} />
      {/* customer phone showing a QR */}
      <Phone x={204} y={20} />
      <QrCode x={218} y={52} size={62} />
      <Rect x={218} y={118} width={62} height={5} rx={2.5} fill={TRACK} />
      {/* beam between the phones */}
      <ARect t={t} x={122} y={86} height={3} rx={1.5} fill={ORANGE} map={(v) => { 'worklet'; return { width: ramp(v, 0.1, 0.46) * 78, opacity: 0.5 * ramp(v, 0.08, 0.12) * (1 - ramp(v, 0.46, 0.5)) } }} />
    </>
  )
}

function Stamps({ t }: { t: Clock }) {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <G key={i}>
          <Circle cx={52 + i * 43} cy={66} r={17} fill={PAPER} stroke={INK} strokeWidth={2} />
          <ACircle t={t} cx={52 + i * 43} cy={66} fill={ORANGE} map={(v) => { 'worklet'; return { r: ramp(v, 0.06 + i * 0.1, 0.14 + i * 0.1) * 14 } }} />
        </G>
      ))}
      <ARect t={t} x={60} y={112} height={38} rx={19} fill={GREEN} map={(v) => { 'worklet'; return { width: ramp(v, 0.68, 0.8) * 200 } }} />
      <Fade t={t} from={0.76} to={0.84}>
        <SvgText x={160} y={137} fontSize={17} fontWeight="800" fill="#fff" textAnchor="middle">Free coffee!</SvgText>
      </Fade>
    </>
  )
}

function Tiers({ t }: { t: Clock }) {
  const steps = [
    { x: 40, h: 46, colour: '#DCAC7F', label: 'Member', a: 0.04, b: 0.2 },
    { x: 124, h: 76, colour: '#7D847E', label: 'Silver', a: 0.26, b: 0.46 },
    { x: 208, h: 106, colour: GOLD, label: 'Gold', a: 0.52, b: 0.74 },
  ]
  return (
    <>
      {steps.map(({ x, h, colour, label, a, b }) => (
        <G key={label}>
          <Rect x={x} y={140 - h} width={72} height={h} rx={10} fill={TRACK} />
          <ARect t={t} x={x} width={72} rx={10} fill={colour} map={(v) => { 'worklet'; const k = ramp(v, a, b) * h; return { y: 140 - k, height: k } }} />
          <SvgText x={x + 36} y={160} fontSize={13} fontWeight="800" fill={INK} textAnchor="middle">{label}</SvgText>
        </G>
      ))}
      <ACircle t={t} cx={244} cy={20} fill={GOLD} map={(v) => { 'worklet'; return { r: ramp(v, 0.74, 0.84) * 10 } }} />
    </>
  )
}

/** A number that follows the clock, shown in the middle of a scene. */
function useCounter(t: Clock, to: number, a: number, b: number, reduced: boolean) {
  const [value, setValue] = useState(reduced ? to : 0)
  useAnimatedReaction(
    () => Math.round(ramp(t.value, a, b) * to),
    (next, prev) => {
      if (next !== prev) runOnJS(setValue)(next)
    },
  )
  return reduced ? to : value
}

function Points({ t, reduced }: { t: Clock; reduced: boolean }) {
  const points = useCounter(t, 200, 0.08, 0.74, reduced)
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <ACircle key={i} t={t} cx={64 + i * 64} r={11} fill={GOLD} stroke="#EAC270" strokeWidth={2} map={(v) => { 'worklet'; const p = ramp(v, 0.06 + i * 0.16, 0.18 + i * 0.16); return { cy: 18 + p * 34, opacity: p > 0 && p < 1 ? 1 : 0 } }} />
      ))}
      <Rect x={40} y={118} width={240} height={14} rx={7} fill={TRACK} />
      <ARect t={t} x={40} y={118} height={14} rx={7} fill={ORANGE} map={(v) => { 'worklet'; return { width: 240 * ramp(v, 0.08, 0.74) } }} />
      <SvgText x={160} y={96} fontSize={34} fontWeight="800" fill={INK} textAnchor="middle">{points} pts</SvgText>
      <SvgText x={280} y={154} fontSize={12} fontWeight="700" fill={INK} textAnchor="end">Reward at 200</SvgText>
    </>
  )
}

function Spend({ t, reduced }: { t: Clock; reduced: boolean }) {
  const amount = useCounter(t, 50, 0.08, 0.74, reduced)
  return (
    <>
      <Rect x={40} y={104} width={240} height={26} rx={13} fill={TRACK} />
      <ARect t={t} x={40} y={104} height={26} rx={13} fill={GREEN} map={(v) => { 'worklet'; return { width: 240 * ramp(v, 0.08, 0.74) } }} />
      <SvgText x={160} y={76} fontSize={36} fontWeight="800" fill={INK} textAnchor="middle">£{amount}</SvgText>
      <SvgText x={280} y={154} fontSize={12} fontWeight="700" fill={INK} textAnchor="end">Reward at £50</SvgText>
      <ACircle t={t} cx={262} cy={40} fill={GOLD} map={(v) => { 'worklet'; return { r: ramp(v, 0.74, 0.84) * 14 } }} />
    </>
  )
}

export function Explainer({ kind, caption, showCaption = true }: { kind: ExplainerKind; caption?: string; showCaption?: boolean }) {
  const reduced = useReducedMotion()
  const t = useSharedValue(1)

  useEffect(() => {
    if (reduced) {
      cancelAnimation(t)
      t.value = 1
      return
    }
    t.value = 0
    t.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(t)
  }, [reduced, t])

  const scene =
    kind === 'join' ? <Join t={t} /> :
    kind === 'scan' ? <Scan t={t} /> :
    kind === 'stamps' ? <Stamps t={t} /> :
    kind === 'tiers' ? <Tiers t={t} /> :
    kind === 'points' ? <Points t={t} reduced={reduced} /> :
    <Spend t={t} reduced={reduced} />

  const text = caption ?? EXPLAINER_CAPTIONS[kind]
  return (
    <View style={styles.wrap} accessible accessibilityRole="image" accessibilityLabel={text}>
      <View style={[styles.frame, { backgroundColor: BG[kind] }]}>
        <Svg viewBox="0 0 320 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {scene}
        </Svg>
      </View>
      {showCaption && <Text style={styles.caption}>{text}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  frame: { width: '100%', aspectRatio: 320 / 180, borderRadius: 22, overflow: 'hidden' },
  caption: { color: '#9DA49E', fontSize: 16, fontWeight: '800', marginTop: 10, textAlign: 'center' },
})
