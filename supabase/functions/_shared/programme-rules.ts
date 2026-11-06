// Custom loyalty programmes (reward_model = 'custom'), built by the AI programme
// builder from building blocks. This file is the single TypeScript definition of
// the rules format: the apps, the website and the `design-programme` edge function
// all use it. supabase/functions/_shared/programme-rules.ts must stay a byte-for-byte
// copy (a test checks), and the database re-checks every rule in
// public.validate_programme_rules() before a programme is saved.
//
// No imports and only erasable TypeScript, so Node, Vite, Metro and Deno can all
// load it unchanged.

export const RULES_VERSION = 1

export const RULE_LIMITS = {
  earnRules: 12,
  rewards: 12,
  milestones: 8,
  levels: 6,
  perks: 6,
  label: 80,
  title: 80,
  description: 200,
  perk: 80,
  unit: 20,
  summary: 600,
  perPound: 1000,
  perVisit: 100000,
  multiplier: 10,
  bonus: 100000,
  pointsCost: 100000000,
  pence: 100000000,
  percent: 100,
  visits: 10000,
  months: 60,
} as const

export interface EarnWhen {
  /** 0 = Sunday … 6 = Saturday, in the shop's local time. */
  days?: number[]
  /** "HH:MM" 24-hour, shop local time. `from` inclusive, `to` exclusive. */
  from?: string
  to?: string
  /** Bill must be at least this much. */
  min_spend_pence?: number
  /** Only on every Nth visit (5 = 5th, 10th, 15th…). */
  every_nth_visit?: number
  /** Only on the customer's first visit. */
  first_visit?: boolean
  /** Only for customers at these level keys. */
  levels?: string[]
  /** "YYYY-MM-DD", inclusive, shop local date. */
  start_date?: string
  end_date?: string
}

/** One way to earn. Exactly one of per_pound, per_visit or multiplier is set. */
export interface EarnRule {
  label: string
  per_pound?: number
  per_visit?: number
  /** Multiplies everything earned on this visit (best multiplier wins, they do not stack). */
  multiplier?: number
  when?: EarnWhen
}

export interface ProgrammeReward {
  /** Stable id inside this programme: a-z, 0-9, dash. */
  key: string
  title: string
  description?: string
  /** Customers can swap this many points for it. Omit for milestone-only rewards. */
  points_cost?: number
  /** Optional value staff take off the bill. At most one of these two. */
  discount_pence?: number
  discount_percent?: number
}

/** A reward handed out automatically. Exactly one of every_visits or at_lifetime_spend_pence. */
export interface Milestone {
  label: string
  reward: string
  every_visits?: number
  at_lifetime_spend_pence?: number
}

/** Member levels. Exactly one of min_visits or min_spend_12m_pence. */
export interface Level {
  key: string
  name: string
  min_visits?: number
  min_spend_12m_pence?: number
  multiplier?: number
  perks?: string[]
}

export interface ProgrammeRules {
  version: 1
  unit: { one: string; many: string }
  earn: EarnRule[]
  bonuses?: { signup?: number; birthday?: number; referral?: number }
  /** "3 points = £1 off": staff can take points off as money at the till. */
  cash_value?: { points: number; pence: number; max_pence_per_visit?: number } | null
  rewards: ProgrammeReward[]
  milestones?: Milestone[]
  levels?: Level[]
  expiry?: { inactive_months: number } | null
  caps?: { max_points_per_visit?: number; max_points_per_day?: number }
  /** Plain-English summary shown to the owner and customers. */
  summary: string
}

export type RulesCheck = { ok: true; rules: ProgrammeRules } | { ok: false; errors: string[] }

const KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v)
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length >= 1 && t.length <= max ? t : null
}
function validDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false
  const d = new Date(v + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}
function onlyKeys(o: Record<string, unknown>, allowed: string[], where: string, errors: string[]) {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) errors.push(`${where}: unknown field "${k}"`)
}
function intIn(v: unknown, min: number, max: number): v is number {
  return isInt(v) && v >= min && v <= max
}

/**
 * Checks a rules object and returns a cleaned copy (trimmed text, no unknown
 * fields). Mirrors public.validate_programme_rules(); keep both in step.
 */
export function validateRules(input: unknown): RulesCheck {
  const errors: string[] = []
  if (!isObj(input)) return { ok: false, errors: ['rules must be an object'] }
  onlyKeys(input, ['version', 'unit', 'earn', 'bonuses', 'cash_value', 'rewards', 'milestones', 'levels', 'expiry', 'caps', 'summary'], 'rules', errors)
  if (input.version !== RULES_VERSION) errors.push('version must be 1')

  // unit
  let unit = { one: 'point', many: 'points' }
  if (!isObj(input.unit)) errors.push('unit must be {one, many}')
  else {
    const one = text(input.unit.one, RULE_LIMITS.unit)
    const many = text(input.unit.many, RULE_LIMITS.unit)
    if (!one || !many) errors.push(`unit names must be 1-${RULE_LIMITS.unit} characters`)
    else unit = { one, many }
  }

  // levels first, so earn rules can refer to them
  const levels: Level[] = []
  const levelKeys = new Set<string>()
  if (input.levels !== undefined) {
    if (!Array.isArray(input.levels) || input.levels.length > RULE_LIMITS.levels) errors.push(`levels must be a list of at most ${RULE_LIMITS.levels}`)
    else input.levels.forEach((raw, i) => {
      const where = `levels[${i}]`
      if (!isObj(raw)) { errors.push(`${where} must be an object`); return }
      onlyKeys(raw, ['key', 'name', 'min_visits', 'min_spend_12m_pence', 'multiplier', 'perks'], where, errors)
      const key = typeof raw.key === 'string' && KEY_RE.test(raw.key) ? raw.key : null
      if (!key) errors.push(`${where}.key must be lower-case letters, numbers or dashes`)
      else if (levelKeys.has(key)) errors.push(`${where}.key "${key}" is used twice`)
      else levelKeys.add(key)
      const name = text(raw.name, 40)
      if (!name) errors.push(`${where}.name must be 1-40 characters`)
      const hasVisits = raw.min_visits !== undefined
      const hasSpend = raw.min_spend_12m_pence !== undefined
      if (hasVisits === hasSpend) errors.push(`${where} needs exactly one of min_visits or min_spend_12m_pence`)
      if (hasVisits && !intIn(raw.min_visits, 0, RULE_LIMITS.visits)) errors.push(`${where}.min_visits must be 0-${RULE_LIMITS.visits}`)
      if (hasSpend && !intIn(raw.min_spend_12m_pence, 0, RULE_LIMITS.pence)) errors.push(`${where}.min_spend_12m_pence is out of range`)
      if (raw.multiplier !== undefined && !(isNum(raw.multiplier) && raw.multiplier >= 1 && raw.multiplier <= RULE_LIMITS.multiplier)) errors.push(`${where}.multiplier must be 1-${RULE_LIMITS.multiplier}`)
      const perks: string[] = []
      if (raw.perks !== undefined) {
        if (!Array.isArray(raw.perks) || raw.perks.length > RULE_LIMITS.perks) errors.push(`${where}.perks must be at most ${RULE_LIMITS.perks}`)
        else raw.perks.forEach((p, j) => {
          const t = text(p, RULE_LIMITS.perk)
          if (!t) errors.push(`${where}.perks[${j}] must be 1-${RULE_LIMITS.perk} characters`)
          else perks.push(t)
        })
      }
      if (key && name) {
        const level: Level = { key, name }
        if (hasVisits) level.min_visits = raw.min_visits as number
        if (hasSpend) level.min_spend_12m_pence = raw.min_spend_12m_pence as number
        if (raw.multiplier !== undefined) level.multiplier = raw.multiplier as number
        if (perks.length) level.perks = perks
        levels.push(level)
      }
    })
    const kinds = new Set(levels.map((l) => (l.min_visits !== undefined ? 'visits' : 'spend')))
    if (kinds.size > 1) errors.push('all levels must use the same measure (visits or 12-month spend)')
    const thresholds = levels.map((l) => l.min_visits ?? l.min_spend_12m_pence)
    if (new Set(thresholds).size !== thresholds.length) errors.push('each level needs a different threshold')
  }

  // earn
  const earn: EarnRule[] = []
  if (!Array.isArray(input.earn) || input.earn.length > RULE_LIMITS.earnRules) errors.push(`earn must be a list of at most ${RULE_LIMITS.earnRules}`)
  else input.earn.forEach((raw, i) => {
    const where = `earn[${i}]`
    if (!isObj(raw)) { errors.push(`${where} must be an object`); return }
    onlyKeys(raw, ['label', 'per_pound', 'per_visit', 'multiplier', 'when'], where, errors)
    const label = text(raw.label, RULE_LIMITS.label)
    if (!label) errors.push(`${where}.label must be 1-${RULE_LIMITS.label} characters`)
    const set = ['per_pound', 'per_visit', 'multiplier'].filter((k) => raw[k] !== undefined)
    if (set.length !== 1) errors.push(`${where} needs exactly one of per_pound, per_visit or multiplier`)
    if (raw.per_pound !== undefined && !(isNum(raw.per_pound) && raw.per_pound > 0 && raw.per_pound <= RULE_LIMITS.perPound)) errors.push(`${where}.per_pound must be above 0 and at most ${RULE_LIMITS.perPound}`)
    if (raw.per_visit !== undefined && !intIn(raw.per_visit, 1, RULE_LIMITS.perVisit)) errors.push(`${where}.per_visit must be a whole number 1-${RULE_LIMITS.perVisit}`)
    if (raw.multiplier !== undefined && !(isNum(raw.multiplier) && raw.multiplier > 1 && raw.multiplier <= RULE_LIMITS.multiplier)) errors.push(`${where}.multiplier must be above 1 and at most ${RULE_LIMITS.multiplier}`)
    let when: EarnWhen | undefined
    if (raw.when !== undefined) {
      if (!isObj(raw.when)) errors.push(`${where}.when must be an object`)
      else {
        const w = raw.when
        onlyKeys(w, ['days', 'from', 'to', 'min_spend_pence', 'every_nth_visit', 'first_visit', 'levels', 'start_date', 'end_date'], `${where}.when`, errors)
        when = {}
        if (w.days !== undefined) {
          if (!Array.isArray(w.days) || w.days.length < 1 || w.days.length > 7 || !w.days.every((d) => intIn(d, 0, 6)) || new Set(w.days).size !== w.days.length) errors.push(`${where}.when.days must be distinct numbers 0 (Sun) to 6 (Sat)`)
          else when.days = [...(w.days as number[])].sort((a, b) => a - b)
        }
        if ((w.from === undefined) !== (w.to === undefined)) errors.push(`${where}.when needs both from and to`)
        if (w.from !== undefined) {
          if (typeof w.from !== 'string' || !TIME_RE.test(w.from) || typeof w.to !== 'string' || !TIME_RE.test(w.to)) errors.push(`${where}.when.from/to must be HH:MM`)
          else if (w.from === w.to) errors.push(`${where}.when.from and to must differ`)
          else { when.from = w.from; when.to = w.to }
        }
        if (w.min_spend_pence !== undefined) {
          if (!intIn(w.min_spend_pence, 1, RULE_LIMITS.pence)) errors.push(`${where}.when.min_spend_pence is out of range`)
          else when.min_spend_pence = w.min_spend_pence
        }
        if (w.every_nth_visit !== undefined) {
          if (!intIn(w.every_nth_visit, 2, RULE_LIMITS.visits)) errors.push(`${where}.when.every_nth_visit must be 2-${RULE_LIMITS.visits}`)
          else when.every_nth_visit = w.every_nth_visit
        }
        if (w.first_visit !== undefined) {
          if (w.first_visit !== true) errors.push(`${where}.when.first_visit can only be true`)
          else when.first_visit = true
        }
        if (w.levels !== undefined) {
          if (!Array.isArray(w.levels) || w.levels.length < 1 || !w.levels.every((k) => typeof k === 'string' && levelKeys.has(k))) errors.push(`${where}.when.levels must name existing level keys`)
          else when.levels = [...new Set(w.levels as string[])]
        }
        for (const k of ['start_date', 'end_date'] as const) {
          if (w[k] !== undefined) {
            if (typeof w[k] !== 'string' || !validDate(w[k] as string)) errors.push(`${where}.when.${k} must be YYYY-MM-DD`)
            else when[k] = w[k] as string
          }
        }
        if (when.start_date && when.end_date && when.start_date > when.end_date) errors.push(`${where}.when.start_date is after end_date`)
        if (Object.keys(when).length === 0) when = undefined
      }
    }
    if (label && set.length === 1) {
      const rule: EarnRule = { label }
      if (raw.per_pound !== undefined) rule.per_pound = raw.per_pound as number
      if (raw.per_visit !== undefined) rule.per_visit = raw.per_visit as number
      if (raw.multiplier !== undefined) rule.multiplier = raw.multiplier as number
      if (when) rule.when = when
      earn.push(rule)
    }
  })

  // bonuses
  let bonuses: ProgrammeRules['bonuses']
  if (input.bonuses !== undefined) {
    if (!isObj(input.bonuses)) errors.push('bonuses must be an object')
    else {
      onlyKeys(input.bonuses, ['signup', 'birthday', 'referral'], 'bonuses', errors)
      bonuses = {}
      for (const k of ['signup', 'birthday', 'referral'] as const) {
        const v = input.bonuses[k]
        if (v === undefined) continue
        if (!intIn(v, 1, RULE_LIMITS.bonus)) errors.push(`bonuses.${k} must be a whole number 1-${RULE_LIMITS.bonus}`)
        else bonuses[k] = v
      }
      if (Object.keys(bonuses).length === 0) bonuses = undefined
    }
  }

  // cash value
  let cash: ProgrammeRules['cash_value'] = null
  if (input.cash_value !== undefined && input.cash_value !== null) {
    const c = input.cash_value
    if (!isObj(c)) errors.push('cash_value must be an object')
    else {
      onlyKeys(c, ['points', 'pence', 'max_pence_per_visit'], 'cash_value', errors)
      if (!intIn(c.points, 1, RULE_LIMITS.pointsCost)) errors.push('cash_value.points must be a whole number of points')
      if (!intIn(c.pence, 1, RULE_LIMITS.pence)) errors.push('cash_value.pence must be a whole number of pence')
      if (c.max_pence_per_visit !== undefined && !intIn(c.max_pence_per_visit, 1, RULE_LIMITS.pence)) errors.push('cash_value.max_pence_per_visit is out of range')
      if (intIn(c.max_pence_per_visit, 1, RULE_LIMITS.pence) && intIn(c.pence, 1, RULE_LIMITS.pence) && c.max_pence_per_visit < c.pence) errors.push('cash_value.max_pence_per_visit is below one step')
      if (intIn(c.points, 1, RULE_LIMITS.pointsCost) && intIn(c.pence, 1, RULE_LIMITS.pence)) {
        cash = { points: c.points, pence: c.pence }
        if (c.max_pence_per_visit !== undefined) cash.max_pence_per_visit = c.max_pence_per_visit as number
      }
    }
  }

  // rewards
  const rewards: ProgrammeReward[] = []
  const rewardKeys = new Set<string>()
  if (!Array.isArray(input.rewards) || input.rewards.length > RULE_LIMITS.rewards) errors.push(`rewards must be a list of at most ${RULE_LIMITS.rewards}`)
  else input.rewards.forEach((raw, i) => {
    const where = `rewards[${i}]`
    if (!isObj(raw)) { errors.push(`${where} must be an object`); return }
    onlyKeys(raw, ['key', 'title', 'description', 'points_cost', 'discount_pence', 'discount_percent'], where, errors)
    const key = typeof raw.key === 'string' && KEY_RE.test(raw.key) ? raw.key : null
    if (!key) errors.push(`${where}.key must be lower-case letters, numbers or dashes`)
    else if (rewardKeys.has(key)) errors.push(`${where}.key "${key}" is used twice`)
    else rewardKeys.add(key)
    const title = text(raw.title, RULE_LIMITS.title)
    if (!title) errors.push(`${where}.title must be 1-${RULE_LIMITS.title} characters`)
    let description: string | undefined
    if (raw.description !== undefined && raw.description !== '') {
      const d = text(raw.description, RULE_LIMITS.description)
      if (!d) errors.push(`${where}.description must be at most ${RULE_LIMITS.description} characters`)
      else description = d
    }
    if (raw.points_cost !== undefined && !intIn(raw.points_cost, 1, RULE_LIMITS.pointsCost)) errors.push(`${where}.points_cost must be a whole number of points`)
    if (raw.discount_pence !== undefined && raw.discount_percent !== undefined) errors.push(`${where} can have discount_pence or discount_percent, not both`)
    if (raw.discount_pence !== undefined && !intIn(raw.discount_pence, 1, RULE_LIMITS.pence)) errors.push(`${where}.discount_pence is out of range`)
    if (raw.discount_percent !== undefined && !intIn(raw.discount_percent, 1, RULE_LIMITS.percent)) errors.push(`${where}.discount_percent must be 1-100`)
    if (key && title) {
      const r: ProgrammeReward = { key, title }
      if (description) r.description = description
      if (raw.points_cost !== undefined) r.points_cost = raw.points_cost as number
      if (raw.discount_pence !== undefined) r.discount_pence = raw.discount_pence as number
      if (raw.discount_percent !== undefined) r.discount_percent = raw.discount_percent as number
      rewards.push(r)
    }
  })

  // milestones
  const milestones: Milestone[] = []
  const usedRewards = new Set<string>()
  if (input.milestones !== undefined) {
    if (!Array.isArray(input.milestones) || input.milestones.length > RULE_LIMITS.milestones) errors.push(`milestones must be a list of at most ${RULE_LIMITS.milestones}`)
    else input.milestones.forEach((raw, i) => {
      const where = `milestones[${i}]`
      if (!isObj(raw)) { errors.push(`${where} must be an object`); return }
      onlyKeys(raw, ['label', 'reward', 'every_visits', 'at_lifetime_spend_pence'], where, errors)
      const label = text(raw.label, RULE_LIMITS.label)
      if (!label) errors.push(`${where}.label must be 1-${RULE_LIMITS.label} characters`)
      if (typeof raw.reward !== 'string' || !rewardKeys.has(raw.reward)) errors.push(`${where}.reward must name a reward key`)
      const hasVisits = raw.every_visits !== undefined
      const hasSpend = raw.at_lifetime_spend_pence !== undefined
      if (hasVisits === hasSpend) errors.push(`${where} needs exactly one of every_visits or at_lifetime_spend_pence`)
      if (hasVisits && !intIn(raw.every_visits, 1, RULE_LIMITS.visits)) errors.push(`${where}.every_visits must be 1-${RULE_LIMITS.visits}`)
      if (hasSpend && !intIn(raw.at_lifetime_spend_pence, 1, RULE_LIMITS.pence)) errors.push(`${where}.at_lifetime_spend_pence is out of range`)
      if (label && typeof raw.reward === 'string' && rewardKeys.has(raw.reward) && hasVisits !== hasSpend) {
        const m: Milestone = { label, reward: raw.reward }
        if (hasVisits) m.every_visits = raw.every_visits as number
        if (hasSpend) m.at_lifetime_spend_pence = raw.at_lifetime_spend_pence as number
        milestones.push(m)
        usedRewards.add(raw.reward)
      }
    })
  }

  for (const r of rewards) {
    if (r.points_cost === undefined && !usedRewards.has(r.key)) errors.push(`reward "${r.key}" has no points_cost and no milestone gives it out`)
  }

  // expiry
  let expiry: ProgrammeRules['expiry'] = null
  if (input.expiry !== undefined && input.expiry !== null) {
    if (!isObj(input.expiry)) errors.push('expiry must be an object')
    else {
      onlyKeys(input.expiry, ['inactive_months'], 'expiry', errors)
      if (!intIn(input.expiry.inactive_months, 1, RULE_LIMITS.months)) errors.push(`expiry.inactive_months must be 1-${RULE_LIMITS.months}`)
      else expiry = { inactive_months: input.expiry.inactive_months }
    }
  }

  // caps
  let caps: ProgrammeRules['caps']
  if (input.caps !== undefined) {
    if (!isObj(input.caps)) errors.push('caps must be an object')
    else {
      onlyKeys(input.caps, ['max_points_per_visit', 'max_points_per_day'], 'caps', errors)
      caps = {}
      for (const k of ['max_points_per_visit', 'max_points_per_day'] as const) {
        const v = input.caps[k]
        if (v === undefined) continue
        if (!intIn(v, 1, RULE_LIMITS.pointsCost)) errors.push(`caps.${k} must be a whole number`)
        else caps[k] = v
      }
      if (Object.keys(caps).length === 0) caps = undefined
    }
  }

  const summary = text(input.summary, RULE_LIMITS.summary)
  if (!summary) errors.push(`summary must be 1-${RULE_LIMITS.summary} characters`)

  const earnsSomething = earn.some((r) => r.per_pound !== undefined || r.per_visit !== undefined) || milestones.length > 0 || Boolean(bonuses)
  if (!earnsSomething) errors.push('the programme needs at least one way to earn (per £, per visit, a milestone or a bonus)')
  const spendsSomething = rewards.length > 0 || cash !== null || levels.length > 0
  if (!spendsSomething) errors.push('the programme needs at least one reward, a cash value or member levels')

  if (errors.length) return { ok: false, errors }
  const rules: ProgrammeRules = { version: 1, unit, earn, rewards, summary: summary as string }
  if (bonuses) rules.bonuses = bonuses
  if (cash) rules.cash_value = cash
  if (milestones.length) rules.milestones = milestones
  if (levels.length) rules.levels = levels
  if (expiry) rules.expiry = expiry
  if (caps) rules.caps = caps
  return { ok: true, rules }
}

// ---------------------------------------------------------------------------
// Evaluation. The database does the real maths in public.apply_custom_spend();
// this mirror powers previews ("a £12 visit on Tuesday earns 24 points") and
// tests that pin both to the same answers.

export interface VisitContext {
  /** The bill in pence. */
  pence: number
  /** Which visit this is, 1 = first. */
  visitNumber: number
  /** Shop local day, 0 = Sunday. */
  day: number
  /** Shop local time "HH:MM". */
  time: string
  /** Shop local date "YYYY-MM-DD". */
  date: string
  /** Customer's level key before this visit, if any. */
  level?: string | null
}

function timeIn(time: string, from: string, to: string): boolean {
  // A window like 22:00 → 02:00 wraps past midnight.
  return from < to ? time >= from && time < to : time >= from || time < to
}

export function ruleApplies(rule: EarnRule, ctx: VisitContext): boolean {
  const w = rule.when
  if (!w) return true
  if (w.days && !w.days.includes(ctx.day)) return false
  if (w.from && w.to && !timeIn(ctx.time, w.from, w.to)) return false
  if (w.min_spend_pence !== undefined && ctx.pence < w.min_spend_pence) return false
  if (w.every_nth_visit !== undefined && ctx.visitNumber % w.every_nth_visit !== 0) return false
  if (w.first_visit && ctx.visitNumber !== 1) return false
  if (w.levels && !(ctx.level && w.levels.includes(ctx.level))) return false
  if (w.start_date && ctx.date < w.start_date) return false
  if (w.end_date && ctx.date > w.end_date) return false
  return true
}

/** Points for one visit before daily caps and bonuses. Matches apply_custom_spend. */
export function pointsForVisit(rules: ProgrammeRules, ctx: VisitContext): number {
  let base = 0
  let mult = 1
  for (const rule of rules.earn) {
    if (!ruleApplies(rule, ctx)) continue
    if (rule.per_pound !== undefined) base += Math.floor((ctx.pence * rule.per_pound) / 100)
    else if (rule.per_visit !== undefined) base += rule.per_visit
    else if (rule.multiplier !== undefined) mult = Math.max(mult, rule.multiplier)
  }
  const level = rules.levels?.find((l) => l.key === ctx.level)
  if (level?.multiplier) mult = Math.max(mult, level.multiplier)
  let points = Math.floor(base * mult)
  if (rules.caps?.max_points_per_visit !== undefined) points = Math.min(points, rules.caps.max_points_per_visit)
  return points
}

/** The highest level reached, given visits so far and 12-month spend. */
export function levelFor(rules: ProgrammeRules, visits: number, spend12mPence: number): Level | null {
  let best: Level | null = null
  for (const l of rules.levels ?? []) {
    const reached = l.min_visits !== undefined ? visits >= l.min_visits : spend12mPence >= (l.min_spend_12m_pence ?? Infinity)
    const score = l.min_visits ?? l.min_spend_12m_pence ?? 0
    const bestScore = best ? best.min_visits ?? best.min_spend_12m_pence ?? 0 : -1
    if (reached && score > bestScore) best = l
  }
  return best
}

/** How much money a number of points is worth at the till, in whole steps. */
export function cashFor(rules: ProgrammeRules, balance: number): { points: number; pence: number } {
  const c = rules.cash_value
  if (!c) return { points: 0, pence: 0 }
  let steps = Math.floor(balance / c.points)
  if (c.max_pence_per_visit !== undefined) steps = Math.min(steps, Math.floor(c.max_pence_per_visit / c.pence))
  return { points: steps * c.points, pence: steps * c.pence }
}

// ---------------------------------------------------------------------------
// Plain-English description, for previews, the shop page and the scan screen.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function plural(n: number, unit: { one: string; many: string }): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? unit.one : unit.many}`
}

function defaultMoney(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

function describeWhen(w: EarnWhen | undefined, rules: ProgrammeRules, money: (p: number) => string): string {
  if (!w) return ''
  const bits: string[] = []
  if (w.days) bits.push(w.days.length === 1 ? `on ${DAY_NAMES[w.days[0]]}s` : `on ${w.days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')}`)
  if (w.from && w.to) bits.push(`${w.from}–${w.to}`)
  if (w.min_spend_pence !== undefined) bits.push(`when you spend ${money(w.min_spend_pence)} or more`)
  if (w.every_nth_visit !== undefined) bits.push(`every ${w.every_nth_visit}th visit`)
  if (w.first_visit) bits.push('on your first visit')
  if (w.levels) {
    const names = w.levels.map((k) => rules.levels?.find((l) => l.key === k)?.name ?? k)
    bits.push(`for ${names.join(' and ')} members`)
  }
  if (w.start_date && w.end_date) bits.push(`from ${w.start_date} to ${w.end_date}`)
  else if (w.start_date) bits.push(`from ${w.start_date}`)
  else if (w.end_date) bits.push(`until ${w.end_date}`)
  return bits.length ? ' ' + bits.join(', ') : ''
}

export interface RulesDescription {
  earn: string[]
  spend: string[]
  levels: string[]
  small: string[]
}

export function describeRules(rules: ProgrammeRules, money: (pence: number) => string = defaultMoney): RulesDescription {
  const u = rules.unit
  const earn: string[] = []
  for (const r of rules.earn) {
    const when = describeWhen(r.when, rules, money)
    if (r.per_pound !== undefined) earn.push(`${trimNumber(r.per_pound)} ${r.per_pound === 1 ? u.one : u.many} per ${money(100)} spent${when}`)
    else if (r.per_visit !== undefined) earn.push(`${plural(r.per_visit, u)} per visit${when}`)
    else if (r.multiplier !== undefined) earn.push(`${trimNumber(r.multiplier)}× ${u.many}${when}`)
  }
  if (rules.bonuses?.signup) earn.push(`${plural(rules.bonuses.signup, u)} for joining`)
  if (rules.bonuses?.birthday) earn.push(`${plural(rules.bonuses.birthday, u)} on your first visit in your birthday month`)
  if (rules.bonuses?.referral) earn.push(`${plural(rules.bonuses.referral, u)} when a friend you invited joins`)

  const spend: string[] = []
  if (rules.cash_value) {
    const c = rules.cash_value
    spend.push(`${plural(c.points, u)} = ${money(c.pence)} off${c.max_pence_per_visit ? ` (up to ${money(c.max_pence_per_visit)} per visit)` : ''}`)
  }
  const rewardValue = (r: ProgrammeReward) => (r.discount_pence ? ` (${money(r.discount_pence)} off)` : r.discount_percent ? ` (${r.discount_percent}% off)` : '')
  for (const r of rules.rewards) {
    if (r.points_cost !== undefined) spend.push(`${r.title}${rewardValue(r)} for ${plural(r.points_cost, u)}`)
  }
  for (const m of rules.milestones ?? []) {
    const r = rules.rewards.find((x) => x.key === m.reward)
    const what = r ? `${r.title}${rewardValue(r)}` : m.reward
    if (m.every_visits !== undefined) spend.push(m.every_visits === 1 ? `${what} every visit` : `${what} every ${m.every_visits} visits`)
    else if (m.at_lifetime_spend_pence !== undefined) spend.push(`${what} once you've spent ${money(m.at_lifetime_spend_pence)}`)
  }

  const levels = (rules.levels ?? [])
    .slice()
    .sort((a, b) => (a.min_visits ?? a.min_spend_12m_pence ?? 0) - (b.min_visits ?? b.min_spend_12m_pence ?? 0))
    .map((l) => {
      const at = l.min_visits !== undefined ? `${l.min_visits} visits` : `${money(l.min_spend_12m_pence ?? 0)} spent in 12 months`
      const extras = [l.multiplier && l.multiplier > 1 ? `${trimNumber(l.multiplier)}× ${u.many}` : '', ...(l.perks ?? [])].filter(Boolean)
      return `${l.name} at ${at}${extras.length ? `: ${extras.join(', ')}` : ''}`
    })

  const small: string[] = []
  if (rules.caps?.max_points_per_visit) small.push(`At most ${plural(rules.caps.max_points_per_visit, u)} per visit`)
  if (rules.caps?.max_points_per_day) small.push(`At most ${plural(rules.caps.max_points_per_day, u)} per day`)
  if (rules.expiry) small.push(`${u.many[0].toUpperCase()}${u.many.slice(1)} expire after ${rules.expiry.inactive_months} month${rules.expiry.inactive_months === 1 ? '' : 's'} without a visit`)
  return { earn, spend, levels, small }
}

/** Whether staff need the bill amount for these rules (anything £-based). */
export function rulesNeedBill(rules: ProgrammeRules): boolean {
  return (
    rules.earn.some((r) => r.per_pound !== undefined || r.when?.min_spend_pence !== undefined) ||
    (rules.milestones ?? []).some((m) => m.at_lifetime_spend_pence !== undefined) ||
    (rules.levels ?? []).some((l) => l.min_spend_12m_pence !== undefined)
  )
}
