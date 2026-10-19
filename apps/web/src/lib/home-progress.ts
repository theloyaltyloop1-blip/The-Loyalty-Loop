import { progressFor } from '@loyalty-loop/loyalty'
import type { Business, Membership, RewardCatalogItem } from './businesses'

// The calculation lives in @loyalty-loop/loyalty and is shared with the shopper app.
export function getHomeProgress(
  business: Business,
  membership: Membership | undefined,
  catalog: RewardCatalogItem[],
) {
  const { spend, unit, value, threshold, title, label, reward, fraction } = progressFor(business, membership, catalog)
  return { spend, unit, value, target: threshold, title, label, reward, fraction }
}
