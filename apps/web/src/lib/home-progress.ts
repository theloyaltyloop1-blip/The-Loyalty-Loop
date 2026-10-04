import type { Business, Membership, RewardCatalogItem } from './businesses'

const formatPounds = (pence: number) => `£${(pence / 100).toFixed(2)}`

export function getHomeProgress(
  business: Business,
  membership: Membership | undefined,
  catalog: RewardCatalogItem[],
) {
  const spend = business.reward_model === 'spend_threshold'
  const unit = business.loyalty_type === 'points' ? 'points' : business.loyalty_type === 'tiered' ? 'visits' : 'stamps'
  const value = Math.max(0, spend
    ? membership?.reward_progress_pence ?? 0
    : business.loyalty_type === 'points' ? membership?.points_balance ?? 0 : membership?.stamp_count ?? 0)
  const tiers = catalog
    .filter((reward) => reward.business_id === business.id && (spend ? reward.spend_threshold_pence : reward.stamp_threshold) != null && (spend ? reward.spend_threshold_pence! : reward.stamp_threshold) > 0)
    .slice()
    .sort((a, b) => spend
      ? (a.spend_threshold_pence ?? 0) - (b.spend_threshold_pence ?? 0)
      : a.stamp_threshold - b.stamp_threshold)
  const tier = tiers.find((reward) => (spend ? reward.spend_threshold_pence! : reward.stamp_threshold) > value) ?? tiers[tiers.length - 1]
  const configured = spend ? business.reward_threshold_pence : business.loyalty_config?.stamps_required
  const target = tier ? spend ? tier.spend_threshold_pence! : tier.stamp_threshold : configured && configured > 0 ? configured : null
  const amount = (count: number) => spend ? formatPounds(count) : `${count}`
  return {
    spend,
    unit,
    value,
    target,
    title: tier?.title ?? null,
    label: target && value <= target ? `${amount(value)} of ${spend ? formatPounds(target) : `${target} ${unit}`}` : `${spend ? formatPounds(value) : `${value} ${unit}`} collected`,
    reward: tier?.title ?? 'Loyalty card',
    fraction: target ? Math.min(1, value / target) : 0,
  }
}
