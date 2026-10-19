/**
 * The Loyalty Loop: loyalty programme logic shared by the website, the shopper
 * app and the Business app. One place for what each programme is called, whether
 * staff record a purchase amount, how a customer's progress reads, and the words
 * (stamps / visits / points) used around it.
 *
 * Keep this file self-contained (no imports) so it works unchanged under Metro,
 * Vite and `node --test`. The Deno edge functions cannot import a workspace
 * package; they mirror what they need (see supabase/functions/_shared).
 */

export type RewardModel = 'stamp_legacy' | 'spend_threshold' | 'tiers' | 'points'
export type LoyaltyType = 'stamp_card' | 'points' | 'tiered'
export type ProgrammeId = 'stamps' | 'spend' | 'tiers' | 'points'

// ---------------------------------------------------------------------------
// Programme registry

export interface Programme {
  id: ProgrammeId
  /** What businesses.reward_model holds for this programme. */
  model: RewardModel
  name: string
  /** One line an owner reads when choosing. */
  pitch: string
  bestFor: string
  /** True when staff record how much a customer spent. */
  recordsSpend: boolean
}

export const PROGRAMMES: Record<ProgrammeId, Programme> = {
  stamps: {
    id: 'stamps',
    model: 'stamp_legacy',
    name: 'Stamp card',
    pitch: 'A stamp for every visit, then a free reward.',
    bestFor: 'Cafés, barbers and bakeries',
    recordsSpend: false,
  },
  spend: {
    id: 'spend',
    model: 'spend_threshold',
    name: 'Spend rewards',
    pitch: 'Customers earn rewards as they spend.',
    bestFor: 'Salons, boutiques and higher-priced shops',
    recordsSpend: true,
  },
  tiers: {
    id: 'tiers',
    model: 'tiers',
    name: 'Membership tiers',
    pitch: 'Customers reach levels like Silver and Gold by spending over the year.',
    bestFor: 'Boutiques, jewellers and premium shops',
    recordsSpend: true,
  },
  points: {
    id: 'points',
    model: 'points',
    name: 'Points',
    pitch: 'Customers earn points on every £ and swap them for rewards.',
    bestFor: 'Shops where customers choose their own reward',
    recordsSpend: true,
  },
}

type ModelHolder = { reward_model?: string | null } | string | null | undefined

const modelOf = (value: ModelHolder): string | null | undefined =>
  typeof value === 'string' || value == null ? value : value.reward_model

/**
 * The programme a business runs. Legacy stamp / points / visit shops (the old
 * loyalty_type column) are all 'stamps'; 'points' here is the new £-based
 * Points programme (reward_model = 'points').
 */
export function programmeIdFor(value: ModelHolder): ProgrammeId {
  const model = modelOf(value)
  if (model === 'spend_threshold') return 'spend'
  if (model === 'tiers') return 'tiers'
  if (model === 'points') return 'points'
  return 'stamps'
}

/** True when staff record a purchase amount at scan (so no stamps are given). */
export function recordsSpend(value: ModelHolder): boolean {
  return PROGRAMMES[programmeIdFor(value)].recordsSpend
}

// ---------------------------------------------------------------------------
// Wording

export interface RewardWords {
  /** Singular noun for one unit of progress: "stamp", "visit". */
  unit: string
  units: string
  /** Heading word for the programme: "Stamp card", "Membership". */
  programme: string
  /** Label for the owner's threshold field. */
  thresholdLabel: string
  /** What a customer sees as progress, e.g. "2 more stamps until a reward". */
  remaining: (n: number) => string
}

const plural = (n: number, unit: string, units: string) => (n === 1 ? unit : units)

export function rewardWords(type: string | null | undefined): RewardWords {
  if (type === 'points') {
    return {
      unit: 'point', units: 'points', programme: 'Points',
      thresholdLabel: 'Points needed for a reward',
      remaining: (n) => `${n} more ${plural(n, 'point', 'points')} until a reward`,
    }
  }
  if (type === 'tiered') {
    return {
      unit: 'visit', units: 'visits', programme: 'Membership',
      thresholdLabel: 'Visits to reach the next level',
      remaining: (n) => `${n} more ${plural(n, 'visit', 'visits')} to reach the next level`,
    }
  }
  return {
    unit: 'stamp', units: 'stamps', programme: 'Stamp card',
    thresholdLabel: 'Stamps needed for a reward',
    remaining: (n) => `${n} more ${plural(n, 'stamp', 'stamps')} until a reward`,
  }
}

// ---------------------------------------------------------------------------
// Progress

export interface LoyaltyBusiness {
  id: string
  reward_model?: string | null
  loyalty_type?: string | null
  loyalty_config?: { stamps_required?: number; points_per_pound?: number } | null
  reward_threshold_pence?: number | null
}

export interface LoyaltyMember {
  stamp_count?: number | null
  points_balance?: number | null
  reward_progress_pence?: number | null
}

/** One reward in the shop's catalogue: the rung a customer is climbing towards. */
export interface LadderRung {
  business_id: string
  title: string
  stamp_threshold: number
  spend_threshold_pence?: number | null
}

export interface Progress {
  /** True when progress is money (pence) rather than a count. */
  spend: boolean
  unit: string
  value: number
  /** The next rung's threshold (or the configured one), null when unknown. */
  threshold: number | null
  /** Title of the next reward, null when the catalogue has none. */
  title: string | null
  /** "3 of 10 stamps" / "£12.00 of £50.00". */
  label: string
  /** Short offer line for cards: "10 stamps · Free coffee". */
  offer: string
  /** Reward name for tiles, with a neutral fallback. */
  reward: string
  /** 0..1 */
  fraction: number
}

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`

/**
 * What a customer's progress at a shop reads as, for the stamps and £ spend
 * programmes. Tiers and points shops have their own shapes: use
 * `tierStanding` and `pointsStanding` for those (branch on `programmeIdFor`).
 * Never invents a reward target when the catalogue is unavailable. `money`
 * formats pence in the shop's currency and defaults to pounds.
 */
export function progressFor(
  business: LoyaltyBusiness,
  member: LoyaltyMember | null | undefined,
  ladder: readonly LadderRung[],
  money: (pence: number) => string = pounds,
): Progress {
  const spend = programmeIdFor(business) === 'spend'
  const unit = rewardWords(business.loyalty_type).units
  const raw = spend
    ? member?.reward_progress_pence ?? 0
    : business.loyalty_type === 'points' ? member?.points_balance ?? 0 : member?.stamp_count ?? 0
  const value = Math.max(0, raw)
  const thresholdOf = (rung: LadderRung) => (spend ? rung.spend_threshold_pence ?? 0 : rung.stamp_threshold)
  const rungs = ladder
    .filter((rung) => rung.business_id === business.id && thresholdOf(rung) > 0)
    .slice()
    .sort((a, b) => thresholdOf(a) - thresholdOf(b))
  const next = rungs.find((rung) => thresholdOf(rung) > value) ?? rungs[rungs.length - 1]
  const configured = spend ? business.reward_threshold_pence : business.loyalty_config?.stamps_required
  const threshold = next ? thresholdOf(next) : configured && configured > 0 ? configured : null
  return {
    spend,
    unit,
    value,
    threshold,
    title: next?.title ?? null,
    label: threshold && value <= threshold
      ? `${spend ? money(value) : value} of ${spend ? money(threshold) : `${threshold} ${unit}`}`
      : `${spend ? money(value) : `${value} ${unit}`} collected`,
    offer: next
      ? spend ? `Spend ${money(threshold as number)} · ${next.title}` : `${threshold} ${unit} · ${next.title}`
      : 'Explore this shop’s rewards',
    reward: next?.title ?? 'Loyalty card',
    fraction: threshold ? Math.min(1, value / threshold) : 0,
  }
}

// ---------------------------------------------------------------------------
// Membership tiers (reward_model = 'tiers'): a level earned by £ spent in the
// last 12 months. The database does the maths; this describes the result.

export interface TierRung {
  id?: string
  name: string
  spend_threshold_pence: number
  perks?: readonly string[] | null
  colour?: string | null
}

export interface TierStanding {
  /** The level the customer is on now, null before the first level. */
  current: TierRung | null
  /** The next level up, null at the top. */
  next: TierRung | null
  /** Pence spent in the last 12 months. */
  spendPence: number
  /** Pence still to spend to reach `next`, null at the top. */
  toNextPence: number | null
  /** 0..1 progress between the current level and the next. */
  fraction: number
  /** "Gold · £150.00 to Platinum" */
  label: string
}

export function tierStanding(
  tiers: readonly TierRung[],
  rollingSpendPence: number,
  money: (pence: number) => string = pounds,
): TierStanding {
  const spendPence = Math.max(0, rollingSpendPence)
  const ladder = tiers.slice().sort((a, b) => a.spend_threshold_pence - b.spend_threshold_pence)
  let current: TierRung | null = null
  let next: TierRung | null = null
  for (const rung of ladder) {
    if (rung.spend_threshold_pence <= spendPence) current = rung
    else if (!next) next = rung
  }
  const from = current?.spend_threshold_pence ?? 0
  const toNextPence = next ? next.spend_threshold_pence - spendPence : null
  const fraction = next
    ? Math.min(1, Math.max(0, (spendPence - from) / Math.max(1, next.spend_threshold_pence - from)))
    : current ? 1 : 0
  const label = current && next
    ? `${current.name} · ${money(toNextPence as number)} to ${next.name}`
    : current ? `${current.name} · top level`
    : next ? `${money(toNextPence as number)} to ${next.name}`
    : 'No levels set up yet'
  return { current, next, spendPence, toNextPence, fraction, label }
}

// ---------------------------------------------------------------------------
// Points (reward_model = 'points'): earn per £, swap points for rewards.

export interface PointsReward {
  id: string
  title: string
  points_cost: number
}

export interface PointsStanding {
  balance: number
  /** Points earned per £1 spent (the shop's setting, default 1). */
  perPound: number
  /** Rewards the customer can swap for right now, cheapest first. */
  affordable: PointsReward[]
  /** The cheapest reward they can't afford yet, null if none. */
  next: PointsReward | null
  toNext: number | null
  /** 0..1 progress towards `next`. */
  fraction: number
  /** "240 points · 60 to Free cake" */
  label: string
}

/** Same rate rule the database applies: clamped to 0..1000 points per £. */
export function pointsPerPound(business: Pick<LoyaltyBusiness, 'loyalty_config'>): number {
  const rate = Number(business.loyalty_config?.points_per_pound ?? 1)
  return Number.isFinite(rate) ? Math.min(1000, Math.max(0, rate)) : 1
}

/** Points a purchase earns, matching the database (floor of pence x rate / 100). */
export function pointsEarned(business: Pick<LoyaltyBusiness, 'loyalty_config'>, pence: number): number {
  return Math.floor((Math.max(0, pence) * pointsPerPound(business)) / 100)
}

export function pointsStanding(
  business: Pick<LoyaltyBusiness, 'loyalty_config'>,
  balance: number,
  rewards: readonly PointsReward[],
): PointsStanding {
  const points = Math.max(0, balance)
  const sorted = rewards.filter((r) => r.points_cost > 0).slice().sort((a, b) => a.points_cost - b.points_cost)
  const affordable = sorted.filter((r) => r.points_cost <= points)
  const next = sorted.find((r) => r.points_cost > points) ?? null
  const toNext = next ? next.points_cost - points : null
  const label = `${points} point${points === 1 ? '' : 's'}` +
    (next ? ` · ${toNext} to ${next.title}` : affordable.length ? ' · rewards ready' : '')
  return {
    balance: points,
    perPound: pointsPerPound(business),
    affordable,
    next,
    toNext,
    fraction: next ? Math.min(1, points / next.points_cost) : affordable.length ? 1 : 0,
    label,
  }
}

// ---------------------------------------------------------------------------
// Shop onboarding: what kind of shop -> recommended programme, starter rewards
// scaled to the shop's currency, and the arguments for the
// create_shop_with_programme database function. Used by the Business app and
// the website so both ask the same questions and send the same thing.

export type ShopKindKey = 'everyday' | 'style' | 'premium'

export interface ShopKind {
  key: ShopKindKey
  title: string
  examples: string
  /** Programme recommended for this kind of shop. */
  programme: ProgrammeId
  /** Category stored on the shop. */
  category: string
}

export const SHOP_KINDS: ShopKind[] = [
  { key: 'everyday', title: 'Café, bakery or barber', examples: 'Regulars popping in often', programme: 'stamps', category: 'Café' },
  { key: 'style', title: 'Boutique, jeweller, salon or homeware', examples: 'Fewer, bigger visits', programme: 'tiers', category: 'Retail' },
  // Premium maps to Membership tiers until the VIP list exists.
  { key: 'premium', title: 'Premium or one-off purchases', examples: 'Recognition over freebies', programme: 'tiers', category: 'Retail' },
]

/** What the owner edits. Amounts are typed text in whole currency units (stamp counts for stamps). */
export interface DraftReward { title: string; description: string; amount: string }
export interface DraftTier { name: string; amount: string; perks: string; colour: string }
export interface ProgrammeDraft {
  /** Points earned per £1 (points shops). */
  pointsPerPound: string
  rewards: DraftReward[]
  tiers: DraftTier[]
}

export interface CurrencyInfo {
  /** "£", "Rs" */
  symbol: string
  /** Spend limits are written for pounds and multiplied by this (PKR: 300). */
  scale: number
}

const label = (currency: CurrencyInfo, major: number) =>
  `${currency.symbol}${currency.symbol.length > 1 ? ' ' : ''}${major.toLocaleString('en-GB')}`

/** Starter content for a programme, scaled to the currency. */
export function onboardingDefaults(programme: ProgrammeId, kind: ShopKindKey, currency: CurrencyInfo): ProgrammeDraft {
  const s = Math.max(1, currency.scale)
  if (programme === 'stamps') {
    return {
      pointsPerPound: '1',
      tiers: [],
      rewards: [{ title: kind === 'everyday' ? 'Free coffee' : 'A free treat', description: '', amount: '8' }],
    }
  }
  if (programme === 'tiers') {
    return {
      pointsPerPound: '1',
      rewards: [],
      tiers: [
        { name: 'Silver', amount: String(150 * s), perks: 'Free gift wrapping', colour: '#A8A9AD' },
        { name: 'Gold', amount: String(500 * s), perks: 'Free gift wrapping\nEarly access to new arrivals', colour: '#D4AF37' },
        { name: 'Platinum', amount: String(1200 * s), perks: 'Free gift wrapping\nEarly access to new arrivals\nA personal thank-you gift', colour: '#8F9BB3' },
      ],
    }
  }
  if (programme === 'points') {
    return {
      pointsPerPound: '1',
      tiers: [],
      rewards: [
        { title: `${label(currency, 5 * s)} off your next visit`, description: '', amount: String(100 * s) },
        { title: `${label(currency, 15 * s)} off your next visit`, description: '', amount: String(300 * s) },
      ],
    }
  }
  return {
    pointsPerPound: '1',
    tiers: [],
    rewards: kind === 'everyday'
      ? [
          { title: 'Free coffee', description: '', amount: String(20 * s) },
          { title: 'Free lunch', description: '', amount: String(50 * s) },
        ]
      : [
          { title: `${label(currency, 10 * s)} off your next visit`, description: '', amount: String(100 * s) },
          { title: `${label(currency, 30 * s)} off your next visit`, description: '', amount: String(300 * s) },
        ],
  }
}

/** "20", "£20", "Rs 2,000", "12.5" -> number of whole/decimal currency units, or null. */
export function parseAmount(value: string): number | null {
  const cleaned = String(value ?? '').replace(/£|rs|[,\s]/gi, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Number(cleaned)
}

export interface ShopRpcArgs {
  _programme: ProgrammeId
  _stamps_required: number
  _points_per_pound: number
  _rewards: Record<string, unknown>[]
  _tiers: Record<string, unknown>[]
}

export type ShopArgsResult = { ok: true; args: ShopRpcArgs } | { ok: false; message: string }

const MAX_MINOR = 100_000_000

/** Checks the owner's draft the same way the database will, with friendly messages. */
export function buildShopArgs(programme: ProgrammeId, draft: ProgrammeDraft): ShopArgsResult {
  const fail = (message: string): ShopArgsResult => ({ ok: false, message })
  const base: ShopRpcArgs = { _programme: programme, _stamps_required: 10, _points_per_pound: 1, _rewards: [], _tiers: [] }

  if (programme === 'tiers') {
    if (draft.tiers.length < 1 || draft.tiers.length > 8) return fail('Add between 1 and 8 membership levels.')
    const seen = new Set<number>()
    for (const tier of draft.tiers) {
      const name = tier.name.trim()
      if (!name) return fail('Every level needs a name, for example Silver.')
      if (name.length > 40) return fail('Level names can be up to 40 characters.')
      const major = parseAmount(tier.amount)
      const minor = major === null ? null : Math.round(major * 100)
      if (minor === null || minor < 1 || minor > MAX_MINOR) return fail(`Enter how much customers spend to reach ${name}.`)
      if (seen.has(minor)) return fail('Each level needs a different spend amount.')
      seen.add(minor)
      const perks = tier.perks.split(/\r?\n|,/).map((perk) => perk.trim()).filter(Boolean)
      if (perks.length > 6) return fail(`${name} can have up to 6 perks.`)
      if (perks.some((perk) => perk.length > 80)) return fail('Each perk can be up to 80 characters.')
      base._tiers.push({
        name, spend_threshold_pence: minor, perks, colour: /^#[0-9A-Fa-f]{6}$/.test(tier.colour) ? tier.colour : null,
      })
    }
    return { ok: true, args: base }
  }

  if (draft.rewards.length < 1 || draft.rewards.length > 10) return fail('Add between 1 and 10 rewards.')
  const seen = new Set<number>()
  let firstStamps = 0
  for (const reward of draft.rewards) {
    const title = reward.title.trim()
    if (!title) return fail('Every reward needs a name, for example: Free coffee.')
    if (title.length > 80) return fail('Reward names can be up to 80 characters.')
    const description = reward.description.trim()
    if (description.length > 200) return fail('Reward details can be up to 200 characters.')
    const major = parseAmount(reward.amount)
    if (programme === 'stamps') {
      if (major === null || !Number.isInteger(major) || major < 1 || major > 100) return fail(`Enter how many stamps unlock ${title} (1 to 100).`)
      firstStamps = firstStamps === 0 ? major : Math.min(firstStamps, major)
      base._rewards.push({ title, description, stamp_threshold: major })
    } else if (programme === 'spend') {
      const minor = major === null ? null : Math.round(major * 100)
      if (minor === null || minor < 1 || minor > MAX_MINOR) return fail(`Enter how much customers spend to unlock ${title}.`)
      if (seen.has(minor)) return fail('Each reward needs a different amount.')
      seen.add(minor)
      base._rewards.push({ title, description, spend_threshold_pence: minor })
    } else {
      if (major === null || !Number.isInteger(major) || major < 1 || major > MAX_MINOR) return fail(`Enter how many points ${title} costs.`)
      if (seen.has(major)) return fail('Each reward needs a different points cost.')
      seen.add(major)
      base._rewards.push({ title, description, points_cost: major })
    }
  }
  if (programme === 'stamps') base._stamps_required = firstStamps
  if (programme === 'points') {
    const rate = parseAmount(draft.pointsPerPound)
    if (rate === null || !Number.isInteger(rate) || rate < 1 || rate > 1000) return fail('Points per £ must be a whole number from 1 to 1000.')
    base._points_per_pound = rate
  }
  return { ok: true, args: base }
}

// ---------------------------------------------------------------------------
// Standing from the database snapshot (record_manual_spend and
// scanned_member_spend_summary merge `programme_snapshot` into their result).
// Used on the scan screens. Stamps and £ spend return null: those screens keep
// their own display.

export interface ProgrammeSnapshot {
  programme?: string | null
  tierName?: string | null
  tierPerks?: readonly string[] | null
  rollingSpendPence?: number | null
  nextTierName?: string | null
  toNextTierPence?: number | null
  pointsBalance?: number | null
  pointsPerPound?: number | null
}

export type SnapshotStanding =
  | {
      kind: 'tiers'
      /** "Gold", or null when the customer is below the first level. */
      tierName: string | null
      perks: string[]
      rollingSpendPence: number
      /** Null at the top level or when there are no levels. */
      nextTierName: string | null
      toNextPence: number | null
      /** "£150.00 to Platinum" / "Top level" / "" */
      label: string
    }
  | {
      kind: 'points'
      balance: number
      perPound: number
      /** "240 points · earns 1 point per £1" */
      label: string
    }

/** Null for stamps and £ spend, which keep their existing display. */
export function standingFromSnapshot(
  snapshot: ProgrammeSnapshot | null | undefined,
  money: (pence: number) => string = pounds,
): SnapshotStanding | null {
  if (!snapshot) return null
  if (snapshot.programme === 'tiers') {
    const toNext = snapshot.toNextTierPence ?? null
    const nextName = snapshot.nextTierName ?? null
    const label = nextName && toNext !== null
      ? `${money(Math.max(0, toNext))} to ${nextName}`
      : snapshot.tierName ? 'Top level' : ''
    return {
      kind: 'tiers',
      tierName: snapshot.tierName ?? null,
      perks: (snapshot.tierPerks ?? []).filter((perk) => perk.trim() !== ''),
      rollingSpendPence: Math.max(0, snapshot.rollingSpendPence ?? 0),
      nextTierName: nextName,
      toNextPence: toNext,
      label,
    }
  }
  if (snapshot.programme === 'points') {
    const balance = Math.max(0, snapshot.pointsBalance ?? 0)
    const perPound = Number.isFinite(snapshot.pointsPerPound ?? NaN) ? (snapshot.pointsPerPound as number) : 1
    return {
      kind: 'points',
      balance,
      perPound,
      label: `${balance} point${balance === 1 ? '' : 's'} · earns ${perPound} point${perPound === 1 ? '' : 's'} per £1`,
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Wallet pass lines (Google and Apple Wallet). The Deno mirror in
// supabase/functions/_shared/wallet-progress.ts must produce the same output;
// packages/loyalty/test/wallet-fixtures.json is read by both test suites.

export interface WalletLine {
  label: string
  value: string
  goal: string
  programName: string
}

export interface WalletTierInput {
  title: string
  spend_threshold_pence: number | null
}

export interface WalletRewardInput {
  title: string
  points_cost: number | null
}

const walletPounds = (pence: number) =>
  `£${pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)}`

/**
 * Pass lines for membership tiers and points shops. Returns null for stamps
 * and £ spend shops (the caller keeps its existing lines).
 *
 * Points: the goal names the cheapest reward the customer cannot afford yet,
 * or, once all are affordable, the cheapest reward ("Ready to swap ...").
 */
export function walletStanding(
  programme: 'tiers' | 'points',
  input: {
    tierName?: string | null
    rollingSpendPence?: number | null
    tiers?: WalletTierInput[]
    pointsBalance?: number | null
    rewards?: WalletRewardInput[]
  },
): WalletLine | null {
  if (programme === 'tiers') {
    const spend = Math.max(0, input.rollingSpendPence ?? 0)
    const ladder = (input.tiers ?? [])
      .filter((t): t is { title: string; spend_threshold_pence: number } => (t.spend_threshold_pence ?? 0) > 0)
      .sort((a, b) => a.spend_threshold_pence - b.spend_threshold_pence)
    const next = ladder.find((t) => t.spend_threshold_pence > spend) ?? null
    const value = input.tierName ?? 'No level yet'
    const goal = next
      ? `Spend ${walletPounds(next.spend_threshold_pence - spend)} more for ${next.title} (spent in the last 12 months)`
      : ladder.length ? 'You are at the top level' : 'Levels are being set up'
    return { label: 'Level', value, goal, programName: 'Membership Card' }
  }
  const balance = Math.max(0, input.pointsBalance ?? 0)
  const costed = (input.rewards ?? [])
    .filter((r): r is { title: string; points_cost: number } => (r.points_cost ?? 0) > 0)
    .sort((a, b) => a.points_cost - b.points_cost)
  const next = costed.find((r) => r.points_cost > balance) ?? costed[0] ?? null
  const goal = !next
    ? 'Swap points for rewards in the app'
    : next.points_cost > balance
      ? `${next.points_cost - balance} more points for ${next.title}`
      : `Ready to swap for ${next.title}`
  return { label: 'Points', value: String(balance), goal, programName: 'Points Card' }
}
