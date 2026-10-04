export type HomeShop = {
  id: string; name: string; category?: string | null; description?: string | null;
  address?: string | null; logo_url?: string | null; cover_url?: string | null;
  loyalty_type?: string; loyalty_config?: { stamps_required?: number };
  reward_model?: 'stamp_legacy' | 'spend_threshold'; reward_threshold_pence?: number | null;
}
export type HomeMember = { business_id: string; stamp_count: number; points_balance: number; reward_progress_pence?: number | null; visit_count?: number | null; last_activity_at?: string | null }
export type HomeTier = { business_id: string; title: string; stamp_threshold: number; spend_threshold_pence?: number | null }
const pounds = (value: number) => `£${(value / 100).toFixed(2)}`

// Never invent a reward target when the catalogue is unavailable.
export function homeProgress(shop: HomeShop, member: HomeMember | undefined, catalog: HomeTier[]) {
  const spend = shop.reward_model === 'spend_threshold'
  const unit = shop.loyalty_type === 'points' ? 'points' : shop.loyalty_type === 'tiered' ? 'visits' : 'stamps'
  const value = Math.max(0, spend ? member?.reward_progress_pence ?? 0 : shop.loyalty_type === 'points' ? member?.points_balance ?? 0 : member?.stamp_count ?? 0)
  const tiers = catalog.filter(t => t.business_id === shop.id && (spend ? t.spend_threshold_pence ?? 0 : t.stamp_threshold) > 0)
    .slice().sort((a, b) => (spend ? a.spend_threshold_pence! - b.spend_threshold_pence! : a.stamp_threshold - b.stamp_threshold))
  const tier = tiers.find(t => (spend ? t.spend_threshold_pence! : t.stamp_threshold) > value) ?? tiers[tiers.length - 1]
  const configured = spend ? shop.reward_threshold_pence : shop.loyalty_config?.stamps_required
  const threshold = tier ? (spend ? tier.spend_threshold_pence! : tier.stamp_threshold) : configured && configured > 0 ? configured : null
  return {
    value, threshold, unit, spend, title: tier?.title ?? null,
    label: threshold && value <= threshold ? `${spend ? pounds(value) : value} of ${spend ? pounds(threshold) : `${threshold} ${unit}`}` : `${spend ? pounds(value) : `${value} ${unit}`} collected`,
    offer: tier ? (spend ? `Spend ${pounds(threshold!)} · ${tier.title}` : `${threshold} ${unit} · ${tier.title}`) : 'Explore this shop’s rewards',
    fraction: threshold ? Math.min(1, value / threshold) : 0,
  }
}
