import { pointsStanding, progressFor, tierStanding } from '@loyalty-loop/loyalty'

export type HomeShop = {
  id: string; name: string; category?: string | null; description?: string | null;
  address?: string | null; logo_url?: string | null; cover_url?: string | null; brand_color?: string | null;
  loyalty_type?: string; loyalty_config?: { stamps_required?: number; points_per_pound?: number };
  reward_model?: 'stamp_legacy' | 'spend_threshold' | 'tiers' | 'points'; reward_threshold_pence?: number | null;
  country_code?: string | null;
  rating_avg?: number | null; rating_count?: number | null;
}
export type HomeMember = {
  business_id: string; stamp_count: number; points_balance: number; reward_progress_pence?: number | null; visit_count?: number | null; last_activity_at?: string | null;
  /** memberships.current_tier: the level name (tiers shops). */
  current_tier?: string | null;
  /** Spend in the last 12 months, from the customer's own transactions (tiers shops). Null when not loaded. */
  rolling_spend_pence?: number | null;
}
/**
 * One row of the shop's home catalogue. Plain reward rows (stamps and £ spend)
 * have no `kind`. `kind: 'tier'` rows are membership levels (spend_threshold_pence,
 * title = level name); `points_cost` is set on points rewards.
 */
export type HomeTier = {
  business_id: string; title: string; stamp_threshold: number; spend_threshold_pence?: number | null;
  points_cost?: number | null; kind?: 'tier';
}
const pounds = (value: number) => `£${(value / 100).toFixed(2)}`

// The calculation lives in @loyalty-loop/loyalty and is shared with the website.
// Never invents a reward target when the catalogue is unavailable.
// `money` formats minor units in the shop's currency; it defaults to pounds.
export function homeProgress(shop: HomeShop, member: HomeMember | undefined, catalog: HomeTier[], money: (value: number) => string = pounds) {
  if (shop.reward_model === 'tiers') return tierHomeProgress(shop, member, catalog, money)
  if (shop.reward_model === 'points') return pointsHomeProgress(shop, member, catalog)
  const rewards = catalog.filter((row) => !row.kind)
  const { value, threshold, unit, spend, title, label, offer, fraction } = progressFor(shop, member, rewards, money)
  return { value, threshold, unit, spend, title, label, offer, fraction }
}

function tierHomeProgress(shop: HomeShop, member: HomeMember | undefined, catalog: HomeTier[], money: (value: number) => string) {
  const ladder = catalog
    .filter((row) => row.kind === 'tier' && row.business_id === shop.id && (row.spend_threshold_pence ?? 0) > 0)
    .map((row) => ({ name: row.title, spend_threshold_pence: row.spend_threshold_pence as number }))
  const rolling = member?.rolling_spend_pence
  const current = member?.current_tier ?? null
  if (rolling == null || ladder.length === 0) {
    // No distance is guessed when the spend or the levels are unavailable.
    const label = current ? `${current} level` : ladder.length ? 'Membership levels' : 'Membership'
    return { value: 0, threshold: null, unit: 'levels', spend: true, title: current, label, offer: 'See your levels in the shop', fraction: 0 }
  }
  const standing = tierStanding(ladder, rolling, money)
  return {
    value: standing.spendPence,
    threshold: standing.next?.spend_threshold_pence ?? null,
    unit: 'levels',
    spend: true,
    title: standing.next?.name ?? standing.current?.name ?? null,
    label: standing.label,
    offer: standing.next ? `Spend ${money(standing.next.spend_threshold_pence)} a year · ${standing.next.name}` : 'Top level',
    fraction: standing.fraction,
  }
}

function pointsHomeProgress(shop: HomeShop, member: HomeMember | undefined, catalog: HomeTier[]) {
  const rewards = catalog
    .filter((row) => row.business_id === shop.id && (row.points_cost ?? 0) > 0)
    .map((row) => ({ id: `${row.title}-${row.points_cost}`, title: row.title, points_cost: row.points_cost as number }))
  const standing = pointsStanding(shop, member?.points_balance ?? 0, rewards)
  const next = standing.next
  return {
    value: standing.balance,
    threshold: next ? next.points_cost : null,
    unit: 'points',
    spend: false,
    title: next?.title ?? standing.affordable[0]?.title ?? null,
    label: standing.label,
    offer: next ? `${next.points_cost} points · ${next.title}` : standing.affordable.length ? 'Rewards ready to swap' : 'Points rewards',
    fraction: standing.fraction,
  }
}
