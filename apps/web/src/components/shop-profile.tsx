import * as React from 'react'
import { toast } from 'sonner'
import { PROGRAMMES, pointsStanding, programmeIdFor, tierStanding, type PointsReward } from '@loyalty-loop/loyalty'
import { supabase } from '@/lib/supabase'
import { onBrandColor } from '@/lib/utils'
import type { Business, MembershipTier, Membership, OpeningHours, RewardCatalogItem } from '@/lib/businesses'

const DAYS: (keyof OpeningHours)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m ? `${h12}:${String(m).padStart(2, '0')}${period}` : `${h12}${period}`
}

/** Open or closed right now, by the visitor's clock. Null when the shop has not set any hours. */
export function openStatus(hours: OpeningHours | null | undefined, now = new Date()): { open: boolean; label: string } | null {
  if (!hours || Object.keys(hours).length === 0) return null
  const day = hours[DAYS[(now.getDay() + 6) % 7]]
  const minutes = now.getHours() * 60 + now.getMinutes()
  if (day && !day.closed && minutes >= minutesOf(day.open) && minutes < minutesOf(day.close)) {
    return { open: true, label: `Open · closes ${formatTime(day.close)}` }
  }
  if (day && !day.closed && minutes < minutesOf(day.open)) {
    return { open: false, label: `Closed · opens ${formatTime(day.open)}` }
  }
  return { open: false, label: 'Closed now' }
}

const whole = (pence: number) => `£${pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)}`
const full = (pence: number) => `£${(pence / 100).toFixed(2)}`

function newRef(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16))
}

export function HowItWorks({
  business,
  membership,
  catalog,
  tiers,
  rollingSpendPence,
  refetch,
}: {
  business: Business
  membership: Membership | null
  catalog: RewardCatalogItem[]
  tiers: MembershipTier[]
  /** Pence spent here in the last 12 months, null when it could not be read. */
  rollingSpendPence: number | null
  refetch: () => Promise<void>
}) {
  const programme = PROGRAMMES[programmeIdFor(business)]
  const brand = business.brand_color
  const onBrand = onBrandColor(brand)
  return (
    <section className="rounded-3xl bg-card p-6 ring-1 ring-foreground/8 sm:p-7" aria-labelledby="how-it-works-title">
      <p className="text-xs font-extrabold tracking-[0.14em] text-foreground">HOW IT WORKS</p>
      <h2 id="how-it-works-title" className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-foreground">{programme.name}</h2>
      <p className="mb-5 mt-1 text-sm text-foreground">{programme.pitch}</p>
      {programme.id === 'stamps' && <StampsHow business={business} membership={membership} catalog={catalog} brand={brand} onBrand={onBrand} />}
      {programme.id === 'spend' && <SpendHow membership={membership} catalog={catalog} brand={brand} onBrand={onBrand} />}
      {programme.id === 'tiers' && <TiersHow membership={membership} tiers={tiers} rollingSpendPence={rollingSpendPence} brand={brand} />}
      {programme.id === 'points' && <PointsHow business={business} membership={membership} catalog={catalog} brand={brand} onBrand={onBrand} refetch={refetch} />}
    </section>
  )
}

function Line({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-sm font-semibold leading-relaxed text-foreground">{children}</p>
}

function StampsHow({ business, membership, catalog, brand, onBrand }: { business: Business; membership: Membership | null; catalog: RewardCatalogItem[]; brand: string; onBrand: string }) {
  const unit = business.loyalty_type === 'points' ? 'point' : business.loyalty_type === 'tiered' ? 'visit' : 'stamp'
  const required = Math.max(1, Math.min(20, catalog[0]?.stamp_threshold ?? business.loyalty_config?.stamps_required ?? 10))
  const have = business.loyalty_type === 'points' ? membership?.points_balance ?? 0 : membership?.stamp_count ?? 0
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="img" aria-label={`${required} ${unit}s to a reward`}>
        {Array.from({ length: required }).map((_, i) => {
          const last = i === required - 1
          const filled = i < have
          return (
            <span
              key={i}
              className="flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-extrabold text-foreground"
              style={filled
                ? { backgroundColor: brand, borderColor: brand, color: onBrand }
                : { borderColor: last ? brand : 'rgba(0,0,0,0.15)', borderStyle: last ? 'dashed' : 'solid' }}
            >
              {last ? '★' : i + 1}
            </span>
          )
        })}
      </div>
      <Line>Collect {required} {unit}{required === 1 ? '' : 's'} and get {catalog[0]?.title ?? 'a reward'}.</Line>
      {catalog.length > 1 && (
        <ul className="mt-3 space-y-2">
          {catalog.map((reward) => (
            <li key={reward.id} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-foreground">
              <span className="text-sm font-extrabold">{reward.stamp_threshold} {unit}{reward.stamp_threshold === 1 ? '' : 's'}</span>
              <span className="text-right font-semibold">{reward.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SpendHow({ membership, catalog, brand, onBrand }: { membership: Membership | null; catalog: RewardCatalogItem[]; brand: string; onBrand: string }) {
  const rungs = catalog.filter((r) => (r.spend_threshold_pence ?? 0) > 0).sort((a, b) => a.spend_threshold_pence! - b.spend_threshold_pence!)
  const progress = Math.max(0, membership?.reward_progress_pence ?? 0)
  const next = rungs.find((r) => r.spend_threshold_pence! > progress) ?? rungs[rungs.length - 1]
  return (
    <div>
      <ul className="space-y-2">
        {rungs.map((reward) => {
          const reached = Boolean(membership) && reward.spend_threshold_pence! <= progress
          return (
            <li key={reward.id} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-foreground" style={reached ? { backgroundColor: brand, color: onBrand } : undefined}>
              <span className="text-sm font-extrabold">Spend {whole(reward.spend_threshold_pence!)}</span>
              <span className="text-right font-semibold">{reward.title}</span>
            </li>
          )
        })}
      </ul>
      {membership && next ? (
        <Line>
          {next.spend_threshold_pence! > progress
            ? `Spend ${full(next.spend_threshold_pence! - progress)} more to unlock ${next.title}.`
            : 'You have unlocked every reward in this round. A new round starts with your next purchase.'}
        </Line>
      ) : (
        <Line>Staff add what you spend when you pay. Rewards appear in your wallet as you unlock them.</Line>
      )}
    </div>
  )
}

function TiersHow({ membership, tiers, rollingSpendPence, brand }: { membership: Membership | null; tiers: MembershipTier[]; rollingSpendPence: number | null; brand: string }) {
  const ladder = tiers.slice().sort((a, b) => a.spend_threshold_pence - b.spend_threshold_pence)
  if (!ladder.length) return <Line>This shop's levels are being set up.</Line>
  // The level comes from the member's own row (current_tier_id, kept by the database).
  // The distance to the next level uses their own last-12-months spend and is only
  // shown when that could be read: no figure is guessed.
  const currentIndex = membership?.current_tier_id ? ladder.findIndex((t) => t.id === membership.current_tier_id) : -1
  const standing = rollingSpendPence != null ? tierStanding(ladder, rollingSpendPence, full) : null
  const next = currentIndex >= 0 ? ladder[currentIndex + 1] ?? null : ladder[0]
  return (
    <div>
      <ol className="space-y-2.5">
        {ladder.map((tier, index) => {
          const here = index === currentIndex
          const colour = tier.colour || brand
          return (
            <li key={tier.id} className="rounded-2xl bg-secondary/60 p-4 text-foreground ring-1 ring-foreground/8" style={here ? { boxShadow: `0 0 0 2px ${colour}` } : undefined} aria-current={here ? 'step' : undefined}>
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: colour }} />
                <span className="flex-1 text-lg font-extrabold">{tier.name}</span>
                {here && <span className="rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ backgroundColor: colour, color: onBrandColor(colour) }}>You are here</span>}
                {!here && index < currentIndex && <span className="text-xs font-extrabold">Reached</span>}
              </div>
              <p className="mt-1.5 text-sm font-semibold">{tier.spend_threshold_pence === 0 ? 'Everyone starts here' : `Spend ${whole(tier.spend_threshold_pence)} in a year`}</p>
              {tier.perks?.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {tier.perks.map((perk) => <li key={perk}>✓ {perk}</li>)}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ol>
      {membership ? (
        <Line>
          {!next
            ? 'You are on the top level. Keep it by spending here through the year.'
            : standing && standing.next && standing.toNextPence != null
              ? `Spend ${full(standing.toNextPence)} more to reach ${standing.next.name}.`
              : `Next level: ${next.name}, at ${whole(next.spend_threshold_pence)} spent in a year.`}
        </Line>
      ) : (
        <Line>Join, then every purchase counts towards your level for the next 12 months.</Line>
      )}
    </div>
  )
}

function PointsHow({ business, membership, catalog, brand, onBrand, refetch }: { business: Business; membership: Membership | null; catalog: RewardCatalogItem[]; brand: string; onBrand: string; refetch: () => Promise<void> }) {
  const rewards: PointsReward[] = catalog.filter((r) => (r.points_cost ?? 0) > 0).map((r) => ({ id: r.id, title: r.title, points_cost: r.points_cost as number }))
  const standing = pointsStanding(business, membership?.points_balance ?? 0, rewards)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  // One id per tap-attempt, reused if the same tap is retried after a dropped
  // connection, so the database can tell a retry from a second redemption.
  const attempt = React.useRef<{ catalogId: string; ref: string } | null>(null)

  async function redeem(reward: PointsReward) {
    if (busyId) return
    if (!attempt.current || attempt.current.catalogId !== reward.id) attempt.current = { catalogId: reward.id, ref: newRef() }
    setBusyId(reward.id)
    try {
      const { data, error } = await supabase.rpc('redeem_points_reward', { _business_id: business.id, _catalog_id: reward.id, _client_ref: attempt.current.ref })
      if (error) throw error
      attempt.current = null
      await refetch()
      toast.success((data as { status?: string } | null)?.status === 'duplicate' ? 'Already added to your rewards.' : `${reward.title} is ready. Show it to staff when you pay.`)
    } catch (e) {
      const message = (e as { message?: string })?.message ?? ''
      if (message.includes('not_enough_points')) {
        attempt.current = null
        await refetch()
        toast.error('Not enough points yet. Keep earning, then you can get this reward.')
      } else if (message.includes('not_a_member')) {
        attempt.current = null
        toast.error('Join this card first, then you can start earning points here.')
      } else {
        toast.error('Could not get the reward. Check your connection and try again. You will not be charged points twice.')
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="rounded-2xl bg-amber/25 py-5 text-center text-foreground">
        <p className="font-display text-5xl font-bold leading-none tracking-tight">{membership ? standing.balance : standing.perPound}</p>
        <p className="mt-1 text-sm font-bold">{membership ? (standing.balance === 1 ? 'point' : 'points') : `point${standing.perPound === 1 ? '' : 's'} for every £1`}</p>
      </div>
      <Line>
        You earn {standing.perPound} point{standing.perPound === 1 ? '' : 's'} for every £1 you spend here.
        {membership && standing.next && standing.toNext != null ? ` ${standing.toNext} more to get ${standing.next.title}.` : ''}
      </Line>
      <ul className="mt-3 space-y-2">
        {rewards.map((reward) => {
          const can = Boolean(membership) && standing.balance >= reward.points_cost
          return (
            <li key={reward.id} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-foreground">
              <div>
                <p className="font-semibold">{reward.title}</p>
                <p className="text-sm font-extrabold">{reward.points_cost} points</p>
              </div>
              {membership && (
                <button
                  data-press-feedback
                  disabled={!can || busyId !== null}
                  onClick={() => void redeem(reward)}
                  className="min-h-10 shrink-0 rounded-full px-4 text-sm font-extrabold transition-transform active:scale-[0.98] disabled:cursor-not-allowed"
                  style={can ? { backgroundColor: brand, color: onBrand } : { backgroundColor: 'rgba(0,0,0,0.08)', color: '#000' }}
                >
                  {busyId === reward.id ? 'Getting…' : 'Get reward'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {!rewards.length && <Line>This shop's rewards are being set up.</Line>}
    </div>
  )
}
