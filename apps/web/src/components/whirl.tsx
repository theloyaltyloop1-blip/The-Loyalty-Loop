import { Whirl as KitWhirl, type WhirlEffect, type WhirlPose } from './whirl-kit'

export type { WhirlPose }

// Whirl the mascot now comes from the shared kit (components/whirl-kit, rules in docs/whirl-usage-rules.md): light/dark art follows
// `html.dark`, he is hidden when "Show Whirl" is off, and gets a short one-shot animation unless the visitor prefers reduced motion.
const DEFAULT_EFFECT: Partial<Record<WhirlPose, WhirlEffect>> = { wave: 'wave', celebrate: 'celebrate', oops: 'oops', thumbs: 'pop', stamp: 'stamp', peek: 'peek' }

/** Size comes from `className` (e.g. `h-24 w-24`); `size` only picks the full or the 40 px mini artwork. */
export function Whirl({ pose, className = '', size = 96, effect }: { pose: WhirlPose; className?: string; size?: number; effect?: WhirlEffect }) {
  return <KitWhirl pose={pose} size={size} className={className} effect={effect ?? DEFAULT_EFFECT[pose] ?? 'none'} />
}
