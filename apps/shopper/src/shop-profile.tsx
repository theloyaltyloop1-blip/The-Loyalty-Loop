import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { PROGRAMMES, pointsStanding, programmeIdFor, tierStanding, type PointsReward, type TierRung } from '@loyalty-loop/loyalty'
import { showAlert } from './components/AppAlert'
import { supabase } from './supabase'
import { colors } from './theme'

import { pick } from './theme'
const { primary } = colors

// ---------------------------------------------------------------------
// Opening hours (businesses.opening_hours, same shape as the website)
// ---------------------------------------------------------------------

export type DayHours = { closed: boolean; open: string; close: string }
export type OpeningHours = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayHours>>

const DAYS: { key: keyof OpeningHours; label: string }[] = [
  { key: 'mon', label: 'Monday' }, { key: 'tue', label: 'Tuesday' }, { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' }, { key: 'fri', label: 'Friday' }, { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

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

/** Open or closed right now, by the phone's clock. Null when the shop has not set any hours. */
export function openStatus(hours: OpeningHours | null | undefined, now = new Date()): { open: boolean; label: string } | null {
  if (!hours || Object.keys(hours).length === 0) return null
  const today = DAYS[(now.getDay() + 6) % 7].key
  const day = hours[today]
  const minutes = now.getHours() * 60 + now.getMinutes()
  if (day && !day.closed && minutes >= minutesOf(day.open) && minutes < minutesOf(day.close)) {
    return { open: true, label: `Open · closes ${formatTime(day.close)}` }
  }
  if (day && !day.closed && minutes < minutesOf(day.open)) {
    return { open: false, label: `Closed · opens ${formatTime(day.open)}` }
  }
  return { open: false, label: 'Closed now' }
}

export function OpeningHoursList({ hours }: { hours: OpeningHours }) {
  const today = DAYS[(new Date().getDay() + 6) % 7].key
  return (
    <View style={styles.hoursList}>
      {DAYS.map(({ key, label }) => {
        const day = hours[key]
        const isToday = key === today
        return (
          <View key={key} style={styles.hoursRow}>
            <Text style={[styles.hoursDay, isToday && styles.hoursToday]}>{label}</Text>
            <Text style={[styles.hoursTime, isToday && styles.hoursToday]}>
              {!day || day.closed ? 'Closed' : `${formatTime(day.open)} to ${formatTime(day.close)}`}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------

type HeroBusiness = {
  name: string
  category?: string | null
  brand_color?: string
  logo_url?: string | null
  cover_url?: string | null
  features?: string[] | null
  halal_certifier?: string | null
  opening_hours?: OpeningHours | null
}

export function ShopHero({
  business,
  favouriteButton,
  ratingText,
  reviewCount,
  featureLabels,
  isMember,
  joining,
  onJoin,
  onYourCard,
}: {
  business: HeroBusiness
  favouriteButton: ReactNode
  ratingText: string | null
  reviewCount: number
  featureLabels: string[]
  isMember: boolean
  joining: boolean
  onJoin: () => void
  onYourCard: () => void
}) {
  const brand = business.brand_color || primary
  const status = openStatus(business.opening_hours)
  const chips = [business.category || 'Local business', ...featureLabels]
  return (
    <View style={styles.hero}>
      <View style={[styles.cover, { backgroundColor: brand }]}>
        {business.cover_url ? <Image source={{ uri: business.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        {favouriteButton}
      </View>
      <View style={styles.heroBody}>
        <View style={[styles.logo, { backgroundColor: brand }]}>
          {business.logo_url ? (
            <Image source={{ uri: business.logo_url }} style={styles.logoImage} />
          ) : (
            <Text style={styles.logoLetter}>{business.name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <Text style={styles.name}>{business.name}</Text>
        <View style={styles.chipRow}>
          {chips.map((chip) => (
            <View key={chip} style={styles.chip}><Text style={styles.chipText}>{chip}</Text></View>
          ))}
        </View>
        <View style={styles.metaRow}>
          {ratingText ? (
            <Text style={styles.metaText}>
              {ratingText} <Text style={styles.metaLight}>({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</Text>
            </Text>
          ) : null}
          {status ? (
            <View style={[styles.statusPill, status.open ? styles.statusOpen : styles.statusClosed]}>
              <View style={[styles.statusDot, { backgroundColor: status.open ? pick('#2F8A4C', '#4CC07A') : pick('#B73B32', '#FF6B60') }]} />
              <Text style={styles.statusText}>{status.label}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={isMember ? onYourCard : onJoin}
          disabled={joining}
          style={({ pressed }) => [styles.cta, { backgroundColor: brand }, joining && { opacity: 0.6 }, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
        >
          <Text style={[styles.ctaText, { color: readableOn(brand) }]}>{joining ? 'Joining…' : isMember ? 'Your card' : 'Join card'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

/** Black or white text, whichever reads on the brand colour. */
function readableOn(hex: string) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  if (Number.isNaN(n)) return '#fff'
  const luminance = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return luminance > 0.6 ? '#000000' : '#ffffff'
}

// ---------------------------------------------------------------------
// How it works: generated from the shop's programme
// ---------------------------------------------------------------------

export type TierRow = TierRung & { id: string; sort_order?: number }
export type CatalogRow = {
  id: string
  title: string
  description?: string | null
  stamp_threshold: number
  spend_threshold_pence?: number | null
  points_cost?: number | null
}

type HowBusiness = {
  id: string
  brand_color?: string
  reward_model?: string | null
  loyalty_type?: string
  loyalty_config?: { stamps_required?: number; points_per_pound?: number } | null
  reward_threshold_pence?: number | null
}
type HowMembership = {
  stamp_count: number
  points_balance: number
  reward_progress_pence?: number | null
  current_tier_id?: string | null
} | undefined

function newRef(): string {
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function HowItWorks({
  business,
  membership,
  catalog,
  tiers,
  rollingSpendPence,
  money,
  refresh,
}: {
  business: HowBusiness
  membership: HowMembership
  catalog: CatalogRow[]
  tiers: TierRow[]
  /** Pence spent here in the last 12 months, null when it could not be read. */
  rollingSpendPence: number | null
  money: (pence: number) => string
  refresh: () => Promise<void>
}) {
  const brand = business.brand_color || primary
  const programme = PROGRAMMES[programmeIdFor(business)]
  return (
    <View style={styles.how}>
      <Text style={styles.howEyebrow}>HOW IT WORKS</Text>
      <Text style={styles.howTitle}>{programme.name}</Text>
      <Text style={styles.howPitch}>{programme.pitch}</Text>
      {programme.id === 'stamps' ? <StampsHow business={business} membership={membership} catalog={catalog} brand={brand} /> : null}
      {programme.id === 'spend' ? <SpendHow business={business} membership={membership} catalog={catalog} brand={brand} money={money} /> : null}
      {programme.id === 'tiers' ? <TiersHow membership={membership} tiers={tiers} rollingSpendPence={rollingSpendPence} brand={brand} money={money} /> : null}
      {programme.id === 'points' ? <PointsHow business={business} membership={membership} catalog={catalog} brand={brand} refresh={refresh} /> : null}
    </View>
  )
}

function StampsHow({ business, membership, catalog, brand }: { business: HowBusiness; membership: HowMembership; catalog: CatalogRow[]; brand: string }) {
  const unit = business.loyalty_type === 'points' ? 'point' : business.loyalty_type === 'tiered' ? 'visit' : 'stamp'
  const required = Math.max(1, Math.min(20, catalog[0]?.stamp_threshold ?? business.loyalty_config?.stamps_required ?? 10))
  const have = business.loyalty_type === 'points' ? membership?.points_balance ?? 0 : membership?.stamp_count ?? 0
  const reward = catalog[0]?.title ?? 'a reward'
  return (
    <View>
      <View style={styles.stampRow}>
        {Array.from({ length: required }).map((_, i) => {
          const last = i === required - 1
          const filled = i < have
          return (
            <View
              key={i}
              style={[
                styles.stamp,
                filled ? { backgroundColor: brand, borderColor: brand } : last ? { borderColor: brand, borderStyle: 'dashed' } : null,
              ]}
            >
              <Text style={[styles.stampText, filled && { color: readableOn(brand) }]}>{last ? '★' : i + 1}</Text>
            </View>
          )
        })}
      </View>
      <Text style={styles.howLine}>Collect {required} {unit}{required === 1 ? '' : 's'} and get {reward}.</Text>
      {catalog.length > 1 ? (
        <View style={styles.rowList}>
          {catalog.map((reward) => (
            <View key={reward.id} style={styles.listRow}>
              <Text style={styles.listRowStrong}>{reward.stamp_threshold} {unit}{reward.stamp_threshold === 1 ? '' : 's'}</Text>
              <Text style={styles.listRowText}>{reward.title}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function SpendHow({ business, membership, catalog, brand, money }: { business: HowBusiness; membership: HowMembership; catalog: CatalogRow[]; brand: string; money: (pence: number) => string }) {
  const rungs = catalog.filter((r) => (r.spend_threshold_pence ?? 0) > 0).sort((a, b) => (a.spend_threshold_pence as number) - (b.spend_threshold_pence as number))
  const progress = Math.max(0, membership?.reward_progress_pence ?? 0)
  const next = rungs.find((r) => (r.spend_threshold_pence as number) > progress) ?? rungs[rungs.length - 1]
  return (
    <View>
      <View style={styles.rowList}>
        {rungs.map((reward) => {
          const reached = membership && (reward.spend_threshold_pence as number) <= progress
          return (
            <View key={reward.id} style={[styles.listRow, reached && { backgroundColor: brand }]}>
              <Text style={[styles.listRowStrong, reached && { color: readableOn(brand) }]}>Spend {money(reward.spend_threshold_pence as number).replace(/\.00$/, '')}</Text>
              <Text style={[styles.listRowText, reached && { color: readableOn(brand) }]}>{reward.title}</Text>
            </View>
          )
        })}
      </View>
      {membership && next ? (
        <Text style={styles.howLine}>
          {(next.spend_threshold_pence as number) > progress
            ? `Spend ${money((next.spend_threshold_pence as number) - progress)} more to unlock ${next.title}.`
            : 'You have unlocked every reward in this round. A new round starts with your next purchase.'}
        </Text>
      ) : (
        <Text style={styles.howLine}>Staff add what you spend when you pay. Rewards appear in your wallet as you unlock them.</Text>
      )}
    </View>
  )
}

function TiersHow({ membership, tiers, rollingSpendPence, brand, money }: { membership: HowMembership; tiers: TierRow[]; rollingSpendPence: number | null; brand: string; money: (pence: number) => string }) {
  const ladder = tiers.slice().sort((a, b) => a.spend_threshold_pence - b.spend_threshold_pence)
  if (!ladder.length) return <Text style={styles.howLine}>This shop's levels are being set up.</Text>
  // The level comes from the member's own row (current_tier_id, kept by the database).
  // The distance to the next level uses their own spend over the last 12 months, and
  // is only shown when that could be read: no figure is guessed.
  const currentIndex = membership?.current_tier_id ? ladder.findIndex((t) => t.id === membership.current_tier_id) : -1
  const standing = rollingSpendPence != null ? tierStanding(ladder, rollingSpendPence, money) : null
  const next = currentIndex >= 0 ? ladder[currentIndex + 1] ?? null : ladder[0]
  return (
    <View>
      <View style={styles.rowList}>
        {ladder.map((tier, index) => {
          const here = index === currentIndex
          const reached = index <= currentIndex
          const colour = tier.colour || brand
          return (
            <View key={tier.id} style={[styles.tierCard, here && { borderColor: colour, borderWidth: 2 }]}>
              <View style={styles.tierHead}>
                <View style={[styles.tierDot, { backgroundColor: colour }]} />
                <Text style={styles.tierName}>{tier.name}</Text>
                {here ? <View style={[styles.youPill, { backgroundColor: colour }]}><Text style={[styles.youPillText, { color: readableOn(colour) }]}>You are here</Text></View> : null}
                {!here && reached ? <Text style={styles.reachedText}>Reached</Text> : null}
              </View>
              <Text style={styles.tierThreshold}>{tier.spend_threshold_pence === 0 ? 'Everyone starts here' : `Spend ${money(tier.spend_threshold_pence).replace(/\.00$/, '')} in a year`}</Text>
              {tier.perks?.length ? (
                <View style={styles.perkList}>
                  {tier.perks.map((perk) => (
                    <Text key={perk} style={styles.perk}>✓  {perk}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
      {membership ? (
        <Text style={styles.howLine}>
          {!next
            ? 'You are on the top level. Keep it by spending here through the year.'
            : standing && standing.next && standing.toNextPence != null
              ? `Spend ${money(standing.toNextPence)} more to reach ${standing.next.name}.`
              : `Next level: ${next.name}, at ${money(next.spend_threshold_pence).replace(/\.00$/, '')} spent in a year.`}
        </Text>
      ) : (
        <Text style={styles.howLine}>Join, then every purchase counts towards your level for the next 12 months.</Text>
      )}
    </View>
  )
}

function PointsHow({ business, membership, catalog, brand, refresh }: { business: HowBusiness; membership: HowMembership; catalog: CatalogRow[]; brand: string; refresh: () => Promise<void> }) {
  const rewards: PointsReward[] = catalog.filter((r) => (r.points_cost ?? 0) > 0).map((r) => ({ id: r.id, title: r.title, points_cost: r.points_cost as number }))
  const standing = pointsStanding(business, membership?.points_balance ?? 0, rewards)
  const [busyId, setBusyId] = useState<string | null>(null)
  // One id per tap-attempt, reused if the same tap is retried after a dropped
  // connection, so the database can tell a retry from a second redemption.
  const attempt = useRef<{ catalogId: string; ref: string } | null>(null)
  useEffect(() => () => { attempt.current = null }, [business.id])

  async function redeem(reward: PointsReward) {
    if (busyId) return
    if (!attempt.current || attempt.current.catalogId !== reward.id) attempt.current = { catalogId: reward.id, ref: newRef() }
    const { ref } = attempt.current
    setBusyId(reward.id)
    try {
      const { data, error } = await supabase.rpc('redeem_points_reward', { _business_id: business.id, _catalog_id: reward.id, _client_ref: ref })
      if (error) throw error
      attempt.current = null
      await refresh()
      showAlert(
        (data as { status?: string } | null)?.status === 'duplicate' ? 'Already added' : 'Reward ready',
        `${reward.title} is in your Rewards tab. Show it to staff when you pay.`,
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? ''
      if (message.includes('not_enough_points')) {
        attempt.current = null
        await refresh()
        showAlert('Not enough points yet', 'Keep earning, then you can get this reward.')
      } else if (message.includes('not_a_member')) {
        attempt.current = null
        showAlert('Join this card first', 'Tap Join card at the top to start earning points here.')
      } else {
        // Network or unknown: keep the same ref so tapping again is a safe retry.
        showAlert('Could not get the reward', 'Please check your connection and try again. You will not be charged points twice.')
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <View>
      <View style={styles.pointsBox}>
        <Text style={styles.pointsBalance}>{membership ? standing.balance : standing.perPound}</Text>
        <Text style={styles.pointsLabel}>{membership ? (standing.balance === 1 ? 'point' : 'points') : `point${standing.perPound === 1 ? '' : 's'} for every £1`}</Text>
      </View>
      <Text style={styles.howLine}>
        You earn {standing.perPound} point{standing.perPound === 1 ? '' : 's'} for every £1 you spend here.
        {membership && standing.next && standing.toNext != null ? ` ${standing.toNext} more to get ${standing.next.title}.` : ''}
      </Text>
      <View style={styles.rowList}>
        {rewards.map((reward) => {
          const can = Boolean(membership) && standing.balance >= reward.points_cost
          return (
            <View key={reward.id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listRowText}>{reward.title}</Text>
                <Text style={styles.listRowStrong}>{reward.points_cost} points</Text>
              </View>
              {membership ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={!can || busyId !== null}
                  onPress={() => void redeem(reward)}
                  style={({ pressed }) => [styles.getButton, { backgroundColor: can ? brand : pick('#E4E2DA', '#262A28') }, pressed && { opacity: 0.8 }]}
                >
                  <Text style={[styles.getButtonText, { color: can ? readableOn(brand) : pick('#000000', '#7D847E') }]}>{busyId === reward.id ? 'Getting…' : 'Get reward'}</Text>
                </Pressable>
              ) : null}
            </View>
          )
        })}
      </View>
      {!rewards.length ? <Text style={styles.howLine}>This shop's rewards are being set up.</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { backgroundColor: pick('#fff', '#151716'), borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: pick('rgba(0,0,0,0.06)', 'rgba(255,255,255,0.08)'), marginBottom: 16 },
  cover: { height: 150, width: '100%' },
  heroBody: { paddingHorizontal: 18, paddingBottom: 18 },
  logo: { width: 74, height: 74, borderRadius: 24, marginTop: -37, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%' },
  logoLetter: { color: '#fff', fontSize: 30, fontWeight: '800' },
  name: { fontSize: 27, lineHeight: 32, fontWeight: '800', color: pick('#000000', '#9DA49E'), letterSpacing: -0.6, marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: pick('#EDEFE9', '#1F2221'), borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: '700', color: pick('#000000', '#9DA49E') },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  metaText: { fontSize: 14, fontWeight: '800', color: pick('#000000', '#9DA49E') },
  metaLight: { fontWeight: '400' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  statusOpen: { backgroundColor: pick('#DCEBD9', '#1E321A') },
  statusClosed: { backgroundColor: pick('#F8DCD8', '#361B17') },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '800', color: pick('#000000', '#9DA49E') },
  cta: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  ctaText: { fontSize: 16, fontWeight: '900' },

  how: { backgroundColor: pick('#fff', '#151716'), borderRadius: 26, padding: 20, borderWidth: 1, borderColor: pick('rgba(0,0,0,0.06)', 'rgba(255,255,255,0.08)'), marginTop: 24 },
  howEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: pick('#000000', '#9DA49E') },
  howTitle: { fontSize: 22, fontWeight: '800', color: pick('#000000', '#9DA49E'), letterSpacing: -0.4, marginTop: 6 },
  howPitch: { fontSize: 14, lineHeight: 20, color: pick('#000000', '#9DA49E'), marginTop: 4, marginBottom: 16 },
  howLine: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: pick('#000000', '#9DA49E'), marginTop: 14 },
  stampRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stamp: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: pick('rgba(0,0,0,0.15)', 'rgba(255,255,255,0.16)'), alignItems: 'center', justifyContent: 'center' },
  stampText: { fontSize: 14, fontWeight: '800', color: pick('#000000', '#9DA49E') },
  rowList: { gap: 8, marginTop: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: pick('#EDEFE9', '#1F2221'), borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13 },
  listRowStrong: { fontSize: 13, fontWeight: '800', color: pick('#000000', '#9DA49E') },
  listRowText: { fontSize: 15, fontWeight: '700', color: pick('#000000', '#9DA49E'), flexShrink: 1 },
  tierCard: { backgroundColor: pick('#F6F5F0', '#302D1D'), borderRadius: 18, padding: 15, borderWidth: 1, borderColor: pick('rgba(0,0,0,0.06)', 'rgba(255,255,255,0.08)') },
  tierHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tierDot: { width: 14, height: 14, borderRadius: 7 },
  tierName: { fontSize: 17, fontWeight: '800', color: pick('#000000', '#9DA49E'), flex: 1 },
  youPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  youPillText: { fontSize: 11, fontWeight: '900' },
  reachedText: { fontSize: 12, fontWeight: '800', color: pick('#000000', '#9DA49E') },
  tierThreshold: { fontSize: 13, fontWeight: '600', color: pick('#000000', '#9DA49E'), marginTop: 6 },
  perkList: { marginTop: 8, gap: 4 },
  perk: { fontSize: 14, lineHeight: 20, color: pick('#000000', '#9DA49E') },
  pointsBox: { backgroundColor: pick('#FBE7BF', '#362B17'), borderRadius: 20, paddingVertical: 18, alignItems: 'center' },
  pointsBalance: { fontSize: 44, lineHeight: 48, fontWeight: '900', color: pick('#000000', '#9DA49E'), letterSpacing: -1 },
  pointsLabel: { fontSize: 14, fontWeight: '700', color: pick('#000000', '#9DA49E'), marginTop: 2 },
  getButton: { height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  getButtonText: { fontSize: 13, fontWeight: '900' },

  hoursList: { marginTop: 8 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  hoursDay: { fontSize: 14, color: pick('#000000', '#9DA49E') },
  hoursTime: { fontSize: 14, color: pick('#000000', '#9DA49E') },
  hoursToday: { fontWeight: '900' },
})
