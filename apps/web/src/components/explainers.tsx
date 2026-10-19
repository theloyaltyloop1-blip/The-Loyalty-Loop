import * as React from 'react'

/**
 * Short looping explainers (about 5 s, one caption line), the web twin of
 * apps/retailer/src/components/Explainers.tsx. Plain SVG + CSS keyframes, only
 * opacity and transform are animated. Every element's resting style is its
 * finished state, so with prefers-reduced-motion the animation is switched off
 * and the finished frame shows.
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

const LOOP_S = 5.6
const INK = '#1B1B1B'
const ORANGE = '#C0501F'
const GREEN = '#2F6B3F'
const GOLD = '#E0A82E'
const TRACK = '#E8DFD0'
const BG: Record<ExplainerKind, string> = {
  join: '#FFF1E3',
  scan: '#E8F3EA',
  stamps: '#FFF1E3',
  tiers: '#F1ECFA',
  points: '#FFF6DD',
  spend: '#E8F3EA',
}

type Style = { opacity?: number; transform?: string }
type Keys = Array<[number, Style]>

const css = (s: Style) => `${s.opacity !== undefined ? `opacity:${s.opacity};` : ''}${s.transform ? `transform:${s.transform};` : ''}`

/** From `from` until a, to `to` by b, held until the loop restarts. */
const rise = (a: number, b: number, from: Style, to: Style): Keys => [[0, from], [a, from], [b, to], [1, to]]
const fadeIn = (a: number, b: number): Keys => rise(a, b, { opacity: 0 }, { opacity: 1 })
const grow = (a: number, b: number, axis: 'X' | 'Y' | '', origin: string) =>
  ({ keys: rise(a, b, { transform: `scale${axis}(0)` }, { transform: `scale${axis}(1)` }), origin })

type AnimProps = React.SVGProps<SVGElement> & {
  tag: 'rect' | 'circle' | 'g' | 'text' | 'polyline'
  keys: Keys
  /** CSS transform-origin within the element's own box. */
  origin?: string
  /** Resting style (the finished frame). */
  rest?: Style
}

/** An SVG element that plays `keys` once per loop and rests on its last key. */
function A({ tag, keys, origin = 'center', rest, children, style, ...props }: AnimProps) {
  const id = 'ex' + React.useId().replace(/[^a-zA-Z0-9]/g, '')
  const last = rest ?? keys[keys.length - 1][1]
  const frames = keys.map(([at, s]) => `${(at * 100).toFixed(1)}%{${css(s)}}`).join('')
  const Tag = tag as React.ElementType
  return (
    <>
      <style>{`.${id}{transform-box:fill-box;transform-origin:${origin};${css(last)}animation:${id} ${LOOP_S}s linear infinite}@keyframes ${id}{${frames}}`}</style>
      <Tag className={id} style={style} {...props}>{children}</Tag>
    </>
  )
}

const QR_ROWS = ['1110111', '1010101', '1110011', '0001101', '1101110', '0111001', '1010111']
function Qr({ x, y, size }: { x: number; y: number; size: number }) {
  const cell = size / QR_ROWS.length
  return (
    <g>
      {QR_ROWS.flatMap((row, r) =>
        row.split('').map((bit, c) => (bit === '1' ? <rect key={`${r}-${c}`} x={x + c * cell} y={y + r * cell} width={cell} height={cell} fill={INK} /> : null)),
      )}
    </g>
  )
}

function Phone({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={90} height={140} rx={16} fill={INK} />
      <rect x={x + 6} y={y + 10} width={78} height={120} rx={8} fill="#fff" />
    </g>
  )
}

const Tick = ({ cx, cy, s = 0.8 }: { cx: number; cy: number; s?: number }) => (
  <polyline points={`${cx - 7 * s},${cy} ${cx - 2 * s},${cy + 6 * s} ${cx + 8 * s},${cy - 7 * s}`} fill="none" stroke="#fff" strokeWidth={3.5 * s} strokeLinecap="round" strokeLinejoin="round" />
)

function Join() {
  return (
    <>
      <rect x={34} y={26} width={86} height={128} rx={10} fill="#fff" stroke={INK} strokeWidth={2} />
      <Qr x={48} y={44} size={58} />
      <rect x={50} y={116} width={54} height={5} rx={2.5} fill={ORANGE} />
      <rect x={58} y={128} width={38} height={4} rx={2} fill={TRACK} />
      {/* scan beam sweeping the poster, then gone */}
      <A tag="rect" x={40} y={40} width={74} height={4} rx={2} fill={ORANGE} rest={{ opacity: 0 }}
        keys={[[0, { opacity: 0, transform: 'translateY(0)' }], [0.06, { opacity: 1, transform: 'translateY(0)' }], [0.4, { opacity: 1, transform: 'translateY(76px)' }], [0.44, { opacity: 0, transform: 'translateY(76px)' }], [1, { opacity: 0, transform: 'translateY(76px)' }]]} />
      <Phone x={196} y={20} />
      <A tag="circle" cx={124} cy={90} r={5} fill={ORANGE} rest={{ opacity: 0 }}
        keys={[[0, { opacity: 0, transform: 'translateX(0)' }], [0.4, { opacity: 1, transform: 'translateX(0)' }], [0.56, { opacity: 1, transform: 'translateX(76px)' }], [0.6, { opacity: 0, transform: 'translateX(76px)' }], [1, { opacity: 0, transform: 'translateX(76px)' }]]} />
      <A tag="rect" x={206} y={52} width={70} height={46} rx={9} fill={ORANGE} {...grow(0.58, 0.72, 'Y', 'top')} />
      <A tag="g" keys={fadeIn(0.66, 0.74)}>
        <rect x={214} y={62} width={34} height={5} rx={2.5} fill="#fff" />
        <rect x={214} y={73} width={50} height={4} rx={2} fill="#fff" opacity={0.6} />
      </A>
      <A tag="circle" cx={241} cy={124} r={14} fill={GREEN} {...grow(0.74, 0.84, '', 'center')} />
      <A tag="g" keys={fadeIn(0.8, 0.86)}><Tick cx={241} cy={124} /></A>
    </>
  )
}

function Scan() {
  const bracket = { fill: 'none', stroke: ORANGE, strokeWidth: 3, strokeLinecap: 'round' as const }
  return (
    <>
      <Phone x={26} y={20} />
      <A tag="g" rest={{ opacity: 0 }} keys={[[0, { opacity: 1 }], [0.46, { opacity: 1 }], [0.52, { opacity: 0 }], [1, { opacity: 0 }]]}>
        <polyline points="42,56 42,46 52,46" {...bracket} />
        <polyline points="98,46 108,46 108,56" {...bracket} />
        <polyline points="42,98 42,108 52,108" {...bracket} />
        <polyline points="98,108 108,108 108,98" {...bracket} />
      </A>
      <A tag="rect" x={44} y={50} width={62} height={3} rx={1.5} fill={ORANGE} rest={{ opacity: 0 }}
        keys={[[0, { opacity: 0, transform: 'translateY(0)' }], [0.05, { opacity: 1, transform: 'translateY(0)' }], [0.45, { opacity: 1, transform: 'translateY(54px)' }], [0.48, { opacity: 0, transform: 'translateY(54px)' }], [1, { opacity: 0, transform: 'translateY(54px)' }]]} />
      <A tag="circle" cx={75} cy={64} r={15} fill={GREEN} {...grow(0.5, 0.58, '', 'center')} />
      <A tag="g" keys={fadeIn(0.56, 0.6)}><Tick cx={75} cy={64} /></A>
      <rect x={42} y={96} width={66} height={10} rx={5} fill={TRACK} />
      <A tag="rect" x={42} y={96} width={56} height={10} rx={5} fill={ORANGE}
        keys={[[0, { transform: 'scaleX(0.63)' }], [0.58, { transform: 'scaleX(0.63)' }], [0.82, { transform: 'scaleX(1)' }], [1, { transform: 'scaleX(1)' }]]} origin="left" />
      <Phone x={204} y={20} />
      <Qr x={218} y={52} size={62} />
      <rect x={218} y={118} width={62} height={5} rx={2.5} fill={TRACK} />
      <A tag="rect" x={122} y={86} width={78} height={3} rx={1.5} fill={ORANGE} rest={{ opacity: 0 }} origin="left"
        keys={[[0, { opacity: 0, transform: 'scaleX(0)' }], [0.1, { opacity: 0.5, transform: 'scaleX(0)' }], [0.46, { opacity: 0.5, transform: 'scaleX(1)' }], [0.5, { opacity: 0, transform: 'scaleX(1)' }], [1, { opacity: 0, transform: 'scaleX(1)' }]]} />
    </>
  )
}

function Stamps() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <circle cx={52 + i * 43} cy={66} r={17} fill="#fff" stroke={INK} strokeWidth={2} />
          <A tag="circle" cx={52 + i * 43} cy={66} r={14} fill={ORANGE} {...grow(0.06 + i * 0.1, 0.14 + i * 0.1, '', 'center')} />
        </g>
      ))}
      <A tag="rect" x={60} y={112} width={200} height={38} rx={19} fill={GREEN} {...grow(0.68, 0.8, 'X', 'center')} />
      <A tag="g" keys={fadeIn(0.76, 0.84)}>
        <text x={160} y={137} fontSize={17} fontWeight={800} fill="#fff" textAnchor="middle">Free coffee!</text>
      </A>
    </>
  )
}

function Tiers() {
  const steps = [
    { x: 40, h: 46, colour: '#B87333', label: 'Member', a: 0.04, b: 0.2 },
    { x: 124, h: 76, colour: '#8D97A3', label: 'Silver', a: 0.26, b: 0.46 },
    { x: 208, h: 106, colour: GOLD, label: 'Gold', a: 0.52, b: 0.74 },
  ]
  return (
    <>
      {steps.map(({ x, h, colour, label, a, b }) => (
        <g key={label}>
          <rect x={x} y={140 - h} width={72} height={h} rx={10} fill={TRACK} />
          <A tag="rect" x={x} y={140 - h} width={72} height={h} rx={10} fill={colour} {...grow(a, b, 'Y', 'bottom')} />
          <text x={x + 36} y={160} fontSize={13} fontWeight={800} fill={INK} textAnchor="middle">{label}</text>
        </g>
      ))}
      <A tag="circle" cx={244} cy={20} r={10} fill={GOLD} {...grow(0.74, 0.84, '', 'center')} />
    </>
  )
}

/** A number that follows the loop clock (the only JS in the scenes). */
function useCounter(to: number, a: number, b: number, still: boolean) {
  const [value, setValue] = React.useState(to)
  React.useEffect(() => {
    if (still) { setValue(to); return }
    const start = performance.now()
    const id = window.setInterval(() => {
      const t = (((performance.now() - start) / 1000) % LOOP_S) / LOOP_S
      setValue(Math.round(Math.min(1, Math.max(0, (t - a) / (b - a))) * to))
    }, 90)
    return () => window.clearInterval(id)
  }, [to, a, b, still])
  return value
}

function Points({ still }: { still: boolean }) {
  const points = useCounter(200, 0.08, 0.74, still)
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <A key={i} tag="circle" cx={64 + i * 64} cy={18} r={11} fill={GOLD} stroke="#B4811A" strokeWidth={2} rest={{ opacity: 0 }}
          keys={[[0, { opacity: 0, transform: 'translateY(0)' }], [0.06 + i * 0.16, { opacity: 1, transform: 'translateY(0)' }], [0.18 + i * 0.16, { opacity: 0, transform: 'translateY(34px)' }], [1, { opacity: 0, transform: 'translateY(34px)' }]]} />
      ))}
      <rect x={40} y={118} width={240} height={14} rx={7} fill={TRACK} />
      <A tag="rect" x={40} y={118} width={240} height={14} rx={7} fill={ORANGE} {...grow(0.08, 0.74, 'X', 'left')} />
      <text x={160} y={96} fontSize={34} fontWeight={800} fill={INK} textAnchor="middle">{points} pts</text>
      <text x={280} y={154} fontSize={12} fontWeight={700} fill={INK} textAnchor="end">Reward at 200</text>
    </>
  )
}

function Spend({ still }: { still: boolean }) {
  const amount = useCounter(50, 0.08, 0.74, still)
  return (
    <>
      <rect x={40} y={104} width={240} height={26} rx={13} fill={TRACK} />
      <A tag="rect" x={40} y={104} width={240} height={26} rx={13} fill={GREEN} {...grow(0.08, 0.74, 'X', 'left')} />
      <text x={160} y={76} fontSize={36} fontWeight={800} fill={INK} textAnchor="middle">£{amount}</text>
      <text x={280} y={154} fontSize={12} fontWeight={700} fill={INK} textAnchor="end">Reward at £50</text>
      <A tag="circle" cx={262} cy={40} r={14} fill={GOLD} {...grow(0.74, 0.84, '', 'center')} />
    </>
  )
}

export function Explainer({ kind, caption, showCaption = true }: { kind: ExplainerKind; caption?: string; showCaption?: boolean }) {
  const [still, setStill] = React.useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  React.useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const onChange = () => setStill(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  const text = caption ?? EXPLAINER_CAPTIONS[kind]
  const scene =
    kind === 'join' ? <Join /> : kind === 'scan' ? <Scan /> : kind === 'stamps' ? <Stamps /> :
    kind === 'tiers' ? <Tiers /> : kind === 'points' ? <Points still={still} /> : <Spend still={still} />
  return (
    <figure className="m-0">
      <style>{`@media (prefers-reduced-motion: reduce){.ex-frame *{animation:none!important}}`}</style>
      <div className="ex-frame overflow-hidden rounded-3xl" style={{ background: BG[kind], aspectRatio: '320 / 180' }}>
        <svg viewBox="0 0 320 180" role="img" aria-label={text} className="block h-full w-full">{scene}</svg>
      </div>
      {showCaption && <figcaption className="mt-3 text-center font-semibold text-foreground">{text}</figcaption>}
    </figure>
  )
}
